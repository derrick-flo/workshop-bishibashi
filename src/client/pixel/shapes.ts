import { type Bitmap, paint } from "./bitmap";
import { CLEAR } from "./palette";

/** w×h 상자에 꽉 차는 타원 안쪽 칸인지(칸 가운데로 판단) */
export function insideEllipse(x: number, y: number, w: number, h: number): boolean {
	const nx = (x + 0.5 - w / 2) / (w / 2);
	const ny = (y + 0.5 - h / 2) / (h / 2);
	return nx * nx + ny * ny <= 1;
}

/** 지름 d 동그라미 */
export function disc(d: number, color: number): Bitmap {
	return paint(d, d, (x, y) => (insideEllipse(x, y, d, d) ? color : CLEAR));
}

/** 지름 d, 두께 thickness 고리 */
export function ring(d: number, thickness: number, color: number): Bitmap {
	const inner = d - thickness * 2;
	return paint(d, d, (x, y) => {
		if (!insideEllipse(x, y, d, d)) return CLEAR;
		const inHole = inner > 0 && insideEllipse(x - thickness, y - thickness, inner, inner);
		return inHole ? CLEAR : color;
	});
}
