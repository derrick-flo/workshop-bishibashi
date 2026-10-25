import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export type Direction = "left" | "up" | "right" | "down";

export const EYE = {
	durationMs: 15_000,
	/** 틀렸을 때 입력이 막히는 시간 */
	lockMs: 800,
	items: 120,
} as const;

/** 고리가 뚫린 방향 → 누를 버튼. FINISH가 세 버튼 아래에 있어서 '아래'를 맡는다. */
export const EYE_BUTTON: Readonly<Record<Direction, Button>> = {
	left: "red",
	up: "green",
	right: "blue",
	down: "finish",
};

const DIRECTIONS: readonly Direction[] = ["left", "up", "right", "down"];

export type EyeEvent = { readonly kind: "hit" | "miss"; readonly at: number };

export type EyeState = {
	readonly index: number;
	readonly correct: number;
	readonly lockedUntil: number;
	readonly lastCorrectAt: number | null;
	readonly event: EyeEvent | null;
};

export const EYE_START: EyeState = { index: 0, correct: 0, lockedUntil: 0, lastCorrectAt: null, event: null };

const HIT_WEIGHT = 100_000;

/** 같은 방향이 연달아 나오지 않게 뽑는다(바뀐 걸 눈으로 알아보도록) */
export function eyeDirections(seed: number): readonly Direction[] {
	const rng = createRng(seed);
	return Array.from({ length: EYE.items }).reduce<readonly Direction[]>((picked) => {
		const previous = picked[picked.length - 1];
		const choices = DIRECTIONS.filter((direction) => direction !== previous);
		return [...picked, choices[randomInt(rng, 0, choices.length - 1)] ?? "left"];
	}, []);
}

export function currentDirection(state: EyeState, directions: readonly Direction[]): Direction {
	return directions[state.index % directions.length] ?? "left";
}

export function eyePress(state: EyeState, directions: readonly Direction[], button: Button, t: number): EyeState {
	if (!isWithin(t, EYE.durationMs) || t < state.lockedUntil) return state;
	if (EYE_BUTTON[currentDirection(state, directions)] !== button) {
		return { ...state, lockedUntil: t + EYE.lockMs, event: { kind: "miss", at: t } };
	}
	return {
		...state,
		index: state.index + 1,
		correct: state.correct + 1,
		lastCorrectAt: t,
		event: { kind: "hit", at: t },
	};
}

/** 맞힌 개수가 먼저, 같으면 마지막으로 맞힌 시점이 빠른 쪽이 높다 */
export function eyeScore(state: EyeState): number {
	if (state.correct === 0 || state.lastCorrectAt === null) return 0;
	return state.correct * HIT_WEIGHT + (EYE.durationMs - state.lastCorrectAt);
}

export function formatEye(score: number): string {
	return `${Math.floor(score / HIT_WEIGHT)}개`;
}

export const EYE_MAX_SCORE = EYE.items * HIT_WEIGHT + EYE.durationMs;
