import { type Button, isWithin } from "./button";

export const BALLOON = {
	durationMs: 12_000,
	/** 이만큼 불면 다 찬 것, FINISH를 누를 수 있다 */
	fullPumps: 50,
	/** 이만큼 불면 터진다 */
	burstPumps: 58,
} as const;

export type BalloonState = {
	readonly pumps: number;
	readonly last: Button | null;
	readonly finishedAt: number | null;
	readonly burst: boolean;
};

export const BALLOON_START: BalloonState = { pumps: 0, last: null, finishedAt: null, burst: false };

const FINISHED_BASE = 1000;

export function balloonPress(state: BalloonState, button: Button, t: number): BalloonState {
	if (!isWithin(t, BALLOON.durationMs) || state.finishedAt !== null || state.burst) return state;
	if (button === "finish") {
		return state.pumps >= BALLOON.fullPumps ? { ...state, finishedAt: t } : state;
	}
	if (button === "green" || button === state.last) return state;
	const pumps = state.pumps + 1;
	return { ...state, pumps, last: button, burst: pumps >= BALLOON.burstPumps };
}

/** 끝냈으면 1000 + 남은 시간(10ms 단위), 못 끝냈으면 불어 넣은 횟수, 터졌으면 0 */
export function balloonScore(state: BalloonState): number {
	if (state.burst) return 0;
	if (state.finishedAt !== null) return FINISHED_BASE + Math.floor((BALLOON.durationMs - state.finishedAt) / 10);
	return state.pumps;
}

export function formatBalloon(score: number): string {
	if (score === 0) return "실패";
	if (score < FINISHED_BASE) return `${score}회`;
	const finishedAt = BALLOON.durationMs - (score - FINISHED_BASE) * 10;
	return `${(finishedAt / 1000).toFixed(2)}초`;
}

export const BALLOON_MAX_SCORE = FINISHED_BASE + BALLOON.durationMs / 10;
