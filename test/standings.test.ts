import { describe, expect, it } from "vitest";
import type { RoundResult } from "../src/domain/game";
import type { Player } from "../src/domain/player";
import { pointsFor, roundPoints, standings } from "../src/domain/standings";

const player = (id: string, name: string): Player => ({ id, name, claimed: true });

const players = [player("a", "가람"), player("b", "나래"), player("c", "다솜"), player("d", "라온")];

const result = (no: number, participantIds: readonly string[], scores: Readonly<Record<string, number>>): RoundResult => ({
	no,
	gameId: "balloon",
	participantIds,
	scores,
});

describe("pointsFor", () => {
	it("30명 중 1등은 30점, 꼴등은 1점", () => {
		expect(pointsFor(1, 30)).toBe(30);
		expect(pointsFor(30, 30)).toBe(1);
	});

	it("기록이 없으면 0점", () => {
		expect(pointsFor(null, 30)).toBe(0);
	});
});

describe("roundPoints", () => {
	it("동점은 같은 등수라 같은 점수를 받는다", () => {
		expect(roundPoints(result(1, ["a", "b", "c", "d"], { a: 9, b: 7, c: 7, d: 1 }))).toEqual({ a: 4, b: 3, c: 3, d: 1 });
	});

	it("기록을 안 낸 참가자는 0점", () => {
		expect(roundPoints(result(1, ["a", "b", "c"], { a: 9, c: 5 }))).toEqual({ a: 3, c: 2, b: 0 });
	});
});

describe("standings", () => {
	it("라운드 점수를 더해 순위를 매긴다", () => {
		const table = standings(players, [
			result(1, ["a", "b", "c", "d"], { a: 4, b: 3, c: 2, d: 1 }),
			result(2, ["a", "b", "c", "d"], { a: 3, b: 1, c: 4, d: 2 }),
		]);
		expect(table.map((row) => [row.playerId, row.total, row.rank])).toEqual([
			["a", 7, 1],
			["c", 6, 2],
			["b", 4, 3],
			["d", 3, 4],
		]);
	});

	it("합계가 같으면 1등 횟수가 많은 쪽이 앞선다", () => {
		const table = standings(players, [result(1, ["a", "b"], { a: 9, b: 1 }), result(2, ["a", "b", "c"], { c: 9, b: 5, a: 1 })]);
		expect(table.map((row) => [row.playerId, row.total, row.wins, row.rank])).toEqual([
			["a", 3, 1, 1],
			["c", 3, 1, 1],
			["b", 3, 0, 3],
		]);
	});

	it("합계와 1등 횟수까지 같으면 같은 등수이고 이름순으로 세운다", () => {
		const table = standings(players, [result(1, ["d", "a"], { d: 5, a: 5 })]);
		expect(table.map((row) => [row.playerId, row.rank])).toEqual([
			["a", 1],
			["d", 1],
		]);
	});

	it("늦게 들어온 사람은 지난 라운드를 null로 남기고 0점으로 계산한다", () => {
		const table = standings(players, [result(1, ["a", "b"], { a: 9, b: 5 }), result(2, ["a", "b", "c"], { a: 1, b: 2, c: 3 })]);
		expect(table.find((row) => row.playerId === "c")?.perRound).toEqual([null, 3]);
		expect(table.find((row) => row.playerId === "a")?.perRound).toEqual([2, 1]);
	});

	it("한 번도 참가하지 않은 사람은 순위에 넣지 않는다", () => {
		const table = standings(players, [result(1, ["a", "b"], { a: 9, b: 5 })]);
		expect(table.map((row) => row.playerId)).toEqual(["a", "b"]);
	});

	it("아무도 기록을 못 낸 라운드는 모두 0점이고 1등도 없다", () => {
		const table = standings(players, [result(1, ["a", "b"], {})]);
		expect(table.map((row) => [row.playerId, row.total, row.wins, row.rank])).toEqual([
			["a", 0, 0, 1],
			["b", 0, 0, 1],
		]);
	});

	it("명단에서 빠진 사람의 기록은 순위에 나오지 않는다", () => {
		const table = standings([player("a", "가람")], [result(1, ["a", "z"], { a: 1, z: 9 })]);
		expect(table.map((row) => [row.playerId, row.total])).toEqual([["a", 1]]);
	});

	it("라운드가 없으면 빈 표", () => {
		expect(standings(players, [])).toEqual([]);
	});
});
