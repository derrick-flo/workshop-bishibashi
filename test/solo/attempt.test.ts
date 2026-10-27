import { describe, expect, it } from "vitest";
import { addAttempt, type Attempt, passCount } from "../../src/domain/solo/attempt";

describe("도전 기록", () => {
	it("도전할 때마다 회차가 1부터 하나씩 올라간다", () => {
		const first = addAttempt([], false, "248ms");
		const second = addAttempt(first, true, "212ms");
		expect(first.map((attempt) => attempt.no)).toEqual([1]);
		expect(second.map((attempt) => attempt.no)).toEqual([1, 2]);
		expect(second.at(-1)).toEqual({ no: 2, passed: true, record: "212ms" });
	});

	it("앞의 기록은 그대로 두고 새 목록을 만든다", () => {
		const before: readonly Attempt[] = addAttempt([], false, "반칙");
		const after = addAttempt(before, true, "215ms");
		expect(before).toHaveLength(1);
		expect(after).not.toBe(before);
	});

	it("성공한 횟수를 센다", () => {
		const list = addAttempt(addAttempt(addAttempt([], true, "1"), false, "2"), true, "3");
		expect(passCount(list)).toBe(2);
		expect(passCount([])).toBe(0);
	});
});
