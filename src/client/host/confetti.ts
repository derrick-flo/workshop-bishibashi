import { fill } from "../pixel/bitmap";
import { C, CLEAR } from "../pixel/palette";
import { drawParticles, type Particle, stepParticles } from "../pixel/particles";
import { animate, mountScreen } from "../pixel/screen";

const W = 160;
const H = 90;
const COLORS = [C.y, C.r, C.g, C.b, C.c, C.p, C.w, C.l];

/** 픽셀 색종이. parent를 덮는 투명한 화면에 durationMs 동안 뿌린다. */
export function confetti(parent: HTMLElement, durationMs: number): void {
	const screen = mountScreen(parent, W, H, CLEAR);
	screen.canvas.parentElement?.classList.add("ax-confetti");
	const startedAt = performance.now();
	let pieces: readonly Particle[] = [];
	animate(screen, (now, dt) => {
		const spawning = now - startedAt < durationMs;
		if (spawning) {
			const fresh = Array.from({ length: 3 }, (): Particle => ({
				x: Math.random() * W,
				y: -2,
				vx: (Math.random() - 0.5) * 18,
				vy: 18 + Math.random() * 24,
				color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? C.y,
				life: 4000 + Math.random() * 2000,
				gravity: 6,
			}));
			pieces = [...pieces, ...fresh];
		}
		pieces = stepParticles(pieces, dt).filter((p) => p.y < H + 2);
		// 다 떨어졌으면 화면을 떼어 그리기를 멈춘다
		if (!spawning && pieces.length === 0) {
			screen.canvas.parentElement?.remove();
			return;
		}
		fill(screen.fb, CLEAR);
		// 색종이는 흔들리며 떨어진다
		drawParticles(
			screen.fb,
			pieces.map((p) => ({ ...p, x: p.x + Math.sin((now + p.life) / 180) * 1.5 })),
		);
		screen.present();
	});
}
