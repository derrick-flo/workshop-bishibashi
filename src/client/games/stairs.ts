import { formatStairs, STAIRS_START, type StairsState, stairsCourse, stairsPress, stairsScore } from "../../domain/games/stairs";
import { arcade } from "../arcade-sound";
import { blit, dither, plot, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { FLAG, RUNNER, RUNNER_DOWN } from "./art/stairs";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
/** 칸 너비와 계단 한 칸 높이 */
const TW = 6;
const SH = 4;
/** 화면에서 등산객이 서는 자리(발밑 가운데) */
const RUNNER_X = 17;
const FEET_Y = 42;
const STEP_MS = 90;

const OOPS_TEXT = label(BIG, "OOPS!", C.p, C.k);
const GOAL_TEXT = label(BIG, "GOAL!", C.y, C.k);

export const mountStairs: MountGame = (stage, seed) => {
	const course = stairsCourse(seed);
	/** heights[i] = i번 칸을 밟았을 때의 높이(그때까지 나온 계단 수) */
	const heights = course.reduce<readonly number[]>(
		(acc, step) => [...acc, (acc[acc.length - 1] ?? 0) + (step === "stair" ? 1 : 0)],
		[],
	);
	const summit = Math.max(1, heights[heights.length - 1] ?? 1);
	const kit = mountKit(stage, W, H, C.N);
	let state: StairsState = STAIRS_START;
	let movedAt = Number.NEGATIVE_INFINITY;
	let goalAt: number | null = null;

	/** 칸 i 윗면의 세계 높이(위로 갈수록 작다). 출발점(i < 0)은 0, 끝 너머는 정상 높이 */
	const topOf = (i: number) => -(i < 0 ? 0 : (heights[Math.min(i, heights.length - 1)] ?? 0)) * SH;
	const centerOf = (i: number) => i * TW + TW / 2;
	const fallen = (now: number) => (kit.gameTime(now) ?? 0) < state.lockedUntil;

	/** 등산객의 세계 좌표와 뛰어오른 높이. 한 칸 옮길 때는 짧게 이어 움직이고, 계단이면 살짝 뛴다 */
	function runnerAt(now: number): readonly [number, number, number] {
		const here = state.position - 1;
		const p = Math.min(1, (now - movedAt) / STEP_MS);
		if (p >= 1 || state.position === 0) return [centerOf(here), topOf(here), 0];
		const hop = course[here] === "stair" ? Math.sin(p * Math.PI) * 3 : Math.sin(p * Math.PI);
		return [centerOf(here - 1) + TW * p, topOf(here - 1) + (topOf(here) - topOf(here - 1)) * p, hop];
	}

	function drawSky(camX: number, camY: number): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, H, C.N);
		dither(fb, 0, 16, W, 4, C.N, C.m, 1);
		rect(fb, 0, 20, W, 8, C.m);
		dither(fb, 0, 28, W, 4, C.m, C.p, 2);
		rect(fb, 0, 32, W, H - 32, C.p);
		// 먼 산(천천히 따라온다)
		for (let x = 0; x < W; x++) {
			const wx = x + camX * 0.15;
			const top = Math.round(30 + Math.sin(wx / 9) * 4 + Math.sin(wx / 4) * 1.5 - camY * 0.1);
			rect(fb, x, top, 1, H - top, C.v);
			plot(fb, x, top, C.W);
		}
	}

	function drawCourse(now: number, camX: number, camY: number): void {
		const fb = kit.fb;
		const first = Math.floor((camX - RUNNER_X) / TW) - 1;
		for (let i = first; i <= first + Math.ceil(W / TW) + 2; i++) {
			const x = Math.round(i * TW - camX + RUNNER_X);
			const y = Math.round(topOf(i) - camY + FEET_Y);
			if (y >= H) continue;
			if (i >= 0 && i < course.length && course[i] === "stair") {
				// 이끼 낀 돌계단(초록 버튼)
				rect(fb, x, y, TW, H - y, C.a);
				rect(fb, x, y, TW, 1, C.l);
				rect(fb, x, y + 1, TW, 1, C.g);
				rect(fb, x + TW - 1, y + 2, 1, H - y - 2, C.A);
				for (let row = y + 5; row < H; row += 4) rect(fb, x, row, TW, 1, C.A);
			} else {
				// 흙길(빨강·파랑 버튼)
				rect(fb, x, y, TW, H - y, C.t);
				rect(fb, x, y, TW, 1, C.o);
				rect(fb, x, y + 1, TW, 1, C.O);
				for (let row = y + 4; row < H; row += 5) plot(fb, x + ((i * 7 + row) % TW), row, C.T);
			}
			// 마지막 계단 바로 앞 정상에 꽂은 깃발
			if (i === course.length) {
				rect(fb, x + 2, y - 12, 1, 12, C.W);
				const flag = FLAG[Math.floor(now / 200) % FLAG.length];
				if (flag !== undefined) blit(fb, flag, x + 3, y - 12);
			}
		}
		// 다음에 밟을 칸 위에서 깜빡이는 화살표
		const next = state.position;
		if (next < course.length && state.finishedAt === null && !fallen(now) && Math.floor(now / 180) % 2 === 0) {
			const x = Math.round(centerOf(next) - camX + RUNNER_X);
			const y = Math.round(topOf(next) - camY + FEET_Y);
			rect(fb, x - 1, y - 6, 3, 1, C.y);
			plot(fb, x, y - 5, C.y);
		}
	}

	function drawRunner(now: number, hop: number): void {
		const fb = kit.fb;
		if (fallen(now)) {
			blit(fb, RUNNER_DOWN, RUNNER_X - 4, FEET_Y - RUNNER_DOWN.h + 1);
			// 머리 위를 도는 별
			for (let i = 0; i < 3; i++) {
				const a = now / 130 + (i * Math.PI * 2) / 3;
				plot(fb, RUNNER_X + 4 + Math.cos(a) * 4, FEET_Y - 9 + Math.sin(a) * 1.5, C.y);
			}
			return;
		}
		const moving = now - movedAt < STEP_MS;
		const cheer = goalAt !== null ? Math.abs(Math.sin((now - goalAt) / 150)) * 3 : 0;
		const art = moving ? (course[state.position - 1] === "stair" ? RUNNER.hop : RUNNER.walk) : RUNNER.stand;
		blit(fb, art, RUNNER_X - Math.floor(art.w / 2), Math.round(FEET_Y - art.h + 1 - hop - cheer));
	}

	function drawHud(): void {
		const count = cachedLabel(BIG, `${state.position}/${course.length}`, C.w, C.k);
		blit(kit.fb, count, 2, 2);
	}

	function updateHint(now: number): void {
		if (state.finishedAt !== null) return kit.setHint(`도착! ${formatStairs(stairsScore(state))}`, "good");
		if (fallen(now)) return kit.setHint("넘어졌다! 잠깐 멈춤", "bad");
		kit.setHint("평지는 빨강·파랑, 계단은 초록!");
	}

	kit.run((now) => {
		const [camX, camY, hop] = runnerAt(now);
		drawSky(camX, camY);
		drawCourse(now, camX, camY);
		drawRunner(now, hop);
		drawHud();
		updateHint(now);
	});

	return {
		labels: {
			red: { text: "걷기", enabled: true },
			green: { text: "계단", enabled: true },
			blue: { text: "걷기", enabled: true },
			finish: { text: "", enabled: false },
		},
		press(button, t) {
			const before = state;
			state = stairsPress(state, course, button, t);
			if (state === before) return;
			const now = performance.now();
			const kind = state.event?.kind;
			if (kind === "fall") {
				kit.popup(OOPS_TEXT, RUNNER_X + 8, FEET_Y - 20, 700, 6);
				kit.shake(1, 200);
				arcade.wrong();
				buzz(150);
				return;
			}
			movedAt = now;
			const here = state.position - 1;
			arcade.step(course[here] === "stair", (heights[here] ?? 0) / summit);
			if (kind === "goal") {
				goalAt = now;
				kit.popup(GOAL_TEXT, W / 2, 24, 1800, 6);
				kit.emit(sparkle(RUNNER_X, FEET_Y - 8, [C.y, C.w, C.l, C.r], Math.random, 20, 60, 900));
				arcade.fanfare();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => stairsScore(state),
	};
};
