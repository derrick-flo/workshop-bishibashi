import { describe, expect, it } from "vitest";
import { DEMO_SCRIPTS, type DemoScript } from "../src/client/games/demo-scripts";
import { BALLOON_START, balloonPress } from "../src/domain/games/balloon";
import { CANDY_START, candyPress, candyTargets } from "../src/domain/games/candy";
import { GAME_IDS, GAMES } from "../src/domain/games/catalog";
import { EYE_START, eyeDirections, eyePress } from "../src/domain/games/eye";
import { REACTION, reactionPress, reactionSignals, reactionStart } from "../src/domain/games/reaction";

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

	it("결투는 두 판 모두 신호 뒤에 눌러 명중한다", () => {
		const demo = script("reaction");
		const signals = reactionSignals(demo.seed);
		const state = demo.steps.reduce((s, [t]) => reactionPress(s, signals, t), reactionStart(signals.length));
		expect(state.results.slice(0, 2).every((record) => record !== null && record < REACTION.penaltyMs)).toBe(true);
	});
});
