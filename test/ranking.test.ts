import { describe, expect, it } from "vitest";
import { decideCut, rankScores } from "../src/domain/ranking";

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

describe("decideCut", () => {
	it("점수가 낮은 사람부터 정한 인원만큼 탈락시킨다", () => {
		expect(decideCut(ids, { a: 10, b: 8, c: 6, d: 4, e: 2 }, 2)).toEqual(["d", "e"]);
	});

	it("탈락선에 걸친 동점자는 살린다", () => {
		expect(decideCut(ids, { a: 10, b: 8, c: 6, d: 6, e: 2 }, 2)).toEqual(["e"]);
	});

	it("기록을 내지 않은 사람을 탈락 인원에 먼저 넣는다", () => {
		expect(decideCut(ids, { a: 10, b: 8, c: 6, e: 2 }, 2)).toEqual(["d", "e"]);
	});

	it("기록을 안 낸 사람이 탈락 인원보다 많으면 그 사람들만 모두 탈락한다", () => {
		expect(decideCut(ids, { a: 10, e: 2 }, 2)).toEqual(["b", "c", "d"]);
	});

	it("탈락 인원이 0이면 기록을 안 낸 사람도 살린다", () => {
		expect(decideCut(ids, { a: 10 }, 0)).toEqual([]);
	});

	it("전원이 같은 점수면 아무도 탈락하지 않는다", () => {
		expect(decideCut(ids, { a: 5, b: 5, c: 5, d: 5, e: 5 }, 2)).toEqual([]);
	});

	it("아무도 기록을 내지 않으면 라운드를 무효로 보고 아무도 탈락시키지 않는다", () => {
		expect(decideCut(ids, {}, 2)).toEqual([]);
	});
});
