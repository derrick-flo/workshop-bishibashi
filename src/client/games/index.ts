import type { GameId } from "../../domain/games/catalog";
import { mountBalloon } from "./balloon";
import { mountCandy } from "./candy";
import { mountCups } from "./cups";
import { mountEye } from "./eye";
import { mountGrill } from "./grill";
import { mountJudge } from "./judge";
import { mountMemory } from "./memory";
import { mountMonster } from "./monster";
import { mountShooting } from "./shooting";
import { mountStairs } from "./stairs";
import { mountTreasure } from "./treasure";
import type { MountGame } from "./types";

export const MOUNTS: Readonly<Record<GameId, MountGame>> = {
	balloon: mountBalloon,
	candy: mountCandy,
	eye: mountEye,
	monster: mountMonster,
	judge: mountJudge,
	shooting: mountShooting,
	stairs: mountStairs,
	grill: mountGrill,
	memory: mountMemory,
	cups: mountCups,
	treasure: mountTreasure,
};
