import { EMPTY_GAME, type GameState } from "../domain/game";
import type { Player } from "../domain/player";

const PHASES: ReadonlySet<string> = new Set(["lobby", "playing", "results", "finished"]);

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayer(value: unknown): value is Player {
	return isFields(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.claimed === "boolean";
}

/**
 * 저장해 둔 상태를 불러온다. 지금 형식이면 그대로 쓰고,
 * 예전(탈락전) 형식이면 명단과 입장만 살려 처음 상태로 둔다. 알아볼 수 없으면 빈 상태.
 */
export function restoreGame(raw: unknown): GameState {
	if (!isFields(raw) || !Array.isArray(raw.players)) return EMPTY_GAME;
	const isCurrent =
		Array.isArray(raw.plan) && Array.isArray(raw.history) && isFields(raw.phase) && PHASES.has(String(raw.phase.kind));
	if (isCurrent) return raw as GameState;
	const players = raw.players.filter(isPlayer).map(({ id, name, claimed }): Player => ({ id, name, claimed }));
	return { ...EMPTY_GAME, players };
}
