import { CANDY_START, candyPress, candyScore, candyTargets, currentTarget } from "../../domain/games/candy";
import { pick } from "../dom";
import { buzz, sfx } from "../sound";
import type { MountGame } from "./types";

const MESSAGES = {
	spill: "넘쳤다! 처음부터",
	wrong: "숫자가 달라요! 처음부터",
	done: "한 병 완성!",
} as const;

export const mountCandy: MountGame = (stage, seed) => {
	const targets = candyTargets(seed);
	stage.innerHTML = `
		<div class="candy">
			<p class="candy__done">완성 <b>0</b>병</p>
			<div class="candy__jar">
				<p class="candy__target"><small>담을 개수</small><b></b></p>
				<p class="candy__count"><b>0</b><small>개</small></p>
			</div>
			<p class="candy__hint" role="status">숫자만큼 담고 FINISH</p>
		</div>`;
	const jar = pick(stage, ".candy__jar");
	const done = pick(stage, ".candy__done b");
	const target = pick(stage, ".candy__target b");
	const count = pick(stage, ".candy__count b");
	const hint = pick(stage, ".candy__hint");
	let state = CANDY_START;

	function draw(): void {
		done.textContent = String(state.completed);
		target.textContent = String(currentTarget(state, targets));
		count.textContent = String(state.count);
	}

	function shake(kind: "spill" | "wrong" | "done"): void {
		hint.textContent = MESSAGES[kind];
		jar.dataset.event = kind;
		jar.classList.remove("is-pop");
		void jar.offsetWidth;
		jar.classList.add("is-pop");
	}

	draw();
	return {
		labels: {
			red: { text: "+1", enabled: true },
			green: { text: "+5", enabled: true },
			blue: { text: "+10", enabled: true },
			finish: { text: "FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = candyPress(state, targets, button, t);
			if (state === before) return;
			const kind = state.event?.kind;
			if (kind === "spill" || kind === "wrong") {
				sfx.bad();
				buzz(120);
				shake(kind);
			} else if (kind === "done") {
				sfx.good();
				shake("done");
			} else {
				sfx.press();
				delete jar.dataset.event;
				hint.textContent = "숫자만큼 담고 FINISH";
			}
			draw();
		},
		frame() {},
		score: () => candyScore(state),
	};
};
