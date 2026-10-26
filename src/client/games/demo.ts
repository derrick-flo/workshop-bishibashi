import { BUTTONS, type Button } from "../../domain/games/button";
import { GAMES, type GameId } from "../../domain/games/catalog";
import type { ControllerLabels } from "../controller";
import { pick } from "../dom";
import { muteWhileAttached } from "../sound";
import { svg } from "../ui-art";
import { DEMO_SCRIPTS } from "./demo-scripts";
import { MOUNTS } from "./index";

/** 시연을 시작하기 전 준비 장면을 보여주는 시간 */
const LEAD_MS = 900;
/** 눌린 버튼이 눌린 채로 보이는 시간 */
const PRESS_MS = 110;
/** 손 그림에서 손가락 끝의 가로 위치(비율, 오른손 기준). 끝은 그림 맨 아래. 왼손은 좌우가 뒤집힌다. */
const FINGER_X = 0.58;
/** 사람처럼 양손 엄지로 누른다: 왼쪽 버튼은 왼손, 오른쪽과 FINISH는 오른손 */
const HAND_OF: Readonly<Record<Button, "left" | "right">> = { red: "left", green: "left", blue: "right", finish: "right" };

/**
 * 게임 설명 화면의 시연. 실제 게임 화면을 대본대로 저절로 플레이하고, 아래 패드가 눌리는 모습과 픽셀 손가락을 보여준다.
 * 입력은 받지 않고, 시연이 붙어 있는 동안은 소리·진동을 끈다. container가 화면에서 떨어지면 저절로 멈춘다.
 * 대본이 없는 게임은 손 없이 첫 장면만 흘려보낸다.
 */
export function mountDemo(container: HTMLElement, gameId: GameId): void {
	container.innerHTML = `<div class="play ax-play ax-demo" data-game="${gameId}">
		<span class="ax-demo__badge">DEMO</span>
		<div class="play__stage"></div>
		<div class="pad is-active ax-demo__pad" aria-hidden="true">${BUTTONS.map(
			(button) => `<div class="pad__btn pad__btn--${button}" data-button="${button}"><span></span></div>`,
		).join("")}</div>
		<div class="ax-demo__hand" data-hand="left" hidden>${svg.leftHand}</div>
		<div class="ax-demo__hand" data-hand="right" hidden>${svg.hand}</div>
	</div>`;
	const root = pick(container, ".ax-demo");
	const stage = pick(root, ".play__stage");
	const script = DEMO_SCRIPTS[gameId];
	muteWhileAttached(root);

	function setLabels(labels: ControllerLabels): void {
		for (const button of BUTTONS) {
			const target = pick(root, `[data-button="${button}"]`);
			target.dataset.enabled = String(labels[button].enabled);
			pick(target, "span").textContent = labels[button].text;
		}
	}

	/** 버튼을 눌린 모양으로 바꾸고, 맡은 손의 손가락 끝을 그 버튼 가운데로 옮겨 톡 누른다 */
	function showPress(button: Button): void {
		const target = pick(root, `[data-button="${button}"]`);
		target.classList.add("is-down");
		setTimeout(() => target.classList.remove("is-down"), PRESS_MS);
		const side = HAND_OF[button];
		const hand = pick(root, `.ax-demo__hand[data-hand="${side}"]`);
		const box = root.getBoundingClientRect();
		const rect = target.getBoundingClientRect();
		// 처음 나타날 때는 구석에서 미끄러져 오지 않고 그 자리에 바로 놓는다
		const firstShow = hand.hidden;
		hand.hidden = false;
		if (firstShow) hand.style.transition = "none";
		const finger = side === "right" ? FINGER_X : 1 - FINGER_X;
		const x = rect.left - box.left + rect.width / 2 - hand.offsetWidth * finger;
		// 손가락 끝이 버튼 위쪽에 닿게 해서 버튼 글자는 가리지 않는다
		const y = rect.top - box.top + rect.height * 0.35 - hand.offsetHeight;
		hand.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
		if (firstShow) {
			void hand.offsetWidth;
			hand.style.transition = "";
		}
		hand.classList.remove("is-tap");
		void hand.offsetWidth;
		hand.classList.add("is-tap");
	}

	function cycle(): void {
		stage.replaceChildren();
		const view = MOUNTS[gameId](stage, script?.seed ?? 1);
		setLabels(view.labels);
		const steps = script?.steps ?? [];
		const lengthMs = script?.lengthMs ?? GAMES[gameId].durationMs;
		const begin = performance.now() + LEAD_MS;
		let next = 0;
		const tick = (now: number) => {
			if (!root.isConnected) return;
			const t = now - begin;
			for (let step = steps[next]; step !== undefined && step[0] <= t; step = steps[next]) {
				view.press(step[1], step[0]);
				showPress(step[1]);
				next++;
			}
			if (t >= 0 && t <= GAMES[gameId].durationMs) view.frame(t);
			if (t > lengthMs) return cycle();
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}

	cycle();
}
