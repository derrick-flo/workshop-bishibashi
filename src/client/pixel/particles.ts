import { type Bitmap, colorAt, plot } from "./bitmap";
import { CLEAR } from "./palette";

/** 파편·반짝이 한 점. 좌표는 가상 픽셀, 속도는 초당 픽셀. */
export type Particle = {
	readonly x: number;
	readonly y: number;
	readonly vx: number;
	readonly vy: number;
	readonly color: number;
	/** 남은 시간(ms) */
	readonly life: number;
	/** 아래로 끌어당기는 힘(초당 초당 픽셀) */
	readonly gravity: number;
};

/** dtMs만큼 움직이고 수명이 다한 점은 뺀다 */
export function stepParticles(list: readonly Particle[], dtMs: number): readonly Particle[] {
	const dt = dtMs / 1000;
	return list
		.filter((p) => p.life > dtMs)
		.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + p.gravity * dt, life: p.life - dtMs }));
}

/** 수명이 거의 다한 점은 깜빡이며 사라진다 */
export function drawParticles(dst: Bitmap, list: readonly Particle[]): void {
	for (const p of list) {
		if (p.life < 180 && Math.floor(p.life / 45) % 2 === 0) continue;
		plot(dst, p.x, p.y, p.color);
	}
}

/**
 * 그림을 칸 단위로 부숴 가운데에서 바깥으로 튀게 한다. (x, y)는 그림의 왼쪽 위.
 * keep 비율만큼만 남겨 너무 빽빽하지 않게 한다.
 */
export function shatter(src: Bitmap, x: number, y: number, random: () => number, power = 70, life = 900, keep = 0.6): Particle[] {
	const cx = src.w / 2;
	const cy = src.h / 2;
	const result: Particle[] = [];
	for (let py = 0; py < src.h; py++) {
		for (let px = 0; px < src.w; px++) {
			const color = colorAt(src, px, py);
			if (color === CLEAR || random() > keep) continue;
			const angle = Math.atan2(py - cy, px - cx) + (random() - 0.5) * 0.9;
			const speed = power * (0.45 + random());
			result.push({
				x: x + px,
				y: y + py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - power * 0.35,
				color,
				life: life * (0.55 + random() * 0.45),
				gravity: 140,
			});
		}
	}
	return result;
}

/** (x, y)에서 반짝이가 사방으로 퍼진다 */
export function sparkle(x: number, y: number, colors: readonly number[], random: () => number, count = 12, power = 45, life = 520): Particle[] {
	return Array.from({ length: count }, (_, i) => {
		const angle = (i / count) * Math.PI * 2 + random() * 0.5;
		const speed = power * (0.5 + random() * 0.7);
		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			color: colors[i % colors.length] ?? CLEAR,
			life: life * (0.6 + random() * 0.4),
			gravity: 30,
		};
	});
}
