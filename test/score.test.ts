import { describe, expect, it } from "vitest";
import { submittableScore } from "../src/domain/score";

describe("submittableScore", () => {
	it("소수점은 버려서 서버가 받는 정수로 만든다", () => {
		expect(submittableScore(1_812_345.678, 9_999_999)).toBe(1_812_345);
	});

	it("0보다 작으면 0, 최대치를 넘으면 최대치", () => {
		expect(submittableScore(-3, 100)).toBe(0);
		expect(submittableScore(140, 100)).toBe(100);
	});

	it("숫자가 아니면 0", () => {
		expect(submittableScore(Number.NaN, 100)).toBe(0);
		expect(submittableScore(Number.POSITIVE_INFINITY, 100)).toBe(0);
	});
});
