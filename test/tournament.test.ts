import { describe, expect, it } from "vitest";
import { createRng } from "../src/domain/random";
import {
	type Bracket,
	bracketRounds,
	bracketSize,
	byeCount,
	championOf,
	drawBracket,
	entrantCount,
	matchTotal,
	matchWinner,
	nextMatch,
	readBracket,
	roundTitle,
	seedOrder,
} from "../src/domain/tournament";

/** 섞지 않는 난수(1에 가까우면 피셔-예이츠가 제자리를 고른다). 대진을 눈으로 따라갈 수 있게 한다. */
const inOrder = () => 0.999999;

/** a~e 5명을 섞지 않고 짠 대진: 8자리 중 세 자리가 비어 부전승 세 번이 생긴다 */
const FIVE: Bracket = drawBracket(["a", "b", "c", "d", "e"], inOrder);

describe("bracketSize", () => {
	it("사람 수를 담는 가장 작은 2의 거듭제곱", () => {
		expect([0, 1, 2, 3, 4, 5, 8, 9, 16, 17, 30, 32].map(bracketSize)).toEqual([2, 2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 32]);
	});
});

describe("seedOrder", () => {
	it("1번 시드와 꼴찌 시드가 양 끝에서 만난다", () => {
		expect(seedOrder(2)).toEqual([1, 2]);
		expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
		expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
	});

	it("자리 수만큼의 시드를 한 번씩 쓴다", () => {
		for (const size of [2, 4, 8, 16, 32]) {
			expect([...seedOrder(size)].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i + 1));
		}
	});
});

describe("drawBracket", () => {
	it("사람이 모자란 자리는 빈자리가 되고 부전승이 대진표에 퍼진다", () => {
		expect(FIVE.slots).toEqual(["a", null, "d", "e", "b", null, "c", null]);
		expect(entrantCount(FIVE)).toBe(5);
		// 부전승은 세지 않으므로 5명이면 4경기
		expect(matchTotal(FIVE)).toBe(4);
	});

	it("한 경기에 두 자리가 다 비는 일은 없다(절반 넘게 채워지므로)", () => {
		for (let count = 2; count <= 40; count++) {
			const ids = Array.from({ length: count }, (_, i) => `p${i}`);
			const { slots } = drawBracket(ids, inOrder);
			for (let slot = 0; slot * 2 < slots.length; slot++) {
				expect(slots[slot * 2] === null && slots[slot * 2 + 1] === null).toBe(false);
			}
			expect(slots.filter((id) => id !== null)).toHaveLength(count);
		}
	});

	it("섞어도 사람은 빠지지 않는다", () => {
		const ids = Array.from({ length: 13 }, (_, i) => `p${i}`);
		let seed = 0;
		const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
		const { slots } = drawBracket(ids, rng);
		expect([...slots.filter((id) => id !== null)].sort()).toEqual([...ids].sort());
	});
});

describe("byeCount", () => {
	it("자리 수에서 사람 수를 뺀 만큼 부전승 자리가 생긴다", () => {
		expect([2, 3, 4, 5, 7, 8, 29, 30, 31, 32].map(byeCount)).toEqual([0, 1, 0, 3, 1, 0, 3, 2, 1, 0]);
	});
});

/** 1회전에서 빈자리와 붙은 사람(부전승) */
function byePlayers(slots: readonly (string | null)[]): readonly string[] {
	return Array.from({ length: slots.length / 2 }, (_, i) => {
		const a = slots[i * 2] ?? null;
		const b = slots[i * 2 + 1] ?? null;
		return a === null ? b : b === null ? a : null;
	}).filter((id) => id !== null);
}

describe("drawBracket 부전승 지정", () => {
	it("정해 둔 사람은 늘 빈자리와 붙고, 남은 부전승 자리는 나머지에서 나온다", () => {
		for (let seed = 1; seed <= 30; seed++) {
			const { slots } = drawBracket(["a", "b", "c", "d", "e"], createRng(seed), ["d", "e"]);
			const byes = byePlayers(slots);
			expect(byes).toHaveLength(3);
			expect(byes).toEqual(expect.arrayContaining(["d", "e"]));
		}
	});

	it("정해 둔 사람이 없으면 예전과 같은 대진이 나온다", () => {
		expect(drawBracket(["a", "b", "c", "d", "e"], inOrder, [])).toEqual(FIVE);
	});

	it("대진에 없는 사람을 정해 둬도 자리를 차지하지 않는다", () => {
		const { slots } = drawBracket(["a", "b", "c"], inOrder, ["z", "c"]);
		expect(slots).not.toContain("z");
		expect(byePlayers(slots)).toEqual(["c"]);
	});
});

describe("matchWinner", () => {
	it("점수가 높은 쪽이 이기고, 기록이 없으면 낸 쪽이 이긴다", () => {
		expect(matchWinner({ participantIds: ["a", "b"], scores: { a: 5, b: 3 } })).toBe("a");
		expect(matchWinner({ participantIds: ["a", "b"], scores: { a: 1, b: 3 } })).toBe("b");
		expect(matchWinner({ participantIds: ["a", "b"], scores: { b: 3 } })).toBe("b");
	});

	it("동점이거나 둘 다 기록이 없으면 가릴 수 없다", () => {
		expect(matchWinner({ participantIds: ["a", "b"], scores: { a: 3, b: 3 } })).toBeNull();
		expect(matchWinner({ participantIds: ["a", "b"], scores: {} })).toBeNull();
	});
});

describe("bracketRounds", () => {
	it("1회전부터 결승까지 회전을 만들고 부전승은 1회전에만 둔다", () => {
		const rounds = bracketRounds(FIVE, []);
		expect(rounds.map((matches) => matches.length)).toEqual([4, 2, 1]);
		expect(rounds[0]?.map((match) => match.bye)).toEqual([true, false, true, true]);
		// 부전승은 그 자리 사람이 그냥 올라간다
		expect(rounds[0]?.[0]?.winnerId).toBe("a");
		expect(rounds[0]?.[2]?.winnerId).toBe("b");
		expect(rounds[0]?.[3]?.winnerId).toBe("c");
		// 아직 치르지 않은 경기는 승자가 없고, 뒷 회전은 누가 올라올지 모른다
		expect(rounds[0]?.[1]?.winnerId).toBeNull();
		expect(rounds[1]?.[0]).toMatchObject({ aId: "a", bId: null, bye: false, winnerId: null });
		expect(rounds[2]?.[0]).toMatchObject({ aId: null, bId: null, bye: false, winnerId: null });
	});

	it("치른 경기를 부전승을 뺀 순서와 하나씩 맞춰 승자를 채운다", () => {
		const rounds = bracketRounds(FIVE, [{ participantIds: ["d", "e"], scores: { d: 9, e: 2 } }]);
		expect(rounds[0]?.[1]).toMatchObject({ winnerId: "d", playedNo: 1 });
		expect(rounds[1]?.[0]).toMatchObject({ aId: "a", bId: "d", winnerId: null });
		expect(rounds[1]?.[1]).toMatchObject({ aId: "b", bId: "c", winnerId: null });
	});

	it("동점인 경기는 승자가 비어 뒷 회전으로 올라가지 않는다", () => {
		const rounds = bracketRounds(FIVE, [{ participantIds: ["d", "e"], scores: { d: 5, e: 5 } }]);
		expect(rounds[0]?.[1]?.winnerId).toBeNull();
		expect(rounds[1]?.[0]?.bId).toBeNull();
	});
});

describe("nextMatch · championOf", () => {
	it("부전승을 건너뛰고 앞에서부터 한 경기씩 내준다", () => {
		const played: { participantIds: readonly string[]; scores: Readonly<Record<string, number>> }[] = [];
		const order: string[] = [];
		for (;;) {
			const match = nextMatch(FIVE, played);
			if (match === null) break;
			expect(match.aId).not.toBeNull();
			expect(match.bId).not.toBeNull();
			const aId = match.aId ?? "";
			const bId = match.bId ?? "";
			order.push(`${aId}-${bId}`);
			// 늘 앞사람이 이긴다
			played.push({ participantIds: [aId, bId], scores: { [aId]: 9, [bId]: 1 } });
		}
		expect(order).toEqual(["d-e", "a-d", "b-c", "a-b"]);
		expect(played).toHaveLength(matchTotal(FIVE));
		expect(championOf(FIVE, played)).toBe("a");
	});

	it("결승이 끝나기 전에는 우승자가 없다", () => {
		expect(championOf(FIVE, [])).toBeNull();
		expect(nextMatch(FIVE, [])).toMatchObject({ roundIndex: 0, slot: 1 });
	});

	it("두 명이면 한 경기로 끝난다", () => {
		const two = drawBracket(["a", "b"], inOrder);
		expect(two.slots).toEqual(["a", "b"]);
		expect(matchTotal(two)).toBe(1);
		expect(nextMatch(two, [])).toMatchObject({ roundIndex: 0, slot: 0, aId: "a", bId: "b" });
		expect(championOf(two, [{ participantIds: ["a", "b"], scores: { a: 1, b: 2 } }])).toBe("b");
	});
});

describe("roundTitle", () => {
	it("결승·준결승은 이름으로, 그 앞은 8강처럼 센다", () => {
		expect([0, 1, 2, 3].map((index) => roundTitle(index, 4))).toEqual(["16강", "8강", "준결승", "결승"]);
		expect(roundTitle(0, 1)).toBe("결승");
	});
});

describe("readBracket", () => {
	it("2의 거듭제곱 자리에 id나 빈자리만 있으면 읽는다", () => {
		expect(readBracket({ slots: ["a", null, "b", "c"] })).toEqual({ slots: ["a", null, "b", "c"] });
		expect(readBracket({ slots: ["a", "b"] })).toEqual({ slots: ["a", "b"] });
	});

	it("알아볼 수 없으면 null", () => {
		for (const raw of [undefined, null, "a", [], {}, { slots: "a" }, { slots: [] }, { slots: ["a"] }, { slots: ["a", "b", "c"] }, { slots: ["a", 3] }]) {
			expect(readBracket(raw)).toBeNull();
		}
	});
});
