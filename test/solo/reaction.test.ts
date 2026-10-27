import { describe, expect, it } from "vitest";
import { formatReaction, REACTION, reactionPasses, reactionWaitMs } from "../../src/domain/solo/reaction";
import { DEFAULT_SOLO_RULES } from "../../src/domain/solo/rules";

const PASS_MS = DEFAULT_SOLO_RULES.reactionPassMs;

describe("반응속도 테스트", () => {
	it.each([
		[80, true],
		[229, true],
		[PASS_MS, true],
		[231, false],
		[640, false],
	])("기준이 230ms 일 때 %dms 는 성공 %s", (ms, passed) => {
		expect(reactionPasses({ kind: "measured", ms }, PASS_MS)).toBe(passed);
	});

	it("기준을 올리면 느린 기록도 성공한다", () => {
		expect(reactionPasses({ kind: "measured", ms: 380 }, PASS_MS)).toBe(false);
		expect(reactionPasses({ kind: "measured", ms: 380 }, 400)).toBe(true);
	});

	it("초록이 되기 전에 누르면 기준을 아무리 올려도 반칙이다", () => {
		expect(reactionPasses({ kind: "tooSoon" }, PASS_MS)).toBe(false);
		expect(reactionPasses({ kind: "tooSoon" }, 1000)).toBe(false);
		expect(formatReaction({ kind: "tooSoon" })).toBe("반칙");
	});

	it("기록은 ms 단위 정수로 적는다", () => {
		expect(formatReaction({ kind: "measured", ms: 212.6 })).toBe("213ms");
	});

	it("기다리는 시간은 정해진 범위 안이다", () => {
		expect(reactionWaitMs(() => 0)).toBe(REACTION.minWaitMs);
		expect(reactionWaitMs(() => 0.999999)).toBeLessThan(REACTION.maxWaitMs);
		expect(reactionWaitMs(() => 0.5)).toBeGreaterThan(REACTION.minWaitMs);
	});
});
