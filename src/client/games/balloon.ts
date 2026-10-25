import { BALLOON, BALLOON_START, balloonPress, balloonScore, formatBalloon } from "../../domain/games/balloon";
import { pick } from "../dom";
import { buzz, sfx } from "../sound";
import type { MountGame } from "./types";

export const mountBalloon: MountGame = (stage) => {
	stage.innerHTML = `
		<div class="balloon">
			<div class="balloon__meter" aria-hidden="true"><div class="balloon__fill"></div></div>
			<div class="balloon__body" aria-hidden="true">🎈</div>
			<p class="balloon__hint" role="status">빨강·파랑 번갈아!</p>
		</div>`;
	const root = pick(stage, ".balloon");
	const body = pick(stage, ".balloon__body");
	const fill = pick(stage, ".balloon__fill");
	const hint = pick(stage, ".balloon__hint");
	let state = BALLOON_START;

	function draw(): void {
		const ratio = state.pumps / BALLOON.fullPumps;
		body.style.setProperty("--size", String(0.45 + Math.min(ratio, 1.2) * 0.9));
		fill.style.setProperty("--ratio", String(Math.min(ratio, 1)));
		root.classList.toggle("is-full", state.pumps >= BALLOON.fullPumps && state.finishedAt === null && !state.burst);
		root.classList.toggle("is-danger", state.pumps > BALLOON.fullPumps + 3 && !state.burst && state.finishedAt === null);
		if (state.burst) {
			body.textContent = "💥";
			hint.textContent = "펑! 터졌어요";
		} else if (state.finishedAt !== null) {
			hint.textContent = `묶었다! ${formatBalloon(balloonScore(state))}`;
		} else if (state.pumps >= BALLOON.fullPumps) {
			hint.textContent = "지금 FINISH!";
		}
	}

	return {
		labels: {
			red: { text: "펌프", enabled: true },
			green: { text: "", enabled: false },
			blue: { text: "펌프", enabled: true },
			finish: { text: "FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = balloonPress(state, button, t);
			if (state === before) return;
			if (state.burst && !before.burst) {
				sfx.bad();
				buzz(200);
			} else if (state.finishedAt !== null && before.finishedAt === null) {
				sfx.good();
			} else {
				sfx.press();
				body.classList.remove("is-puff");
				void body.offsetWidth;
				body.classList.add("is-puff");
			}
			draw();
		},
		frame() {},
		score: () => balloonScore(state),
	};
};
