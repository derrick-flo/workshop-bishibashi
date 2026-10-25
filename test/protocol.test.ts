import { describe, expect, it } from "vitest";
import { isHostMessage, parseClientMessage } from "../src/protocol";

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe("parseClientMessage", () => {
	it("참가자 메시지를 해석한다", () => {
		expect(parse({ type: "hello", token: "abc" })).toEqual({ type: "hello", token: "abc" });
		expect(parse({ type: "hello", token: null })).toEqual({ type: "hello", token: null });
		expect(parse({ type: "claim", playerId: "p1" })).toEqual({ type: "claim", playerId: "p1" });
		expect(parse({ type: "submit", roundNo: 2, score: 1679 })).toEqual({ type: "submit", roundNo: 2, score: 1679 });
	});

	it("진행자 메시지를 해석한다", () => {
		expect(parse({ type: "setRoster", names: ["김철수", "이영희"] })).toEqual({ type: "setRoster", names: ["김철수", "이영희"] });
		expect(parse({ type: "prepareRound", gameId: "eye", cutCount: 3 })).toEqual({ type: "prepareRound", gameId: "eye", cutCount: 3 });
		expect(parse({ type: "setStatus", playerId: "p3", status: "out" })).toEqual({ type: "setStatus", playerId: "p3", status: "out" });
		expect(parse({ type: "startRound" })).toEqual({ type: "startRound" });
	});

	it("필요한 필드만 남기고 나머지는 버린다", () => {
		expect(parse({ type: "submit", roundNo: 1, score: 10, playerId: "p9" })).toEqual({ type: "submit", roundNo: 1, score: 10 });
	});

	it("JSON이 아니거나 모르는 종류면 null", () => {
		expect(parseClientMessage("{oops")).toBeNull();
		expect(parse({ type: "dropTable" })).toBeNull();
		expect(parse(["claim", "p1"])).toBeNull();
		expect(parse(null)).toBeNull();
	});

	it("필드 형식이 틀리면 null", () => {
		expect(parse({ type: "claim", playerId: 1 })).toBeNull();
		expect(parse({ type: "submit", roundNo: 1, score: "1000" })).toBeNull();
		expect(parse({ type: "submit", roundNo: 1.5, score: 1000 })).toBeNull();
		expect(parse({ type: "prepareRound", gameId: "tetris", cutCount: 1 })).toBeNull();
		expect(parse({ type: "setStatus", playerId: "p1", status: "lobby" })).toBeNull();
		expect(parse({ type: "setRoster", names: "김철수" })).toBeNull();
		expect(parse({ type: "setRoster", names: ["김철수", 3] })).toBeNull();
		expect(parse({ type: "setRoster", names: Array.from({ length: 101 }, (_, i) => `사람${i}`) })).toBeNull();
		expect(parse({ type: "hello", token: "x".repeat(200) })).toBeNull();
	});
});

describe("isHostMessage", () => {
	it("진행을 바꾸는 메시지만 진행자 메시지로 본다", () => {
		expect(isHostMessage({ type: "startRound" })).toBe(true);
		expect(isHostMessage({ type: "release", playerId: "p1" })).toBe(true);
		expect(isHostMessage({ type: "claim", playerId: "p1" })).toBe(false);
		expect(isHostMessage({ type: "hello", token: null })).toBe(false);
	});
});
