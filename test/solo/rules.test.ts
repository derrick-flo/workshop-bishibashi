import { describe, expect, it } from "vitest";
import {
	clampSoloRule,
	DEFAULT_SOLO_RULES,
	parseSoloRules,
	readSoloRules,
	SOLO_RULE_LIMITS,
	type SoloRules,
} from "../../src/domain/solo/rules";

const EASIER: SoloRules = { reactionPassMs: 400, stopwatchAllowedMs: 1200, circlePassPercent: 80 };

describe("혼자 하는 도전 성공 기준", () => {
	it("기본 기준은 230ms · 0.1초 · 95%", () => {
		expect(DEFAULT_SOLO_RULES).toEqual({ reactionPassMs: 230, stopwatchAllowedMs: 100, circlePassPercent: 95 });
	});

	it("기본 기준은 고를 수 있는 범위 안에 있다", () => {
		for (const key of ["reactionPassMs", "stopwatchAllowedMs", "circlePassPercent"] as const) {
			expect(DEFAULT_SOLO_RULES[key]).toBeGreaterThanOrEqual(SOLO_RULE_LIMITS[key].min);
			expect(DEFAULT_SOLO_RULES[key]).toBeLessThanOrEqual(SOLO_RULE_LIMITS[key].max);
		}
	});

	it("범위 안의 값은 그대로 받는다", () => {
		expect(parseSoloRules(EASIER)).toEqual(EASIER);
	});

	it("범위의 양 끝도 받는다", () => {
		const low = {
			reactionPassMs: SOLO_RULE_LIMITS.reactionPassMs.min,
			stopwatchAllowedMs: SOLO_RULE_LIMITS.stopwatchAllowedMs.min,
			circlePassPercent: SOLO_RULE_LIMITS.circlePassPercent.min,
		};
		const high = {
			reactionPassMs: SOLO_RULE_LIMITS.reactionPassMs.max,
			stopwatchAllowedMs: SOLO_RULE_LIMITS.stopwatchAllowedMs.max,
			circlePassPercent: SOLO_RULE_LIMITS.circlePassPercent.max,
		};
		expect(parseSoloRules(low)).toEqual(low);
		expect(parseSoloRules(high)).toEqual(high);
	});

	it("범위를 벗어나면 받지 않는다", () => {
		expect(parseSoloRules({ ...EASIER, reactionPassMs: SOLO_RULE_LIMITS.reactionPassMs.min - 1 })).toBeNull();
		expect(parseSoloRules({ ...EASIER, reactionPassMs: SOLO_RULE_LIMITS.reactionPassMs.max + 1 })).toBeNull();
		expect(parseSoloRules({ ...EASIER, stopwatchAllowedMs: 0 })).toBeNull();
		expect(parseSoloRules({ ...EASIER, circlePassPercent: SOLO_RULE_LIMITS.circlePassPercent.max + 1 })).toBeNull();
	});

	it("세 기준이 모두 정수로 들어 있어야 받는다", () => {
		expect(parseSoloRules(null)).toBeNull();
		expect(parseSoloRules("230")).toBeNull();
		expect(parseSoloRules([230, 500, 95])).toBeNull();
		expect(parseSoloRules({ reactionPassMs: 230 })).toBeNull();
		expect(parseSoloRules({ ...EASIER, reactionPassMs: 230.5 })).toBeNull();
		expect(parseSoloRules({ ...EASIER, circlePassPercent: Number.NaN })).toBeNull();
	});

	it("남는 칸은 버리고 세 기준만 남긴다", () => {
		expect(parseSoloRules({ ...EASIER, targetMs: 5000 })).toEqual(EASIER);
	});

	it("저장해 둔 값을 알아볼 수 없으면 기본 기준으로 읽는다", () => {
		expect(readSoloRules(undefined)).toEqual(DEFAULT_SOLO_RULES);
		expect(readSoloRules({ reactionPassMs: 9999 })).toEqual(DEFAULT_SOLO_RULES);
		expect(readSoloRules(EASIER)).toEqual(EASIER);
	});

	it("넣은 값은 범위 안으로 당기고 정수로 맞춘다", () => {
		expect(clampSoloRule("reactionPassMs", 5)).toBe(SOLO_RULE_LIMITS.reactionPassMs.min);
		expect(clampSoloRule("reactionPassMs", 99_999)).toBe(SOLO_RULE_LIMITS.reactionPassMs.max);
		expect(clampSoloRule("stopwatchAllowedMs", 849.6)).toBe(850);
		expect(clampSoloRule("circlePassPercent", 90)).toBe(90);
	});

	it("숫자가 아닌 값을 넣으면 기본 기준으로 돌린다", () => {
		expect(clampSoloRule("reactionPassMs", Number.NaN)).toBe(DEFAULT_SOLO_RULES.reactionPassMs);
		expect(clampSoloRule("circlePassPercent", Number.POSITIVE_INFINITY)).toBe(DEFAULT_SOLO_RULES.circlePassPercent);
	});
});
