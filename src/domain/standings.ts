import type { RoundResult } from "./game";
import type { Player, PlayerId } from "./player";
import { rankScores } from "./ranking";

export type Standing = {
	readonly playerId: PlayerId;
	readonly total: number;
	/** 1등 한 라운드 수. 합계가 같을 때 가른다. */
	readonly wins: number;
	readonly rank: number;
	/** 라운드별로 받은 점수. 참가하지 않은 라운드는 null */
	readonly perRound: readonly (number | null)[];
};

type Scored = Pick<RoundResult, "participantIds" | "scores">;

/** 참가자 n명 중 1등은 n점, 꼴등은 1점. 기록이 없으면 0점. 게임마다 기록 단위가 달라서 등수로 점수를 준다. */
export function pointsFor(rank: number | null, participantCount: number): number {
	return rank === null ? 0 : participantCount - rank + 1;
}

/** 라운드 하나에서 참가자별로 받은 점수 */
export function roundPoints(round: Scored): Readonly<Record<PlayerId, number>> {
	const count = round.participantIds.length;
	return Object.fromEntries(rankScores(round.participantIds, round.scores).map((entry) => [entry.playerId, pointsFor(entry.rank, count)]));
}

function winnersOf(round: Scored): ReadonlySet<PlayerId> {
	return new Set(rankScores(round.participantIds, round.scores).filter((entry) => entry.rank === 1).map((entry) => entry.playerId));
}

/** 앞선 쪽이 음수. 합계 → 1등 횟수 순이고, 둘 다 같으면 0(같은 등수). */
function compareRecord(a: Pick<Standing, "total" | "wins">, b: Pick<Standing, "total" | "wins">): number {
	return b.total - a.total || b.wins - a.wins;
}

/**
 * 누적 순위. 한 라운드라도 참가한 사람만 넣는다.
 * 합계 → 1등 횟수 순으로 세우고, 둘 다 같으면 같은 등수를 주고 이름순으로 둔다.
 */
export function standings(players: readonly Player[], history: readonly RoundResult[]): readonly Standing[] {
	const rounds = history.map((round) => ({ ids: new Set(round.participantIds), points: roundPoints(round), winners: winnersOf(round) }));
	const rows = players
		.filter((player) => rounds.some((round) => round.ids.has(player.id)))
		.map((player) => {
			const perRound = rounds.map((round) => (round.ids.has(player.id) ? (round.points[player.id] ?? 0) : null));
			return {
				player,
				perRound,
				total: perRound.reduce<number>((sum, points) => sum + (points ?? 0), 0),
				wins: rounds.filter((round) => round.winners.has(player.id)).length,
			};
		})
		.sort((a, b) => compareRecord(a, b) || a.player.name.localeCompare(b.player.name, "ko"));
	return rows.map((row) => ({
		playerId: row.player.id,
		total: row.total,
		wins: row.wins,
		rank: 1 + rows.filter((other) => compareRecord(other, row) < 0).length,
		perRound: row.perRound,
	}));
}
