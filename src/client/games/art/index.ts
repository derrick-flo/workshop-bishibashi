import { GAMES, type GameId } from "../../../domain/games/catalog";
import type { Bitmap } from "../../pixel/bitmap";
import { toSvg } from "../../pixel/svg";
import { BALLOON_ICON } from "./balloon";
import { CANDY_ICON } from "./candy";
import { DUEL_ICON } from "./duel";
import { EYE_ICON } from "./eye";

export type GameArt = {
	/** 16×16 아이콘 */
	readonly icon: Bitmap;
};

/**
 * 픽셀 그림이 있는 게임. 아직 그림이 없는 게임은 화면에서 이모지로 대신한다
 * (새 게임을 들여와도 그림을 그리기 전까지 그대로 돌아가게).
 */
export const GAME_ART: Readonly<Partial<Record<GameId, GameArt>>> = {
	balloon: { icon: BALLOON_ICON },
	candy: { icon: CANDY_ICON },
	eye: { icon: EYE_ICON },
	reaction: { icon: DUEL_ICON },
};

/** 게임 아이콘 HTML. 그림이 없는 게임은 이모지로 대신한다. */
export function gameIcon(id: GameId, className = "ax-game-icon"): string {
	const art = GAME_ART[id];
	return art === undefined ? `<span class="${className} is-emoji" aria-hidden="true">${GAMES[id].emoji}</span>` : toSvg(art.icon, `px-art ${className}`);
}
