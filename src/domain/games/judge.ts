import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export type Hand = "rock" | "scissors" | "paper";
export type Bout = { readonly left: Hand; readonly right: Hand };
export type Verdict = "left" | "draw" | "right";

export const JUDGE = {
	durationMs: 15_000,
	/** 틀렸을 때 입력이 막히는 시간 */
	lockMs: 800,
	bouts: 120,
} as const;

/** 왼쪽이 이기면 빨강(왼쪽 버튼), 비기면 초록(가운데), 오른쪽이 이기면 파랑(오른쪽) */
export const VERDICT_BUTTON: Readonly<Record<Verdict, Button>> = { left: "red", draw: "green", right: "blue" };

const HANDS: readonly Hand[] = ["rock", "scissors", "paper"];
const BEATS: Readonly<Record<Hand, Hand>> = { rock: "scissors", scissors: "paper", paper: "rock" };
const ALL_BOUTS: readonly Bout[] = HANDS.flatMap((left) => HANDS.map((right) => ({ left, right })));
const FALLBACK: Bout = { left: "rock", right: "rock" };

export function verdictOf(bout: Bout): Verdict {
	if (bout.left === bout.right) return "draw";
	return BEATS[bout.left] === bout.right ? "left" : "right";
}

/** 같은 판이 연달아 나오지 않게 뽑는다(바뀐 걸 눈으로 알아보도록) */
export function judgeBouts(seed: number): readonly Bout[] {
	const rng = createRng(seed);
	return Array.from({ length: JUDGE.bouts }).reduce<readonly Bout[]>((picked) => {
		const previous = picked[picked.length - 1];
		const choices = ALL_BOUTS.filter((bout) => bout.left !== previous?.left || bout.right !== previous?.right);
		return [...picked, choices[randomInt(rng, 0, choices.length - 1)] ?? FALLBACK];
	}, []);
}

export type JudgeEvent = { readonly kind: "hit" | "miss"; readonly at: number };

export type JudgeState = {
	/** 맞힌 판 수 = 지금 보고 있는 판 번호 */
	readonly correct: number;
	readonly lockedUntil: number;
	readonly lastCorrectAt: number | null;
	readonly event: JudgeEvent | null;
};

export const JUDGE_START: JudgeState = { correct: 0, lockedUntil: 0, lastCorrectAt: null, event: null };

const HIT_WEIGHT = 100_000;

export function currentBout(state: JudgeState, bouts: readonly Bout[]): Bout {
	return bouts[state.correct % bouts.length] ?? FALLBACK;
}

export function judgePress(state: JudgeState, bouts: readonly Bout[], button: Button, t: number): JudgeState {
	if (!isWithin(t, JUDGE.durationMs) || t < state.lockedUntil || button === "finish") return state;
	if (VERDICT_BUTTON[verdictOf(currentBout(state, bouts))] !== button) {
		return { ...state, lockedUntil: t + JUDGE.lockMs, event: { kind: "miss", at: t } };
	}
	return { ...state, correct: state.correct + 1, lastCorrectAt: t, event: { kind: "hit", at: t } };
}

/** 맞힌 판 수가 먼저, 같으면 마지막으로 맞힌 시점이 빠른 쪽이 높다. 누른 시각은 ms 이하 소수라 버린다(서버는 정수만 받는다). */
export function judgeScore(state: JudgeState): number {
	if (state.correct === 0 || state.lastCorrectAt === null) return 0;
	return state.correct * HIT_WEIGHT + Math.floor(JUDGE.durationMs - state.lastCorrectAt);
}

export function formatJudge(score: number): string {
	return `${Math.floor(score / HIT_WEIGHT)}판`;
}

export const JUDGE_MAX_SCORE = JUDGE.bouts * HIT_WEIGHT + JUDGE.durationMs;
