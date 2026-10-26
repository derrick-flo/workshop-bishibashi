import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export type MonsterColor = "red" | "green" | "blue";

export const MONSTER = {
	durationMs: 15_000,
	count: 20,
	/** 마지막 드래곤은 FINISH를 이만큼 때려야 쓰러진다 */
	dragonHp: 20,
	/** 다른 색을 눌렀을 때 입력이 막히는 시간 */
	lockMs: 600,
} as const;

const COLORS: readonly MonsterColor[] = ["red", "green", "blue"];

export type MonsterEvent = { readonly kind: "hit" | "miss" | "dragon" | "clear"; readonly at: number };

export type MonsterState = {
	readonly defeated: number;
	readonly dragonHits: number;
	readonly clearedAt: number | null;
	readonly lockedUntil: number;
	readonly event: MonsterEvent | null;
};

export const MONSTER_START: MonsterState = { defeated: 0, dragonHits: 0, clearedAt: null, lockedUntil: 0, event: null };

const CLEARED_BASE = 1000;

export function monsterQueue(seed: number): readonly MonsterColor[] {
	const rng = createRng(seed);
	return Array.from({ length: MONSTER.count }, () => COLORS[randomInt(rng, 0, COLORS.length - 1)] ?? "red");
}

/** 맨 앞 몬스터. 다 쓰러뜨렸으면 null(드래곤 차례) */
export function frontMonster(state: MonsterState, queue: readonly MonsterColor[]): MonsterColor | null {
	return queue[state.defeated] ?? null;
}

export function monsterPress(state: MonsterState, queue: readonly MonsterColor[], button: Button, t: number): MonsterState {
	if (!isWithin(t, MONSTER.durationMs) || state.clearedAt !== null || t < state.lockedUntil) return state;
	const front = frontMonster(state, queue);
	if (front === null) {
		if (button !== "finish") return state;
		const dragonHits = state.dragonHits + 1;
		const cleared = dragonHits >= MONSTER.dragonHp;
		return { ...state, dragonHits, clearedAt: cleared ? t : null, event: { kind: cleared ? "clear" : "dragon", at: t } };
	}
	if (button === "finish") return state;
	if (button !== front) return { ...state, lockedUntil: t + MONSTER.lockMs, event: { kind: "miss", at: t } };
	return { ...state, defeated: state.defeated + 1, event: { kind: "hit", at: t } };
}

/** 깼으면 1000 + 남은 시간(10ms 단위), 못 깼으면 쓰러뜨린 몬스터 수 + 드래곤을 때린 횟수 */
export function monsterScore(state: MonsterState): number {
	if (state.clearedAt !== null) return CLEARED_BASE + Math.floor((MONSTER.durationMs - state.clearedAt) / 10);
	return state.defeated + state.dragonHits;
}

export function formatMonster(score: number): string {
	if (score >= CLEARED_BASE) {
		const clearedAt = MONSTER.durationMs - (score - CLEARED_BASE) * 10;
		return `${(clearedAt / 1000).toFixed(2)}초`;
	}
	if (score > MONSTER.count) return `드래곤 ${score - MONSTER.count}대`;
	return `${score}마리`;
}

export const MONSTER_MAX_SCORE = CLEARED_BASE + MONSTER.durationMs / 10;
