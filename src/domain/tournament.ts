import type { PlayerId, Scores } from "./player";
import { rankScores } from "./ranking";

/**
 * 1:1 토너먼트 대진. 1회전 자리를 2의 거듭제곱 개수로 만들고, 사람이 모자란 자리는 빈자리(null)로 둔다.
 * 빈자리와 붙은 사람은 싸우지 않고 올라간다(부전승). 한 번 짜면 바뀌지 않는다.
 */
export type Bracket = {
	readonly slots: readonly (PlayerId | null)[];
};

/** 대진표의 경기 한 칸 */
export type Match = {
	/** 0 = 1회전 */
	readonly roundIndex: number;
	/** 그 회전 안에서 몇 번째 경기인지(0부터) */
	readonly slot: number;
	/** 아직 앞 경기가 안 끝나 누가 올라올지 모르면 null */
	readonly aId: PlayerId | null;
	readonly bId: PlayerId | null;
	readonly winnerId: PlayerId | null;
	/** 1회전에서 상대 자리가 비어 싸우지 않고 올라간 경기 */
	readonly bye: boolean;
	/** 몇 번째로 치른 경기인지(1부터). 부전승과 아직 안 한 경기는 null */
	readonly playedNo: number | null;
};

/** 치른 경기 하나. 라운드 기록(RoundResult)에서 승자를 가리는 데 필요한 부분만 본다. */
export type PlayedMatch = {
	readonly participantIds: readonly PlayerId[];
	readonly scores: Scores;
};

/** 토너먼트를 짤 수 있는 최소 인원 */
export const MIN_ENTRANTS = 2;

/** 사람 수를 담을 1회전 자리 수(2의 거듭제곱) */
export function bracketSize(count: number): number {
	let size = MIN_ENTRANTS;
	while (size < count) size *= 2;
	return size;
}

/**
 * size 자리 대진의 시드 배치. 1번 시드와 꼴찌 시드가 양 끝에서 만나도록 두 배씩 늘려 가며 만든다.
 * 사람이 모자라 생기는 빈자리는 늘 뒷번호 시드라서, 이 순서를 쓰면 부전승이 대진표에 고르게 퍼진다.
 */
export function seedOrder(size: number): readonly number[] {
	let order: readonly number[] = [1];
	for (let width = 2; width <= size; width *= 2) {
		order = order.flatMap((seed) => [seed, width + 1 - seed]);
	}
	return order;
}

/** 순서를 섞은 새 배열(피셔-예이츠). 받은 배열은 건드리지 않는다. */
function shuffled(ids: readonly PlayerId[], rng: () => number): readonly PlayerId[] {
	const list = [...ids];
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const a = list[i];
		const b = list[j];
		if (a === undefined || b === undefined) continue;
		list[i] = b;
		list[j] = a;
	}
	return list;
}

/** n명으로 대진을 짜면 생기는 부전승 자리 수 */
export function byeCount(count: number): number {
	return bracketSize(count) - count;
}

/**
 * 참가자를 섞어 대진을 짠다. 사람이 모자란 자리는 빈자리가 되어 부전승이 된다.
 * byeIds 는 빈자리와 붙는 앞번호 시드(부전승 자리)에 먼저 넣고, 남은 자리는 나머지 사람을 섞어서 채운다.
 * byeIds 가 부전승 자리보다 많으면 넘치는 사람은 부전승을 받지 못한다(drawTournament 가 미리 막는다).
 */
export function drawBracket(playerIds: readonly PlayerId[], rng: () => number, byeIds: readonly PlayerId[] = []): Bracket {
	const chosen = shuffled(playerIds.filter((id) => byeIds.includes(id)), rng);
	const rest = shuffled(playerIds.filter((id) => !byeIds.includes(id)), rng);
	const entrants = [...chosen, ...rest];
	return { slots: seedOrder(bracketSize(entrants.length)).map((seed) => entrants[seed - 1] ?? null) };
}

/** 대진에 들어간 사람 수 */
export function entrantCount(bracket: Bracket): number {
	return bracket.slots.filter((id) => id !== null).length;
}

/** 치러야 하는 경기 수(부전승은 세지 않는다) */
export function matchTotal(bracket: Bracket): number {
	return Math.max(0, entrantCount(bracket) - 1);
}

/** 1:1 경기의 승자. 점수가 높은 쪽이고, 같거나 둘 다 기록이 없으면 null(가릴 수 없다). */
export function matchWinner(match: PlayedMatch): PlayerId | null {
	const top = rankScores(match.participantIds, match.scores).filter((entry) => entry.rank === 1);
	return top.length === 1 ? (top[0]?.playerId ?? null) : null;
}

/**
 * 대진표 전체를 1회전부터 결승까지 만든다. 치른 경기(played)는 부전승을 뺀 경기 순서와 하나씩 맞춰 승자를 채운다.
 * 뒷 회전의 빈자리는 앞 경기가 안 끝난 것이고(부전승이 아니다), 부전승은 1회전에만 생긴다.
 */
export function bracketRounds(bracket: Bracket, played: readonly PlayedMatch[]): readonly (readonly Match[])[] {
	const rounds: Match[][] = [];
	let entrants: readonly (PlayerId | null)[] = bracket.slots;
	let playedIndex = 0;
	for (let roundIndex = 0; entrants.length > 1; roundIndex++) {
		const matches: Match[] = [];
		const winners: (PlayerId | null)[] = [];
		for (let slot = 0; slot * 2 < entrants.length; slot++) {
			const aId = entrants[slot * 2] ?? null;
			const bId = entrants[slot * 2 + 1] ?? null;
			const bye = roundIndex === 0 && (aId === null) !== (bId === null);
			if (bye) {
				const winnerId = aId ?? bId;
				matches.push({ roundIndex, slot, aId, bId, winnerId, bye: true, playedNo: null });
				winners.push(winnerId);
				continue;
			}
			if (aId === null || bId === null) {
				matches.push({ roundIndex, slot, aId, bId, winnerId: null, bye: false, playedNo: null });
				winners.push(null);
				continue;
			}
			const record = played[playedIndex] ?? null;
			if (record === null) {
				matches.push({ roundIndex, slot, aId, bId, winnerId: null, bye: false, playedNo: null });
				winners.push(null);
				continue;
			}
			playedIndex += 1;
			const winnerId = matchWinner(record);
			matches.push({ roundIndex, slot, aId, bId, winnerId, bye: false, playedNo: playedIndex });
			winners.push(winnerId);
		}
		rounds.push(matches);
		entrants = winners;
	}
	return rounds;
}

/** 다음에 치를 경기. 부전승은 건너뛰고, 다 끝났으면 null */
export function nextMatch(bracket: Bracket, played: readonly PlayedMatch[]): Match | null {
	for (const matches of bracketRounds(bracket, played)) {
		for (const match of matches) {
			if (match.bye || match.winnerId !== null) continue;
			if (match.aId !== null && match.bId !== null) return match;
		}
	}
	return null;
}

/** 우승자. 결승이 끝나지 않았으면 null */
export function championOf(bracket: Bracket, played: readonly PlayedMatch[]): PlayerId | null {
	return bracketRounds(bracket, played).at(-1)?.[0]?.winnerId ?? null;
}

/** 회전 이름. 결승·준결승은 이름으로, 그 앞은 8강·16강처럼 센다. */
export function roundTitle(roundIndex: number, roundCount: number): string {
	const left = roundCount - roundIndex;
	if (left <= 1) return "결승";
	if (left === 2) return "준결승";
	return `${2 ** left}강`;
}

/** 저장해 둔 대진을 읽는다. 알아볼 수 없으면 null(다시 짜야 한다). */
export function readBracket(value: unknown): Bracket | null {
	if (typeof value !== "object" || value === null) return null;
	const slots = (value as { readonly slots?: unknown }).slots;
	if (!Array.isArray(slots)) return null;
	const size = slots.length;
	if (size < MIN_ENTRANTS || (size & (size - 1)) !== 0) return null;
	if (!slots.every((slot) => slot === null || typeof slot === "string")) return null;
	return { slots: slots as readonly (PlayerId | null)[] };
}
