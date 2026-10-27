import { type Bitmap, blit, outline, scale } from "../pixel/bitmap";
import { BIG, text } from "../pixel/font";
import { C } from "../pixel/palette";

const remembered = new Map<string, Bitmap>();
const REMEMBER_LIMIT = 200;

/** 크게 키운 외곽선 글자. 매 프레임 새로 만들지 않도록 한 번 만든 걸 다시 쓴다. */
export function bigLabel(value: string, color: number, factor: number): Bitmap {
	const key = `${value}|${color}|${factor}`;
	const found = remembered.get(key);
	if (found !== undefined) return found;
	if (remembered.size >= REMEMBER_LIMIT) remembered.clear();
	const art = outline(scale(text(BIG, value, color), factor), C.k);
	remembered.set(key, art);
	return art;
}

/** 그림 가운데가 (centerX, centerY)에 오게 찍는다 */
export function blitCentered(dst: Bitmap, art: Bitmap, centerX: number, centerY: number): void {
	blit(dst, art, centerX - art.w / 2, centerY - art.h / 2);
}
