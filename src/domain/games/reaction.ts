import { createRng, randomInt } from "../random";

export const REACTION = {
	durationMs: 24_000,
	trials: 5,
	/** 신호 뒤 이 시간 안에 눌러야 한다 */
	windowMs: 1000,
	/** 이보다 빠르면 신호를 보고 누른 게 아니라 미리 누른 것 */
	minHumanMs: 100,
	/** 미리 눌렀거나 놓친 회차의 기록 */
	penaltyMs: 1000,
} as const;

export type ReactionState = {
	/** 회차별 기록(ms). 아직 안 눌렀으면 null */
	readonly results: readonly (number | null)[];
};

export function reactionStart(trials: number): ReactionState {
	return { results: Array.from({ length: trials }, () => null) };
}

/** 회차마다 신호가 뜨는 시각(게임 시작 기준 ms) */
export function reactionSignals(seed: number): readonly number[] {
	const rng = createRng(seed);
	return Array.from({ length: REACTION.trials }, (_, i) => 1500 + i * 4300 + randomInt(rng, 0, 2000));
}

/** 시각 t의 입력이 몇 번째 회차 것인지. 회차 i는 직전 회차의 입력 마감 뒤부터 자기 신호의 입력 마감까지를 맡는다. */
export function trialAt(signals: readonly number[], t: number): number | null {
	const index = signals.findIndex((signal) => t <= signal + REACTION.windowMs);
	return index === -1 ? null : index;
}

export function reactionPress(state: ReactionState, signals: readonly number[], t: number): ReactionState {
	const trial = t < 0 ? null : trialAt(signals, t);
	if (trial === null || state.results[trial] !== null) return state;
	const elapsed = t - (signals[trial] ?? 0);
	const record = elapsed < REACTION.minHumanMs ? REACTION.penaltyMs : elapsed;
	return { results: state.results.map((result, i) => (i === trial ? record : result)) };
}

export function reactionAverage(state: ReactionState): number {
	const total = state.results.reduce<number>((sum, result) => sum + (result ?? REACTION.penaltyMs), 0);
	return total / state.results.length;
}

/** 평균 기록이 짧을수록 높다. 1000 - 평균(ms) */
export function reactionScore(state: ReactionState): number {
	return Math.max(0, Math.round(REACTION.penaltyMs - reactionAverage(state)));
}

export function formatReaction(score: number): string {
	if (score === 0) return "실패";
	return `${((REACTION.penaltyMs - score) / 1000).toFixed(3)}초`;
}

export const REACTION_MAX_SCORE = REACTION.penaltyMs - REACTION.minHumanMs;
