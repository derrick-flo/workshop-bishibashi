import { currentDirection, type Direction, EYE_START, eyeDirections, eyePress, eyeScore } from "../../domain/games/eye";
import { pick } from "../dom";
import { buzz, sfx } from "../sound";
import type { MountGame } from "./types";

/** 오른쪽이 뚫린 고리를 돌려서 쓴다(SVG는 y가 아래로 커져서 90°가 아래) */
const ROTATION: Readonly<Record<Direction, number>> = { right: 0, down: 90, left: 180, up: 270 };

export const mountEye: MountGame = (stage, seed) => {
	const directions = eyeDirections(seed);
	stage.innerHTML = `
		<div class="eye">
			<p class="eye__count">맞힌 개수 <b>0</b></p>
			<div class="eye__chart">
				<svg class="eye__ring" viewBox="-50 -50 100 100" role="img" aria-label="시력검사 고리">
					<path d="M 30.98 8.01 A 32 32 0 1 1 30.98 -8.01" />
				</svg>
				<span class="eye__miss" aria-hidden="true">✕</span>
			</div>
			<p class="eye__hint" role="status">뚫린 쪽을 눌러요</p>
		</div>`;
	const root = pick(stage, ".eye");
	const ring = pick<SVGElement>(stage, ".eye__ring");
	const count = pick(stage, ".eye__count b");
	let state = EYE_START;

	function draw(): void {
		const size = Math.max(0.32, 1 - state.index * 0.04);
		ring.style.transform = `rotate(${ROTATION[currentDirection(state, directions)]}deg) scale(${size})`;
		count.textContent = String(state.correct);
	}

	draw();
	return {
		labels: {
			red: { text: "←", enabled: true },
			green: { text: "↑", enabled: true },
			blue: { text: "→", enabled: true },
			finish: { text: "↓", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = eyePress(state, directions, button, t);
			if (state === before) return;
			if (state.event?.kind === "miss") {
				sfx.bad();
				buzz(120);
			} else {
				sfx.press();
			}
			draw();
		},
		frame(t) {
			root.classList.toggle("is-locked", t < state.lockedUntil);
		},
		score: () => eyeScore(state),
	};
};
