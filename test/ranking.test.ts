import { describe, expect, it } from "vitest";
import { rankScores } from "../src/domain/ranking";

const ids = ["a", "b", "c", "d", "e"];

describe("rankScores", () => {
	it("점수가 높은 순으로 세우고 같은 점수는 같은 등수를 준다", () => {
		expect(rankScores(ids, { a: 6, b: 10, c: 6, d: 2, e: 8 })).toEqual([
			{ playerId: "b", score: 10, rank: 1 },
			{ playerId: "e", score: 8, rank: 2 },
			{ playerId: "a", score: 6, rank: 3 },
			{ playerId: "c", score: 6, rank: 3 },
			{ playerId: "d", score: 2, rank: 5 },
		]);
	});

	it("기록을 내지 않은 사람은 등수 없이 맨 뒤에 둔다", () => {
		expect(rankScores(ids, { a: 3, c: 9 })).toEqual([
			{ playerId: "c", score: 9, rank: 1 },
			{ playerId: "a", score: 3, rank: 2 },
			{ playerId: "b", score: null, rank: null },
			{ playerId: "d", score: null, rank: null },
			{ playerId: "e", score: null, rank: null },
		]);
	});
});
