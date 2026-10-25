import {
	REACTION,
	reactionPress,
	reactionScore,
	reactionSignals,
	reactionStart,
	trialAt,
} from "../../domain/games/reaction";
import { pick } from "../dom";
import { buzz, sfx } from "../sound";
import type { MountGame } from "./types";

type Look = { readonly mode: "wait" | "fire" | "result" | "over"; readonly text: string };

export const mountReaction: MountGame = (stage, seed) => {
	const signals = reactionSignals(seed);
	stage.innerHTML = `
		<div class="duel" data-mode="wait">
			<p class="duel__sign" role="status">기다려…</p>
			<ol class="duel__trials">${signals.map((_, i) => `<li>${i + 1}</li>`).join("")}</ol>
		</div>`;
	const root = pick(stage, ".duel");
	const sign = pick(stage, ".duel__sign");
	const trials = [...stage.querySelectorAll<HTMLElement>(".duel__trials li")];
	let state = reactionStart(signals.length);
	let firedFor = -1;

	function resultText(record: number): string {
		return record >= REACTION.penaltyMs ? "실격!" : `${(record / 1000).toFixed(3)}초`;
	}

	function lookAt(t: number): Look {
		const trial = trialAt(signals, t);
		if (trial === null) return { mode: "over", text: "끝!" };
		const record = state.results[trial] ?? null;
		if (record !== null) return { mode: "result", text: resultText(record) };
		return t < (signals[trial] ?? 0) ? { mode: "wait", text: "기다려…" } : { mode: "fire", text: "쏴!" };
	}

	return {
		labels: {
			red: { text: "쏴!", enabled: true },
			green: { text: "쏴!", enabled: true },
			blue: { text: "쏴!", enabled: true },
			finish: { text: "쏴!", enabled: true },
		},
		press(_button, t) {
			const before = state;
			state = reactionPress(state, signals, t);
			if (state === before) return;
			const trial = state.results.findIndex((record, i) => record !== before.results[i]);
			const record = state.results[trial] ?? REACTION.penaltyMs;
			if (record >= REACTION.penaltyMs) {
				sfx.bad();
				buzz(150);
			} else {
				sfx.good();
			}
			const item = trials[trial];
			if (item !== undefined) {
				item.textContent = record >= REACTION.penaltyMs ? "✕" : (record / 1000).toFixed(2);
				item.dataset.result = record >= REACTION.penaltyMs ? "foul" : "hit";
			}
		},
		frame(t) {
			const look = lookAt(t);
			const trial = trialAt(signals, t);
			// 신호를 놓치고 지나간 회차도 바로 ✕로 보여준다(점수에서는 1초로 계산된다)
			signals.forEach((signal, i) => {
				const item = trials[i];
				if (item === undefined || item.dataset.result !== undefined || state.results[i] !== null) return;
				if (t <= signal + REACTION.windowMs) return;
				item.textContent = "✕";
				item.dataset.result = "foul";
			});
			if (look.mode === "fire" && trial !== null && firedFor !== trial) {
				firedFor = trial;
				sfx.go();
				buzz(40);
			}
			if (root.dataset.mode !== look.mode) root.dataset.mode = look.mode;
			if (sign.textContent !== look.text) sign.textContent = look.text;
		},
		score: () => reactionScore(state),
	};
};
