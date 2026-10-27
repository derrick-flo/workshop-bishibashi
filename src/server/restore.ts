import { EMPTY_GAME, type GameState } from "../domain/game";
import { isGameId } from "../domain/games/catalog";
import type { Player } from "../domain/player";
import { readSoloRules } from "../domain/solo/rules";

const PHASES: ReadonlySet<string> = new Set(["lobby", "intro", "playing", "results", "finished"]);

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayer(value: unknown): value is Player {
	return isFields(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.claimed === "boolean";
}

/**
 * 이제 없는 게임(예: 빠진 총잡이 결투)을 걸러 낸다. 순서표에서는 빼고,
 * 진행 중이던 라운드(설명·게임·결과)가 그 게임이면 그 라운드만 취소한다(확정 기록은 남긴다).
 * 확정한 라운드에 그 게임이 있으면 기록을 맞출 수 없으니 기록은 비우고 명단·입장과 순서표만 살린다.
 */
function withoutRemovedGames(saved: GameState): GameState {
	const plan = saved.plan.filter(isGameId);
	if (!saved.history.every((round) => isGameId(round.gameId)))
		return { ...EMPTY_GAME, players: saved.players, plan, soloRules: saved.soloRules };
	const phase = saved.phase;
	const current =
		phase.kind === "playing" || phase.kind === "results" ? phase.round.gameId : phase.kind === "intro" ? saved.plan[saved.history.length] : undefined;
	const cancelled = current !== undefined && !isGameId(current);
	if (!cancelled && plan.length === saved.plan.length) return saved;
	return { ...saved, plan, phase: cancelled ? { kind: "lobby" } : phase };
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
	if (isCurrent) return withoutRemovedGames({ ...(raw as GameState), soloRules });
	const players = raw.players.filter(isPlayer).map(({ id, name, claimed }): Player => ({ id, name, claimed }));
	return { ...EMPTY_GAME, players, soloRules };
}
