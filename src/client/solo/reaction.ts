import { formatReaction, type ReactionResult, reactionPasses, reactionWaitMs } from "../../domain/solo/reaction";
import { arcade } from "../arcade-sound";
import { CHECK, CROSS } from "../games/art/common";
import { rect, scale } from "../pixel/bitmap";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { disc, ring } from "../pixel/shapes";
import { buzz } from "../sound";
import { bigLabel, blitCentered } from "./draw";
import { type SoloGame, startSoloPage } from "./shell";

/** 반응속도 테스트 화면. 신호등이 초록으로 바뀌는 순간 화면을 누른다. */

const W = 128;
const H = 176;
const BODY = { x: 10, y: 14, w: 108, h: 124 } as const;
const LAMP = { x: 64, y: 72, d: 100 } as const;
const TEXT_Y = 158;
/** 결과를 보고 바로 다음 도전으로 넘어가 버리지 않게 잠깐 누르기를 받지 않는다 */
const REPLAY_LOCK_MS = 500;

type Phase =
	| { readonly kind: "idle" }
	| { readonly kind: "waiting"; readonly goAt: number }
	| { readonly kind: "go"; readonly greenAt: number }
	| { readonly kind: "done"; readonly result: ReactionResult; readonly passed: boolean; readonly at: number };

const MARK_CHECK = scale(CHECK, 5);
const MARK_CROSS = scale(CROSS, 5);
const LAMP_RIM = ring(LAMP.d, 2, C.k);

export const reactionGame: SoloGame = {
	width: W,
	height: H,
	background: C.n,
	start(stage, kit, solo) {
		let phase: Phase = { kind: "idle" };

		function finish(result: ReactionResult): void {
			// 기록과 화면이 어긋나지 않게 판정한 결과를 들고 간다(진행자가 기준을 바꿔도 지난 도전은 그대로)
			const passed = reactionPasses(result, solo.rules().reactionPassMs);
			phase = { kind: "done", result, passed, at: performance.now() };
			if (passed) {
				kit.emit(sparkle(LAMP.x, LAMP.y, [C.y, C.g, C.l], Math.random, 18, 70, 560));
				arcade.jar();
			} else {
				kit.shake(2, 260);
				arcade.wrong();
				buzz(140);
			}
			solo.report(passed, formatReaction(result));
		}

		function press(at: number): void {
			switch (phase.kind) {
				case "idle":
					phase = { kind: "waiting", goAt: at + reactionWaitMs(Math.random) };
					arcade.reveal();
					return;
				case "waiting":
					return finish({ kind: "tooSoon" });
				case "go":
					return finish({ kind: "measured", ms: at - phase.greenAt });
				case "done":
					if (at - phase.at >= REPLAY_LOCK_MS) phase = { kind: "idle" };
					return;
			}
		}

		/** 신호등 몸통과 등. face 가 등의 색 */
		function drawSignal(face: number): void {
			const fb = kit.fb;
			rect(fb, 0, 0, W, H, C.n);
			rect(fb, BODY.x - 2, BODY.y - 2, BODY.w + 4, BODY.h + 4, C.k);
			rect(fb, BODY.x, BODY.y, BODY.w, BODY.h, C.A);
			rect(fb, BODY.x, BODY.y, BODY.w, 2, C.a);
			rect(fb, BODY.x, BODY.y + BODY.h - 2, BODY.w, 2, C.v);
			blitCentered(fb, disc(LAMP.d, face), LAMP.x, LAMP.y);
			blitCentered(fb, LAMP_RIM, LAMP.x, LAMP.y);
		}

		function drawDone(result: ReactionResult, passed: boolean): void {
			drawSignal(passed ? C.G : C.R);
			blitCentered(kit.fb, passed ? MARK_CHECK : MARK_CROSS, LAMP.x, LAMP.y);
			const record = result.kind === "tooSoon" ? "FOUL" : `${Math.round(result.ms)}MS`;
			blitCentered(kit.fb, bigLabel(record, passed ? C.l : C.p, 3), W / 2, TEXT_Y);
		}

		function draw(now: number): void {
			switch (phase.kind) {
				case "idle":
					drawSignal(C.A);
					blitCentered(kit.fb, bigLabel("TAP", C.y, 4), LAMP.x, LAMP.y);
					kit.setHint("탭하면 시작해요");
					return;
				case "waiting":
					drawSignal(C.r);
					blitCentered(kit.fb, bigLabel("WAIT", C.W, 3), LAMP.x, LAMP.y);
					kit.setHint("초록이 되면 바로 탭!");
					return;
				case "go":
					drawSignal(C.g);
					blitCentered(kit.fb, bigLabel("TAP!", C.w, 3), LAMP.x, LAMP.y);
					kit.setHint("지금!", "good");
					return;
				case "done": {
					const { result, passed } = phase;
					drawDone(result, passed);
					const again = now - phase.at >= REPLAY_LOCK_MS ? " · 탭하면 다시" : "";
					if (result.kind === "tooSoon") kit.setHint(`너무 빨랐어요!${again}`, "bad");
					else if (passed) kit.setHint(`${formatReaction(result)} · 성공!${again}`, "good");
					else kit.setHint(`${formatReaction(result)} · ${solo.rules().reactionPassMs}ms 이하여야 해요${again}`, "bad");
					return;
				}
			}
		}

		stage.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			press(event.timeStamp);
		});

		kit.run((now) => {
			// 초록으로 바뀐 시각은 초록을 처음 그리는 이 프레임의 시각으로 본다
			if (phase.kind === "waiting" && now >= phase.goAt) {
				phase = { kind: "go", greenAt: now };
				arcade.blip();
			}
			draw(now);
		});
	},
};

startSoloPage({
	title: "반응속도 테스트",
	goal: (rules) => `${rules.reactionPassMs}ms 이하면 성공`,
	game: reactionGame,
});
