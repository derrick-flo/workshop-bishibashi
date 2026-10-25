import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export const CANDY = {
	durationMs: 20_000,
	values: { red: 1, green: 5, blue: 10 },
	minTarget: 11,
	maxTarget: 39,
	jars: 60,
} as const;

export type CandyEvent = { readonly kind: "add" | "spill" | "done" | "wrong"; readonly at: number };

export type CandyState = {
	/** 지금 채우는 병 번호(0부터) */
	readonly jar: number;
	readonly count: number;
	readonly completed: number;
	readonly lastCompletedAt: number | null;
	readonly event: CandyEvent | null;
};

export const CANDY_START: CandyState = { jar: 0, count: 0, completed: 0, lastCompletedAt: null, event: null };

const JAR_WEIGHT = 100_000;

export function candyTargets(seed: number): readonly number[] {
	const rng = createRng(seed);
	return Array.from({ length: CANDY.jars }, () => randomInt(rng, CANDY.minTarget, CANDY.maxTarget));
}

export function currentTarget(state: CandyState, targets: readonly number[]): number {
	return targets[state.jar % targets.length] ?? CANDY.minTarget;
}

export function candyPress(state: CandyState, targets: readonly number[], button: Button, t: number): CandyState {
	if (!isWithin(t, CANDY.durationMs)) return state;
	const target = currentTarget(state, targets);
	if (button === "finish") {
		if (state.count !== target) return { ...state, count: 0, event: { kind: "wrong", at: t } };
		return {
			jar: state.jar + 1,
			count: 0,
			completed: state.completed + 1,
			lastCompletedAt: t,
			event: { kind: "done", at: t },
		};
	}
	const count = state.count + CANDY.values[button];
	if (count > target) return { ...state, count: 0, event: { kind: "spill", at: t } };
	return { ...state, count, event: { kind: "add", at: t } };
}

/** 채운 병 수가 먼저, 같으면 마지막 병을 빨리 채운 쪽이 높다 */
export function candyScore(state: CandyState): number {
	if (state.completed === 0 || state.lastCompletedAt === null) return 0;
	return state.completed * JAR_WEIGHT + (CANDY.durationMs - state.lastCompletedAt);
}

export function formatCandy(score: number): string {
	return `${Math.floor(score / JAR_WEIGHT)}병`;
}

export const CANDY_MAX_SCORE = CANDY.jars * JAR_WEIGHT + CANDY.durationMs;
