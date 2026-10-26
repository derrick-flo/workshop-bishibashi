import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export const TREASURE = {
	durationMs: 20_000,
	/** 구덩이마다 폭탄이 숨은 깊이: 두 번째 칸부터 아홉 번째 칸 사이(첫 칸은 늘 안전) */
	minBombDepth: 2,
	maxBombDepth: 9,
	/** 한 칸 파는 시간. 이동안 누른 파기는 무시한다(연타해도 빨라지지 않는다). 챙기기는 바로 된다 */
	digMs: 300,
	/** 금고에 넣는 시간 */
	bankMs: 400,
	/** 폭탄이 터진 뒤 멈춰 있는 시간 */
	bombMs: 800,
} as const;

/** 준비해 두는 구덩이 수. 구덩이마다 적어도 한 칸은 파므로 20초에 이보다 많이 팔 수 없다 */
export const HOLES = Math.ceil(TREASURE.durationMs / TREASURE.digMs);

export type TreasureEvent = { readonly kind: "dig" | "bomb" | "bank"; readonly gold: number; readonly at: number };

export type TreasureState = {
	readonly hole: number;
	/** 지금 구덩이에서 판 칸 수 */
	readonly depth: number;
	/** 아직 금고에 안 넣은 금 */
	readonly bag: number;
	readonly vault: number;
	/** 이 시각 전에 누른 파기는 무시한다(파는 중 · 넣는 중 · 폭탄 뒤) */
	readonly busyUntil: number;
	readonly lastBankAt: number | null;
	readonly event: TreasureEvent | null;
};

export const TREASURE_START: TreasureState = { hole: 0, depth: 0, bag: 0, vault: 0, busyUntil: 0, lastBankAt: null, event: null };

const GOLD_WEIGHT = 100_000;

/** 구덩이마다 폭탄이 숨은 깊이. 모든 폰이 같은 땅을 판다 */
export function bombDepths(seed: number): readonly number[] {
	const rng = createRng(seed);
	return Array.from({ length: HOLES }, () => randomInt(rng, TREASURE.minBombDepth, TREASURE.maxBombDepth));
}

/** depth번째 칸에서 나오는 금. 깊을수록 많다 */
export function goldAt(depth: number): number {
	return depth;
}

/**
 * 빨강·초록·파랑은 한 칸 더 파고, FINISH는 가방의 금을 금고에 넣고 새 구덩이로 간다.
 * 폭탄 깊이에 닿으면 가방의 금을 잃고 잠시 멈췄다가 새 구덩이로 간다.
 */
export function treasurePress(state: TreasureState, bombs: readonly number[], button: Button, t: number): TreasureState {
	if (!isWithin(t, TREASURE.durationMs)) return state;
	if (button === "finish") {
		// 가방에 금이 있으면 마지막 동작은 파기였다(챙기거나 폭탄이 터지면 가방이 빈다). 파는 중에도 바로 챙긴다
		if (state.bag === 0) return state;
		return {
			hole: state.hole + 1,
			depth: 0,
			bag: 0,
			vault: state.vault + state.bag,
			busyUntil: t + TREASURE.bankMs,
			lastBankAt: t,
			event: { kind: "bank", gold: state.bag, at: t },
		};
	}
	if (t < state.busyUntil) return state;
	const depth = state.depth + 1;
	if (depth >= (bombs[state.hole] ?? TREASURE.maxBombDepth)) {
		return { ...state, hole: state.hole + 1, depth: 0, bag: 0, busyUntil: t + TREASURE.bombMs, event: { kind: "bomb", gold: state.bag, at: t } };
	}
	const gold = goldAt(depth);
	return { ...state, depth, bag: state.bag + gold, busyUntil: t + TREASURE.digMs, event: { kind: "dig", gold, at: t } };
}

/** 금고의 금이 먼저, 같으면 마지막으로 금고에 넣은 시점이 빠른 쪽이 높다 */
export function treasureScore(state: TreasureState): number {
	if (state.vault === 0 || state.lastBankAt === null) return 0;
	return state.vault * GOLD_WEIGHT + (TREASURE.durationMs - state.lastBankAt);
}

export function formatTreasure(score: number): string {
	return `${Math.floor(score / GOLD_WEIGHT)}골드`;
}

/** 금고 금의 상한: 한 칸 파는 데 0.3초는 걸리고, 한 칸에서 나오는 금은 폭탄 바로 앞 칸이 가장 많다 */
export const TREASURE_MAX_SCORE = HOLES * goldAt(TREASURE.maxBombDepth - 1) * GOLD_WEIGHT + TREASURE.durationMs;
