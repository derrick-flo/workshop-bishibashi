import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export type Step = "flat" | "stair";

export const STAIRS = {
	durationMs: 15_000,
	steps: 40,
	/** 틀리면 넘어져서 이만큼 못 움직인다 */
	fallMs: 800,
} as const;

export type StairsEvent = { readonly kind: "step" | "fall" | "goal"; readonly at: number };

export type StairsState = {
	/** 오른 칸 수 = 다음에 밟을 칸 번호 */
	readonly position: number;
	readonly lockedUntil: number;
	readonly finishedAt: number | null;
	readonly event: StairsEvent | null;
};

export const STAIRS_START: StairsState = { position: 0, lockedUntil: 0, finishedAt: null, event: null };

const FINISHED_BASE = 1000;

/** 평지 1~3칸과 계단 2~4칸이 번갈아 나온다. 평지로 시작한다. */
export function stairsCourse(seed: number): readonly Step[] {
	const rng = createRng(seed);
	return Array.from({ length: STAIRS.steps }, (_, i) => {
		const step: Step = i % 2 === 0 ? "flat" : "stair";
		const length = step === "flat" ? randomInt(rng, 1, 3) : randomInt(rng, 2, 4);
		return Array.from({ length }, () => step);
	})
		.flat()
		.slice(0, STAIRS.steps);
}

export function stairsPress(state: StairsState, course: readonly Step[], button: Button, t: number): StairsState {
	if (!isWithin(t, STAIRS.durationMs) || state.finishedAt !== null || t < state.lockedUntil) return state;
	const step = course[state.position];
	if (step === undefined || button === "finish") return state;
	const right = step === "stair" ? button === "green" : button !== "green";
	if (!right) return { ...state, lockedUntil: t + STAIRS.fallMs, event: { kind: "fall", at: t } };
	const position = state.position + 1;
	const finished = position >= course.length;
	return { ...state, position, finishedAt: finished ? t : null, event: { kind: finished ? "goal" : "step", at: t } };
}

/** 다 올랐으면 1000 + 남은 시간(10ms 단위), 못 올랐으면 오른 칸 수 */
export function stairsScore(state: StairsState): number {
	if (state.finishedAt !== null) return FINISHED_BASE + Math.floor((STAIRS.durationMs - state.finishedAt) / 10);
	return state.position;
}

export function formatStairs(score: number): string {
	if (score < FINISHED_BASE) return `${score}칸`;
	const finishedAt = STAIRS.durationMs - (score - FINISHED_BASE) * 10;
	return `${(finishedAt / 1000).toFixed(2)}초`;
}

export const STAIRS_MAX_SCORE = FINISHED_BASE + STAIRS.durationMs / 10;
