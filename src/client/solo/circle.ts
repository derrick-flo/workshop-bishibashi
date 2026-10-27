import { type CirclePoint, type CircleResult, circlePasses, formatCircle, judgeCircle } from "../../domain/solo/circle";
import { arcade } from "../arcade-sound";
import { CHECK, CROSS } from "../games/art/common";
import { line, outline, rect, scale } from "../pixel/bitmap";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { type PointerFrame, pointerFrame } from "../pixel/pointer";
import { disc } from "../pixel/shapes";
import { buzz } from "../sound";
import { bigLabel, blitCentered } from "./draw";
import { type SoloGame, startSoloPage } from "./shell";

/** 원 그리기 화면. 가운데 점을 중심으로 손가락을 한 바퀴 돌리면 자취가 얼마나 고른 원인지 재 준다. */

const W = 128;
const H = 176;
const CENTER = { x: W / 2, y: 80 } as const;
/** 화면에 들어가는 가장 큰 반지름(가상 픽셀). 규칙은 이 값을 1 로 본다. */
const MAX_RADIUS = 56;
const TEXT_Y = 158;
const REPLAY_LOCK_MS = 500;
/** 이만큼도 돌지 않은 자취는 손가락이 스친 것으로 보고 도전으로 세지 않는다 */
const MIN_TURN = 0.5;

/** 가상 픽셀 좌표 */
type Point = { readonly x: number; readonly y: number };

type Phase =
	| { readonly kind: "idle" }
	| { readonly kind: "drawing"; readonly trail: readonly Point[] }
	| { readonly kind: "done"; readonly trail: readonly Point[]; readonly result: CircleResult; readonly passed: boolean; readonly at: number };

const MARK_CHECK = scale(CHECK, 4);
const MARK_CROSS = scale(CROSS, 4);
const CENTER_DOT = outline(disc(5, C.y), C.k);

/** 가상 픽셀 좌표 → 중심을 (0, 0), 가장 큰 반지름을 1 로 본 좌표 */
function normalize(point: Point): CirclePoint {
	return { x: (point.x - CENTER.x) / MAX_RADIUS, y: (point.y - CENTER.y) / MAX_RADIUS };
}

export const circleGame: SoloGame = {
	width: W,
	height: H,
	background: C.n,
	start(_stage, kit, solo) {
		const canvas = kit.screen.canvas;
		let phase: Phase = { kind: "idle" };
		let frame: PointerFrame | null = null;
		let holding: number | null = null;

		function finish(trail: readonly Point[], result: CircleResult): void {
			// 기록과 화면이 어긋나지 않게 판정한 결과를 들고 간다(진행자가 기준을 바꿔도 지난 도전은 그대로)
			const passed = circlePasses(result, solo.rules().circlePassPercent);
			phase = { kind: "done", trail, result, passed, at: performance.now() };
			frame = null;
			holding = null;
			if (passed) {
				kit.emit(sparkle(CENTER.x, CENTER.y, [C.y, C.g, C.l], Math.random, 18, 70, 560));
				arcade.jar();
			} else {
				kit.shake(2, 260);
				arcade.wrong();
				buzz(140);
			}
			solo.report(passed, formatCircle(result));
		}

		canvas.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			if (holding !== null) return;
			if (phase.kind === "done" && performance.now() - phase.at < REPLAY_LOCK_MS) return;
			const map = pointerFrame(kit.screen, W, H);
			const point = map(event);
			if (point.x < 0 || point.y < 0 || point.x > W || point.y > H) return;
			frame = map;
			holding = event.pointerId;
			canvas.setPointerCapture(event.pointerId);
			phase = { kind: "drawing", trail: [point] };
			arcade.reveal();
		});

		canvas.addEventListener("pointermove", (event) => {
			if (phase.kind !== "drawing" || frame === null || event.pointerId !== holding) return;
			const trail = [...phase.trail, frame(event)];
			phase = { kind: "drawing", trail };
			// 한 바퀴를 돌거나 되돌아간 순간 바로 끝낸다
			const result = judgeCircle(trail.map(normalize));
			if (result.kind !== "short") finish(trail, result);
		});

		function release(event: PointerEvent): void {
			if (phase.kind !== "drawing" || event.pointerId !== holding) return;
			const trail = phase.trail;
			const result = judgeCircle(trail.map(normalize));
			if (result.kind === "short" && result.turned < MIN_TURN) {
				phase = { kind: "idle" };
				frame = null;
				holding = null;
				return;
			}
			finish(trail, result);
		}

		canvas.addEventListener("pointerup", release);
		canvas.addEventListener("pointercancel", release);

		function drawBoard(): void {
			const fb = kit.fb;
			rect(fb, 0, 0, W, H, C.n);
			for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) rect(fb, x, y, 1, 1, C.v);
		}

		function drawTrail(trail: readonly Point[], color: number): void {
			for (let i = 1; i < trail.length; i++) {
				const from = trail[i - 1];
				const to = trail[i];
				if (from !== undefined && to !== undefined) line(kit.fb, from.x, from.y, to.x, to.y, color);
			}
		}

		function drawResult(result: CircleResult, passed: boolean): void {
			blitCentered(kit.fb, passed ? MARK_CHECK : MARK_CROSS, CENTER.x, CENTER.y);
			if (result.kind === "scored") {
				blitCentered(kit.fb, bigLabel(`${result.percent.toFixed(1)}%`, passed ? C.l : C.p, 3), W / 2, TEXT_Y);
			}
		}

		function hintFor(result: CircleResult, passed: boolean, again: string): void {
			switch (result.kind) {
				case "scored":
					return kit.setHint(
						passed ? `${formatCircle(result)} · 성공!${again}` : `${formatCircle(result)} · ${solo.rules().circlePassPercent}% 이상이어야 해요${again}`,
						passed ? "good" : "bad",
					);
				case "short":
					return kit.setHint(`한 바퀴를 못 돌았어요${again}`, "bad");
				case "small":
					return kit.setHint(`너무 작아요. 크게 그려요${again}`, "bad");
				case "backtracked":
					return kit.setHint(`가던 방향을 되돌렸어요${again}`, "bad");
			}
		}

		kit.run((now) => {
			drawBoard();
			switch (phase.kind) {
				case "idle":
					blitCentered(kit.fb, CENTER_DOT, CENTER.x, CENTER.y);
					kit.setHint("가운데 점을 중심으로 한 바퀴 그려요");
					return;
				case "drawing":
					drawTrail(phase.trail, C.c);
					blitCentered(kit.fb, CENTER_DOT, CENTER.x, CENTER.y);
					kit.setHint("그대로 한 바퀴!");
					return;
				case "done": {
					const { passed } = phase;
					drawTrail(phase.trail, passed ? C.l : C.p);
					blitCentered(kit.fb, CENTER_DOT, CENTER.x, CENTER.y);
					drawResult(phase.result, passed);
					hintFor(phase.result, passed, now - phase.at >= REPLAY_LOCK_MS ? " · 다시 그려요" : "");
					return;
				}
			}
		});
	},
};

startSoloPage({
	title: "원 그리기",
	goal: (rules) => `${rules.circlePassPercent}% 이상이면 성공`,
	game: circleGame,
});
