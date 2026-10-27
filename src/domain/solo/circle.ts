/**
 * 원 그리기. 가운데 점을 중심으로 한 바퀴 돌린 자취가 얼마나 고른 원인지 재서 퍼센트로 준다.
 * 점은 중심을 (0, 0)으로 두고 화면에 들어가는 가장 큰 반지름을 1로 맞춘 값이라 화면 크기와 상관없다.
 */

export type CirclePoint = { readonly x: number; readonly y: number };

export const CIRCLE = {
	/** 평균 반지름이 이보다 작으면 무효(작게 그려 쉽게 넘기는 걸 막는다) */
	minRadius: 0.35,
	/** 가장 많이 돈 데서 이 각(라디안)보다 되돌아가면 무효 */
	backtrackLimit: 0.35,
	/** 각을 이만큼 나눠 칸마다 반지름 하나로 본다(빨리 지난 쪽과 천천히 지난 쪽을 똑같이 보려고) */
	buckets: 180,
} as const;

export type CircleResult =
	| { readonly kind: "scored"; readonly percent: number }
	/** 한 바퀴를 못 돌았다. turned 는 돈 각(라디안) */
	| { readonly kind: "short"; readonly turned: number }
	/** 너무 작게 그렸다 */
	| { readonly kind: "small" }
	/** 가던 방향을 되돌렸다 */
	| { readonly kind: "backtracked" };

const TURN = Math.PI * 2;
/** 중심에 이보다 가까운 점은 각을 가늠할 수 없어 버린다 */
const DEAD_ZONE = 0.02;

/** -π 보다 크고 π 이하가 되게 맞춘 두 각의 차 */
function angleStep(from: number, to: number): number {
	const raw = (to - from) % TURN;
	if (raw > Math.PI) return raw - TURN;
	if (raw <= -Math.PI) return raw + TURN;
	return raw;
}

function average(values: readonly number[]): number {
	return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 각 칸마다 반지름 하나(그 칸을 지난 점들의 평균)만 남긴다. 빈 칸은 뺀다. */
function radiusPerBucket(angles: readonly number[], radii: readonly number[]): readonly number[] {
	const sums = new Float64Array(CIRCLE.buckets);
	const counts = new Int32Array(CIRCLE.buckets);
	angles.forEach((angle, i) => {
		const turnPart = (((angle % TURN) + TURN) % TURN) / TURN;
		const slot = Math.min(CIRCLE.buckets - 1, Math.floor(turnPart * CIRCLE.buckets));
		sums[slot] = (sums[slot] ?? 0) + (radii[i] ?? 0);
		counts[slot] = (counts[slot] ?? 0) + 1;
	});
	const result: number[] = [];
	for (let slot = 0; slot < CIRCLE.buckets; slot++) {
		const count = counts[slot] ?? 0;
		if (count > 0) result.push((sums[slot] ?? 0) / count);
	}
	return result;
}

/** 반지름이 평균에서 벗어난 정도로 정확도를 낸다. 소수 한 자리까지(보이는 숫자로 판정하려고) */
function accuracyPercent(angles: readonly number[], radii: readonly number[]): number {
	const perBucket = radiusPerBucket(angles, radii);
	const mean = average(perBucket);
	if (mean <= 0) return 0;
	const spread = average(perBucket.map((radius) => Math.abs(radius - mean)));
	const raw = Math.max(0, Math.min(100, (1 - spread / mean) * 100));
	return Math.round(raw * 10) / 10;
}

/** 그린 자취를 보고 결과를 낸다. 한 바퀴를 넘겨 그린 뒤는 보지 않는다. */
export function judgeCircle(points: readonly CirclePoint[]): CircleResult {
	const path = points.filter((point) => Math.hypot(point.x, point.y) > DEAD_ZONE);
	const first = path[0];
	if (first === undefined || path.length < 2) return { kind: "short", turned: 0 };

	const angles = [Math.atan2(first.y, first.x)];
	const radii = [Math.hypot(first.x, first.y)];
	let previous = angles[0] ?? 0;
	let turned = 0;
	let peak = 0;
	for (const point of path.slice(1)) {
		const angle = Math.atan2(point.y, point.x);
		turned += angleStep(previous, angle);
		previous = angle;
		if (Math.abs(turned) + CIRCLE.backtrackLimit < peak) return { kind: "backtracked" };
		peak = Math.max(peak, Math.abs(turned));
		angles.push(angle);
		radii.push(Math.hypot(point.x, point.y));
		if (peak >= TURN) break;
	}

	if (average(radii) < CIRCLE.minRadius) return { kind: "small" };
	if (peak < TURN) return { kind: "short", turned: peak };
	return { kind: "scored", percent: accuracyPercent(angles, radii) };
}

/** passPercent 는 진행자가 정한 성공 기준(SoloRules.circlePassPercent) */
export function circlePasses(result: CircleResult, passPercent: number): boolean {
	return result.kind === "scored" && result.percent >= passPercent;
}

/** 기록판에 적는 글자 */
export function formatCircle(result: CircleResult): string {
	switch (result.kind) {
		case "scored":
			return `${result.percent.toFixed(1)}%`;
		case "short":
			return "덜 돎";
		case "small":
			return "작음";
		case "backtracked":
			return "되돌림";
	}
}
