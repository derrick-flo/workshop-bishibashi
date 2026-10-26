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

	it("순서표에 없어진 게임이 있으면 그 게임만 빼고 나머지는 그대로 둔다", () => {
		const saved = {
			players: [{ id: "p1", name: "가람", claimed: true }],
			plan: ["eye", "reaction", "balloon"],
			history: [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }],
			phase: { kind: "lobby" },
		};
		expect(restoreGame(saved)).toEqual({ ...saved, plan: ["eye", "balloon"] });
	});

	it("없어진 게임으로 이미 라운드를 했으면 기록은 비우고 명단·입장과 순서표만 살린다", () => {
		const players = [{ id: "p1", name: "가람", claimed: true }];
		const saved = {
			players,
			plan: ["reaction", "eye"],
			history: [{ no: 1, gameId: "reaction", participantIds: ["p1"], scores: { p1: 700 } }],
			phase: { kind: "lobby" },
		};
		expect(restoreGame(saved)).toEqual({ ...EMPTY_GAME, players, plan: ["eye"] });
	});

	it("진행 중이던 라운드가 없어진 게임이면 그 라운드만 취소하고 확정 기록은 남긴다", () => {
		const history = [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }];
		const players = [{ id: "p1", name: "가람", claimed: true }];
		const round = { no: 2, gameId: "reaction", seed: 1, playAt: 0, endAt: 1, deadlineAt: 2, participantIds: ["p1"], scores: {} };
		const playing = { players, plan: ["eye", "reaction", "balloon"], history, phase: { kind: "playing", round } };
		expect(restoreGame(playing)).toEqual({ players, plan: ["eye", "balloon"], history, phase: { kind: "lobby" } });
		const intro = { ...playing, phase: { kind: "intro" } };
		expect(restoreGame(intro)).toEqual({ players, plan: ["eye", "balloon"], history, phase: { kind: "lobby" } });
	});

	it("알아볼 수 없으면 빈 상태", () => {
		for (const raw of [undefined, null, "game", [], {}, { players: "x" }]) {
			expect(restoreGame(raw)).toEqual(EMPTY_GAME);
		}
	});
});
