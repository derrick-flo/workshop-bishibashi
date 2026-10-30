import { describe, expect, it } from "vitest";
import { EMPTY_GAME, type GameState } from "../src/domain/game";
import { DEFAULT_SOLO_RULES, type SoloRules } from "../src/domain/solo/rules";
import { restoreGame } from "../src/server/restore";

const EASIER: SoloRules = { reactionPassMs: 400, stopwatchAllowedMs: 1200, circlePassPercent: 80 };

describe("restoreGame", () => {
	it("지금 형식은 그대로 불러온다", () => {
		const saved: GameState = {
			players: [{ id: "p1", name: "가람", claimed: true }],
			mode: "points",
			bracket: null,
			byeIds: [],
			plan: ["eye", "balloon"],
			history: [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }],
			phase: { kind: "lobby" },
			soloRules: EASIER,
		};
		expect(restoreGame(structuredClone(saved))).toEqual(saved);
	});

	it("혼자 하는 도전 기준이 없거나 범위를 벗어난 저장본은 기본 기준으로 채운다", () => {
		const base = { players: [], plan: [], history: [], phase: { kind: "lobby" } };
		expect(restoreGame(base).soloRules).toEqual(DEFAULT_SOLO_RULES);
		expect(restoreGame({ ...base, soloRules: { reactionPassMs: 9999 } }).soloRules).toEqual(DEFAULT_SOLO_RULES);
		expect(restoreGame({ ...base, soloRules: EASIER }).soloRules).toEqual(EASIER);
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
			soloRules: EASIER,
		};
		expect(restoreGame(saved)).toEqual({ ...saved, mode: "points", bracket: null, byeIds: [], plan: ["eye", "balloon"] });
	});

	it("없어진 게임으로 이미 라운드를 했으면 기록은 비우고 명단·입장과 순서표만 살린다", () => {
		const players = [{ id: "p1", name: "가람", claimed: true }];
		const saved = {
			players,
			plan: ["reaction", "eye"],
			history: [{ no: 1, gameId: "reaction", participantIds: ["p1"], scores: { p1: 700 } }],
			phase: { kind: "lobby" },
			soloRules: EASIER,
		};
		// 기록은 비우더라도 진행자가 맞춰 둔 도전 기준은 살린다
		expect(restoreGame(saved)).toEqual({ ...EMPTY_GAME, players, plan: ["eye"], soloRules: EASIER });
	});

	it("진행 중이던 라운드가 없어진 게임이면 그 라운드만 취소하고 확정 기록은 남긴다", () => {
		const history = [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }];
		const players = [{ id: "p1", name: "가람", claimed: true }];
		const round = { no: 2, gameId: "reaction", seed: 1, playAt: 0, endAt: 1, deadlineAt: 2, participantIds: ["p1"], scores: {} };
		const playing = { players, plan: ["eye", "reaction", "balloon"], history, phase: { kind: "playing", round }, soloRules: EASIER };
		const expected = { players, mode: "points", bracket: null, byeIds: [], plan: ["eye", "balloon"], history, phase: { kind: "lobby" }, soloRules: EASIER };
		expect(restoreGame(playing)).toEqual(expected);
		expect(restoreGame({ ...playing, phase: { kind: "intro" } })).toEqual(expected);
	});

	it("방식·대진이 없던 저장본은 점수전으로 본다", () => {
		const saved = { players: [], plan: ["eye"], history: [], phase: { kind: "lobby" }, soloRules: EASIER, bracket: { slots: ["p1", "p2"] } };
		const restored = restoreGame(saved);
		// 점수전에서는 대진을 쓰지 않으므로 저장본에 남아 있어도 버린다
		expect(restored.mode).toBe("points");
		expect(restored.bracket).toBeNull();
	});

	it("토너먼트는 대진을 함께 살린다", () => {
		const players = [
			{ id: "p1", name: "가람", claimed: true },
			{ id: "p2", name: "나래", claimed: true },
		];
		const saved = {
			players,
			mode: "tournament",
			bracket: { slots: ["p1", "p2"] },
			byeIds: ["p2"],
			plan: ["eye"],
			history: [{ no: 1, gameId: "eye", participantIds: ["p1", "p2"], scores: { p1: 3, p2: 1 } }],
			phase: { kind: "finished" },
			soloRules: EASIER,
		};
		expect(restoreGame(structuredClone(saved))).toEqual(saved);
	});

	it("토너먼트인데 대진을 알아볼 수 없으면 명단·순서표만 살리고 처음 상태로 둔다", () => {
		const players = [{ id: "p1", name: "가람", claimed: true }];
		for (const bracket of [undefined, null, "p1", { slots: "p1" }, { slots: ["p1", "p2", "p3"] }, { slots: ["p1", 7] }]) {
			const saved = {
				players,
				mode: "tournament",
				bracket,
				plan: ["eye"],
				history: [{ no: 1, gameId: "eye", participantIds: ["p1"], scores: { p1: 3 } }],
				phase: { kind: "lobby" },
				soloRules: EASIER,
			};
			expect(restoreGame(saved)).toEqual({ ...EMPTY_GAME, players, plan: ["eye"], soloRules: EASIER, mode: "tournament" });
		}
	});

	it("부전승 지정은 명단에 있는 사람만 살리고, 없던 저장본은 빈 목록으로 둔다", () => {
		const players = [
			{ id: "p1", name: "가람", claimed: true },
			{ id: "p2", name: "나래", claimed: false },
		];
		const base = { players, mode: "tournament", plan: ["eye"], history: [], phase: { kind: "lobby" }, soloRules: EASIER, bracket: null };
		expect(restoreGame({ ...base, byeIds: ["p2", "사라진 사람", 7, "p1"] }).byeIds).toEqual(["p2", "p1"]);
		expect(restoreGame(base).byeIds).toEqual([]);
		expect(restoreGame({ ...base, byeIds: "p1" }).byeIds).toEqual([]);
	});

	it("알아볼 수 없으면 빈 상태", () => {
		for (const raw of [undefined, null, "game", [], {}, { players: "x" }]) {
			expect(restoreGame(raw)).toEqual(EMPTY_GAME);
		}
	});
});
