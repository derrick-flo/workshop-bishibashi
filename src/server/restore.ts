import { EMPTY_GAME, type GameState, isMode, type Mode } from "../domain/game";
import { isGameId } from "../domain/games/catalog";
import type { Player, PlayerId } from "../domain/player";
import { readSoloRules } from "../domain/solo/rules";
import { type Bracket, readBracket } from "../domain/tournament";

const PHASES: ReadonlySet<string> = new Set(["lobby", "intro", "playing", "results", "finished"]);

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayer(value: unknown): value is Player {
	return isFields(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.claimed === "boolean";
}

/** 저장된 부전승 지정. 명단에 있는 사람만 남긴다(지정이 없던 때의 저장본은 빈 목록). */
function readByeIds(value: unknown, players: readonly Player[]): readonly PlayerId[] {
	if (!Array.isArray(value)) return [];
	const known = new Set(players.map((player) => player.id));
	return value.filter((id): id is PlayerId => typeof id === "string" && known.has(id));
}

/**
 * 이제 없는 게임(예: 빠진 총잡이 결투)을 걸러 낸다. 순서표에서는 빼고,
 * 진행 중이던 라운드(설명·게임·결과)가 그 게임이면 그 라운드만 취소한다(확정 기록은 남긴다).
 * 확정한 라운드에 그 게임이 있으면 기록을 맞출 수 없으니 기록은 비우고 명단·입장과 순서표만 살린다.
 */
function withoutRemovedGames(saved: GameState): GameState {
	const plan = saved.plan.filter(isGameId);
	if (!saved.history.every((round) => isGameId(round.gameId)))
		return { ...EMPTY_GAME, players: saved.players, plan, soloRules: saved.soloRules, mode: saved.mode, byeIds: saved.byeIds };
	const phase = saved.phase;
	const current =
		phase.kind === "playing" || phase.kind === "results" ? phase.round.gameId : phase.kind === "intro" ? saved.plan[saved.history.length] : undefined;
	const cancelled = current !== undefined && !isGameId(current);
	if (!cancelled && plan.length === saved.plan.length) return saved;
	return { ...saved, plan, phase: cancelled ? { kind: "lobby" } : phase };
}

/**
 * 토너먼트 대진을 맞춰 넣는다. 토너먼트인데 대진을 알아볼 수 없으면 경기 기록을 맞출 수 없어서
 * 명단·입장과 순서표만 살리고 처음 상태로 둔다(대진을 다시 짠다).
 */
function withBracket(saved: GameState, bracket: Bracket | null): GameState {
	if (saved.mode !== "tournament") return { ...saved, bracket: null };
	if (bracket !== null) return { ...saved, bracket };
	return { ...EMPTY_GAME, players: saved.players, plan: saved.plan, soloRules: saved.soloRules, mode: "tournament", byeIds: saved.byeIds };
}

/**
 * 저장해 둔 상태를 불러온다. 지금 형식이면 없어진 게임만 걸러 그대로 쓰고,
 * 예전(탈락전) 형식이면 명단과 입장만 살려 처음 상태로 둔다. 알아볼 수 없으면 빈 상태.
 */
export function restoreGame(raw: unknown): GameState {
	if (!isFields(raw) || !Array.isArray(raw.players)) return EMPTY_GAME;
	const isCurrent =
		Array.isArray(raw.plan) && Array.isArray(raw.history) && isFields(raw.phase) && PHASES.has(String(raw.phase.kind));
	// 혼자 하는 도전 기준이 없던 때의 저장본도 있어서 기준은 따로 읽는다(알아볼 수 없으면 기본 기준)
	const soloRules = readSoloRules(raw.soloRules);
	// 방식·대진이 없던 때의 저장본은 점수전으로 본다
	const mode: Mode = isMode(raw.mode) ? raw.mode : "points";
	if (isCurrent) {
		const saved = raw as GameState;
		const byeIds = readByeIds(raw.byeIds, saved.players);
		return withoutRemovedGames(withBracket({ ...saved, soloRules, mode, byeIds }, readBracket(raw.bracket)));
	}
	const players = raw.players.filter(isPlayer).map(({ id, name, claimed }): Player => ({ id, name, claimed }));
	return { ...EMPTY_GAME, players, soloRules, mode };
}
