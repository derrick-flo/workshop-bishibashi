import { createRng, randomInt } from "../random";
import { type Button, isWithin } from "./button";

export type TargetColor = "red" | "green" | "blue" | "gold";

export const SHOOTING = {
	durationMs: 20_000,
	targets: 20,
	firstAt: 1500,
	/** 표적이 떠 있는 시간. 첫 표적 1초에서 마지막 표적 0.65초까지 점점 짧아진다 */
	firstWindowMs: 1000,
	lastWindowMs: 650,
} as const;

/** 금색 표적은 FINISH로 쏜다 */
export const TARGET_BUTTON: Readonly<Record<TargetColor, Button>> = {
	red: "red",
	green: "green",
	blue: "blue",
	gold: "finish",
};

const COLORS: readonly TargetColor[] = ["red", "green", "blue", "gold"];

/** at부터 until 직전까지 떠 있다. 앞 표적이 사라지는 순간 다음 표적이 뜬다. */
export type Target = { readonly color: TargetColor; readonly at: number; readonly until: number };

/** 표적 하나에 한 발만 쏠 수 있다. ms는 표적이 뜬 뒤 쏠 때까지 걸린 시간 */
export type Shot = { readonly target: number; readonly hit: boolean; readonly ms: number };

export type ShootingState = { readonly shots: readonly Shot[] };

export const SHOOTING_START: ShootingState = { shots: [] };

const HIT_WEIGHT = 100_000;

function pickColor(rng: () => number, previous: TargetColor | undefined, allowGold: boolean): TargetColor {
	const choices = COLORS.filter((color) => color !== previous && (allowGold || color !== "gold"));
	return choices[randomInt(rng, 0, choices.length - 1)] ?? "red";
}

/** 같은 색이 연달아 나오지 않게 뽑고(바뀐 걸 알아보도록), 마지막은 금색(FINISH)으로 마무리한다 */
export function shootingTargets(seed: number): readonly Target[] {
	const rng = createRng(seed);
	const last = SHOOTING.targets - 1;
	return Array.from({ length: SHOOTING.targets }).reduce<readonly Target[]>((picked, _, i) => {
		const previous = picked[picked.length - 1];
		const color = i === last ? "gold" : pickColor(rng, previous?.color, i !== last - 1);
		const at = previous?.until ?? SHOOTING.firstAt;
		const windowMs = Math.round(
			SHOOTING.firstWindowMs - ((SHOOTING.firstWindowMs - SHOOTING.lastWindowMs) * i) / last,
		);
		return [...picked, { color, at, until: at + windowMs }];
	}, []);
}

/** 시각 t에 떠 있는 표적 번호. 없으면 null */
export function targetAt(targets: readonly Target[], t: number): number | null {
	const index = targets.findIndex((target) => target.at <= t && t < target.until);
	return index === -1 ? null : index;
}

export function shootingPress(state: ShootingState, targets: readonly Target[], button: Button, t: number): ShootingState {
	if (!isWithin(t, SHOOTING.durationMs)) return state;
	const index = targetAt(targets, t) ?? -1;
	const target = targets[index];
	if (target === undefined || state.shots.some((shot) => shot.target === index)) return state;
	return { shots: [...state.shots, { target: index, hit: TARGET_BUTTON[target.color] === button, ms: t - target.at }] };
}

/**
 * 맞힌 표적 수가 먼저, 같으면 빨리 쏜 쪽이 높다(맞힌 표적마다 1000 - 걸린 ms를 더한다).
 * 누른 시각은 ms 이하 소수라 버린다(서버는 정수만 받는다).
 */
export function shootingScore(state: ShootingState): number {
	return state.shots.reduce(
		(sum, shot) => (shot.hit ? sum + HIT_WEIGHT + Math.floor(SHOOTING.firstWindowMs - shot.ms) : sum),
		0,
	);
}

export function formatShooting(score: number): string {
	return `${Math.floor(score / HIT_WEIGHT)}발`;
}

export const SHOOTING_MAX_SCORE = SHOOTING.targets * (HIT_WEIGHT + SHOOTING.firstWindowMs);
