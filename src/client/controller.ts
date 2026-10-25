import { BUTTONS, type Button } from "../domain/games/button";
import { esc } from "./dom";

export type ButtonLabel = { readonly text: string; readonly enabled: boolean };
export type ControllerLabels = Readonly<Record<Button, ButtonLabel>>;

export type Controller = {
	readonly element: HTMLElement;
	setLabels(labels: ControllerLabels): void;
	setActive(active: boolean): void;
	destroy(): void;
};

/** 노트북으로 시험할 때 쓰는 키: A·S·D 또는 ←·↑·→, FINISH는 스페이스·엔터·↓ */
const KEYS: Readonly<Record<string, Button>> = {
	a: "red",
	ArrowLeft: "red",
	s: "green",
	ArrowUp: "green",
	d: "blue",
	ArrowRight: "blue",
	" ": "finish",
	Enter: "finish",
	ArrowDown: "finish",
};

const NAMES: Readonly<Record<Button, string>> = { red: "빨강", green: "초록", blue: "파랑", finish: "FINISH" };

/**
 * 폰 아래쪽 4버튼. 눌린 시각은 이벤트의 timeStamp(performance.now 기준)로 넘겨서
 * 화면 그리기가 밀려도 반응속도가 정확하게 잡히게 한다.
 */
export function createController(onPress: (button: Button, at: number) => void): Controller {
	const element = document.createElement("div");
	element.className = "pad";
	element.innerHTML = BUTTONS.map(
		(button) =>
			`<button type="button" class="pad__btn pad__btn--${button}" data-button="${button}" aria-label="${NAMES[button]}"><span></span></button>`,
	).join("");

	let active = false;
	const buttonOf = (target: EventTarget | null) =>
		target instanceof Element ? target.closest<HTMLButtonElement>("[data-button]") : null;

	const down = (event: PointerEvent) => {
		const target = buttonOf(event.target);
		if (target === null) return;
		event.preventDefault();
		if (target.dataset.enabled === "true") target.classList.add("is-down");
		if (active) onPress(target.dataset.button as Button, event.timeStamp);
	};
	const up = (event: PointerEvent) => buttonOf(event.target)?.classList.remove("is-down");
	const key = (event: KeyboardEvent) => {
		const button = KEYS[event.key];
		if (button === undefined || event.repeat) return;
		event.preventDefault();
		const target = element.querySelector<HTMLElement>(`[data-button="${button}"]`);
		target?.classList.add("is-down");
		setTimeout(() => target?.classList.remove("is-down"), 90);
		if (active) onPress(button, event.timeStamp);
	};

	element.addEventListener("pointerdown", down);
	element.addEventListener("pointerup", up);
	element.addEventListener("pointercancel", up);
	element.addEventListener("pointerout", up);
	element.addEventListener("contextmenu", (event) => event.preventDefault());
	window.addEventListener("keydown", key);

	return {
		element,
		setLabels(labels) {
			for (const button of BUTTONS) {
				const target = element.querySelector<HTMLElement>(`[data-button="${button}"]`);
				if (target === null) continue;
				target.dataset.enabled = String(labels[button].enabled);
				target.innerHTML = `<span>${esc(labels[button].text)}</span>`;
			}
		},
		setActive(next) {
			active = next;
			element.classList.toggle("is-active", next);
		},
		destroy() {
			window.removeEventListener("keydown", key);
			element.remove();
		},
	};
}
