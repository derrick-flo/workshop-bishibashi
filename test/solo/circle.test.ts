import { describe, expect, it } from "vitest";
import { CIRCLE, type CirclePoint, circlePasses, formatCircle, judgeCircle } from "../../src/domain/solo/circle";
import { DEFAULT_SOLO_RULES } from "../../src/domain/solo/rules";

const TURN = Math.PI * 2;
const PASS_PERCENT = DEFAULT_SOLO_RULES.circlePassPercent;

/** 중심을 돌며 radiusAt(각)만큼 떨어진 점들. turns 바퀴를 steps 번에 나눠 그린다. */
function stroke(radiusAt: (angle: number) => number, turns = 1.05, steps = 400, direction = 1): readonly CirclePoint[] {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const angle = direction * (i / steps) * TURN * turns;
		const radius = radiusAt(angle);
		return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
	});
}

describe("원 그리기", () => {
	it("반지름이 고른 원은 100%", () => {
		const result = judgeCircle(stroke(() => 0.6));
		expect(result).toEqual({ kind: "scored", percent: 100 });
		expect(circlePasses(result, PASS_PERCENT)).toBe(true);
		expect(formatCircle(result)).toBe("100.0%");
	});

	it("시계 반대 방향으로 그려도 똑같이 센다", () => {
		expect(judgeCircle(stroke(() => 0.6, 1.05, 400, -1))).toEqual({ kind: "scored", percent: 100 });
	});

	it("살짝 울퉁불퉁한 원은 95% 를 넘겨 성공", () => {
		const result = judgeCircle(stroke((angle) => 0.6 + Math.sin(angle * 3) * 0.008));
		expect(result.kind).toBe("scored");
		expect(circlePasses(result, PASS_PERCENT)).toBe(true);
	});

	it("찌그러진 타원은 95% 에 못 미쳐 실패", () => {
		const result = judgeCircle(stroke((angle) => 0.7 * 0.45 / Math.hypot(0.45 * Math.cos(angle), 0.7 * Math.sin(angle))));
		expect(result.kind).toBe("scored");
		if (result.kind === "scored") expect(result.percent).toBeLessThan(PASS_PERCENT);
		expect(circlePasses(result, PASS_PERCENT)).toBe(false);
	});

	it("기준을 내리면 찌그러진 타원도 성공한다", () => {
		const result = judgeCircle(stroke((angle) => (0.7 * 0.45) / Math.hypot(0.45 * Math.cos(angle), 0.7 * Math.sin(angle))));
		expect(circlePasses(result, PASS_PERCENT)).toBe(false);
		expect(circlePasses(result, 80)).toBe(true);
	});

	it("빨리 지난 쪽과 천천히 지난 쪽을 똑같이 본다", () => {
		// 같은 원을 점이 한쪽에 몰리게 그려도 점수가 같아야 한다
		const even = judgeCircle(stroke(() => 0.6, 1.05, 400));
		const uneven = judgeCircle(
			Array.from({ length: 401 }, (_, i) => {
				const angle = ((i / 400) ** 2.5) * TURN * 1.05;
				return { x: Math.cos(angle) * 0.6, y: Math.sin(angle) * 0.6 };
			}),
		);
		expect(uneven).toEqual(even);
	});

	it("한 바퀴를 못 돌면 덜 돈 것", () => {
		const result = judgeCircle(stroke(() => 0.6, 0.5));
		expect(result.kind).toBe("short");
		if (result.kind === "short") expect(result.turned).toBeCloseTo(Math.PI, 2);
		expect(formatCircle(result)).toBe("덜 돎");
	});

	it("점이 없거나 하나면 덜 돈 것", () => {
		expect(judgeCircle([])).toEqual({ kind: "short", turned: 0 });
		expect(judgeCircle([{ x: 0.6, y: 0 }])).toEqual({ kind: "short", turned: 0 });
	});

	it("너무 작게 그리면 무효", () => {
		const result = judgeCircle(stroke(() => CIRCLE.minRadius - 0.05));
		expect(result).toEqual({ kind: "small" });
		expect(circlePasses(result, PASS_PERCENT)).toBe(false);
		// 기준을 아무리 내려도 무효는 성공이 아니다
		expect(circlePasses(result, 50)).toBe(false);
		expect(formatCircle(result)).toBe("작음");
	});

	it("가던 방향을 되돌리면 무효", () => {
		const forward = stroke(() => 0.6, 1.5 / TURN, 60);
		const back = stroke(() => 0.6, 1.5 / TURN, 60).toReversed().slice(1);
		const result = judgeCircle([...forward, ...back]);
		expect(result).toEqual({ kind: "backtracked" });
		expect(formatCircle(result)).toBe("되돌림");
	});
});
