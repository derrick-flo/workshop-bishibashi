import { GAMES, type GameId } from "./games/catalog";
import type { Player, PlayerId, Scores } from "./player";
import { DEFAULT_SOLO_RULES, type SoloRules } from "./solo/rules";
import { type Bracket, byeCount, championOf, drawBracket, type Match, matchWinner, MIN_ENTRANTS, nextMatch } from "./tournament";

export const ROUND_TIMING = {
	/** 시작을 누른 뒤 게임이 열리기까지(준비 + 3·2·1) */
	leadMs: 4000,
	/** 게임이 끝난 뒤 기록을 더 기다리는 시간(느린 와이파이, 끊겼다 다시 붙는 폰 대비) */
	graceMs: 8000,
} as const;

/** 순서표에 넣을 수 있는 라운드 수 */
export const PLAN_LIMIT = 30;

/**
 * 진행 방식.
 * - points: 라운드마다 입장한 사람 모두가 같은 게임을 하고 등수로 점수를 받는다(합계로 최종 순위).
 * - tournament: 두 사람이 1:1로 붙어 이긴 쪽만 올라간다. 관전 화면(/arena)에서 둘의 플레이를 같이 본다.
 */
export type Mode = "points" | "tournament";

export const MODES: readonly Mode[] = ["points", "tournament"];

export function isMode(value: unknown): value is Mode {
	return value === "points" || value === "tournament";
}

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
	/** 라운드 시작 전 게임 설명(시연). 다음 라운드 게임은 순서표에서 잠긴다. 진행자가 다음을 누르면 시작한다. */
	| { readonly kind: "intro" }
	| { readonly kind: "playing"; readonly round: Round }
	/** 기록 받기를 끝내고 순위를 보여주는 중. 진행자가 확정하면 기록에 쌓인다. */
	| { readonly kind: "results"; readonly round: Round }
	/** 최종 순위 발표 */
	| { readonly kind: "finished" };

export type GameState = {
	readonly players: readonly Player[];
	readonly mode: Mode;
	/** 토너먼트 대진. 아직 안 짰으면 null. points 방식에서는 쓰지 않는다. */
	readonly bracket: Bracket | null;
	/** 토너먼트에서 부전승으로 정해 둔 사람. 대진을 짤 때 부전승 자리에 먼저 넣는다. 명단·순서표처럼 '처음부터'를 눌러도 남는다. */
	readonly byeIds: readonly PlayerId[];
	/** 라운드별 게임 순서. 앞의 lockedPlanLength개는 이미 했거나 하는 중이라 바꿀 수 없다. */
	readonly plan: readonly GameId[];
	readonly history: readonly RoundResult[];
	readonly phase: Phase;
	/** 혼자 하는 도전 세 종목(/reaction·/stopwatch·/circle)의 성공 기준. 라운드와 상관없다. */
	readonly soloRules: SoloRules;
};

export type Rejection =
	| "wrong_phase"
	| "wrong_mode"
	| "already_started"
	| "unknown_player"
	| "already_claimed"
	| "not_claimed"
	| "plan_too_long"
	| "no_next_game"
	| "no_next_match"
	| "not_enough_players"
	| "wrong_round"
	| "not_participant"
	| "already_submitted"
	| "too_late"
	| "invalid_score"
	| "tie_match"
	| "too_many_byes"
	| "nothing_played";

export type Transition = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly reason: Rejection };

export const EMPTY_GAME: GameState = {
	players: [],
	mode: "points",
	bracket: null,
	byeIds: [],
	plan: [],
	history: [],
	phase: { kind: "lobby" },
	soloRules: DEFAULT_SOLO_RULES,
};

const accept = (state: GameState): Transition => ({ ok: true, state });
const reject = (reason: Rejection): Transition => ({ ok: false, reason });

function findPlayer(state: GameState, playerId: PlayerId): Player | null {
	return state.players.find((player) => player.id === playerId) ?? null;
}

function setClaimed(state: GameState, playerId: PlayerId, claimed: boolean): GameState {
	return { ...state, players: state.players.map((player) => (player.id === playerId ? { ...player, claimed } : player)) };
}

/**
 * 명단을 바꾼다. 남은 이름은 입장 상태를 그대로 두고, 새 이름에만 새 id를 준다. 라운드 사이에만 할 수 있다.
 * 명단에서 빠진 사람은 부전승 지정도 풀린다.
 * 대진에 들어간 사람이 명단에서 빠지면 대진을 맞출 수 없어서 대진과 경기 기록을 비운다(다시 짜야 한다).
 */
export function setRoster(state: GameState, names: readonly string[], newId: () => PlayerId): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	const cleaned = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))];
	const players = cleaned.map((name): Player => state.players.find((player) => player.name === name) ?? { id: newId(), name, claimed: false });
	const ids = new Set(players.map((player) => player.id));
	const byeIds = state.byeIds.filter((id) => ids.has(id));
	const keepsBracket = state.bracket === null || state.bracket.slots.every((id) => id === null || ids.has(id));
	return accept(keepsBracket ? { ...state, players, byeIds } : { ...state, players, byeIds, bracket: null, history: [] });
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

/** 진행 방식을 고른다. 라운드를 하나라도 한 뒤에는 바꿀 수 없다. 바꾸면 짜 둔 대진은 지운다. */
export function setMode(state: GameState, mode: Mode): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (mode === state.mode) return accept(state);
	if (state.history.length > 0) return reject("already_started");
	return accept({ ...state, mode, bracket: null });
}

/**
 * 부전승으로 정해 둘 사람을 통째로 바꾼다. 토너먼트에서 첫 경기를 치르기 전까지만 바꿀 수 있다.
 * 명단에 없는 id는 버린다. 입장하지 않은 사람도 정해 둘 수 있다(대진을 짤 때 입장해 있어야 들어간다).
 */
export function setByes(state: GameState, playerIds: readonly PlayerId[]): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (state.mode !== "tournament") return reject("wrong_mode");
	if (state.history.length > 0) return reject("already_started");
	const known = new Set(state.players.map((player) => player.id));
	return accept({ ...state, byeIds: [...new Set(playerIds)].filter((id) => known.has(id)) });
}

/** 부전승으로 정해 둔 사람 가운데 지금 입장해 있는 사람. 대진에 들어가는 사람만 부전승 자리를 차지한다. */
export function chosenByes(state: GameState): readonly PlayerId[] {
	const joined = new Set(joinedPlayers(state).map((player) => player.id));
	return state.byeIds.filter((id) => joined.has(id));
}

/**
 * 입장한 사람으로 대진을 짠다. 부전승으로 정해 둔 사람은 부전승 자리에 먼저 넣고, 남은 부전승 자리는 무작위다.
 * 정해 둔 사람이 부전승 자리보다 많으면 거절한다. 경기를 하나라도 치른 뒤에는 다시 짤 수 없다.
 */
export function drawTournament(state: GameState, rng: () => number): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (state.mode !== "tournament") return reject("wrong_mode");
	if (state.history.length > 0) return reject("already_started");
	const entrants = joinedPlayers(state).map((player) => player.id);
	if (entrants.length < MIN_ENTRANTS) return reject("not_enough_players");
	const chosen = chosenByes(state);
	if (chosen.length > byeCount(entrants.length)) return reject("too_many_byes");
	return accept({ ...state, bracket: drawBracket(entrants, rng, chosen) });
}

/** 다음에 치를 1:1 경기. 토너먼트가 아니거나 대진을 안 짰거나 다 끝났으면 null */
export function currentMatch(state: GameState): Match | null {
	if (state.mode !== "tournament" || state.bracket === null) return null;
	return nextMatch(state.bracket, state.history);
}

/** 토너먼트 우승자. 결승이 끝나지 않았으면 null */
export function champion(state: GameState): PlayerId | null {
	if (state.mode !== "tournament" || state.bracket === null) return null;
	return championOf(state.bracket, state.history);
}

/** 순서표에서 바꿀 수 없는 앞부분 길이. 확정한 라운드에 지금 하는 라운드를 더한다. */
export function lockedPlanLength(state: GameState): number {
	// 토너먼트는 순서표를 경기 수만큼 돌려 쓰기 때문에 지나간 부분이 잠기지 않는다
	if (state.mode === "tournament") return 0;
	const inRound = state.phase.kind === "intro" || state.phase.kind === "playing" || state.phase.kind === "results";
	return state.history.length + (inRound ? 1 : 0);
}

/** 순서표에서 아직 안 한 부분을 upcoming으로 바꾼다. */
export function setPlan(state: GameState, upcoming: readonly GameId[]): Transition {
	const plan = [...state.plan.slice(0, lockedPlanLength(state)), ...upcoming];
	if (plan.length > PLAN_LIMIT) return reject("plan_too_long");
	return accept({ ...state, plan });
}

/**
 * 혼자 하는 도전 성공 기준을 바꾼다. 파티 게임과 상관없어서 어느 단계에서든 할 수 있고 거절되지 않는다.
 * 폰은 바뀐 기준을 바로 받고, 그 뒤에 끝나는 도전부터 이 기준으로 본다.
 */
export function setSoloRules(state: GameState, soloRules: SoloRules): GameState {
	return { ...state, soloRules };
}

/** 다음 라운드 게임. 토너먼트는 경기 수가 순서표보다 많아서 순서표를 처음부터 돌려 쓴다. */
export function nextGame(state: GameState): GameId | null {
	if (state.plan.length === 0) return null;
	const index = state.mode === "tournament" ? state.history.length % state.plan.length : state.history.length;
	return state.plan[index] ?? null;
}

/** 지금 입장해 있는 사람. 라운드를 시작하면 이 사람들이 참가자가 된다. */
export function joinedPlayers(state: GameState): readonly Player[] {
	return state.players.filter((player) => player.claimed);
}

/** 이번 라운드를 뛰는 사람. 토너먼트는 다음 경기의 두 사람, 그 밖에는 입장한 사람 모두. 없으면 null */
function roundParticipants(state: GameState): readonly PlayerId[] | null {
	if (state.mode === "tournament") {
		const match = currentMatch(state);
		return match === null || match.aId === null || match.bId === null ? null : [match.aId, match.bId];
	}
	// 혼자서도 시작할 수 있다(테스트용)
	const ids = joinedPlayers(state).map((player) => player.id);
	return ids.length === 0 ? null : ids;
}

/** 다음 라운드 게임 설명을 띄운다 */
export function openIntro(state: GameState): Transition {
	if (state.phase.kind !== "lobby") return reject("wrong_phase");
	if (nextGame(state) === null) return reject("no_next_game");
	if (roundParticipants(state) === null) return reject(state.mode === "tournament" ? "no_next_match" : "not_enough_players");
	return accept({ ...state, phase: { kind: "intro" } });
}

/** 설명을 접고 로비로 돌아간다(게임을 바꾸러) */
export function closeIntro(state: GameState): Transition {
	if (state.phase.kind !== "intro") return reject("wrong_phase");
	return accept({ ...state, phase: { kind: "lobby" } });
}

/** 라운드를 시작한다. 보통은 설명 단계에서, 설명 없이 로비에서 바로 시작할 수도 있다. */
export function startRound(state: GameState, seed: number, now: number): Transition {
	if (state.phase.kind !== "lobby" && state.phase.kind !== "intro") return reject("wrong_phase");
	const gameId = nextGame(state);
	if (gameId === null) return reject("no_next_game");
	const participantIds = roundParticipants(state);
	if (participantIds === null) return reject(state.mode === "tournament" ? "no_next_match" : "not_enough_players");

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

/**
 * 결과를 확정해 기록에 쌓고 로비로 돌아간다.
 * 토너먼트는 승자가 갈려야 확정할 수 있고(동점이면 재경기), 결승이 끝나면 바로 최종 발표로 넘어간다.
 */
export function confirmRound(state: GameState): Transition {
	if (state.phase.kind !== "results") return reject("wrong_phase");
	const { no, gameId, participantIds, scores } = state.phase.round;
	const result: RoundResult = { no, gameId, participantIds, scores };
	if (state.mode === "tournament" && matchWinner(result) === null) return reject("tie_match");
	const played = { ...state, history: [...state.history, result] };
	const over = state.mode === "tournament" && champion(played) !== null;
	return accept({ ...played, phase: over ? { kind: "finished" } : { kind: "lobby" } });
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

/** 입장과 순서표는 그대로 두고 라운드 기록만 지운다(리허설 뒤 등). 토너먼트 대진도 지워서 다시 짜게 한다. */
export function resetGame(state: GameState): GameState {
	return { ...state, bracket: null, history: [], phase: { kind: "lobby" } };
}
