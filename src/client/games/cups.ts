import {
	ballSpot,
	CUPS,
	CUPS_START,
	type CupRound,
	type CupsState,
	cupRounds,
	cupsPress,
	cupsScore,
	type Spot,
} from "../../domain/games/cups";
import { arcade } from "../arcade-sound";
import { blit, dither, rect } from "../pixel/bitmap";
import { BIG, cachedLabel } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { BALL, CUP } from "./art/cups";
import { CHECK, CROSS } from "./art/common";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
/** 컵 자리 가운데: 왼쪽 빨강 · 가운데 초록 · 오른쪽 파랑(패드 버튼 자리와 같다) */
const SPOT_X: Readonly<Record<Spot, number>> = { 0: 14, 1: 32, 2: 50 };
const SPOT_COLOR: Readonly<Record<Spot, readonly [number, number]>> = { 0: [C.r, C.R], 1: [C.g, C.G], 2: [C.b, C.B] };
const SPOTS: readonly Spot[] = [0, 1, 2];
/** 컵 입구(맨 아래 줄) 높이와 들어 올리는 높이 */
const CUP_BOTTOM = 47;
const LIFT = 12;
const FELT_Y = 20;
const EDGE_Y = 52;

/** 시각 t의 장면 */
type Scene =
	| { readonly kind: "idle" }
	| { readonly kind: "reveal"; readonly round: CupRound; readonly local: number }
	| { readonly kind: "shuffle"; readonly round: CupRound; readonly index: number; readonly p: number }
	| { readonly kind: "choose"; readonly round: CupRound }
	| { readonly kind: "result"; readonly round: CupRound; readonly spot: Spot; readonly hit: boolean; readonly since: number };

const smooth = (p: number) => p * p * (3 - 2 * p);

export const mountCups: MountGame = (stage, seed) => {
	const rounds = cupRounds(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: CupsState = CUPS_START;
	let pressedAt: Readonly<Record<Spot, number>> = { 0: -1e9, 1: -1e9, 2: -1e9 };
	/** 컵을 들 때와 섞을 때 소리를 한 번만 내려고 마지막 장면을 기억한다 */
	let cueKey = "";

	function sceneAt(t: number | null): Scene {
		if (t === null) return { kind: "idle" };
		const previous = rounds[state.round - 1];
		if (state.event !== null && previous !== undefined && t < state.roundAt) {
			return { kind: "result", round: previous, spot: state.event.spot, hit: state.event.kind === "hit", since: t - state.event.at };
		}
		const round = rounds[state.round];
		if (round === undefined || t < state.roundAt) return { kind: "idle" };
		const local = t - state.roundAt;
		if (local < CUPS.revealMs) return { kind: "reveal", round, local };
		const index = Math.floor((local - CUPS.revealMs) / round.swapMs);
		if (index >= round.swaps.length) return { kind: "choose", round };
		return { kind: "shuffle", round, index, p: (local - CUPS.revealMs - index * round.swapMs) / round.swapMs };
	}

	function drawTable(now: number, scene: Scene): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, FELT_Y, C.n);
		dither(fb, 0, FELT_Y - 4, W, 4, C.n, C.N, 2);
		rect(fb, 0, FELT_Y, W, EDGE_Y - FELT_Y, C.G);
		dither(fb, 0, FELT_Y, W, EDGE_Y - FELT_Y, C.G, C.g, 1);
		rect(fb, 0, FELT_Y, W, 1, C.g);
		rect(fb, 0, EDGE_Y, W, H - EDGE_Y, C.t);
		rect(fb, 0, EDGE_Y, W, 1, C.o);
		rect(fb, 0, EDGE_Y + 1, W, 1, C.T);
		// 컵 자리 표시판(버튼 색). 고를 때는 깜빡이고, 누르면 노랗게
		const blink = scene.kind === "choose" && Math.floor(now / 250) % 2 === 0;
		for (const spot of SPOTS) {
			const [color, dark] = SPOT_COLOR[spot];
			const lit = now - pressedAt[spot] < 150;
			const x = SPOT_X[spot] - 5;
			rect(fb, x, EDGE_Y + 3, 11, 6, C.k);
			rect(fb, x + 1, EDGE_Y + 3, 9, 4, lit ? C.y : blink ? C.w : color);
			rect(fb, x + 1, EDGE_Y + 6, 9, 1, lit ? C.Y : dark);
		}
	}

	function drawCup(x: number, lift: number, shadow = true): void {
		const fb = kit.fb;
		if (shadow) rect(fb, Math.round(x) - 6, CUP_BOTTOM + 1, 13, 1, C.k);
		blit(fb, CUP, Math.round(x) - Math.floor(CUP.w / 2), CUP_BOTTOM - CUP.h + 1 - Math.round(lift));
	}

	function drawBall(spot: Spot): void {
		blit(kit.fb, BALL, SPOT_X[spot] - Math.floor(BALL.w / 2), CUP_BOTTOM - BALL.h + 1);
	}

	function drawCups(scene: Scene): void {
		switch (scene.kind) {
			case "idle":
			case "choose":
				for (const spot of SPOTS) drawCup(SPOT_X[spot], 0);
				return;
			case "reveal": {
				// 0.15초 동안 들고, 0.6초까지 보여준 뒤 덮는다
				const { local } = scene;
				const up = local < 150 ? smooth(local / 150) : local < 600 ? 1 : 1 - smooth((local - 600) / (CUPS.revealMs - 600));
				drawBall(scene.round.start);
				for (const spot of SPOTS) drawCup(SPOT_X[spot], spot === scene.round.start ? up * LIFT : 0);
				return;
			}
			case "shuffle": {
				// 바꾸는 두 컵: 한 컵은 뒤로(위로) 돌고 한 컵은 앞으로(아래로) 돈다
				const [a, b] = scene.round.swaps[scene.index] ?? [0, 1];
				const still = SPOTS.find((spot) => spot !== a && spot !== b) ?? 2;
				const e = smooth(scene.p);
				const arc = Math.sin(scene.p * Math.PI);
				drawCup(SPOT_X[still], 0);
				drawCup(SPOT_X[a] + (SPOT_X[b] - SPOT_X[a]) * e, arc * 4, false);
				drawCup(SPOT_X[b] + (SPOT_X[a] - SPOT_X[b]) * e, -arc * 2, false);
				return;
			}
			case "result": {
				// 0.12초 동안 들고, 다음 판 직전 0.15초 동안 내려놓는다(판이 바뀔 때 컵이 한 번에 떨어지지 않게)
				const rise = smooth(Math.min(1, scene.since / 120));
				const fall = smooth(Math.min(1, Math.max(0, CUPS.resultMs - scene.since) / 150));
				const up = Math.min(rise, fall);
				drawBall(ballSpot(scene.round));
				for (const spot of SPOTS) drawCup(SPOT_X[spot], up * LIFT);
				return;
			}
		}
	}

	function drawCount(): void {
		const count = cachedLabel(BIG, String(state.correct), C.y, C.k);
		const x = Math.floor((W - CHECK.w - 2 - count.w) / 2);
		blit(kit.fb, CHECK, x, 4);
		blit(kit.fb, count, x + CHECK.w + 2, 3);
	}

	function updateHint(scene: Scene, t: number | null): void {
		if (t !== null && t >= CUPS.durationMs) return kit.setHint(`끝! ${state.correct}판`);
		switch (scene.kind) {
			case "idle":
				return kit.setHint("공이 숨는 컵을 눈으로 따라가요");
			case "reveal":
				return kit.setHint("공 위치를 잘 봐요");
			case "shuffle":
				return kit.setHint("눈 떼지 마요!");
			case "choose":
				return kit.setHint("공이 든 컵은? ◀빨강 ▼초록 ▶파랑", "good");
			case "result":
				return scene.hit ? kit.setHint("맞았어요!", "good") : kit.setHint("틀렸어요! 공은 여기", "bad");
		}
	}

	/** 컵을 드는 순간과 컵을 바꿀 때마다 소리를 한 번 낸다 */
	function cue(scene: Scene): void {
		const key = scene.kind === "reveal" ? `${state.round}:reveal` : scene.kind === "shuffle" ? `${state.round}:${scene.index}` : "";
		if (key === "" || key === cueKey) return;
		cueKey = key;
		if (scene.kind === "reveal") arcade.reveal();
		else arcade.whoosh();
	}

	kit.run((now) => {
		// 시간이 끝나면 장면도 멈춘다
		const elapsed = kit.gameTime(now);
		const t = elapsed === null ? null : Math.min(elapsed, CUPS.durationMs);
		const scene = sceneAt(t);
		drawTable(now, scene);
		drawCups(scene);
		drawCount();
		updateHint(scene, t);
		cue(scene);
	});

	return {
		labels: {
			red: { text: "◀", enabled: true },
			green: { text: "▼", enabled: true },
			blue: { text: "▶", enabled: true },
			finish: { text: "", enabled: false },
		},
		press(button, t) {
			const before = state;
			state = cupsPress(state, rounds, button, t);
			const event = state.event;
			if (state === before || event === null) return;
			const now = performance.now();
			pressedAt = { ...pressedAt, [event.spot]: now };
			const x = SPOT_X[event.spot];
			if (event.kind === "hit") {
				kit.popup(CHECK, x, CUP_BOTTOM - CUP.h - LIFT - 3, 700, 4, "mark");
				kit.emit(sparkle(x, CUP_BOTTOM - 3, [C.y, C.w, C.l], Math.random, 10, 45, 420));
				arcade.ding();
			} else {
				kit.popup(CROSS, x, CUP_BOTTOM - CUP.h - LIFT - 3, 700, 0, "mark");
				kit.shake(1, 200);
				arcade.wrong();
				buzz(120);
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => cupsScore(state),
	};
};
