/** 10초 맞추기. 돌아가는 초시계를 10.00초에 맞춰 멈춘다. */

export const STOPWATCH = {
	/** 맞춰야 하는 시간 */
	targetMs: 10_000,
	/** 화면에 적는 소수 자리. 이만큼 보여 주므로 기준도 이 눈금으로 생각한다. */
	digits: 2,
	/** 누르지 않아도 이만큼 지나면 저절로 멈춘다(그만큼 늦었으니 실패) */
	limitMs: 20_000,
} as const;

/** allowedMs 는 진행자가 정한 성공 기준(SoloRules.stopwatchAllowedMs) */
export function stopwatchPasses(elapsedMs: number, allowedMs: number): boolean {
	return Math.abs(elapsedMs - STOPWATCH.targetMs) <= allowedMs;
}

/** 멈춘 시간. "10.23초" */
export function formatSeconds(ms: number): string {
	return `${(ms / 1000).toFixed(STOPWATCH.digits)}초`;
}

/** 목표와의 차이. "+0.23초" · "-0.45초" */
export function formatGap(elapsedMs: number): string {
	const gap = (elapsedMs - STOPWATCH.targetMs) / 1000;
	return `${gap < 0 ? "-" : "+"}${Math.abs(gap).toFixed(2)}초`;
}
