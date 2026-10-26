import { CLEAR } from "./palette";

/**
 * 팔레트 번호로 된 그림 한 장. 0은 투명.
 * 스프라이트는 한 번 만들면 고치지 않고, 화면 버퍼만 매 프레임 직접 고친다(매번 새로 만들면 느리다).
 */
export type Bitmap = { readonly w: number; readonly h: number; readonly px: Uint8Array };

export function blank(w: number, h: number): Bitmap {
	return { w, h, px: new Uint8Array(w * h) };
}

/** 칸마다 paint가 돌려준 색으로 그림을 만든다(0은 투명) */
export function paint(w: number, h: number, colorAt: (x: number, y: number) => number): Bitmap {
	const result = blank(w, h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) result.px[y * w + x] = colorAt(x, y);
	return result;
}

/** 그림 밖이면 투명 */
export function colorAt(b: Bitmap, x: number, y: number): number {
	return x < 0 || y < 0 || x >= b.w || y >= b.h ? CLEAR : (b.px[y * b.w + x] ?? CLEAR);
}

export function flipX(b: Bitmap): Bitmap {
	return paint(b.w, b.h, (x, y) => colorAt(b, b.w - 1 - x, y));
}

/** 시계 방향으로 90° 돌린다 */
export function rotate90(b: Bitmap): Bitmap {
	return paint(b.h, b.w, (x, y) => colorAt(b, y, b.h - 1 - x));
}

/** 색을 바꾼다. map에 없는 색은 그대로 */
export function recolor(b: Bitmap, map: Readonly<Record<number, number>>): Bitmap {
	return paint(b.w, b.h, (x, y) => {
		const color = colorAt(b, x, y);
		return map[color] ?? color;
	});
}

/** 모든 칸을 한 색으로(번쩍임·그림자용) */
export function silhouette(b: Bitmap, color: number): Bitmap {
	return paint(b.w, b.h, (x, y) => (colorAt(b, x, y) === CLEAR ? CLEAR : color));
}

/** 둘레에 1칸 외곽선을 두른다. 그림이 사방으로 1칸씩 커진다. */
export function outline(b: Bitmap, color: number): Bitmap {
	return paint(b.w + 2, b.h + 2, (x, y) => {
		const inner = colorAt(b, x - 1, y - 1);
		if (inner !== CLEAR) return inner;
		const touches = [
			[0, -1],
			[0, 1],
			[-1, 0],
			[1, 0],
		].some(([dx = 0, dy = 0]) => colorAt(b, x - 1 + dx, y - 1 + dy) !== CLEAR);
		return touches ? color : CLEAR;
	});
}

/** 정수 배로 키운다 */
export function scale(b: Bitmap, factor: number): Bitmap {
	return paint(b.w * factor, b.h * factor, (x, y) => colorAt(b, Math.floor(x / factor), Math.floor(y / factor)));
}

// ---------- 화면 버퍼에 그리기 (dst를 직접 고친다) ----------

export function plot(dst: Bitmap, x: number, y: number, color: number): void {
	const px = Math.round(x);
	const py = Math.round(y);
	if (color === CLEAR || px < 0 || py < 0 || px >= dst.w || py >= dst.h) return;
	dst.px[py * dst.w + px] = color;
}

/** src를 (x, y)에 찍는다. 투명한 칸은 건너뛰고 화면 밖은 잘라낸다. */
export function blit(dst: Bitmap, src: Bitmap, x: number, y: number): void {
	const ox = Math.round(x);
	const oy = Math.round(y);
	const x0 = Math.max(0, -ox);
	const y0 = Math.max(0, -oy);
	const x1 = Math.min(src.w, dst.w - ox);
	const y1 = Math.min(src.h, dst.h - oy);
	for (let sy = y0; sy < y1; sy++) {
		for (let sx = x0; sx < x1; sx++) {
			const color = src.px[sy * src.w + sx] ?? CLEAR;
			if (color !== CLEAR) dst.px[(oy + sy) * dst.w + ox + sx] = color;
		}
	}
}

/** src 모양대로 한 색을 찍는다(번쩍임·그림자) */
export function blitAs(dst: Bitmap, src: Bitmap, x: number, y: number, color: number): void {
	const ox = Math.round(x);
	const oy = Math.round(y);
	for (let sy = 0; sy < src.h; sy++) {
		for (let sx = 0; sx < src.w; sx++) {
			if ((src.px[sy * src.w + sx] ?? CLEAR) !== CLEAR) plot(dst, ox + sx, oy + sy, color);
		}
	}
}

export function fill(dst: Bitmap, color: number): void {
	dst.px.fill(color);
}

export function rect(dst: Bitmap, x: number, y: number, w: number, h: number, color: number): void {
	const x0 = Math.max(0, Math.round(x));
	const y0 = Math.max(0, Math.round(y));
	const x1 = Math.min(dst.w, Math.round(x) + w);
	const y1 = Math.min(dst.h, Math.round(y) + h);
	for (let py = y0; py < y1; py++) dst.px.fill(color, py * dst.w + x0, py * dst.w + Math.max(x0, x1));
}

/** 2×2 바이엘 무늬로 두 색을 섞는다. level 0이면 a만, 4면 b만. 하늘 그러데이션 등에 쓴다. */
export function dither(dst: Bitmap, x: number, y: number, w: number, h: number, a: number, b: number, level: 0 | 1 | 2 | 3 | 4): void {
	const order = [0, 2, 3, 1];
	for (let py = Math.round(y); py < Math.round(y) + h; py++) {
		for (let px = Math.round(x); px < Math.round(x) + w; px++) {
			const cell = order[(py & 1) * 2 + (px & 1)] ?? 0;
			plot(dst, px, py, cell < level ? b : a);
		}
	}
}

/** 브레젠험 직선 */
export function line(dst: Bitmap, x0: number, y0: number, x1: number, y1: number, color: number): void {
	let x = Math.round(x0);
	let y = Math.round(y0);
	const tx = Math.round(x1);
	const ty = Math.round(y1);
	const dx = Math.abs(tx - x);
	const dy = -Math.abs(ty - y);
	const sx = x < tx ? 1 : -1;
	const sy = y < ty ? 1 : -1;
	let err = dx + dy;
	for (;;) {
		plot(dst, x, y, color);
		if (x === tx && y === ty) return;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
}
