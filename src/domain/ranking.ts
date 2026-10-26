import type { PlayerId, Scores } from "./player";

export type RankEntry = {
	readonly playerId: PlayerId;
	/** 기록을 내지 않았으면 null */
	readonly score: number | null;
	readonly rank: number | null;
};

/** 점수가 높은 순으로 세운다. 같은 점수는 같은 등수(1, 2, 2, 4), 기록이 없으면 맨 뒤. */
export function rankScores(participantIds: readonly PlayerId[], scores: Scores): readonly RankEntry[] {
	const submitted = participantIds
		.filter((id) => scores[id] !== undefined)
		.map((id) => ({ playerId: id, score: scores[id] ?? 0 }))
		.sort((a, b) => b.score - a.score);
	const ranked = submitted.map((entry) => ({
		...entry,
		rank: 1 + submitted.filter((other) => other.score > entry.score).length,
	}));
	const missing = participantIds
		.filter((id) => scores[id] === undefined)
		.map((id) => ({ playerId: id, score: null, rank: null }));
	return [...ranked, ...missing];
}
