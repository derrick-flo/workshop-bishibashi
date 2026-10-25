import type { GameId } from "../../domain/games/catalog";
import { mountBalloon } from "./balloon";
import { mountCandy } from "./candy";
import { mountEye } from "./eye";
import { mountReaction } from "./reaction";
import type { MountGame } from "./types";

export const MOUNTS: Readonly<Record<GameId, MountGame>> = {
	balloon: mountBalloon,
	candy: mountCandy,
	eye: mountEye,
	reaction: mountReaction,
};
