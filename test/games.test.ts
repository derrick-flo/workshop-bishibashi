import { describe, expect, it } from "vitest";
import { balloonPress, balloonScore, BALLOON_START, formatBalloon } from "../src/domain/games/balloon";
import type { Button } from "../src/domain/games/button";
import { candyPress, candyScore, CANDY_START, candyTargets, formatCandy } from "../src/domain/games/candy";
import { eyeDirections, eyePress, eyeScore, EYE_START, formatEye } from "../src/domain/games/eye";
import {
	formatReaction,
	reactionPress,
	reactionScore,
	reactionSignals,
	reactionStart,
} from "../src/domain/games/reaction";

/** 빨강·파랑을 번갈아 count번 누르는 입력. 첫 입력은 t=100, 이후 100ms 간격. */
function alternatingPumps(count: number): readonly [Button, number][] {
	return Array.from({ length: count }, (_, i) => [i % 2 === 0 ? "red" : "blue", 100 * (i + 1)] as [Button, number]);
}

describe("풍선 불기", () => {
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => balloonPress(state, button, t), BALLOON_START);

	it("빨강·파랑을 번갈아 누를 때만 바람이 들어간다", () => {
		const state = play([
			["red", 100],
			["red", 200],
			["blue", 300],
			["blue", 400],
			["red", 500],
		]);
		expect(state.pumps).toBe(3);
	});

	it("다 차기 전에 누른 FINISH는 무시하고, 점수는 넣은 바람 수", () => {
		const state = play([...alternatingPumps(10), ["finish", 1100]]);
		expect(state.finishedAt).toBeNull();
		expect(balloonScore(state)).toBe(10);
		expect(formatBalloon(balloonScore(state))).toBe("10회");
	});

	it("다 찬 뒤 FINISH를 누르면 빨리 끝낼수록 점수가 높다", () => {
		const state = play([...alternatingPumps(50), ["finish", 5210]]);
		expect(balloonScore(state)).toBe(1679);
		expect(formatBalloon(1679)).toBe("5.21초");
	});

	it("너무 많이 불면 터져서 0점이고, 그 뒤 FINISH는 무시한다", () => {
		const state = play([...alternatingPumps(58), ["finish", 6000]]);
		expect(state.burst).toBe(true);
		expect(balloonScore(state)).toBe(0);
		expect(formatBalloon(0)).toBe("실패");
	});

	it("FINISH 뒤에 누른 건 기록을 바꾸지 않는다", () => {
		const state = play([...alternatingPumps(50), ["finish", 5210], ["red", 5300], ["blue", 5400]]);
		expect(state.pumps).toBe(50);
		expect(balloonScore(state)).toBe(1679);
	});

	it("제한 시간이 지난 입력은 무시한다", () => {
		expect(play([["red", 12_001]]).pumps).toBe(0);
	});
});

describe("알사탕 담기", () => {
	const targets = [13, 7, 25];
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => candyPress(state, targets, button, t), CANDY_START);

	it("숫자를 정확히 맞추고 FINISH하면 다음 병으로 넘어간다", () => {
		const state = play([
			["blue", 100],
			["red", 200],
			["red", 300],
			["red", 400],
			["finish", 500],
		]);
		expect(state).toMatchObject({ jar: 1, count: 0, completed: 1, lastCompletedAt: 500 });
	});

	it("숫자를 넘기면 쏟아져서 0개부터 다시 담는다", () => {
		const state = play([
			["blue", 100],
			["green", 200],
		]);
		expect(state).toMatchObject({ jar: 0, count: 0, completed: 0, event: { kind: "spill", at: 200 } });
	});

	it("숫자가 다른데 FINISH하면 0개부터 다시 담는다", () => {
		const state = play([
			["blue", 100],
			["finish", 200],
		]);
		expect(state).toMatchObject({ jar: 0, count: 0, completed: 0, event: { kind: "wrong", at: 200 } });
	});

	it("점수는 채운 병 수가 먼저, 같으면 마지막 병을 빨리 채운 쪽이 높다", () => {
		const twoJarsAt9s = candyScore({ ...CANDY_START, completed: 2, lastCompletedAt: 9000 });
		const twoJarsAt15s = candyScore({ ...CANDY_START, completed: 2, lastCompletedAt: 15_000 });
		const threeJarsAtEnd = candyScore({ ...CANDY_START, completed: 3, lastCompletedAt: 19_999 });
		expect(twoJarsAt9s).toBe(211_000);
		expect(twoJarsAt15s).toBe(205_000);
		expect(threeJarsAtEnd).toBe(300_001);
		expect(formatCandy(twoJarsAt9s)).toBe("2병");
		expect(candyScore(CANDY_START)).toBe(0);
	});

	it("같은 seed면 모든 폰에 같은 숫자가 나오고, 숫자는 11~39 사이", () => {
		const first = candyTargets(42);
		expect(candyTargets(42)).toEqual(first);
		expect(candyTargets(43)).not.toEqual(first);
		expect(first.every((n) => n >= 11 && n <= 39)).toBe(true);
	});
});

describe("시력검사", () => {
	const directions = ["left", "up", "right", "down", "left"] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => eyePress(state, directions, button, t), EYE_START);

	it("고리가 뚫린 쪽 버튼(← 빨강 · ↑ 초록 · → 파랑 · ↓ FINISH)을 누르면 다음 고리가 나온다", () => {
		const state = play([
			["red", 100],
			["green", 200],
			["blue", 300],
			["finish", 400],
		]);
		expect(state).toMatchObject({ index: 4, correct: 4, lastCorrectAt: 400 });
		expect(eyeScore(state)).toBe(414_600);
		expect(formatEye(414_600)).toBe("4개");
	});

	it("틀리면 0.8초 동안 입력이 막힌다", () => {
		const state = play([
			["blue", 100],
			["red", 500],
			["red", 900],
		]);
		expect(state).toMatchObject({ index: 1, correct: 1, lastCorrectAt: 900 });
	});

	it("같은 seed면 같은 문제가 나오고, 같은 방향이 연달아 나오지 않는다", () => {
		const first = eyeDirections(7);
		expect(eyeDirections(7)).toEqual(first);
		expect(first.every((direction, i) => i === 0 || direction !== first[i - 1])).toBe(true);
	});
});

describe("반응속도", () => {
	const signals = [2000, 6000, 10_000, 14_000, 18_000];
	const play = (times: readonly number[]) =>
		times.reduce((state, t) => reactionPress(state, signals, t), reactionStart(signals.length));

	it("신호 뒤 처음 누른 시간이 그 회차 기록이다", () => {
		expect(play([2250]).results[0]).toBe(250);
	});

	it("신호 전에 누르면 그 회차는 1초로 처리하고, 같은 회차에서 다시 눌러도 무시한다", () => {
		const state = play([1500, 2300]);
		expect(state.results[0]).toBe(1000);
		expect(state.results[1]).toBeNull();
	});

	it("신호 뒤 0.1초 안에 누르면 미리 누른 것으로 보고 1초로 처리한다", () => {
		expect(play([2050]).results[0]).toBe(1000);
	});

	it("다섯 번의 평균이 짧을수록 점수가 높다", () => {
		const state = play([2250, 6300, 10_200, 14_400, 18_350]);
		expect(reactionScore(state)).toBe(700);
		expect(formatReaction(700)).toBe("0.300초");
	});

	it("누르지 않은 회차는 1초로 계산하고, 전부 놓치면 실패", () => {
		expect(reactionScore(play([2250]))).toBe(150);
		expect(reactionScore(play([]))).toBe(0);
		expect(formatReaction(0)).toBe("실패");
	});

	it("신호는 5번, 회차 사이가 충분히 떨어져 있고 제한 시간 안에 끝난다", () => {
		const times = reactionSignals(99);
		expect(times).toHaveLength(5);
		expect(times[0]).toBeGreaterThanOrEqual(1500);
		expect(times.every((t, i) => i === 0 || t - (times[i - 1] ?? 0) > 2000)).toBe(true);
		expect((times[4] ?? Infinity) + 1000).toBeLessThanOrEqual(24_000);
	});
});
