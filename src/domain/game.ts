import { GAMES, type GameId } from "./games/catalog";
import type { Player, PlayerId, PlayerStatus, Scores } from "./player";
import { decideCut } from "./ranking";

export const ROUND_TIMING = {
	/** 시작을 누른 뒤 게임이 열리기까지(준비 + 3·2·1) */
	leadMs: 4000,
	/** 게임이 끝난 뒤 기록을 더 기다리는 시간(느린 와이파이 대비) */
	graceMs: 4000,
} as const;

/** 진행자가 미리 골라 둔 다음 라운드. 폰과 앞 화면에 미리 보여준다. */
export type Upcoming = { readonly gameId: GameId; readonly cutCount: number };

export type Round = {
	readonly no: number;
	readonly gameId: GameId;
	/** 모든 폰이 같은 문제를 보도록 나눠 주는 값 */
	readonly seed: number;
	readonly playAt: number;
	readonly endAt: number;
	readonly deadlineAt: number;
	readonly cutCount: number;
	readonly participantIds: readonly PlayerId[];
	readonly scores: Scores;
};

export type Phase =
	| { readonly kind: "lobby" }
	| { readonly kind: "playing"; readonly round: Round }
	| { readonly kind: "results"; readonly round: Round; readonly cutIds: readonly PlayerId[] }
	| { readonly kind: "finished"; readonly winnerIds: readonly PlayerId[] };

export type GameState = {
	readonly players: readonly Player[];
	readonly phase: Phase;
	/** 탈락까지 확정한 라운드 수 */
	readonly roundsPlayed: number;
	readonly upcoming: Upcoming | null;
};

export type Rejection =
	| "wrong_phase"
	| "roster_locked"
	| "unknown_player"
	| "already_claimed"
	| "not_claimed"
	| "no_upcoming"
	| "not_enough_players"
	| "invalid_cut"
	| "wrong_round"
	| "not_participant"
	| "already_submitted"
	| "too_late"
	| "invalid_score";

export type Transition = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: Rejection };

export const EMPTY_GAME: GameState = { players: [], phase: { kind: "lobby" }, roundsPlayed: 0, upcoming: null };

const accept = (state: GameState): Transition => ({ ok: true, state });
const reject = (reason: Rejection): Transition => ({ ok: false, reason });

function findPlayer(state: GameState, playerId: PlayerId): Player | null {
	return state.players.find((player) => player.id === playerId) ?? null;
}

function updatePlayers(state: GameState, ids: readonly PlayerId[], change: (player: Player) => Player): readonly Player[] {
	return state.players.map((player) => (ids.includes(player.id) ? change(player) : player));
}

function aliveIds(players: readonly Player[]): readonly PlayerId[] {
	return players.filter((player) => player.status === "alive").map((player) => player.id);
}

/** 명단을 바꾼다. 남은 이름은 입장·생존 상태를 그대로 두고, 새 이름에만 새 id를 준다. */
export function setRoster(state: GameState, names: readonly string[], newId: () => PlayerId): Transition {
	if (state.roundsPlayed > 0) return reject("roster_locked");
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	const cleaned = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
	const players = cleaned.map(
		(name): Player => state.players.find((player) => player.name === name) ?? { id: newId(), name, claimed: false, status: "lobby" },
	);
	return accept({ ...state, players });
}

export function claim(state: GameState, playerId: PlayerId): Transition {
	const player = findPlayer(state, playerId);
	if (player === null) return reject("unknown_player");
	if (player.claimed) return reject("already_claimed");
	return accept({ ...state, players: updatePlayers(state, [playerId], (p) => ({ ...p, claimed: true })) });
}

/** 진행자가 입장을 풀어 준다(폰을 바꿨을 때 등). 생존 여부는 그대로 둔다. */
export function release(state: GameState, playerId: PlayerId): Transition {
	const player = findPlayer(state, playerId);
	if (player === null) return reject("unknown_player");
	if (!player.claimed) return reject("not_claimed");
	return accept({ ...state, players: updatePlayers(state, [playerId], (p) => ({ ...p, claimed: false })) });
}

/** 다음 라운드에 뛸 사람. 첫 라운드는 입장한 사람 전원, 그 뒤로는 생존자만. */
export function nextParticipants(state: GameState): readonly Player[] {
	if (state.roundsPlayed === 0) return state.players.filter((player) => player.claimed && player.status !== "out");
	return state.players.filter((player) => player.status === "alive");
}

export function prepareRound(state: GameState, gameId: GameId, cutCount: number): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (!Number.isInteger(cutCount) || cutCount < 0) return reject("invalid_cut");
	return accept({ ...state, upcoming: { gameId, cutCount } });
}

export function startRound(state: GameState, seed: number, now: number): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (state.upcoming === null) return reject("no_upcoming");
	const participantIds = nextParticipants(state).map((player) => player.id);
	// 혼자서도 시작할 수 있다(테스트용). 이때 탈락 인원은 0명만 된다.
	if (participantIds.length === 0) return reject("not_enough_players");
	if (state.upcoming.cutCount > participantIds.length - 1) return reject("invalid_cut");

	const playAt = now + ROUND_TIMING.leadMs;
	const endAt = playAt + GAMES[state.upcoming.gameId].durationMs;
	const round: Round = {
		no: state.roundsPlayed + 1,
		gameId: state.upcoming.gameId,
		seed,
		playAt,
		endAt,
		deadlineAt: endAt + ROUND_TIMING.graceMs,
		cutCount: state.upcoming.cutCount,
		participantIds,
		scores: {},
	};
	return accept({
		...state,
		players: updatePlayers(state, participantIds, (p) => ({ ...p, status: "alive" })),
		phase: { kind: "playing", round },
		upcoming: null,
	});
}

export function submitScore(state: GameState, playerId: PlayerId, roundNo: number, score: number, now: number): Transition {
	if (state.phase.kind !== "playing") return reject("wrong_phase");
	const { round } = state.phase;
	if (round.no !== roundNo) return reject("wrong_round");
	if (!round.participantIds.includes(playerId)) return reject("not_participant");
	if (round.scores[playerId] !== undefined) return reject("already_submitted");
	if (now > round.deadlineAt) return reject("too_late");
	if (!Number.isInteger(score) || score < 0 || score > GAMES[round.gameId].maxScore) return reject("invalid_score");
	const scores = { ...round.scores, [playerId]: score };
	return accept({ ...state, phase: { kind: "playing", round: { ...round, scores } } });
}

export function isRoundComplete(round: Round): boolean {
	return round.participantIds.every((id) => round.scores[id] !== undefined);
}

/** 기록 받기를 끝내고 탈락 예정자를 정한다. 확정은 진행자가 따로 한다. */
export function closeRound(state: GameState): Transition {
	if (state.phase.kind !== "playing") return reject("wrong_phase");
	const { round } = state.phase;
	return accept({
		...state,
		phase: { kind: "results", round, cutIds: decideCut(round.participantIds, round.scores, round.cutCount) },
	});
}

/** 진행자가 탈락 예정자를 살리거나 다시 탈락 예정으로 돌린다. */
export function toggleCut(state: GameState, playerId: PlayerId): Transition {
	if (state.phase.kind !== "results") return reject("wrong_phase");
	const { round, cutIds } = state.phase;
	if (!round.participantIds.includes(playerId)) return reject("not_participant");
	const wasCut = cutIds.includes(playerId);
	const nextCutIds = round.participantIds.filter((id) => (id === playerId ? !wasCut : cutIds.includes(id)));
	return accept({ ...state, phase: { kind: "results", round, cutIds: nextCutIds } });
}

function phaseAfterRounds(players: readonly Player[]): Phase {
	const alive = aliveIds(players);
	return alive.length <= 1 ? { kind: "finished", winnerIds: alive } : { kind: "lobby" };
}

/** 탈락을 확정한다. 아무도 탈락하지 않았으면(혼자 테스트하거나 모두 살린 경우) 게임을 끝내지 않고 로비로 돌아간다. */
export function confirmCut(state: GameState): Transition {
	if (state.phase.kind !== "results") return reject("wrong_phase");
	const { cutIds } = state.phase;
	const players = updatePlayers(state, cutIds, (p) => ({ ...p, status: "out" }));
	const phase: Phase = cutIds.length === 0 ? { kind: "lobby" } : phaseAfterRounds(players);
	return accept({ ...state, players, roundsPlayed: state.roundsPlayed + 1, phase });
}

/** 기계 문제 등으로 라운드를 없던 일로 한다. 아무도 탈락하지 않는다. */
export function cancelRound(state: GameState): Transition {
	if (state.phase.kind !== "playing" && state.phase.kind !== "results") return reject("wrong_phase");
	return accept({ ...state, phase: { kind: "lobby" } });
}

/** 진행자가 직접 살리거나 탈락시킨다. 라운드 사이에만 할 수 있다. */
export function setStatus(state: GameState, playerId: PlayerId, status: Exclude<PlayerStatus, "lobby">): Transition {
	if (state.phase.kind !== "lobby" && state.phase.kind !== "finished") return reject("wrong_phase");
	if (findPlayer(state, playerId) === null) return reject("unknown_player");
	const players = updatePlayers(state, [playerId], (p) => ({ ...p, status }));
	const phase = state.roundsPlayed > 0 ? phaseAfterRounds(players) : state.phase;
	return accept({ ...state, players, phase });
}

/** 입장은 그대로 두고 처음 상태로 돌린다(리허설 뒤 등). */
export function resetGame(state: GameState): GameState {
	return {
		players: state.players.map((player) => ({ ...player, status: "lobby" })),
		phase: { kind: "lobby" },
		roundsPlayed: 0,
		upcoming: null,
	};
}

/** 라운드마다 30% 정도 떨어뜨리고, 3명 이하면 한 번에 우승자를 가린다. */
export function suggestCutCount(participantCount: number): number {
	if (participantCount <= 1) return 0;
	if (participantCount <= 3) return participantCount - 1;
	return Math.ceil(participantCount * 0.3);
}
