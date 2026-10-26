import {
	REACTION,
	type ReactionState,
	reactionAverage,
	reactionPress,
	reactionScore,
	reactionSignals,
	reactionStart,
	trialAt,
} from "../../domain/games/reaction";
import { arcade } from "../arcade-sound";
import { type Bitmap, blit, dither, line, rect, scale } from "../pixel/bitmap";
import { BIG, label, SMALL, text } from "../pixel/font";
import { C } from "../pixel/palette";
import { buzz } from "../sound";
import { CACTUS, type Cowboy, MUZZLE, PLAYER, type Pose, RIVAL, TUMBLEWEED } from "./art/duel";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 80;
const H = 72;
const HORIZON = 34;
const FEET_Y = 63;
const PLAYER_X = 6;
const RIVAL_X = W - 6 - RIVAL.stand.w;
/** 결과 장면을 다음 회차 기다리는 동안에도 이만큼 더 보여준다 */
const LINGER_MS = 1200;
/** 신호가 뜬 뒤 이만큼 지나면 상대가 총을 뽑는다(긴장감) */
const RIVAL_DRAW_MS = 600;

const FIRE_TEXT = scale(label(BIG, "FIRE!", C.y, C.k), 2);
const WAIT_TEXT = label(BIG, "WAIT...", C.a, C.k);
const FOUL_TEXT = label(BIG, "FOUL!", C.p, C.k);
const MISS_TEXT = label(BIG, "MISS!", C.p, C.k);
const END_TEXT = label(BIG, "END", C.y, C.k);

type Mode = "ready" | "wait" | "fire" | "hit" | "foul" | "miss" | "end";
type Scene = { readonly mode: Mode; readonly trial: number; readonly since: number };

const seconds = (ms: number) => (ms / 1000).toFixed(3);

export const mountReaction: MountGame = (stage, seed) => {
	const signals = reactionSignals(seed);
	const kit = mountKit(stage, W, H, C.N);
	let state: ReactionState = reactionStart(signals.length);
	/** 회차마다 받아들인 입력 시각(게임 시간) */
	let presses: readonly (number | null)[] = signals.map(() => null);
	let firedFor = -1;
	let missedFor = -1;

	const signalAt = (trial: number) => signals[trial] ?? 0;
	const windowEnd = (trial: number) => signalAt(trial) + REACTION.windowMs;

	/** 회차 결과 장면(입력이 있었으면 명중·실격, 없었으면 놓침) */
	function resultOf(trial: number, t: number): Scene {
		const pressedAt = presses[trial] ?? null;
		if (state.results[trial] === null || pressedAt === null) return { mode: "miss", trial, since: t - windowEnd(trial) };
		return { mode: pressedAt < signalAt(trial) ? "foul" : "hit", trial, since: t - pressedAt };
	}

	function sceneAt(t: number | null): Scene {
		if (t === null || t < 0) return { mode: "ready", trial: 0, since: 0 };
		const trial = trialAt(signals, t);
		if (trial === null) return t < windowEnd(signals.length - 1) + LINGER_MS ? resultOf(signals.length - 1, t) : { mode: "end", trial: signals.length, since: 0 };
		if (trial > 0 && t < windowEnd(trial - 1) + LINGER_MS && t < signalAt(trial)) return resultOf(trial - 1, t);
		if (state.results[trial] !== null) return resultOf(trial, t);
		return t < signalAt(trial) ? { mode: "wait", trial, since: 0 } : { mode: "fire", trial, since: t - signalAt(trial) };
	}

	function drawSky(scene: Scene): void {
		const fb = kit.fb;
		if (scene.mode === "fire") {
			rect(fb, 0, 0, W, HORIZON, scene.since < 70 ? C.w : C.r);
			dither(fb, 0, HORIZON - 6, W, 6, C.r, C.o, 2);
			return;
		}
		rect(fb, 0, 0, W, 10, C.N);
		dither(fb, 0, 10, W, 3, C.N, C.v, 2);
		rect(fb, 0, 13, W, 6, C.v);
		dither(fb, 0, 19, W, 3, C.v, C.m, 2);
		rect(fb, 0, 22, W, 4, C.m);
		dither(fb, 0, 26, W, 3, C.m, C.p, 2);
		rect(fb, 0, 29, W, 3, C.p);
		dither(fb, 0, 32, W, 2, C.p, C.o, 2);
		// 지는 해
		for (let y = 0; y < 9; y++) {
			const half = Math.round(Math.sqrt(81 - (9 - y) ** 2));
			rect(fb, 40 - half, HORIZON - 9 + y, half * 2, 1, y < 2 ? C.o : C.y);
		}
	}

	function drawLand(now: number, scene: Scene): void {
		const fb = kit.fb;
		// 먼 언덕
		for (let x = 0; x < W; x++) {
			const left = x < 22 ? 4 + Math.round(Math.sin(x / 5) * 1.5) : 0;
			const right = x > 54 ? 5 + Math.round(Math.cos(x / 4) * 1.5) : 0;
			const height = Math.max(left, right);
			if (height > 0) rect(fb, x, HORIZON - height, 1, height, C.T);
		}
		rect(fb, 0, HORIZON, W, H - HORIZON, C.O);
		dither(fb, 0, HORIZON, W, 3, C.T, C.O, 2);
		dither(fb, 0, HORIZON + 10, W, 4, C.O, C.o, 1);
		rect(fb, 0, HORIZON + 14, W, H - HORIZON - 14, C.o);
		for (let x = 4; x < W; x += 11) rect(fb, x, HORIZON + 18 + (x % 3), 4, 1, C.O);
		// 앞쪽 돌멩이와 마른 풀
		for (const [x, y] of [[14, 67], [38, 69], [63, 66], [72, 70]] as const) {
			rect(fb, x, y, 4, 2, C.T);
			rect(fb, x + 1, y - 1, 2, 1, C.t);
		}
		for (const x of [5, 29, 52, 77]) rect(fb, x, H - 3, 1, 2, C.Y);
		blit(fb, CACTUS, 27, HORIZON - 5);
		blit(fb, CACTUS, 47, HORIZON - 4);
		// 기다리는 동안 마른 덤불이 굴러간다
		if (scene.mode === "wait") {
			const roll = (now / 28) % (W + 40);
			const frame = TUMBLEWEED[Math.floor(now / 120) % TUMBLEWEED.length];
			if (frame !== undefined) blit(fb, frame, W + 10 - roll, FEET_Y - 5 - (Math.floor(now / 200) % 2));
		}
	}

	function drawCowboy(cowboy: Cowboy, x: number, pose: Pose, facingLeft: boolean): void {
		const art = cowboy[pose];
		if (pose === "down") {
			blit(kit.fb, art, facingLeft ? W - 3 - art.w : 3, FEET_Y - art.h);
			return;
		}
		blit(kit.fb, art, x, FEET_Y - art.h);
	}

	/** 총을 쏜 쪽에서 맞은 쪽으로 총알 줄기와 불꽃 */
	function drawShot(fromPlayer: boolean, since: number): void {
		if (since > 140) return;
		const fb = kit.fb;
		const gunY = FEET_Y - PLAYER.aim.h + 10;
		const fromX = fromPlayer ? PLAYER_X + PLAYER.aim.w : RIVAL_X - 1;
		const toX = fromPlayer ? RIVAL_X + 4 : PLAYER_X + 10;
		blit(fb, MUZZLE, fromPlayer ? fromX - 1 : fromX - MUZZLE.w + 1, gunY - 2);
		if (since < 70) line(fb, fromX, gunY, toX, gunY, C.w);
	}

	function drawTracker(now: number, scene: Scene): void {
		const fb = kit.fb;
		const t = kit.gameTime(now) ?? 0;
		signals.forEach((_, i) => {
			const x = 3 + i * 15;
			const current = i === scene.trial && (scene.mode === "wait" || scene.mode === "fire");
			const edge = current && Math.floor(now / 250) % 2 === 0 ? C.y : C.k;
			rect(fb, x, 1, 14, 9, edge);
			rect(fb, x + 1, 2, 12, 7, C.n);
			const record = state.results[i] ?? null;
			const missed = record === null && t > windowEnd(i);
			const mark =
				record !== null && record < REACTION.penaltyMs
					? text(SMALL, String(record).padStart(3, "0"), C.l)
					: record !== null || missed
						? text(SMALL, "x", C.p)
						: text(SMALL, String(i + 1), C.A);
			blit(fb, mark, x + 7 - Math.floor(mark.w / 2), 3);
		});
	}

	function drawCenterText(now: number, scene: Scene): void {
		const fb = kit.fb;
		const center = (art: Bitmap, y: number) => blit(fb, art, Math.floor((W - art.w) / 2), y);
		switch (scene.mode) {
			case "wait":
				if (Math.floor(now / 500) % 2 === 0) center(WAIT_TEXT, 14);
				return;
			case "fire":
				center(FIRE_TEXT, 13);
				return;
			case "hit": {
				const record = state.results[scene.trial] ?? 0;
				center(label(BIG, seconds(record), C.l, C.k), 15);
				return;
			}
			case "foul":
				center(FOUL_TEXT, 15);
				return;
			case "miss":
				center(MISS_TEXT, 15);
				return;
			case "end":
				center(END_TEXT, 13);
				center(label(BIG, seconds(reactionAverage(state)), C.y, C.k), 23);
				return;
			case "ready":
				return;
		}
	}

	function updateHint(scene: Scene): void {
		switch (scene.mode) {
			case "ready":
				return kit.setHint("하늘이 빨개지며 FIRE!(쏴!)가 뜨면 아무 버튼이나 빨리! 미리 누르면 실격");
			case "wait":
				return kit.setHint("기다려…");
			case "fire":
				return kit.setHint("쏴!", "good");
			case "hit":
				return kit.setHint(`명중! ${seconds(state.results[scene.trial] ?? 0)}초`, "good");
			case "foul":
				return kit.setHint("너무 빨랐어요! 이번 판 실격", "bad");
			case "miss":
				return kit.setHint("늦었어요!", "bad");
			case "end":
				return kit.setHint(`끝! 평균 ${seconds(reactionAverage(state))}초`);
		}
	}

	/** 신호가 뜬 순간·놓친 순간에 소리를 한 번만 낸다 */
	function cue(scene: Scene): void {
		if (scene.mode === "fire" && firedFor !== scene.trial) {
			firedFor = scene.trial;
			arcade.fire();
			buzz(40);
		}
		if (scene.mode === "miss" && missedFor !== scene.trial) {
			missedFor = scene.trial;
			arcade.gun();
			buzz(150);
			kit.shake(2, 250);
		}
	}

	kit.run((now) => {
		const scene = sceneAt(kit.gameTime(now));
		drawSky(scene);
		drawLand(now, scene);
		const playerPose: Pose = scene.mode === "miss" ? "down" : scene.mode === "hit" || scene.mode === "foul" ? "aim" : "stand";
		const rivalPose: Pose =
			scene.mode === "hit" && scene.since > 60 ? "down" : scene.mode === "miss" || (scene.mode === "fire" && scene.since > RIVAL_DRAW_MS) ? "aim" : "stand";
		drawCowboy(PLAYER, PLAYER_X, playerPose, false);
		drawCowboy(RIVAL, RIVAL_X, rivalPose, true);
		if (scene.mode === "hit") drawShot(true, scene.since);
		if (scene.mode === "miss") drawShot(false, scene.since);
		drawTracker(now, scene);
		drawCenterText(now, scene);
		updateHint(scene);
		cue(scene);
	});

	return {
		labels: {
			red: { text: "쏴!", enabled: true },
			green: { text: "쏴!", enabled: true },
			blue: { text: "쏴!", enabled: true },
			finish: { text: "쏴!", enabled: true },
		},
		press(_button, t) {
			const before = state;
			state = reactionPress(state, signals, t);
			if (state === before) return;
			const trial = state.results.findIndex((record, i) => record !== before.results[i]);
			presses = presses.map((at, i) => (i === trial ? t : at));
			const early = t < signalAt(trial);
			if (early || (state.results[trial] ?? REACTION.penaltyMs) >= REACTION.penaltyMs) {
				arcade.wrong();
				buzz(150);
			} else {
				arcade.gun();
				kit.shake(1, 150);
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => reactionScore(state),
	};
};
