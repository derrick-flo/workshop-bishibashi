import { describe, expect, it } from "vitest";
import { DEMO_SCRIPTS, type DemoScript } from "../src/client/games/demo-scripts";
import { BALLOON_START, balloonPress } from "../src/domain/games/balloon";
import { CANDY_START, candyPress, candyTargets } from "../src/domain/games/candy";
import { GAME_IDS, GAMES } from "../src/domain/games/catalog";
import { EYE_START, eyeDirections, eyePress } from "../src/domain/games/eye";
import { CUPS_START, cupRounds, cupsPress } from "../src/domain/games/cups";
import { GRILL_START, grillCookTimes, grillPress } from "../src/domain/games/grill";
import { JUDGE_START, judgeBouts, judgePress } from "../src/domain/games/judge";
import { MEMORY_START, memoryPress, memorySequence } from "../src/domain/games/memory";
import { MONSTER_START, monsterPress, monsterQueue } from "../src/domain/games/monster";
import { SHOOTING_START, shootingPress, shootingTargets } from "../src/domain/games/shooting";
import { STAIRS_START, stairsCourse, stairsPress } from "../src/domain/games/stairs";
import { bombDepths, TREASURE_START, treasurePress } from "../src/domain/games/treasure";

function script(id: keyof typeof DEMO_SCRIPTS): DemoScript {
	const found = DEMO_SCRIPTS[id];
	if (found === undefined) throw new Error(`${id} 대본이 없어요`);
	return found;
}

describe("시연 대본", () => {
	it("입력은 시간 순서이고 게임 시간 안에 끝나며, 한 바퀴 길이도 게임 시간 안이다", () => {
		for (const id of GAME_IDS) {
			const demo = DEMO_SCRIPTS[id];
			if (demo === undefined) continue;
			const times = demo.steps.map(([t]) => t);
			expect(times, id).toEqual([...times].sort((a, b) => a - b));
			expect(Math.max(...times), id).toBeLessThan(GAMES[id].durationMs);
			expect(demo.lengthMs, id).toBeLessThanOrEqual(GAMES[id].durationMs);
			expect(demo.lengthMs, id).toBeGreaterThan(Math.max(...times));
		}
	});

	it("풍선은 다 채운 뒤 FINISH로 묶는다(터지지 않는다)", () => {
		const state = script("balloon").steps.reduce((s, [t, button]) => balloonPress(s, button, t), BALLOON_START);
		expect(state.finishedAt).not.toBeNull();
		expect(state.burst).toBe(false);
	});

	it("알사탕은 두 병을 틀리지 않고 채운다", () => {
		const demo = script("candy");
		const targets = candyTargets(demo.seed);
		const kinds: string[] = [];
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = candyPress(s, targets, button, t);
			if (next.event !== null && next.event !== s.event) kinds.push(next.event.kind);
			return next;
		}, CANDY_START);
		expect(state.completed).toBe(2);
		expect(kinds).not.toContain("spill");
		expect(kinds).not.toContain("wrong");
	});

	it("시력검사는 한 번만 틀리고 나머지는 맞힌다", () => {
		const demo = script("eye");
		const directions = eyeDirections(demo.seed);
		let misses = 0;
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = eyePress(s, directions, button, t);
			if (next.event?.kind === "miss" && next !== s) misses++;
			return next;
		}, EYE_START);
		expect(misses).toBe(1);
		expect(state.correct).toBe(demo.steps.length - 1);
	});

	it("몬스터는 한 번만 틀리고, 모두 쓰러뜨린 뒤 드래곤까지 깬다", () => {
		const demo = script("monster");
		const queue = monsterQueue(demo.seed);
		let misses = 0;
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = monsterPress(s, queue, button, t);
			if (next !== s && next.event?.kind === "miss") misses++;
			return next;
		}, MONSTER_START);
		expect(misses).toBe(1);
		expect(state.clearedAt).not.toBeNull();
	});

	it("가위바위보 판정은 한 번만 틀리고 나머지는 맞힌다", () => {
		const demo = script("judge");
		const bouts = judgeBouts(demo.seed);
		let misses = 0;
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = judgePress(s, bouts, button, t);
			if (next !== s && next.event?.kind === "miss") misses++;
			return next;
		}, JUDGE_START);
		expect(misses).toBe(1);
		expect(state.correct).toBe(demo.steps.length - 1);
	});

	it("권총 속사는 한 발만 빗나가고 나머지는 명중한다", () => {
		const demo = script("shooting");
		const targets = shootingTargets(demo.seed);
		const state = demo.steps.reduce((s, [t, button]) => shootingPress(s, targets, button, t), SHOOTING_START);
		expect(state.shots).toHaveLength(demo.steps.length);
		expect(state.shots.filter((shot) => !shot.hit)).toHaveLength(1);
	});

	it("계단은 한 번 넘어지고 나머지는 한 칸씩 오른다", () => {
		const demo = script("stairs");
		const course = stairsCourse(demo.seed);
		let falls = 0;
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = stairsPress(s, course, button, t);
			if (next !== s && next.event?.kind === "fall") falls++;
			return next;
		}, STAIRS_START);
		expect(falls).toBe(1);
		expect(state.position).toBe(demo.steps.length - 1);
	});

	it("삼겹살은 한 번만 덜 익게 집고 나머지는 알맞게 집는다", () => {
		const demo = script("grill");
		const cookTimes = grillCookTimes(demo.seed);
		const kinds: string[] = [];
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = grillPress(s, cookTimes, button, t);
			if (next !== s && next.event !== null) kinds.push(next.event.kind);
			return next;
		}, GRILL_START);
		expect(kinds.filter((kind) => kind === "raw")).toHaveLength(1);
		expect(state.good).toBe(demo.steps.length - 1);
	});

	it("순서 기억하기는 한 번 틀린 뒤 다시 보고 맞혀 4개까지 기억한다", () => {
		const demo = script("memory");
		const sequence = memorySequence(demo.seed);
		let misses = 0;
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = memoryPress(s, sequence, button, t);
			if (next !== s && next.event?.kind === "miss") misses++;
			return next;
		}, MEMORY_START);
		expect(misses).toBe(1);
		expect(state.best).toBe(4);
	});

	it("야바위는 한 판만 틀리고 나머지는 맞힌다", () => {
		const demo = script("cups");
		const rounds = cupRounds(demo.seed);
		const state = demo.steps.reduce((s, [t, button]) => cupsPress(s, rounds, button, t), CUPS_START);
		expect(state.round).toBe(demo.steps.length);
		expect(state.correct).toBe(demo.steps.length - 1);
	});

	it("보물 캐기는 두 번 금고에 넣고, 한 번은 욕심내다 폭탄을 만난다", () => {
		const demo = script("treasure");
		const bombs = bombDepths(demo.seed);
		const kinds: string[] = [];
		const state = demo.steps.reduce((s, [t, button]) => {
			const next = treasurePress(s, bombs, button, t);
			if (next !== s && next.event !== null) kinds.push(next.event.kind);
			return next;
		}, TREASURE_START);
		expect(kinds.filter((kind) => kind === "bank")).toHaveLength(2);
		expect(kinds.filter((kind) => kind === "bomb")).toHaveLength(1);
		expect(state.vault).toBeGreaterThan(0);
	});
});
