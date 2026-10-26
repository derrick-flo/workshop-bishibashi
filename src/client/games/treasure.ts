import {
	bombDepths,
	goldAt,
	TREASURE,
	TREASURE_START,
	type TreasureState,
	treasurePress,
	treasureScore,
} from "../../domain/games/treasure";
import { arcade } from "../arcade-sound";
import { blit, blitAs, dither, plot, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label, SMALL } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { BAG, CHEST, MINER, NUGGET } from "./art/treasure";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
/** 땅 위(구덩이 입구) 높이와 한 칸 팔 때 내려가는 칸 수 */
const SURFACE_Y = 15;
const DEPTH_PX = 5;
const HOLE_X = 32;
/** 땅속 층: 시작 높이와 색 */
const LAYERS: readonly (readonly [number, number])[] = [
	[SURFACE_Y, C.t],
	[27, C.T],
	[39, C.O],
	[50, C.A],
];
/** 땅속에 박힌 돌과 금 조각(장식) */
const SPECKS: readonly (readonly [number, number, number])[] = [
	[6, 20, C.a],
	[52, 23, C.y],
	[14, 31, C.A],
	[57, 34, C.a],
	[9, 43, C.y],
	[46, 45, C.k],
	[20, 55, C.a],
	[55, 58, C.y],
	[4, 60, C.k],
];

const BOOM_TEXT = label(BIG, "BOOM!", C.y, C.k);

export const mountTreasure: MountGame = (stage, seed) => {
	const bombs = bombDepths(seed);
	const kit = mountKit(stage, W, H, C.c);
	let state: TreasureState = TREASURE_START;
	/** 마지막으로 파거나 넣거나 폭탄이 터진 화면 시각 */
	let actedAt = Number.NEGATIVE_INFINITY;
	/** 광부가 서 있는 깊이를 부드럽게 따라간다 */
	let shownDepth = 0;

	const feetY = (depth: number) => SURFACE_Y + Math.round(depth * DEPTH_PX);

	function drawGround(): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, SURFACE_Y, C.c);
		dither(fb, 0, SURFACE_Y - 4, W, 4, C.c, C.W, 1);
		for (const [y, color] of LAYERS) rect(fb, 0, y, W, H - y, color);
		rect(fb, 0, SURFACE_Y, W, 1, C.g);
		rect(fb, 0, SURFACE_Y + 1, W, 1, C.G);
		for (const [x, y, color] of SPECKS) {
			rect(fb, x, y, 2, 1, color);
			plot(fb, x + 1, y - 1, color);
		}
	}

	const stunned = (t: number) => state.event?.kind === "bomb" && t < state.busyUntil;

	/** 지금 구덩이: 판 깊이만큼 어둡게 파이고, 벽에 다음 칸에서 나올 금을 적는다 */
	function drawHole(t: number): void {
		const fb = kit.fb;
		const bottom = feetY(shownDepth);
		if (bottom > SURFACE_Y) {
			rect(fb, HOLE_X - 7, SURFACE_Y, 15, bottom - SURFACE_Y + 1, C.k);
			rect(fb, HOLE_X - 6, SURFACE_Y, 13, bottom - SURFACE_Y, C.n);
		}
		if (stunned(t) || state.depth === 0) return;
		const next = cachedLabel(SMALL, `+${goldAt(state.depth + 1)}`, C.y, C.k);
		blit(fb, next, HOLE_X + 9, feetY(state.depth) - 6);
	}

	function drawMiner(now: number, t: number): void {
		const fb = kit.fb;
		const swing = state.event?.kind === "dig" && now - actedAt < 150;
		const art = swing ? MINER.down : MINER.up;
		const x = HOLE_X - 6;
		const y = feetY(shownDepth) - art.h + 1;
		if (!stunned(t)) return blit(fb, art, x, y);
		// 폭탄 뒤: 그을린 채 머리 위로 별이 돈다
		blitAs(fb, art, x, y, C.A);
		for (let i = 0; i < 3; i++) {
			const a = now / 130 + (i * Math.PI * 2) / 3;
			plot(fb, HOLE_X + Math.cos(a) * 5, y + 1 + Math.sin(a) * 1.5, C.y);
		}
	}

	function drawHud(): void {
		const fb = kit.fb;
		blit(fb, BAG, 2, 3);
		blit(fb, cachedLabel(BIG, String(state.bag), C.y, C.k), 11, 2);
		const vault = cachedLabel(BIG, String(state.vault), C.w, C.k);
		blit(fb, CHEST, W - 2 - CHEST.w, 3);
		blit(fb, vault, W - 4 - CHEST.w - vault.w, 2);
	}

	function updateHint(now: number, t: number | null): void {
		if (t === null) return kit.setHint("빨강·초록·파랑으로 파고, FINISH로 금고에!");
		if (t >= TREASURE.durationMs) return kit.setHint(`끝! ${state.vault}골드`);
		const event = state.event;
		if (event?.kind === "bomb" && t < state.busyUntil) return kit.setHint(event.gold > 0 ? `펑! 금 ${event.gold}개가 날아갔어요` : "펑! 폭탄이었어요", "bad");
		if (event?.kind === "bank" && now - actedAt < 800) return kit.setHint(`금고에 +${event.gold}!`, "good");
		if (state.bag === 0) return kit.setHint("파면 금! 깊을수록 많지만 폭탄 조심");
		kit.setHint(`가방 ${state.bag} · 다음 칸 +${goldAt(state.depth + 1)} · 챙기려면 FINISH`);
	}

	kit.run((now, dt) => {
		const elapsed = kit.gameTime(now);
		const t = elapsed === null ? null : Math.min(elapsed, TREASURE.durationMs);
		shownDepth += (state.depth - shownDepth) * Math.min(1, dt / 60);
		if (Math.abs(state.depth - shownDepth) < 0.05) shownDepth = state.depth;
		drawGround();
		drawHole(t ?? 0);
		drawMiner(now, t ?? 0);
		drawHud();
		updateHint(now, t);
	});

	return {
		labels: {
			red: { text: "파기", enabled: true },
			green: { text: "파기", enabled: true },
			blue: { text: "파기", enabled: true },
			finish: { text: "챙기기", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = treasurePress(state, bombs, button, t);
			const event = state.event;
			if (state === before || event === null) return;
			const now = performance.now();
			actedAt = now;
			if (event.kind === "dig") {
				kit.emit(sparkle(HOLE_X + 4, feetY(state.depth), [C.t, C.T, C.O], Math.random, 6, 30, 300));
				kit.popup(NUGGET, HOLE_X + 4, feetY(state.depth) - 3, 450, 6, "nugget");
				kit.popup(cachedLabel(BIG, `+${event.gold}`, C.y, C.k), HOLE_X - 15, feetY(state.depth) + 2, 600, 3, "bag");
				arcade.dig(event.gold);
			} else if (event.kind === "bomb") {
				shownDepth = 0;
				kit.emit(sparkle(HOLE_X, feetY(before.depth) - 6, [C.o, C.y, C.r, C.w], Math.random, 28, 75, 700));
				kit.popup(BOOM_TEXT, W / 2, 28, 900, 6);
				if (event.gold > 0) kit.popup(cachedLabel(BIG, `-${event.gold}`, C.p, C.k), 10, 22, 900, 4, "bag");
				kit.flash(C.w, 60);
				kit.shake(3, 400);
				arcade.pop();
				buzz(200);
			} else {
				kit.emit(sparkle(W - 2 - CHEST.w / 2, 6, [C.y, C.w, C.o], Math.random, 14, 45, 520));
				const gain = cachedLabel(BIG, `+${event.gold}`, C.y, C.k);
				kit.popup(gain, Math.min(W - 9, W - Math.ceil(gain.w / 2)), 22, 800, 4, "vault");
				arcade.jar();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => treasureScore(state),
	};
};
