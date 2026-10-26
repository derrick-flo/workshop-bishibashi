import { currentDirection, EYE, EYE_START, type EyeState, eyeDirections, eyePress, eyeScore } from "../../domain/games/eye";
import { arcade } from "../arcade-sound";
import { blit, rect } from "../pixel/bitmap";
import { BIG, cachedLabel } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { CHECK, CROSS } from "./art/common";
import { EYE_OPEN, EYE_SHUT, landoltRing, ringDiameter } from "./art/eye";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
/** 시력검사판(흰 판) */
const PANEL = { x: 7, y: 3, w: 50, h: 46 } as const;
const CENTER_X = PANEL.x + PANEL.w / 2;
const CENTER_Y = PANEL.y + PANEL.h / 2;

export const mountEye: MountGame = (stage, seed) => {
	const directions = eyeDirections(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: EyeState = EYE_START;
	let hitAt = Number.NEGATIVE_INFINITY;
	let missAt = Number.NEGATIVE_INFINITY;

	function drawWall(): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, H, C.N);
		for (let y = 7; y < H; y += 8) rect(fb, 0, y, W, 1, C.v);
		for (let x = 3; x < W; x += 8) rect(fb, x, 0, 1, H, C.v);
	}

	function drawPanel(now: number): void {
		const fb = kit.fb;
		const locked = (kit.gameTime(now) ?? 0) < state.lockedUntil;
		const justHit = now - hitAt < 160;
		const edge = locked ? C.r : justHit ? C.g : C.k;
		const shake = locked && now - missAt < 260 ? (Math.floor(now / 35) % 2 === 0 ? -1 : 1) : 0;
		const x = PANEL.x + shake;
		rect(fb, x - 1, PANEL.y - 1, PANEL.w + 2, PANEL.h + 2, edge);
		rect(fb, x, PANEL.y, PANEL.w, PANEL.h, edge === C.k ? C.k : edge);
		rect(fb, x + 2, PANEL.y + 2, PANEL.w - 4, PANEL.h - 4, C.w);
		rect(fb, x + 2, PANEL.y + PANEL.h - 3, PANEL.w - 4, 1, C.W);
		// 고리. 새 문제가 뜬 직후 한순간 회색으로 보였다가 또렷해진다
		const diameter = ringDiameter(state.index);
		const color = now - hitAt < 70 ? C.a : C.k;
		const ringArt = landoltRing(diameter, currentDirection(state, directions), color);
		blit(fb, ringArt, Math.round(CENTER_X - diameter / 2) + shake, Math.round(CENTER_Y - diameter / 2));
		if (locked) blit(fb, CROSS, Math.round(CENTER_X - CROSS.w / 2) + shake, Math.round(CENTER_Y - CROSS.h / 2));
	}

	function drawFooter(now: number): void {
		const fb = kit.fb;
		const t = kit.gameTime(now) ?? 0;
		// 틀리면 잠깐 멈추는 시간이 줄어드는 막대
		if (t < state.lockedUntil) {
			const left = (state.lockedUntil - t) / EYE.lockMs;
			rect(fb, PANEL.x, 52, PANEL.w, 3, C.k);
			rect(fb, PANEL.x + 1, 53, Math.round((PANEL.w - 2) * left), 1, C.r);
		}
		// 깜빡이는 눈과 맞힌 개수
		const blink = Math.floor(now / 160) % 20 === 0;
		blit(fb, blink ? EYE_SHUT : EYE_OPEN, 4, 56);
		blit(fb, CHECK, W - 30, 56);
		const count = cachedLabel(BIG, String(state.correct), C.y, C.k);
		blit(fb, count, W - 4 - count.w, 55);
	}

	function updateHint(now: number): void {
		const t = kit.gameTime(now);
		if (t === null) return kit.setHint("뚫린 쪽! ←빨강 ↑초록 →파랑 ↓FINISH");
		if (t < state.lockedUntil) return kit.setHint("틀렸어요! 잠깐 멈춤", "bad");
		kit.setHint("뚫린 쪽을 눌러요");
	}

	kit.run((now) => {
		drawWall();
		drawPanel(now);
		drawFooter(now);
		updateHint(now);
	});

	return {
		labels: {
			red: { text: "←", enabled: true },
			green: { text: "↑", enabled: true },
			blue: { text: "→", enabled: true },
			finish: { text: "↓", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = eyePress(state, directions, button, t);
			if (state === before) return;
			const now = performance.now();
			if (state.event?.kind === "miss") {
				missAt = now;
				kit.shake(1, 200);
				arcade.wrong();
				buzz(120);
			} else {
				hitAt = now;
				kit.emit(sparkle(CENTER_X, CENTER_Y, [C.y, C.g, C.l], Math.random, 8, 40, 380));
				arcade.ding();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => eyeScore(state),
	};
};
