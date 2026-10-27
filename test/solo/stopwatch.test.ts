import { describe, expect, it } from "vitest";
import { DEFAULT_SOLO_RULES } from "../../src/domain/solo/rules";
import { formatGap, formatSeconds, STOPWATCH, stopwatchPasses } from "../../src/domain/solo/stopwatch";

const ALLOWED_MS = DEFAULT_SOLO_RULES.stopwatchAllowedMs;

describe("10초 맞추기", () => {
	it("목표는 10초, 기본 오차는 0.1초", () => {
		expect(STOPWATCH.targetMs).toBe(10_000);
		expect(ALLOWED_MS).toBe(100);
	});

	it.each([
		[10_000, true],
		[9_900, true],
		[10_100, true],
		[9_899, false],
		[10_101, false],
		[STOPWATCH.limitMs, false],
	])("오차 0.1초 기준에서 %dms 에 멈추면 성공 %s", (elapsed, passed) => {
		expect(stopwatchPasses(elapsed, ALLOWED_MS)).toBe(passed);
	});

	it("오차를 늘리면 더 벗어난 기록도 성공한다", () => {
		expect(stopwatchPasses(11_200, ALLOWED_MS)).toBe(false);
		expect(stopwatchPasses(11_200, 1_500)).toBe(true);
	});

	it("멈춘 시간은 초시계 숫자판과 같은 자릿수로 적는다", () => {
		expect(STOPWATCH.digits).toBe(2);
		expect(formatSeconds(10_234)).toBe("10.23초");
		expect(formatSeconds(0)).toBe("0.00초");
	});

	it("목표와의 차이는 부호를 붙여 적는다", () => {
		expect(formatGap(10_230)).toBe("+0.23초");
		expect(formatGap(9_550)).toBe("-0.45초");
		expect(formatGap(10_000)).toBe("+0.00초");
	});
});
