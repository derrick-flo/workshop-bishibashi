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

/**
 * 이번 라운드 탈락자를 참가 순서대로 돌려준다.
 * - 기록을 안 낸 사람이 먼저 탈락 인원을 채운다(그 사람이 더 많으면 그 사람들만 전부 탈락).
 * - 남은 자리는 점수가 낮은 순으로 채우되, 탈락선에 걸친 동점자는 살린다.
 * - 아무도 기록을 내지 않았으면 라운드 무효로 보고 아무도 탈락시키지 않는다.
 */
export function decideCut(participantIds: readonly PlayerId[], scores: Scores, cutCount: number): readonly PlayerId[] {
	if (cutCount <= 0) return [];
	const submitted = rankScores(participantIds, scores).filter((entry) => entry.score !== null);
	if (submitted.length === 0) return [];

	const missingIds = participantIds.filter((id) => scores[id] === undefined);
	const seatsLeft = Math.max(0, cutCount - missingIds.length);
	const worstSurvivor = submitted[submitted.length - seatsLeft - 1];
	const lowScorers = seatsLeft === 0 ? [] : submitted.slice(submitted.length - seatsLeft);
	const cutByScore = lowScorers.filter((entry) => entry.score !== worstSurvivor?.score).map((entry) => entry.playerId);

	const cut = new Set([...missingIds, ...cutByScore]);
	return participantIds.filter((id) => cut.has(id));
}
