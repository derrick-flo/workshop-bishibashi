import { describe, expect, it } from "vitest";
import { PLAN_LIMIT } from "../src/domain/game";
import { DEFAULT_SOLO_RULES, SOLO_RULE_LIMITS } from "../src/domain/solo/rules";
import { isHostMessage, parseClientMessage } from "../src/protocol";

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe("parseClientMessage", () => {
	it("참가자 메시지를 해석한다", () => {
		expect(parse({ type: "hello", token: "abc" })).toEqual({ type: "hello", token: "abc" });
		expect(parse({ type: "hello", token: null })).toEqual({ type: "hello", token: null });
		expect(parse({ type: "claim", playerId: "p1" })).toEqual({ type: "claim", playerId: "p1" });
		expect(parse({ type: "submit", roundNo: 2, playAt: 1_004_000, score: 1679 })).toEqual({ type: "submit", roundNo: 2, playAt: 1_004_000, score: 1679 });
	});

	it("진행자 메시지를 해석한다", () => {
		expect(parse({ type: "setRoster", names: ["김철수", "이영희"] })).toEqual({ type: "setRoster", names: ["김철수", "이영희"] });
		expect(parse({ type: "setPlan", gameIds: ["eye", "balloon", "eye"] })).toEqual({ type: "setPlan", gameIds: ["eye", "balloon", "eye"] });
		expect(parse({ type: "setPlan", gameIds: [] })).toEqual({ type: "setPlan", gameIds: [] });
		for (const type of ["openIntro", "closeIntro", "startRound", "closeRound", "confirmRound", "cancelRound", "finishGame", "reopenGame", "reset"]) {
			expect(parse({ type })).toEqual({ type });
		}
		expect(parse({ type: "release", playerId: "p3" })).toEqual({ type: "release", playerId: "p3" });
		const rules = { reactionPassMs: 400, stopwatchAllowedMs: 1200, circlePassPercent: 80 };
		expect(parse({ type: "setSoloRules", rules })).toEqual({ type: "setSoloRules", rules });
		expect(parse({ type: "setSoloRules", rules: DEFAULT_SOLO_RULES })).toEqual({ type: "setSoloRules", rules: DEFAULT_SOLO_RULES });
	});

	it("필요한 필드만 남기고 나머지는 버린다", () => {
		expect(parse({ type: "submit", roundNo: 1, playAt: 5, score: 10, playerId: "p9" })).toEqual({ type: "submit", roundNo: 1, playAt: 5, score: 10 });
	});

	it("JSON이 아니거나 모르는 종류면 null", () => {
		expect(parseClientMessage("{oops")).toBeNull();
		expect(parse({ type: "dropTable" })).toBeNull();
		expect(parse(["claim", "p1"])).toBeNull();
		expect(parse(null)).toBeNull();
	});

	it("탈락전에서 쓰던 메시지는 더 받지 않는다", () => {
		for (const type of ["prepareRound", "toggleCut", "confirmCut", "setStatus"]) {
			expect(parse({ type, playerId: "p1", gameId: "eye", cutCount: 1, status: "out" })).toBeNull();
		}
	});

	it("필드 형식이 틀리면 null", () => {
		expect(parse({ type: "claim", playerId: 1 })).toBeNull();
		expect(parse({ type: "submit", roundNo: 1, playAt: 5, score: "1000" })).toBeNull();
		expect(parse({ type: "submit", roundNo: 1.5, playAt: 5, score: 1000 })).toBeNull();
		expect(parse({ type: "submit", roundNo: 1, score: 1000 })).toBeNull();
		expect(parse({ type: "setPlan", gameIds: ["tetris"] })).toBeNull();
		expect(parse({ type: "setPlan", gameIds: "eye" })).toBeNull();
		expect(parse({ type: "setPlan", gameIds: Array.from({ length: PLAN_LIMIT + 1 }, () => "eye") })).toBeNull();
		expect(parse({ type: "setRoster", names: "김철수" })).toBeNull();
		expect(parse({ type: "setRoster", names: ["김철수", 3] })).toBeNull();
		expect(parse({ type: "setRoster", names: Array.from({ length: 101 }, (_, i) => `사람${i}`) })).toBeNull();
		expect(parse({ type: "hello", token: "x".repeat(200) })).toBeNull();
		expect(parse({ type: "setSoloRules", rules: { ...DEFAULT_SOLO_RULES, reactionPassMs: SOLO_RULE_LIMITS.reactionPassMs.max + 1 } })).toBeNull();
		expect(parse({ type: "setSoloRules", rules: { reactionPassMs: 230 } })).toBeNull();
		expect(parse({ type: "setSoloRules", rules: "230" })).toBeNull();
		expect(parse({ type: "setSoloRules" })).toBeNull();
	});
});

describe("isHostMessage", () => {
	it("진행을 바꾸는 메시지만 진행자 메시지로 본다", () => {
		expect(isHostMessage({ type: "startRound" })).toBe(true);
		expect(isHostMessage({ type: "setPlan", gameIds: [] })).toBe(true);
		expect(isHostMessage({ type: "confirmRound" })).toBe(true);
		expect(isHostMessage({ type: "openIntro" })).toBe(true);
		expect(isHostMessage({ type: "closeIntro" })).toBe(true);
		expect(isHostMessage({ type: "release", playerId: "p1" })).toBe(true);
		expect(isHostMessage({ type: "setSoloRules", rules: DEFAULT_SOLO_RULES })).toBe(true);
		expect(isHostMessage({ type: "claim", playerId: "p1" })).toBe(false);
		expect(isHostMessage({ type: "hello", token: null })).toBe(false);
		expect(isHostMessage({ type: "submit", roundNo: 1, playAt: 5, score: 1 })).toBe(false);
	});
});
