import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

/** 불판 세 칸. 왼쪽부터 빨강·초록·파랑 버튼이 맡는다. */
export type GrillSlot = "red" | "green" | "blue";

export const GRILL_SLOTS: readonly GrillSlot[] = ["red", "green", "blue"];

export const GRILL = {
	durationMs: 20_000,
	/** 칸마다 정해 두는 굽기 시간 수. 다 쓰면 처음부터 다시 돌려 쓴다(연타해도 칸이 비지 않게) */
	pieces: 12,
	/** 칸마다 첫 고기가 올라오는 시각. 셋이 한꺼번에 익지 않게 어긋나게 올린다 */
	firstAt: { red: 300, green: 1000, blue: 1700 },
	/** 고기를 집은 뒤 새 고기가 올라오기까지 */
	refillMs: 500,
	/** 알맞게 익기까지 걸리는 시간. 고기마다 이 사이에서 정해진다 */
	minCookMs: 1800,
	maxCookMs: 3400,
	/** 알맞게 익은 상태가 이어지는 시간. 지나면 탄다 */
	goodMs: 700,
} as const;

export type Doneness = "raw" | "good" | "burnt";

/** 칸마다 올라올 고기들의 굽기 시간(ms) */
export type CookTimes = Readonly<Record<GrillSlot, readonly number[]>>;

/** 칸 하나: 지금(또는 다음에) 올라오는 고기 번호와 그 고기가 불판에 놓이는 시각 */
export type GrillSlotState = { readonly piece: number; readonly placedAt: number };

export type GrillEvent = { readonly kind: Doneness; readonly slot: GrillSlot; readonly at: number };

export type GrillState = {
	readonly slots: Readonly<Record<GrillSlot, GrillSlotState>>;
	/** 알맞게 익었을 때 집은 고기 수 */
	readonly good: number;
	readonly lastGoodAt: number | null;
	readonly event: GrillEvent | null;
};

export const GRILL_START: GrillState = {
	slots: {
		red: { piece: 0, placedAt: GRILL.firstAt.red },
		green: { piece: 0, placedAt: GRILL.firstAt.green },
		blue: { piece: 0, placedAt: GRILL.firstAt.blue },
	},
	good: 0,
	lastGoodAt: null,
	event: null,
};

const GOOD_WEIGHT = 100_000;

export function grillCookTimes(seed: number): CookTimes {
	const rng = createRng(seed);
	const pick = () => Array.from({ length: GRILL.pieces }, () => randomInt(rng, GRILL.minCookMs / 10, GRILL.maxCookMs / 10) * 10);
	return { red: pick(), green: pick(), blue: pick() };
}

/** 불판에 놓인 뒤 elapsed(ms)만큼 지난 고기의 익은 정도 */
export function donenessOf(cookMs: number, elapsed: number): Doneness {
	if (elapsed < cookMs) return "raw";
	return elapsed < cookMs + GRILL.goodMs ? "good" : "burnt";
}

/** 시각 t에 그 칸에 놓인 고기의 굽기 시간. 새 고기가 아직 안 올라왔으면 null */
export function cookingAt(state: GrillState, cookTimes: CookTimes, slot: GrillSlot, t: number): number | null {
	const current = state.slots[slot];
	if (t < current.placedAt) return null;
	const times = cookTimes[slot];
	return times[current.piece % times.length] ?? null;
}

/** 칸 버튼을 누르면 그 칸 고기를 집는다. 익은 정도와 상관없이 집은 고기는 치우고 잠시 뒤 새 고기를 올린다. */
export function grillPress(state: GrillState, cookTimes: CookTimes, button: Button, t: number): GrillState {
	if (!isWithin(t, GRILL.durationMs) || button === "finish") return state;
	const cookMs = cookingAt(state, cookTimes, button, t);
	if (cookMs === null) return state;
	const current = state.slots[button];
	const kind = donenessOf(cookMs, t - current.placedAt);
	const good = kind === "good";
	return {
		slots: { ...state.slots, [button]: { piece: current.piece + 1, placedAt: t + GRILL.refillMs } },
		good: good ? state.good + 1 : state.good,
		lastGoodAt: good ? t : state.lastGoodAt,
		event: { kind, slot: button, at: t },
	};
}

/** 알맞게 구운 고기 수가 먼저, 같으면 마지막으로 잘 구운 고기를 빨리 집은 쪽이 높다 */
export function grillScore(state: GrillState): number {
	if (state.good === 0 || state.lastGoodAt === null) return 0;
	return state.good * GOOD_WEIGHT + (GRILL.durationMs - state.lastGoodAt);
}

export function formatGrill(score: number): string {
	return `${Math.floor(score / GOOD_WEIGHT)}개`;
}

/** 한 칸에서 잘 구울 수 있는 고기 수의 상한: 가장 빨리 익는 고기만 쉬지 않고 집어도 이보다 많을 수 없다 */
const MAX_GOOD_PER_SLOT = Math.ceil(GRILL.durationMs / (GRILL.minCookMs + GRILL.refillMs));

export const GRILL_MAX_SCORE = GRILL_SLOTS.length * MAX_GOOD_PER_SLOT * GOOD_WEIGHT + GRILL.durationMs;
