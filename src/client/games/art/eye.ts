import type { Direction } from "../../../domain/games/eye";
import { type Bitmap, paint, rotate90 } from "../../pixel/bitmap";
import { CLEAR } from "../../pixel/palette";
import { ring } from "../../pixel/shapes";
import { sprite } from "../../pixel/sprite";

/** 맞힌 개수 → 고리 지름(짝수). 40칸에서 2칸씩 줄어 10칸까지 */
export function ringDiameter(index: number): number {
	return Math.max(10, 40 - index * 2);
}

const rings = new Map<string, Bitmap>();

/** 오른쪽이 뚫린 란돌트 고리를 방향대로 돌린다. 두께와 틈은 지름의 1/5(짝수로 맞춘다) */
export function landoltRing(diameter: number, direction: Direction, color: number): Bitmap {
	const key = `${diameter}:${direction}:${color}`;
	const cached = rings.get(key);
	if (cached !== undefined) return cached;
	const thickness = Math.max(2, 2 * Math.round(diameter / 10));
	const whole = ring(diameter, thickness, color);
	const opened = paint(diameter, diameter, (x, y) => {
		const inGap = x >= diameter / 2 && Math.abs(y + 0.5 - diameter / 2) < thickness / 2;
		return inGap ? CLEAR : (whole.px[y * diameter + x] ?? CLEAR);
	});
	const turns = { right: 0, down: 1, left: 2, up: 3 }[direction];
	const result = Array.from({ length: turns }).reduce<Bitmap>((b) => rotate90(b), opened);
	rings.set(key, result);
	return result;
}

/** 아래 구석의 눈(가끔 깜빡인다) */
export const EYE_OPEN = sprite([".kkkkkk.", "kwwkkwwk", "kwkbbkwk", "kwwkkwwk", ".kkkkkk."]);
export const EYE_SHUT = sprite(["........", ".kkkkkk.", "kkkkkkkk", ".kkkkkk.", "........"]);

/** 게임 고르기·순서표에 쓰는 아이콘 */
export const EYE_ICON = sprite([
	"................",
	".kkkkkkkkkkkkkk.",
	".kwwwwwwwwwwwwk.",
	".kwwwkkkkkkwwwk.",
	".kwwkkkkkkkkwwk.",
	".kwkkkwwwwkkkwk.",
	".kwkkwwwwwwkkwk.",
	".kwkkwwwwwwwwwk.",
	".kwkkwwwwwwwwwk.",
	".kwkkwwwwwwkkwk.",
	".kwkkkwwwwkkkwk.",
	".kwwkkkkkkkkwwk.",
	".kwwwkkkkkkwwwk.",
	".kwwwwwwwwwwwwk.",
	".kkkkkkkkkkkkkk.",
	"................",
]);

