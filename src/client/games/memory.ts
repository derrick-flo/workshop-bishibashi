import { BUTTONS, type Button } from "../../domain/games/button";
import {
	inputFrom,
	MEMORY,
	MEMORY_START,
	type MemoryState,
	memoryPress,
	memoryScore,
	memorySequence,
	shownAt,
} from "../../domain/games/memory";
import { arcade } from "../arcade-sound";
import { type Bitmap, blit, blitAs, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { CHECK, CROSS, MARK } from "./art/common";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;

type Pad = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly on: number; readonly off: number };

/** 화면의 칸은 폰 버튼과 같은 자리: 위에 빨강·초록·파랑, 아래에 넓은 노랑(FINISH) */
const PADS: Readonly<Record<Button, Pad>> = {
	red: { x: 3, y: 12, w: 18, h: 18, on: C.r, off: C.R },
	green: { x: 23, y: 12, w: 18, h: 18, on: C.g, off: C.G },
	blue: { x: 43, y: 12, w: 18, h: 18, on: C.b, off: C.B },
	finish: { x: 3, y: 33, w: 58, h: 11, on: C.y, off: C.Y },
};
const SLOT_Y = 48;
/** 누른 칸이 켜져 있는 시간 */
const PRESS_LIT_MS = 160;

const READY_TEXT = label(BIG, "READY", C.a, C.k);
const LOOK_TEXT = label(BIG, "LOOK", C.y, C.k);
const GO_TEXT = label(BIG, "GO!", C.l, C.k);
const GOOD_TEXT = label(BIG, "GOOD!", C.l, C.k);

export const mountMemory: MountGame = (stage, seed) => {
	const sequence = memorySequence(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: MemoryState = MEMORY_START;
	let pressedAt: Readonly<Record<Button, number>> = { red: -1e9, green: -1e9, blue: -1e9, finish: -1e9 };
	/** 보여주는 칸마다 소리를 한 번만 내려고 마지막으로 소리 낸 칸을 기억한다 */
	let toneKey = "";

	/** 시각 t에 켜져 있는 칸 번호. 시간이 끝난 뒤에는 켜지 않는다 */
	const litIndex = (t: number | null) => (t === null || t >= MEMORY.durationMs ? null : shownAt(state, t));

	/** 시각 t에 보여주는 중인 칸의 버튼 */
	function shownButton(t: number | null): Button | null {
		const index = litIndex(t);
		return index === null ? null : (sequence[index] ?? null);
	}

	function drawPad(button: Button, lit: boolean): void {
		const fb = kit.fb;
		const pad = PADS[button];
		rect(fb, pad.x - 1, pad.y - 1, pad.w + 2, pad.h + 2, lit ? C.w : C.k);
		rect(fb, pad.x, pad.y, pad.w, pad.h, lit ? pad.on : pad.off);
		rect(fb, pad.x + 1, pad.y + 1, pad.w - 2, 1, lit ? C.w : pad.on);
		rect(fb, pad.x, pad.y + pad.h - 2, pad.w, 2, lit ? pad.off : C.k);
		const mark = MARK[button];
		blitAs(fb, mark, pad.x + Math.floor((pad.w - mark.w) / 2), pad.y + Math.floor((pad.h - 2 - mark.h) / 2), lit ? C.w : pad.on);
	}

	function drawHeader(now: number, t: number | null): void {
		const fb = kit.fb;
		const center = (art: Bitmap) => blit(fb, art, Math.floor((W - art.w) / 2), 1);
		if (t === null || t < MEMORY.firstShowAt) return center(READY_TEXT);
		if (t >= MEMORY.durationMs || t < state.showAt) return;
		if (t < inputFrom(state)) return center(LOOK_TEXT);
		if (Math.floor(now / 300) % 2 === 0) center(GO_TEXT);
	}

	/** 순서 길이만큼 칸: 보여주는 중엔 보여준 만큼, 누르는 중엔 맞게 누른 만큼 켠다 */
	function drawSlots(t: number | null): void {
		const fb = kit.fb;
		const x0 = Math.floor((W - (state.length * 4 - 1)) / 2);
		const showing = t !== null && t >= state.showAt && t < inputFrom(state);
		const shown = showing && t !== null ? Math.floor((t - state.showAt) / MEMORY.stepMs) : -1;
		for (let i = 0; i < state.length; i++) {
			const color = showing ? (i <= shown ? C.w : C.A) : i < state.entered ? C.l : C.A;
			rect(fb, x0 + i * 4, SLOT_Y, 3, 3, color);
		}
	}

	function drawBest(): void {
		const count = cachedLabel(BIG, String(state.best), C.y, C.k);
		const x = Math.floor((W - CHECK.w - 2 - count.w) / 2);
		blit(kit.fb, CHECK, x, 55);
		blit(kit.fb, count, x + CHECK.w + 2, 54);
	}

	function updateHint(t: number | null): void {
		if (t === null) return kit.setHint("칸이 반짝이는 순서를 기억해요");
		if (t >= MEMORY.durationMs) return kit.setHint(`끝! ${state.best}개`);
		if (t < state.showAt && state.event?.kind === "miss") return kit.setHint("틀렸어요! 다시 보여줄게요", "bad");
		if (t < state.showAt && state.event?.kind === "clear") return kit.setHint(`좋아요! 이번엔 ${state.length}개`, "good");
		if (t < inputFrom(state)) return kit.setHint("잘 보고 기억해요");
		kit.setHint(`따라 눌러요 ${state.entered}/${state.length}`);
	}

	/** 칸이 켜지는 순간 그 칸의 소리를 한 번 낸다 */
	function cue(t: number | null): void {
		const index = litIndex(t);
		if (index === null) return;
		const key = `${state.showAt}:${index}`;
		if (key === toneKey) return;
		toneKey = key;
		const button = sequence[index];
		if (button !== undefined) arcade.tone(BUTTONS.indexOf(button));
	}

	kit.run((now) => {
		// 시간이 끝나면 멈춘다(끝난 뒤에 칸이 켜지거나 소리가 나지 않게)
		const elapsed = kit.gameTime(now);
		const t = elapsed === null ? null : Math.min(elapsed, MEMORY.durationMs);
		const fb = kit.fb;
		rect(fb, 0, 0, W, H, C.n);
		rect(fb, 0, 10, W, 37, C.N);
		const shown = shownButton(t);
		for (const button of BUTTONS) drawPad(button, button === shown || now - pressedAt[button] < PRESS_LIT_MS);
		drawHeader(now, t);
		drawSlots(t);
		drawBest();
		updateHint(t);
		cue(t);
	});

	return {
		labels: {
			red: { text: "▲", enabled: true },
			green: { text: "■", enabled: true },
			blue: { text: "●", enabled: true },
			finish: { text: "★", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = memoryPress(state, sequence, button, t);
			if (state === before) return;
			const now = performance.now();
			pressedAt = { ...pressedAt, [button]: now };
			const kind = state.event?.kind;
			if (kind === "miss") {
				kit.popup(CROSS, W / 2, 24, 600, 0, "mark");
				kit.shake(1, 200);
				arcade.wrong();
				buzz(120);
				return;
			}
			arcade.tone(BUTTONS.indexOf(button));
			if (kind === "clear") {
				kit.emit(sparkle(W / 2, 26, [C.y, C.w, C.l], Math.random, 14, 50));
				kit.popup(GOOD_TEXT, W / 2, 9, MEMORY.pauseMs, 4);
				arcade.tie();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => memoryScore(state),
	};
};
