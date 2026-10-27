/**
 * 혼자 하는 도전 세 종목의 성공 기준. 진행자 화면에서 바꾸면 서버가 열려 있는 폰 모두에 뿌린다.
 * 게임의 생김새(10초라는 목표, 신호등이 기다리는 시간, 원의 최소 크기)는 기준이 아니라서 여기 두지 않는다.
 */
export type SoloRules = {
	/** 반응속도: 이 시간 안에 누르면 성공 */
	readonly reactionPassMs: number;
	/** 10초 맞추기: 10.00초와의 차이가 이 안이면 성공 */
	readonly stopwatchAllowedMs: number;
	/** 원 그리기: 이 퍼센트 이상이면 성공 */
	readonly circlePassPercent: number;
};

export const DEFAULT_SOLO_RULES: SoloRules = {
	reactionPassMs: 230,
	stopwatchAllowedMs: 100,
	circlePassPercent: 95,
};

/** 진행자가 고를 수 있는 범위. step 은 입력 칸이 한 번에 움직이는 단위 */
export const SOLO_RULE_LIMITS = {
	reactionPassMs: { min: 150, max: 1000, step: 10 },
	stopwatchAllowedMs: { min: 10, max: 5000, step: 10 },
	circlePassPercent: { min: 50, max: 100, step: 1 },
} as const;

type Limits = { readonly min: number; readonly max: number };

function inRange(value: unknown, limits: Limits): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= limits.min && value <= limits.max;
}

/** 받은 값이 세 기준을 모두 범위 안에 담고 있을 때만 기준으로 본다. 하나라도 틀리면 null. */
export function parseSoloRules(value: unknown): SoloRules | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const { reactionPassMs, stopwatchAllowedMs, circlePassPercent } = value as Readonly<Record<string, unknown>>;
	if (!inRange(reactionPassMs, SOLO_RULE_LIMITS.reactionPassMs)) return null;
	if (!inRange(stopwatchAllowedMs, SOLO_RULE_LIMITS.stopwatchAllowedMs)) return null;
	if (!inRange(circlePassPercent, SOLO_RULE_LIMITS.circlePassPercent)) return null;
	return { reactionPassMs, stopwatchAllowedMs, circlePassPercent };
}

/** 저장해 둔 값을 불러온다. 알아볼 수 없으면 기본 기준. */
export function readSoloRules(value: unknown): SoloRules {
	return parseSoloRules(value) ?? DEFAULT_SOLO_RULES;
}

/** 진행자가 입력 칸에 넣은 값을 범위 안으로 당긴다. 숫자가 아니면 기본 기준. */
export function clampSoloRule(key: keyof SoloRules, value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_SOLO_RULES[key];
	const limits = SOLO_RULE_LIMITS[key];
	return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}
