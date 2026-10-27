import { formatGap, formatSeconds, STOPWATCH, stopwatchPasses } from "../../domain/solo/stopwatch";
import { arcade } from "../arcade-sound";
import { CHECK, CROSS } from "../games/art/common";
import { blank, blit, rect, scale } from "../pixel/bitmap";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { disc } from "../pixel/shapes";
import { buzz } from "../sound";
import { bigLabel, blitCentered } from "./draw";
import { type SoloGame, startSoloPage } from "./shell";

/** 10초 맞추기 화면. 돌아가는 초시계를 10.00초에 맞춰 멈춘다. */

const W = 128;
const H = 176;
const DIAL = { x: 64, y: 82, d: 116 } as const;
const FACE_D = 104;
const DIGITS_Y = 82;
const MARK_Y = 159;
const REPLAY_LOCK_MS = 500;

type Phase =
	| { readonly kind: "idle" }
	| { readonly kind: "running"; readonly startedAt: number }
	| { readonly kind: "done"; readonly elapsedMs: number; readonly passed: boolean; readonly at: number };

/** 초시계 숫자판에 적는 글자. "10.00" */
const seconds = (ms: number) => (ms / 1000).toFixed(STOPWATCH.digits);

const MARK_CHECK = scale(CHECK, 3);
const MARK_CROSS = scale(CROSS, 3);

/** 초시계 몸통. 한 번 만들어 매 프레임 그대로 찍는다. */
const WATCH = (() => {
	const art = blank(DIAL.d, DIAL.d);
	const inset = (DIAL.d - FACE_D) / 2;
	blit(art, disc(DIAL.d, C.k), 0, 0);
	blit(art, disc(DIAL.d - 4, C.a), 2, 2);
	blit(art, disc(FACE_D, C.k), inset, inset);
	blit(art, disc(FACE_D - 4, C.w), inset + 2, inset + 2);
	// 눈금 12 개. 세 칸마다 진하게
	for (let i = 0; i < 12; i++) {
		const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
		const radius = FACE_D / 2 - 5;
		const x = DIAL.d / 2 + Math.cos(angle) * radius;
		const y = DIAL.d / 2 + Math.sin(angle) * radius;
		rect(art, Math.round(x) - 1, Math.round(y) - 1, 2, 2, i % 3 === 0 ? C.k : C.a);
	}
	return art;
})();

export const stopwatchGame: SoloGame = {
	width: W,
	height: H,
	background: C.n,
	start(stage, kit, solo) {
		let phase: Phase = { kind: "idle" };

		function finish(elapsedMs: number): void {
			// 기록과 화면이 어긋나지 않게 판정한 결과를 들고 간다(진행자가 기준을 바꿔도 지난 도전은 그대로)
			const passed = stopwatchPasses(elapsedMs, solo.rules().stopwatchAllowedMs);
			phase = { kind: "done", elapsedMs, passed, at: performance.now() };
			if (passed) {
				kit.emit(sparkle(DIAL.x, DIAL.y, [C.y, C.g, C.l], Math.random, 18, 70, 560));
				arcade.jar();
			} else {
				kit.shake(2, 260);
				arcade.wrong();
				buzz(140);
			}
			solo.report(passed, formatSeconds(elapsedMs));
		}

		function press(at: number): void {
			switch (phase.kind) {
				case "idle":
					phase = { kind: "running", startedAt: at };
					arcade.reveal();
					return;
				case "running":
					return finish(at - phase.startedAt);
				case "done":
					if (at - phase.at >= REPLAY_LOCK_MS) phase = { kind: "idle" };
					return;
			}
		}

		function drawWatch(): void {
			const fb = kit.fb;
			rect(fb, 0, 0, W, H, C.n);
			// 용두와 양옆 단추(몸통보다 먼저 그려 가려지게)
			rect(fb, 57, 4, 14, 22, C.k);
			rect(fb, 59, 6, 10, 18, C.a);
			rect(fb, 30, 18, 14, 13, C.k);
			rect(fb, 32, 20, 10, 9, C.A);
			rect(fb, 84, 18, 14, 13, C.k);
			rect(fb, 86, 20, 10, 9, C.A);
			blitCentered(fb, WATCH, DIAL.x, DIAL.y);
		}

		function draw(now: number): void {
			drawWatch();
			switch (phase.kind) {
				case "idle":
					blitCentered(kit.fb, bigLabel(seconds(0), C.A, 3), DIAL.x, DIGITS_Y);
					kit.setHint("탭하면 시작해요");
					return;
				case "running": {
					// 매 프레임 숫자가 달라져 bigLabel 의 기억은 못 쓰지만, 글자 하나 만드는 값이라 그냥 만든다
					const running = Math.max(0, now - phase.startedAt);
					blitCentered(kit.fb, bigLabel(seconds(running), C.v, 3), DIAL.x, DIGITS_Y);
					kit.setHint("10.00 에 맞춰 다시 탭!");
					return;
				}
				case "done": {
					const { passed } = phase;
					blitCentered(kit.fb, bigLabel(seconds(phase.elapsedMs), passed ? C.G : C.R, 3), DIAL.x, DIGITS_Y);
					blitCentered(kit.fb, passed ? MARK_CHECK : MARK_CROSS, DIAL.x, MARK_Y);
					const again = now - phase.at >= REPLAY_LOCK_MS ? " · 탭하면 다시" : "";
					const record = `${formatSeconds(phase.elapsedMs)} (${formatGap(phase.elapsedMs)})`;
					kit.setHint(passed ? `${record} 성공!${again}` : `${record} 실패${again}`, passed ? "good" : "bad");
					return;
				}
			}
		}

		stage.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			press(event.timeStamp);
		});

		kit.run((now) => {
			// 누르지 않고 너무 오래 끌면 저절로 멈춘다
			if (phase.kind === "running" && now - phase.startedAt >= STOPWATCH.limitMs) finish(STOPWATCH.limitMs);
			draw(now);
		});
	},
};

startSoloPage({
	title: "10초 맞추기",
	goal: (rules) => `10.00초에서 오차 ${rules.stopwatchAllowedMs / 1000}초 이내면 성공`,
	game: stopwatchGame,
});
