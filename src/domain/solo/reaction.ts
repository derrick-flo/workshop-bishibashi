/** 반응속도 테스트. 빨강이 초록으로 바뀌는 순간 누른 시간을 잰다. */

export const REACTION = {
	/** 초록으로 바뀌기까지 기다리는 시간 */
	minWaitMs: 1200,
	maxWaitMs: 3600,
} as const;

/** 한 번의 도전 결과. tooSoon 은 초록이 되기 전에 누른 것 */
export type ReactionResult = { readonly kind: "measured"; readonly ms: number } | { readonly kind: "tooSoon" };

/** 초록으로 바뀌기까지 기다릴 시간. random 은 0 이상 1 미만 */
export function reactionWaitMs(random: () => number): number {
	return REACTION.minWaitMs + Math.floor(random() * (REACTION.maxWaitMs - REACTION.minWaitMs));
}

/** passMs 는 진행자가 정한 성공 기준(SoloRules.reactionPassMs) */
export function reactionPasses(result: ReactionResult, passMs: number): boolean {
	return result.kind === "measured" && result.ms <= passMs;
}

/** 기록판에 적는 글자 */
export function formatReaction(result: ReactionResult): string {
	return result.kind === "tooSoon" ? "반칙" : `${Math.round(result.ms)}ms`;
}
