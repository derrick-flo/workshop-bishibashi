import { GAMES, type GameId } from "./games/catalog";
import type { Player, PlayerId, Scores } from "./player";

export const ROUND_TIMING = {
	/** 시작을 누른 뒤 게임이 열리기까지(준비 + 3·2·1) */
	leadMs: 4000,
	/** 게임이 끝난 뒤 기록을 더 기다리는 시간(느린 와이파이, 끊겼다 다시 붙는 폰 대비) */
	graceMs: 8000,
} as const;

/** 순서표에 넣을 수 있는 라운드 수 */
export const PLAN_LIMIT = 30;

export type Round = {
	readonly no: number;
	readonly gameId: GameId;
	/** 모든 폰이 같은 문제를 보도록 나눠 주는 값 */
	readonly seed: number;
	readonly playAt: number;
	readonly endAt: number;
	readonly deadlineAt: number;
	readonly participantIds: readonly PlayerId[];
	readonly scores: Scores;
};

/**
 * 기록을 어느 판에 낸 것인지. 라운드 번호는 취소 후 재경기나 처음부터 다시 할 때 다시 쓰이므로
 * 시작 시각까지 맞아야 같은 판으로 본다.
 */
export type RoundKey = { readonly no: number; readonly playAt: number };

/** 확정한 라운드. 순위와 점수는 기록에서 다시 계산한다(standings.ts). */
export type RoundResult = {
	readonly no: number;
	readonly gameId: GameId;
	readonly participantIds: readonly PlayerId[];
	readonly scores: Scores;
};

export type Phase =
	| { readonly kind: "lobby" }
	| { readonly kind: "playing"; readonly round: Round }
	/** 기록 받기를 끝내고 순위를 보여주는 중. 진행자가 확정하면 기록에 쌓인다. */
	| { readonly kind: "results"; readonly round: Round }
	/** 최종 순위 발표 */
	| { readonly kind: "finished" };

export type GameState = {
	readonly players: readonly Player[];
	/** 라운드별 게임 순서. 앞의 lockedPlanLength개는 이미 했거나 하는 중이라 바꿀 수 없다. */
	readonly plan: readonly GameId[];
	readonly history: readonly RoundResult[];
	readonly phase: Phase;
};

export type Rejection =
	| "wrong_phase"
	| "unknown_player"
	| "already_claimed"
	| "not_claimed"
	| "plan_too_long"
	| "no_next_game"
	| "not_enough_players"
	| "wrong_round"
	| "not_participant"
	| "already_submitted"
	| "too_late"
	| "invalid_score"
	| "nothing_played";

export type Transition = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: Rejection };

export const EMPTY_GAME: GameState = { players: [], plan: [], history: [], phase: { kind: "lobby" } };

const accept = (state: GameState): Transition => ({ ok: true, state });
const reject = (reason: Rejection): Transition => ({ ok: false, reason });

function findPlayer(state: GameState, playerId: PlayerId): Player | null {
	return state.players.find((player) => player.id === playerId) ?? null;
}

function setClaimed(state: GameState, playerId: PlayerId, claimed: boolean): GameState {
	return { ...state, players: state.players.map((player) => (player.id === playerId ? { ...player, claimed } : player)) };
}

/** 명단을 바꾼다. 남은 이름은 입장 상태를 그대로 두고, 새 이름에만 새 id를 준다. 라운드 사이에만 할 수 있다. */
export function setRoster(state: GameState, names: readonly string[], newId: () => PlayerId): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	const cleaned = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
	const players = cleaned.map((name): Player => state.players.find((player) => player.name === name) ?? { id: newId(), name, claimed: false });
	return accept({ ...state, players });
}

export function claim(state: GameState, playerId: PlayerId): Transition {
	const player = findPlayer(state, playerId);
	if (player === null) return reject("unknown_player");
	if (player.claimed) return reject("already_claimed");
	return accept(setClaimed(state, playerId, true));
}

/** 진행자가 입장을 풀어 준다(폰을 바꿨을 때 등). 기록은 그대로 둔다. */
export function release(state: GameState, playerId: PlayerId): Transition {
	const player = findPlayer(state, playerId);
	if (player === null) return reject("unknown_player");
	if (!player.claimed) return reject("not_claimed");
	return accept(setClaimed(state, playerId, false));
}

/** 순서표에서 바꿀 수 없는 앞부분 길이. 확정한 라운드에 지금 하는 라운드를 더한다. */
export function lockedPlanLength(state: GameState): number {
	const inRound = state.phase.kind === "playing" || state.phase.kind === "results";
	return state.history.length + (inRound ? 1 : 0);
}

/** 순서표에서 아직 안 한 부분을 upcoming으로 바꾼다. */
export function setPlan(state: GameState, upcoming: readonly GameId[]): Transition {
	const plan = [...state.plan.slice(0, lockedPlanLength(state)), ...upcoming];
	if (plan.length > PLAN_LIMIT) return reject("plan_too_long");
	return accept({ ...state, plan });
}

/** 다음 라운드 게임. 순서표를 다 했으면 null */
export function nextGame(state: GameState): GameId | null {
	return state.plan[state.history.length] ?? null;
}

/** 지금 입장해 있는 사람. 라운드를 시작하면 이 사람들이 참가자가 된다. */
export function joinedPlayers(state: GameState): readonly Player[] {
	return state.players.filter((player) => player.claimed);
}

export function startRound(state: GameState, seed: number, now: number): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	const gameId = nextGame(state);
	if (gameId === null) return reject("no_next_game");
	const participantIds = joinedPlayers(state).map((player) => player.id);
	// 혼자서도 시작할 수 있다(테스트용)
	if (participantIds.length === 0) return reject("not_enough_players");

	const playAt = now + ROUND_TIMING.leadMs;
	const endAt = playAt + GAMES[gameId].durationMs;
	const round: Round = {
		no: state.history.length + 1,
		gameId,
		seed,
		playAt,
		endAt,
		deadlineAt: endAt + ROUND_TIMING.graceMs,
		participantIds,
		scores: {},
	};
	return accept({ ...state, phase: { kind: "playing", round } });
}

export function submitScore(state: GameState, playerId: PlayerId, key: RoundKey, score: number, now: number): Transition {
	if (state.phase.kind !== "playing") return reject("wrong_phase");
	const { round } = state.phase;
	if (round.no !== key.no || round.playAt !== key.playAt) return reject("wrong_round");
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

/** 기록 받기를 끝내고 순위를 보여준다. 확정은 진행자가 따로 한다. */
export function closeRound(state: GameState): Transition {
	if (state.phase.kind !== "playing") return reject("wrong_phase");
	return accept({ ...state, phase: { kind: "results", round: state.phase.round } });
}

/** 결과를 확정해 기록에 쌓고 로비로 돌아간다. */
export function confirmRound(state: GameState): Transition {
	if (state.phase.kind !== "results") return reject("wrong_phase");
	const { no, gameId, participantIds, scores } = state.phase.round;
	return accept({ ...state, history: [...state.history, { no, gameId, participantIds, scores }], phase: { kind: "lobby" } });
}

/** 기계 문제 등으로 라운드를 없던 일로 한다. 기록에 남지 않고 같은 게임이 다시 다음 차례가 된다. */
export function cancelRound(state: GameState): Transition {
	if (state.phase.kind !== "playing" && state.phase.kind !== "results") return reject("wrong_phase");
	return accept({ ...state, phase: { kind: "lobby" } });
}

/** 최종 순위를 발표한다. 확정한 라운드가 있어야 한다. */
export function finishGame(state: GameState): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (state.history.length === 0) return reject("nothing_played");
	return accept({ ...state, phase: { kind: "finished" } });
}

/** 최종 발표를 거두고 로비로 돌아간다(잘못 눌렀거나 라운드를 더 할 때). */
export function reopenGame(state: GameState): Transition {
	if (state.phase.kind !== "finished") return reject("wrong_phase");
	return accept({ ...state, phase: { kind: "lobby" } });
}

/** 입장과 순서표는 그대로 두고 라운드 기록만 지운다(리허설 뒤 등). */
export function resetGame(state: GameState): GameState {
	return { ...state, history: [], phase: { kind: "lobby" } };
}
