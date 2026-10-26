import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export const CUPS = {
	durationMs: 20_000,
	/** 첫 판에 공을 보여주기 시작하는 시각 */
	firstAt: 500,
	/** 공을 보여주는 시간(컵을 들었다가 덮기까지) */
	revealMs: 900,
	/** 섞는 횟수: 첫 판 3번에서 판마다 1번씩 늘어 최대 8번 */
	firstSwaps: 3,
	maxSwaps: 8,
	/** 컵 두 개를 한 번 바꾸는 시간: 첫 판 0.42초에서 판마다 0.04초씩 줄어 최소 0.2초 */
	firstSwapMs: 420,
	minSwapMs: 200,
	swapStepMs: 40,
	/** 고른 뒤 컵을 열어 결과를 보여주는 시간 */
	resultMs: 800,
} as const;

/** 컵 자리: 0 왼쪽 · 1 가운데 · 2 오른쪽(빨강 · 초록 · 파랑 버튼) */
export type Spot = 0 | 1 | 2;
export type Swap = readonly [Spot, Spot];
export type CupRound = { readonly start: Spot; readonly swaps: readonly Swap[]; readonly swapMs: number };

export const SPOT_BUTTON: Readonly<Record<Spot, Button>> = { 0: "red", 1: "green", 2: "blue" };
const SPOT_OF: Readonly<Partial<Record<Button, Spot>>> = { red: 0, green: 1, blue: 2 };
const SPOTS: readonly Spot[] = [0, 1, 2];
const PAIRS: readonly Swap[] = [
	[0, 1],
	[1, 2],
	[0, 2],
];

/** 준비해 두는 판 수. 한 판은 아무리 빨라도 공 보여주기와 결과 보여주기만큼 걸려서 20초에 이보다 많이 할 수 없다 */
export const MAX_ROUNDS = Math.ceil(CUPS.durationMs / (CUPS.revealMs + CUPS.resultMs));

/** 모든 폰이 같은 판을 본다. 방금 바꾼 두 컵을 바로 다시 바꾸지는 않는다(되돌리기만 하면 섞는 의미가 없다) */
export function cupRounds(seed: number): readonly CupRound[] {
	const rng = createRng(seed);
	return Array.from({ length: MAX_ROUNDS }, (_, i): CupRound => {
		const start = SPOTS[randomInt(rng, 0, SPOTS.length - 1)] ?? 0;
		const count = Math.min(CUPS.firstSwaps + i, CUPS.maxSwaps);
		const swaps = Array.from({ length: count }).reduce<readonly Swap[]>((picked) => {
			const previous = picked[picked.length - 1];
			const choices = PAIRS.filter((pair) => pair !== previous);
			return [...picked, choices[randomInt(rng, 0, choices.length - 1)] ?? [0, 1]];
		}, []);
		return { start, swaps, swapMs: Math.max(CUPS.minSwapMs, CUPS.firstSwapMs - i * CUPS.swapStepMs) };
	});
}

/** 섞은 뒤 공이 든 컵의 자리 */
export function ballSpot(round: CupRound): Spot {
	return round.swaps.reduce<Spot>((spot, [a, b]) => (spot === a ? b : spot === b ? a : spot), round.start);
}

/** 이 판에서 고를 수 있게 되는 시각(다 섞인 뒤) */
export function chooseFrom(round: CupRound, roundAt: number): number {
	return roundAt + CUPS.revealMs + round.swaps.length * round.swapMs;
}

export type CupsEvent = { readonly kind: "hit" | "miss"; readonly spot: Spot; readonly at: number };

export type CupsState = {
	/** 지금 판 번호(0부터) */
	readonly round: number;
	/** 지금 판에서 공을 보여주기 시작하는 시각 */
	readonly roundAt: number;
	readonly correct: number;
	readonly lastCorrectAt: number | null;
	readonly event: CupsEvent | null;
};

export const CUPS_START: CupsState = { round: 0, roundAt: CUPS.firstAt, correct: 0, lastCorrectAt: null, event: null };

const HIT_WEIGHT = 100_000;

/** 다 섞인 뒤 공이 든 컵 자리 버튼을 고른다. 맞든 틀리든 결과를 보여주고 다음 판으로 넘어간다 */
export function cupsPress(state: CupsState, rounds: readonly CupRound[], button: Button, t: number): CupsState {
	const spot = SPOT_OF[button];
	const round = rounds[state.round];
	if (!isWithin(t, CUPS.durationMs) || spot === undefined || round === undefined || t < chooseFrom(round, state.roundAt)) return state;
	const hit = spot === ballSpot(round);
	return {
		round: state.round + 1,
		roundAt: t + CUPS.resultMs,
		correct: hit ? state.correct + 1 : state.correct,
		lastCorrectAt: hit ? t : state.lastCorrectAt,
		event: { kind: hit ? "hit" : "miss", spot, at: t },
	};
}

/** 맞힌 판 수가 먼저, 같으면 마지막으로 맞힌 시점이 빠른 쪽이 높다 */
export function cupsScore(state: CupsState): number {
	if (state.correct === 0 || state.lastCorrectAt === null) return 0;
	return state.correct * HIT_WEIGHT + (CUPS.durationMs - state.lastCorrectAt);
}

export function formatCups(score: number): string {
	return `${Math.floor(score / HIT_WEIGHT)}판`;
}

export const CUPS_MAX_SCORE = MAX_ROUNDS * HIT_WEIGHT + CUPS.durationMs;
