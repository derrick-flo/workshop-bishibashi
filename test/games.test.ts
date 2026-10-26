import { describe, expect, it } from "vitest";
import { balloonPress, balloonScore, BALLOON_START, formatBalloon } from "../src/domain/games/balloon";
import type { Button } from "../src/domain/games/button";
import { candyPress, candyScore, CANDY_START, candyTargets, formatCandy } from "../src/domain/games/candy";
import { eyeDirections, eyePress, eyeScore, EYE_START, formatEye } from "../src/domain/games/eye";
import { donenessOf, formatGrill, GRILL_START, grillCookTimes, grillPress, grillScore } from "../src/domain/games/grill";
import {
	ballSpot,
	chooseFrom,
	CUPS,
	CUPS_MAX_SCORE,
	CUPS_START,
	type CupRound,
	cupRounds,
	cupsPress,
	cupsScore,
	formatCups,
	SPOT_BUTTON,
} from "../src/domain/games/cups";
import { formatJudge, judgeBouts, judgePress, judgeScore, JUDGE_START, verdictOf } from "../src/domain/games/judge";
import {
	formatMemory,
	inputFrom,
	MEMORY,
	MEMORY_MAX_SCORE,
	MEMORY_START,
	memoryPress,
	memoryScore,
	memorySequence,
	shownAt,
} from "../src/domain/games/memory";
import { formatMonster, monsterPress, monsterQueue, monsterScore, MONSTER_START } from "../src/domain/games/monster";
import {
	formatShooting,
	shootingPress,
	shootingScore,
	SHOOTING_START,
	shootingTargets,
} from "../src/domain/games/shooting";
import { formatStairs, stairsCourse, stairsPress, stairsScore, STAIRS_START } from "../src/domain/games/stairs";
import {
	bombDepths,
	formatTreasure,
	TREASURE,
	TREASURE_MAX_SCORE,
	TREASURE_START,
	treasurePress,
	treasureScore,
} from "../src/domain/games/treasure";

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

describe("몬스터 퇴치", () => {
	const queue = ["red", "green", "blue"] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => monsterPress(state, queue, button, t), MONSTER_START);
	/** from부터 100ms 간격으로 FINISH를 count번 */
	const dragonHits = (count: number, from: number) =>
		Array.from({ length: count }, (_, i) => ["finish", from + i * 100] as [Button, number]);

	it("맨 앞 몬스터와 같은 색을 누르면 쓰러뜨리고, 드래곤 전까지 FINISH는 무시한다", () => {
		const state = play([
			["red", 100],
			["finish", 200],
			["green", 300],
		]);
		expect(state).toMatchObject({ defeated: 2, dragonHits: 0 });
	});

	it("다른 색을 누르면 0.6초 동안 입력이 막힌다", () => {
		const state = play([
			["blue", 100],
			["red", 500],
			["red", 700],
		]);
		expect(state).toMatchObject({ defeated: 1, lockedUntil: 700 });
	});

	it("몬스터를 다 쓰러뜨리면 드래곤이 나오고, 색 버튼은 무시하며 FINISH 20번이면 클리어", () => {
		const state = play([["red", 100], ["green", 200], ["blue", 300], ["red", 350], ...dragonHits(20, 400)]);
		expect(state).toMatchObject({ defeated: 3, dragonHits: 20, clearedAt: 2300 });
		expect(monsterScore(state)).toBe(2270);
		expect(formatMonster(2270)).toBe("2.30초");
	});

	it("못 깨면 쓰러뜨린 몬스터 수에 드래곤을 때린 횟수를 더한 값이 기록", () => {
		expect(monsterScore(play([["red", 100]]))).toBe(1);
		expect(monsterScore(play([["red", 100], ["green", 200], ["blue", 300], ...dragonHits(2, 400)]))).toBe(5);
		expect(formatMonster(7)).toBe("7마리");
		expect(formatMonster(22)).toBe("드래곤 2대");
	});

	it("같은 seed면 같은 순서로 나오고, 20마리 모두 세 색 중 하나", () => {
		const first = monsterQueue(5);
		expect(monsterQueue(5)).toEqual(first);
		expect(monsterQueue(6)).not.toEqual(first);
		expect(first).toHaveLength(20);
		expect(first.every((color) => color === "red" || color === "green" || color === "blue")).toBe(true);
	});
});

describe("가위바위보 판정", () => {
	const bouts = [
		{ left: "rock", right: "scissors" },
		{ left: "paper", right: "scissors" },
		{ left: "paper", right: "paper" },
	] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => judgePress(state, bouts, button, t), JUDGE_START);

	it("바위는 가위를, 가위는 보를, 보는 바위를 이기고 같은 손이면 비긴다", () => {
		expect(verdictOf({ left: "rock", right: "scissors" })).toBe("left");
		expect(verdictOf({ left: "scissors", right: "paper" })).toBe("left");
		expect(verdictOf({ left: "paper", right: "rock" })).toBe("left");
		expect(verdictOf({ left: "scissors", right: "rock" })).toBe("right");
		expect(verdictOf({ left: "rock", right: "rock" })).toBe("draw");
	});

	it("이긴 쪽(왼쪽 빨강 · 비김 초록 · 오른쪽 파랑)을 누르면 다음 판이 나온다", () => {
		const state = play([
			["red", 100],
			["blue", 200],
			["green", 300],
		]);
		expect(state).toMatchObject({ correct: 3, lastCorrectAt: 300 });
	});

	it("점수는 맞힌 판 수가 먼저, 같으면 마지막으로 맞힌 시점이 빠른 쪽이 높다", () => {
		const state = play([
			["red", 100],
			["blue", 200],
			["green", 300],
		]);
		expect(judgeScore(state)).toBe(314_700);
		expect(formatJudge(314_700)).toBe("3판");
		expect(judgeScore(JUDGE_START)).toBe(0);
	});

	it("누른 시각이 소수(ms 이하)여도 점수는 정수다", () => {
		expect(judgeScore(play([["red", 100.5]]))).toBe(114_899);
	});

	it("틀리면 0.8초 동안 입력이 막히고, FINISH는 쓰지 않는다", () => {
		expect(play([["finish", 50]])).toBe(JUDGE_START);
		const state = play([
			["blue", 100],
			["red", 500],
			["red", 900],
		]);
		expect(state).toMatchObject({ correct: 1, lastCorrectAt: 900 });
	});

	it("같은 seed면 같은 문제가 나오고, 같은 판이 연달아 나오지 않는다", () => {
		const first = judgeBouts(3);
		expect(judgeBouts(3)).toEqual(first);
		expect(
			first.every((bout, i) => i === 0 || bout.left !== first[i - 1]?.left || bout.right !== first[i - 1]?.right),
		).toBe(true);
	});
});

describe("권총 속사", () => {
	const targets = [
		{ color: "red", at: 1000, until: 2000 },
		{ color: "gold", at: 2000, until: 3000 },
		{ color: "blue", at: 3000, until: 3650 },
	] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => shootingPress(state, targets, button, t), SHOOTING_START);

	it("표적과 같은 버튼(금색은 FINISH)을 누르면 명중이고, 빨리 쏠수록 점수가 높다", () => {
		const state = play([
			["red", 1300],
			["finish", 2200],
			["blue", 3500],
		]);
		expect(state.shots.every((shot) => shot.hit)).toBe(true);
		expect(shootingScore(state)).toBe(302_000);
		expect(formatShooting(302_000)).toBe("3발");
	});

	it("누른 시각이 소수(ms 이하)여도 점수는 정수다", () => {
		expect(shootingScore(play([["red", 1300.5]]))).toBe(100_699);
	});

	it("다른 버튼을 누르면 그 표적은 놓치고, 같은 표적에 다시 쏴도 무시한다", () => {
		const state = play([
			["blue", 1300],
			["red", 1400],
		]);
		expect(state.shots).toEqual([{ target: 0, hit: false, ms: 300 }]);
		expect(shootingScore(state)).toBe(0);
	});

	it("금색이 아닌데 FINISH를 누르면 실수", () => {
		expect(play([["finish", 1300]]).shots).toEqual([{ target: 0, hit: false, ms: 300 }]);
	});

	it("표적이 없을 때 누른 건 무시한다", () => {
		const state = play([
			["red", 500],
			["blue", 3650],
		]);
		expect(state.shots).toEqual([]);
	});

	it("같은 seed면 같은 표적이 나오고, 같은 색이 연달아 나오지 않으며 마지막은 금색", () => {
		const first = shootingTargets(11);
		expect(shootingTargets(11)).toEqual(first);
		expect(first).toHaveLength(20);
		expect(first.every((target, i) => i === 0 || target.color !== first[i - 1]?.color)).toBe(true);
		expect(first[19]?.color).toBe("gold");
	});

	it("1.5초에 첫 표적이 뜨고, 앞 표적이 사라지면 다음이 뜨며, 1초에서 0.65초로 빨라져 제한 시간 안에 끝난다", () => {
		const first = shootingTargets(11);
		expect(first[0]?.at).toBe(1500);
		expect(first.every((target, i) => i === 0 || target.at === first[i - 1]?.until)).toBe(true);
		expect((first[0]?.until ?? 0) - (first[0]?.at ?? 0)).toBe(1000);
		expect((first[19]?.until ?? 0) - (first[19]?.at ?? 0)).toBe(650);
		expect(first[19]?.until).toBeLessThanOrEqual(20_000);
	});
});

describe("계단 오르기", () => {
	const course = ["flat", "stair", "stair", "flat"] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => stairsPress(state, course, button, t), STAIRS_START);

	it("평지는 빨강·파랑, 계단은 초록으로 한 칸씩 올라간다", () => {
		const state = play([
			["red", 100],
			["green", 200],
			["green", 300],
		]);
		expect(state).toMatchObject({ position: 3, finishedAt: null });
	});

	it("평지에서 초록을 누르면 넘어져서 0.8초 동안 못 움직인다", () => {
		const state = play([
			["green", 100],
			["red", 500],
			["blue", 900],
		]);
		expect(state).toMatchObject({ position: 1, lockedUntil: 900 });
	});

	it("계단에서 빨강·파랑을 눌러도 넘어진다", () => {
		const state = play([
			["red", 100],
			["blue", 200],
			["green", 600],
			["green", 1000],
		]);
		expect(state).toMatchObject({ position: 2, lockedUntil: 1000 });
	});

	it("끝까지 오르면 빨리 오를수록 점수가 높다", () => {
		const state = play([
			["red", 100],
			["green", 200],
			["green", 300],
			["blue", 400],
		]);
		expect(state.finishedAt).toBe(400);
		expect(stairsScore(state)).toBe(2460);
		expect(formatStairs(2460)).toBe("0.40초");
	});

	it("못 오르면 오른 칸 수가 기록이고, FINISH와 제한 시간이 지난 입력은 무시한다", () => {
		const state = play([
			["red", 100],
			["finish", 200],
			["green", 15_001],
		]);
		expect(stairsScore(state)).toBe(1);
		expect(formatStairs(1)).toBe("1칸");
	});

	it("같은 seed면 같은 코스가 나오고, 평지로 시작하는 40칸에 계단이 섞여 있다", () => {
		const first = stairsCourse(8);
		expect(stairsCourse(8)).toEqual(first);
		expect(first).toHaveLength(40);
		expect(first[0]).toBe("flat");
		expect(first).toContain("stair");
	});
});

describe("삼겹살 굽기", () => {
	// 첫 고기는 빨강 0.3초 · 초록 1초 · 파랑 1.7초에 올라온다
	const cookTimes = { red: [2000, 2000], green: [1800], blue: [3000] };
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => grillPress(state, cookTimes, button, t), GRILL_START);

	it("다 익기 전은 덜 익음, 그 뒤 0.7초 동안은 알맞음, 그 뒤는 탄다", () => {
		expect(donenessOf(2000, 1999)).toBe("raw");
		expect(donenessOf(2000, 2000)).toBe("good");
		expect(donenessOf(2000, 2699)).toBe("good");
		expect(donenessOf(2000, 2700)).toBe("burnt");
	});

	it("알맞게 익었을 때 칸 버튼으로 집으면 1개가 되고, 0.5초 뒤 그 칸에 새 고기가 올라온다", () => {
		const state = play([["red", 2500]]);
		expect(state).toMatchObject({ good: 1, lastGoodAt: 2500, event: { kind: "good", slot: "red", at: 2500 } });
		expect(state.slots.red).toEqual({ piece: 1, placedAt: 3000 });
	});

	it("덜 익었거나 탔을 때 집으면 0개이고, 그 고기는 버린다", () => {
		const raw = play([["green", 2000]]);
		expect(raw).toMatchObject({ good: 0, event: { kind: "raw", slot: "green", at: 2000 } });
		expect(raw.slots.green).toEqual({ piece: 1, placedAt: 2500 });
		expect(play([["blue", 5500]])).toMatchObject({ good: 0, event: { kind: "burnt", slot: "blue", at: 5500 } });
	});

	it("고기가 올라오기 전, FINISH, 제한 시간이 지난 입력은 무시한다", () => {
		expect(play([["blue", 1000]])).toBe(GRILL_START);
		expect(play([["finish", 2500]])).toBe(GRILL_START);
		expect(play([["red", 20_001]])).toBe(GRILL_START);
	});

	it("정해 둔 굽기 시간을 다 쓰면 처음부터 다시 돌려 쓴다", () => {
		expect(play([["green", 2900], ["green", 5300]])).toMatchObject({ good: 2, lastGoodAt: 5300 });
	});

	it("한 칸만 계속 연타해도 고기가 떨어지지 않는다", () => {
		const presses = Array.from({ length: 130 }, (_, i): [Button, number] => ["red", 300 + i * 150]);
		expect(play(presses).event?.at).toBeGreaterThan(19_000);
	});

	it("점수는 잘 구운 고기 수가 먼저, 같으면 마지막으로 잘 구운 고기를 빨리 집은 쪽이 높다", () => {
		const fast = play([["red", 2500], ["green", 2900]]);
		expect(grillScore(fast)).toBe(217_100);
		expect(formatGrill(217_100)).toBe("2개");
		expect(grillScore(play([["red", 2500], ["green", 3400]]))).toBeLessThan(grillScore(fast));
		expect(grillScore(GRILL_START)).toBe(0);
	});

	it("같은 seed면 모든 폰에 같은 굽기 시간이 나오고, 칸마다 12개씩 1.8~3.4초 사이", () => {
		const first = grillCookTimes(4);
		expect(grillCookTimes(4)).toEqual(first);
		expect(grillCookTimes(5)).not.toEqual(first);
		const all = [...first.red, ...first.green, ...first.blue];
		expect(all).toHaveLength(36);
		expect(all.every((ms) => ms >= 1800 && ms <= 3400)).toBe(true);
	});
});

describe("순서 기억하기", () => {
	// 처음 순서(3개)는 0.6초부터 0.45초 간격으로 0.32초씩 켜지고, 1.95초부터 누를 수 있다
	const sequence = ["red", "blue", "finish", "green", "red"] as const;
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => memoryPress(state, sequence, button, t), MEMORY_START);

	it("보여주는 동안 지금 켜진 칸을 알려 주고, 칸 사이와 보여주기 전후에는 꺼져 있다", () => {
		expect(shownAt(MEMORY_START, 599)).toBeNull();
		expect(shownAt(MEMORY_START, 600)).toBe(0);
		expect(shownAt(MEMORY_START, 919)).toBe(0);
		expect(shownAt(MEMORY_START, 920)).toBeNull();
		expect(shownAt(MEMORY_START, 1050)).toBe(1);
		expect(shownAt(MEMORY_START, 1950)).toBeNull();
	});

	it("다 보여준 뒤에야 누를 수 있다(보여주는 중에 누른 건 무시)", () => {
		expect(play([["red", 1900]])).toBe(MEMORY_START);
		expect(play([["red", 1950]])).toMatchObject({ entered: 1, best: 0 });
	});

	it("순서대로 다 누르면 그 길이를 기억한 것이고, 0.6초 뒤 하나 더 긴 순서를 보여준다", () => {
		const state = play([
			["red", 2000],
			["blue", 2300],
			["finish", 2600],
		]);
		expect(state).toMatchObject({ best: 3, bestAt: 2600, length: 4, entered: 0, showAt: 3200, event: { kind: "clear" } });
	});

	it("틀리면 처음부터 다시 누르고, 0.6초 뒤 같은 순서를 다시 보여준다", () => {
		const state = play([
			["red", 2000],
			["green", 2300],
		]);
		expect(state).toMatchObject({ best: 0, length: 3, entered: 0, showAt: 2900, event: { kind: "miss" } });
	});

	it("점수는 기억한 길이가 먼저, 같으면 먼저 기억한 쪽이 높다", () => {
		const fast = play([
			["red", 2000],
			["blue", 2300],
			["finish", 2600],
		]);
		const slow = play([
			["red", 2000],
			["blue", 2300],
			["finish", 3600],
		]);
		expect(memoryScore(fast)).toBe(317_400);
		expect(memoryScore(slow)).toBeLessThan(memoryScore(fast));
		expect(formatMemory(317_400)).toBe("3개");
		expect(memoryScore(MEMORY_START)).toBe(0);
	});

	it("제한 시간이 지난 입력은 무시한다", () => {
		expect(play([["red", 20_001]])).toBe(MEMORY_START);
	});

	it("다 맞히거나 틀린 뒤 다음 순서를 다 보여주기 전에 누른 건 무시한다", () => {
		const cleared = play([
			["red", 2000],
			["blue", 2300],
			["finish", 2600],
		]);
		expect(memoryPress(cleared, sequence, "red", 4900)).toBe(cleared);
		const missed = play([["green", 2000]]);
		expect(memoryPress(missed, sequence, "red", 3500)).toBe(missed);
	});

	it("보여주자마자 바로 다 누르는 사람도 점수 상한을 넘지 못한다", () => {
		const real = memorySequence(1);
		let state = MEMORY_START;
		for (let t = inputFrom(state); t <= MEMORY.durationMs; t = inputFrom(state)) {
			for (let i = 0, at = t; i < state.length && at <= MEMORY.durationMs; i++, at++) state = memoryPress(state, real, real[i] ?? "red", at);
		}
		expect(memoryScore(state)).toBeLessThanOrEqual(MEMORY_MAX_SCORE);
	});

	it("같은 seed면 같은 순서가 나오고, 같은 칸이 연달아 켜지지 않는다", () => {
		const first = memorySequence(5);
		expect(memorySequence(5)).toEqual(first);
		expect(memorySequence(6)).not.toEqual(first);
		expect(first.length).toBeGreaterThanOrEqual(15);
		expect(first.every((button, i) => i === 0 || button !== first[i - 1])).toBe(true);
	});
});

describe("야바위", () => {
	// 첫 판은 0.5초에 공을 보여주기 시작해 0.9초 뒤부터 섞는다
	const rounds: readonly CupRound[] = [
		{ start: 0, swaps: [[0, 1], [1, 2], [0, 2]], swapMs: 400 },
		{ start: 2, swaps: [[0, 2], [0, 1], [1, 2], [0, 1]], swapMs: 300 },
	];
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => cupsPress(state, rounds, button, t), CUPS_START);

	it("섞은 대로 공이 든 컵의 자리를 따라간다", () => {
		expect(rounds.map(ballSpot)).toEqual([0, 2]);
	});

	it("공을 보여주고 섞는 동안 누른 것과 FINISH는 무시하고, 다 섞인 뒤에 고를 수 있다", () => {
		const first = rounds[0];
		if (first === undefined) throw new Error("no round");
		expect(chooseFrom(first, 500)).toBe(2600);
		expect(play([["red", 2599]])).toBe(CUPS_START);
		expect(play([["finish", 3000]])).toBe(CUPS_START);
	});

	it("공이 든 자리 버튼(왼쪽 빨강 · 가운데 초록 · 오른쪽 파랑)을 고르면 맞힌 판이 늘고, 0.8초 뒤 다음 판이 시작된다", () => {
		expect(play([["red", 3000]])).toMatchObject({ round: 1, roundAt: 3800, correct: 1, lastCorrectAt: 3000, event: { kind: "hit", spot: 0 } });
	});

	it("틀리면 맞힌 판 수는 그대로 다음 판으로 넘어간다", () => {
		expect(play([["blue", 3000]])).toMatchObject({ round: 1, roundAt: 3800, correct: 0, event: { kind: "miss", spot: 2 } });
	});

	it("점수는 맞힌 판 수가 먼저, 같으면 마지막으로 맞힌 시점이 빠른 쪽이 높다", () => {
		expect(cupsScore(play([["red", 3000]]))).toBe(117_000);
		expect(cupsScore(play([["red", 4000]]))).toBeLessThan(117_000);
		expect(formatCups(117_000)).toBe("1판");
		expect(cupsScore(CUPS_START)).toBe(0);
	});

	it("제한 시간이 지난 입력은 무시한다", () => {
		expect(play([["red", 20_001]])).toBe(CUPS_START);
	});

	it("섞는 횟수는 8번까지 늘고, 한 번 바꾸는 시간은 0.2초까지만 줄어든다", () => {
		const last = cupRounds(9).at(-1);
		expect(last?.swaps).toHaveLength(8);
		expect(last?.swapMs).toBe(200);
	});

	it("다 섞이자마자 바로 맞히는 사람도 점수 상한을 넘지 못한다", () => {
		const real = cupRounds(1);
		let state = CUPS_START;
		for (let round = real[state.round]; round !== undefined; round = real[state.round]) {
			const t = chooseFrom(round, state.roundAt);
			if (t > CUPS.durationMs) break;
			state = cupsPress(state, real, SPOT_BUTTON[ballSpot(round)], t);
		}
		expect(state.correct).toBeGreaterThan(0);
		expect(cupsScore(state)).toBeLessThanOrEqual(CUPS_MAX_SCORE);
	});

	it("같은 seed면 같은 판이 나오고, 판마다 섞는 횟수가 늘고(3번부터) 빨라진다", () => {
		const first = cupRounds(9);
		expect(cupRounds(9)).toEqual(first);
		expect(first[0]?.swaps).toHaveLength(3);
		expect(first.every((round, i) => i === 0 || round.swaps.length >= (first[i - 1]?.swaps.length ?? 0))).toBe(true);
		expect(first.every((round, i) => i === 0 || round.swapMs <= (first[i - 1]?.swapMs ?? Infinity))).toBe(true);
		expect(first.every((round) => round.swaps.every(([a, b]) => a !== b))).toBe(true);
	});
});

describe("보물 캐기", () => {
	// 구덩이마다 폭탄이 숨은 깊이: 첫 구덩이는 3번째 칸, 두 번째는 2번째 칸
	const bombs = [3, 2, 5];
	const play = (steps: readonly [Button, number][]) =>
		steps.reduce((state, [button, t]) => treasurePress(state, bombs, button, t), TREASURE_START);

	it("한 칸 팔 때마다 깊이만큼 금이 가방에 쌓이고, 파는 0.3초 동안 누른 건 무시한다", () => {
		const state = play([
			["red", 100],
			["blue", 300],
			["green", 400],
		]);
		expect(state).toMatchObject({ depth: 2, bag: 3, vault: 0 });
	});

	it("FINISH로 가방의 금을 금고에 넣고 새 구덩이를 판다", () => {
		const state = play([
			["red", 100],
			["red", 400],
			["finish", 800],
		]);
		expect(state).toMatchObject({ hole: 1, depth: 0, bag: 0, vault: 3, lastBankAt: 800, event: { kind: "bank", gold: 3 } });
	});

	it("폭탄 깊이에 닿으면 가방의 금을 잃고, 0.8초 멈췄다가 새 구덩이를 판다", () => {
		const state = play([
			["red", 100],
			["red", 400],
			["red", 700],
			["red", 1400],
		]);
		expect(state).toMatchObject({ hole: 1, depth: 0, bag: 0, vault: 0, event: { kind: "bomb", gold: 3 } });
		expect(play([["red", 100], ["red", 400], ["red", 700], ["red", 1500]])).toMatchObject({ hole: 1, depth: 1, bag: 1 });
	});

	it("파는 중(0.3초)에 누른 FINISH도 바로 금고에 넣는다", () => {
		expect(play([["red", 100], ["finish", 200]])).toMatchObject({ vault: 1, lastBankAt: 200, event: { kind: "bank", gold: 1 } });
	});

	it("폭탄 깊이를 다 아는 사람이 쉬지 않고 파도 점수 상한을 넘지 못한다", () => {
		const real = bombDepths(1);
		let state = TREASURE_START;
		for (let t = 0; t <= TREASURE.durationMs; t = Math.max(t + 1, state.busyUntil)) {
			const bomb = real[state.hole] ?? TREASURE.maxBombDepth;
			state = treasurePress(state, real, state.depth + 1 < bomb ? "red" : "finish", t);
		}
		expect(state.vault).toBeGreaterThan(0);
		expect(treasureScore(state)).toBeLessThanOrEqual(TREASURE_MAX_SCORE);
	});

	it("가방이 비었을 때 누른 FINISH와 제한 시간이 지난 입력은 무시한다", () => {
		expect(play([["finish", 100]])).toBe(TREASURE_START);
		expect(play([["red", 20_001]])).toBe(TREASURE_START);
	});

	it("점수는 금고의 금이 먼저, 같으면 먼저 모은 쪽이 높다", () => {
		const banked = play([
			["red", 100],
			["red", 400],
			["finish", 800],
		]);
		expect(treasureScore(banked)).toBe(319_200);
		expect(formatTreasure(319_200)).toBe("3골드");
		expect(treasureScore(TREASURE_START)).toBe(0);
	});

	it("같은 seed면 모든 폰의 땅이 같고, 폭탄은 두 번째 칸에서 아홉 번째 칸 사이에 있다", () => {
		const first = bombDepths(3);
		expect(bombDepths(3)).toEqual(first);
		expect(bombDepths(4)).not.toEqual(first);
		expect(first.every((depth) => depth >= 2 && depth <= 9)).toBe(true);
	});
});
