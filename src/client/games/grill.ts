import {
	cookingAt,
	donenessOf,
	GRILL,
	GRILL_SLOTS,
	GRILL_START,
	type GrillSlot,
	type GrillState,
	grillCookTimes,
	grillPress,
	grillScore,
} from "../../domain/games/grill";
import { arcade } from "../arcade-sound";
import { type Bitmap, blit, dither, plot, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { type Particle, sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { LETTUCE, MEAT, type MeatLook, MINI_MEAT } from "./art/grill";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 72;
const H = 64;
/** 불판 */
const PAN = { x: 3, y: 9, w: 66, h: 31 } as const;
/** 칸 가운데: 왼쪽 빨강 · 가운데 초록 · 오른쪽 파랑(패드 버튼 자리와 같다) */
const SLOT_X: Readonly<Record<GrillSlot, number>> = { red: 15, green: 36, blue: 57 };
const SLOT_COLOR: Readonly<Record<GrillSlot, readonly [number, number]>> = {
	red: [C.r, C.R],
	green: [C.g, C.G],
	blue: [C.b, C.B],
};
const MEAT_Y = 20;
const DISH = { x: 42, y: 51, w: 27, h: 9 } as const;
/** 새 고기가 불판에 떨어지는 시간, 집은 고기가 날아가는 시간 */
const DROP_MS = 120;
const FLY_MS = 260;
/** 다 탄 뒤 이만큼 지나면 숯덩이가 된다 */
const CHAR_MS = 1200;

const GOOD_TEXT = label(BIG, "GOOD!", C.l, C.k);
const RAW_TEXT = label(BIG, "RAW!", C.p, C.k);
const BURNT_TEXT = label(BIG, "BURNT!", C.p, C.k);
const BANG = label(BIG, "!", C.y, C.k);

/** 칸 위에 띄우는 글자가 화면 밖으로 잘리지 않게 가운데 자리를 안쪽으로 당긴다 */
function insideX(art: Bitmap, x: number): number {
	const half = Math.ceil(art.w / 2);
	return Math.max(half, Math.min(W - half, x));
}

/** 집어서 접시로(잘 구움) 또는 밖으로(꽝) 날아가는 고기 */
type Flying = { readonly look: MeatLook; readonly fromX: number; readonly good: boolean; readonly bornAt: number };
type Message = { readonly text: string; readonly tone: "good" | "bad"; readonly until: number };

export const mountGrill: MountGame = (stage, seed) => {
	const cookTimes = grillCookTimes(seed);
	const kit = mountKit(stage, W, H, C.T);
	let state: GrillState = GRILL_START;
	let flying: readonly Flying[] = [];
	let message: Message | null = null;
	let pressedAt: Readonly<Record<GrillSlot, number>> = { red: -1e9, green: -1e9, blue: -1e9 };
	let puffAt: Readonly<Record<GrillSlot, number>> = { red: 0, green: 0, blue: 0 };

	/** 시각 t에 그 칸 고기의 모습. 고기가 없으면 null */
	function lookAt(slot: GrillSlot, t: number): MeatLook | null {
		const cookMs = cookingAt(state, cookTimes, slot, t);
		if (cookMs === null) return null;
		const elapsed = t - state.slots[slot].placedAt;
		const doneness = donenessOf(cookMs, elapsed);
		if (doneness === "good") return "good";
		if (doneness === "burnt") return elapsed > cookMs + GRILL.goodMs + CHAR_MS ? "charred" : "burnt";
		const p = elapsed / cookMs;
		return p < 0.4 ? "raw" : p < 0.75 ? "warm" : "brown";
	}

	function drawTable(): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, H, C.T);
		for (let y = 2; y < H; y += 6) {
			for (let x = (y * 7) % 11; x < W; x += 17) rect(fb, x, y, 8, 1, C.t);
		}
		blit(fb, LETTUCE, 3, 50);
		blit(fb, LETTUCE, 14, 53);
	}

	function drawPan(now: number, t: number | null): void {
		const fb = kit.fb;
		// 불기운이 비치는 테두리
		const glow = Math.floor(now / 110) % 2 === 0 ? C.r : C.o;
		rect(fb, PAN.x - 2, PAN.y - 2, PAN.w + 4, PAN.h + 4, C.k);
		dither(fb, PAN.x - 1, PAN.y - 1, PAN.w + 2, PAN.h + 2, C.R, glow, 1);
		rect(fb, PAN.x, PAN.y, PAN.w, PAN.h, C.A);
		rect(fb, PAN.x, PAN.y, PAN.w, 1, C.a);
		for (let y = PAN.y + 3; y < PAN.y + PAN.h - 1; y += 3) rect(fb, PAN.x + 2, y, PAN.w - 4, 1, C.k);
		// 칸 손잡이(버튼 색). 누르면 노랗게
		for (const slot of GRILL_SLOTS) {
			const [color, dark] = SLOT_COLOR[slot];
			const lit = now - pressedAt[slot] < 120;
			const x = SLOT_X[slot] - 5;
			rect(fb, x, PAN.y + PAN.h + 2, 11, 5, C.k);
			rect(fb, x + 1, PAN.y + PAN.h + 2, 9, 3, lit ? C.y : color);
			rect(fb, x + 1, PAN.y + PAN.h + 4, 9, 1, lit ? C.Y : dark);
		}
		if (t === null) return;
		for (const slot of GRILL_SLOTS) drawMeat(now, t, slot);
	}

	function drawMeat(now: number, t: number, slot: GrillSlot): void {
		const look = lookAt(slot, t);
		if (look === null) return;
		const fb = kit.fb;
		const art = MEAT[look];
		const since = t - state.slots[slot].placedAt;
		const drop = since < DROP_MS ? Math.round((1 - since / DROP_MS) * 8) : 0;
		const hop = look === "good" && Math.floor(now / 110) % 2 === 0 ? 1 : 0;
		const x = SLOT_X[slot] - Math.floor(art.w / 2);
		const y = MEAT_Y - drop - hop;
		blit(fb, art, x, y);
		if (look === "good") {
			// 딱 좋을 때: 반짝이와 느낌표
			const blink = Math.floor(now / 140) % 2 === 0;
			plot(fb, blink ? x + 3 : x + art.w - 4, blink ? y - 1 : y + art.h, C.w);
			blit(fb, BANG, SLOT_X[slot] - Math.floor(BANG.w / 2), y - BANG.h - 1);
		}
		emitSteam(now, slot, look, x, y);
	}

	/** 지글지글 김, 타면 연기 */
	function emitSteam(now: number, slot: GrillSlot, look: MeatLook, x: number, y: number): void {
		const burning = look === "burnt" || look === "charred";
		const every = burning ? 90 : look === "raw" ? 0 : 260;
		if (every === 0 || now - puffAt[slot] < every) return;
		puffAt = { ...puffAt, [slot]: now };
		const puff: Particle = {
			x: x + 2 + Math.random() * 12,
			y: y + 1,
			vx: (Math.random() - 0.5) * 6,
			vy: burning ? -14 : -22,
			color: burning ? (Math.random() < 0.5 ? C.a : C.A) : C.W,
			life: burning ? 1100 : 380,
			gravity: burning ? -6 : 0,
		};
		kit.emit([puff]);
	}

	function drawFlying(now: number): void {
		const fb = kit.fb;
		flying = flying.filter((piece) => now - piece.bornAt < FLY_MS);
		for (const piece of flying) {
			const p = (now - piece.bornAt) / FLY_MS;
			const art = MEAT[piece.look];
			if (piece.good) {
				// 접시로 포물선
				const x = piece.fromX + (DISH.x + DISH.w / 2 - piece.fromX) * p - art.w / 2;
				const y = MEAT_Y + (DISH.y - MEAT_Y) * p - Math.sin(p * Math.PI) * 10;
				blit(fb, art, x, y);
			} else if (Math.floor(p * 8) % 2 === 0) {
				// 꽝은 위로 휙 던져 버린다(깜빡이며 사라짐)
				blit(fb, art, piece.fromX - art.w / 2 - p * 14, MEAT_Y - p * 26);
			}
		}
	}

	function drawDish(): void {
		const fb = kit.fb;
		rect(fb, DISH.x + 1, DISH.y, DISH.w - 2, DISH.h, C.k);
		rect(fb, DISH.x, DISH.y + 1, DISH.w, DISH.h - 2, C.k);
		rect(fb, DISH.x + 1, DISH.y + 1, DISH.w - 2, DISH.h - 2, C.w);
		rect(fb, DISH.x + 3, DISH.y + 3, DISH.w - 6, DISH.h - 6, C.W);
		const shown = Math.min(state.good, 4);
		for (let i = 0; i < shown; i++) blit(fb, MINI_MEAT, DISH.x + 3 + (i % 2) * 6 + Math.floor(i / 2) * 2, DISH.y + 1 - Math.floor(i / 2) * 3);
		const count = cachedLabel(BIG, `x${state.good}`, C.y, C.k);
		blit(fb, count, DISH.x + DISH.w - count.w, DISH.y - 3);
	}

	function updateHint(now: number, t: number | null): void {
		if (message !== null && now < message.until) return kit.setHint(message.text, message.tone);
		if (t === null) return kit.setHint("느낌표(!)가 뜨면 그 칸 버튼으로 집어요");
		if (t >= GRILL.durationMs) return kit.setHint(`끝! ${state.good}개`);
		if (GRILL_SLOTS.some((slot) => lookAt(slot, t) === "good")) return kit.setHint("지금 집어요!", "good");
		kit.setHint("느낌표(!)가 뜨면 집어요 · 덜 익거나 타면 꽝");
	}

	kit.run((now) => {
		// 시간이 끝나면 불판도 멈춘다(끝난 뒤에 고기가 더 익거나 타지 않게)
		const elapsed = kit.gameTime(now);
		const t = elapsed === null ? null : Math.min(elapsed, GRILL.durationMs);
		drawTable();
		drawPan(now, t);
		drawDish();
		drawFlying(now);
		updateHint(now, t);
	});

	return {
		labels: {
			red: { text: "집기", enabled: true },
			green: { text: "집기", enabled: true },
			blue: { text: "집기", enabled: true },
			finish: { text: "", enabled: false },
		},
		press(button, t) {
			const before = state;
			const look = button === "finish" ? null : lookAt(button, t);
			state = grillPress(state, cookTimes, button, t);
			const event = state.event;
			if (state === before || event === null || look === null) return;
			const now = performance.now();
			const slot = event.slot;
			pressedAt = { ...pressedAt, [slot]: now };
			flying = [...flying, { look, fromX: SLOT_X[slot], good: event.kind === "good", bornAt: now }];
			if (event.kind === "good") {
				kit.emit(sparkle(SLOT_X[slot], MEAT_Y + 3, [C.y, C.w, C.o], Math.random, 10, 45, 420));
				kit.popup(GOOD_TEXT, insideX(GOOD_TEXT, SLOT_X[slot]), 9, 700, 4);
				message = { text: `맛있다! ${state.good}개`, tone: "good", until: now + 600 };
				arcade.jar();
			} else {
				const text = event.kind === "raw" ? RAW_TEXT : BURNT_TEXT;
				kit.popup(text, insideX(text, SLOT_X[slot]), 9, 700, 4);
				message = { text: event.kind === "raw" ? "덜 익었어요! 꽝" : "탔어요! 꽝", tone: "bad", until: now + 600 };
				arcade.wrong();
				buzz(120);
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => grillScore(state),
	};
};
