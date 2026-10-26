import { createRng, randomInt } from "../random";
import { BUTTONS, type Button, isWithin } from "./button";

export const MEMORY = {
	durationMs: 20_000,
	/** 처음 보여주는 순서 길이. 다 맞힐 때마다 하나씩 늘어난다 */
	startLength: 3,
	/** 준비해 두는 순서 길이(20초 안에 여기까지 갈 수는 없다) */
	maxLength: 20,
	/** 첫 순서를 보여주기 시작하는 시각 */
	firstShowAt: 600,
	/** 한 칸을 보여주는 간격. 이 중 litMs 동안 켜져 있다 */
	stepMs: 450,
	litMs: 320,
	/** 다 맞히거나 틀린 뒤 다음 순서를 보여주기까지 */
	pauseMs: 600,
} as const;

export type MemoryEvent = { readonly kind: "press" | "clear" | "miss"; readonly button: Button; readonly at: number };

export type MemoryState = {
	/** 지금 기억해야 하는 순서 길이 */
	readonly length: number;
	/** 지금 순서에서 맞게 누른 수 */
	readonly entered: number;
	/** 지금 순서를 보여주기 시작하는 시각 */
	readonly showAt: number;
	/** 다 맞힌 가장 긴 순서 길이 */
	readonly best: number;
	readonly bestAt: number | null;
	readonly event: MemoryEvent | null;
};

export const MEMORY_START: MemoryState = {
	length: MEMORY.startLength,
	entered: 0,
	showAt: MEMORY.firstShowAt,
	best: 0,
	bestAt: null,
	event: null,
};

const BEST_WEIGHT = 100_000;

/** 모든 폰이 같은 순서를 본다. 같은 칸이 연달아 켜지지 않게 뽑는다(두 번 켜진 걸 알아보기 어렵다) */
export function memorySequence(seed: number): readonly Button[] {
	const rng = createRng(seed);
	return Array.from({ length: MEMORY.maxLength }).reduce<readonly Button[]>((picked) => {
		const previous = picked[picked.length - 1];
		const choices = BUTTONS.filter((button) => button !== previous);
		return [...picked, choices[randomInt(rng, 0, choices.length - 1)] ?? "red"];
	}, []);
}

/** 지금 순서를 다 보여주는 시각. 이때부터 누를 수 있다 */
export function inputFrom(state: MemoryState): number {
	return state.showAt + state.length * MEMORY.stepMs;
}

/** 시각 t에 켜져 있는 칸이 순서의 몇 번째인지. 보여주는 중이 아니거나 칸 사이에 꺼진 때면 null */
export function shownAt(state: MemoryState, t: number): number | null {
	if (t < state.showAt || t >= inputFrom(state)) return null;
	const offset = t - state.showAt;
	const index = Math.floor(offset / MEMORY.stepMs);
	return offset - index * MEMORY.stepMs < MEMORY.litMs ? index : null;
}

/** 보여준 순서대로 누른다. 틀리면 처음부터 다시 누르고, 같은 순서를 다시 보여준다 */
export function memoryPress(state: MemoryState, sequence: readonly Button[], button: Button, t: number): MemoryState {
	if (!isWithin(t, MEMORY.durationMs) || t < inputFrom(state)) return state;
	if (sequence[state.entered] !== button) {
		return { ...state, entered: 0, showAt: t + MEMORY.pauseMs, event: { kind: "miss", button, at: t } };
	}
	const entered = state.entered + 1;
	if (entered < state.length) return { ...state, entered, event: { kind: "press", button, at: t } };
	return {
		length: Math.min(state.length + 1, MEMORY.maxLength),
		entered: 0,
		showAt: t + MEMORY.pauseMs,
		best: state.length,
		bestAt: t,
		event: { kind: "clear", button, at: t },
	};
}

/** 기억한 길이가 먼저, 같으면 먼저 기억한 쪽이 높다 */
export function memoryScore(state: MemoryState): number {
	if (state.best === 0 || state.bestAt === null) return 0;
	return state.best * BEST_WEIGHT + (MEMORY.durationMs - state.bestAt);
}

export function formatMemory(score: number): string {
	return `${Math.floor(score / BEST_WEIGHT)}개`;
}

export const MEMORY_MAX_SCORE = MEMORY.maxLength * BEST_WEIGHT + MEMORY.durationMs;
