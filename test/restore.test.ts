import { describe, expect, it } from "vitest";
import { EMPTY_GAME, type GameState } from "../src/domain/game";
import { restoreGame } from "../src/server/restore";

describe("restoreGame", () => {
	it("지금 형식은 그대로 불러온다", () => {
		const saved: GameState = {
			players: [{ id: "p1", name: "가람", claimed: true }],
			plan: ["eye", "balloon"],
			history: [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }],
			phase: { kind: "lobby" },
		};
		expect(restoreGame(structuredClone(saved))).toEqual(saved);
	});

	it("예전 탈락전 형식이면 명단과 입장만 살린다", () => {
		const old = {
			players: [
				{ id: "p1", name: "가람", claimed: true, status: "alive" },
				{ id: "p2", name: "나래", claimed: false, status: "out" },
			],
			phase: { kind: "finished", winnerIds: ["p1"] },
			roundsPlayed: 3,
			upcoming: null,
		};
		expect(restoreGame(old)).toEqual({
			...EMPTY_GAME,
			players: [
				{ id: "p1", name: "가람", claimed: true },
				{ id: "p2", name: "나래", claimed: false },
			],
		});
	});

	it("알아볼 수 없으면 빈 상태", () => {
		for (const raw of [undefined, null, "game", [], {}, { players: "x" }]) {
			expect(restoreGame(raw)).toEqual(EMPTY_GAME);
		}
	});
});
