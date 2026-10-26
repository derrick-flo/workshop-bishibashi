import { type Bitmap, blit, fill } from "../pixel/bitmap";
import { drawParticles, type Particle, stepParticles } from "../pixel/particles";
import { animate, mountScreen, type Screen } from "../pixel/screen";

/** 화면 위로 떠올랐다 사라지는 글자·그림. 같은 자리(slot)에는 하나만 뜬다. */
type Popup = {
	readonly art: Bitmap;
	readonly x: number;
	readonly y: number;
	readonly bornAt: number;
	readonly lifeMs: number;
	readonly rise: number;
	readonly slot: string;
};

export type Tone = "good" | "bad" | null;

/**
 * 픽셀 미니게임이 같이 쓰는 도구.
 * 장면은 게임이 매 프레임 fb에 그리고, 파편·떠오르는 글자·흔들림·번쩍임은 여기서 맡는다.
 */
export type Kit = {
	readonly screen: Screen;
	readonly fb: Bitmap;
	/** 게임 시작 뒤 경과 시간(ms). 첫 frame(t) 전(카운트다운)에는 null */
	gameTime(now: number): number | null;
	/** GameView.frame(t)에서 부른다 */
	sync(t: number): void;
	setHint(text: string, tone?: Tone): void;
	emit(particles: readonly Particle[]): void;
	/** (x, y)를 가운데로 그림을 띄운다. 같은 slot에 떠 있던 그림은 지운다(외침이 겹치지 않게). */
	popup(art: Bitmap, x: number, y: number, lifeMs?: number, rise?: number, slot?: string): void;
	/** 가상 픽셀 power만큼 ms 동안 흔든다 */
	shake(power: number, ms: number): void;
	flash(color: number, ms: number): void;
	/** 그리기를 시작한다. draw는 장면만 그리면 된다. */
	run(draw: (now: number, dtMs: number) => void): void;
};

export function mountKit(stage: HTMLElement, w: number, h: number, background: number): Kit {
	stage.classList.add("ax-stage");
	const screen = mountScreen(stage, w, h, background);
	const hint = document.createElement("p");
	hint.className = "ax-hint";
	hint.setAttribute("role", "status");
	stage.append(hint);

	let origin: number | null = null;
	let particles: readonly Particle[] = [];
	let popups: readonly Popup[] = [];
	let shakeUntil = 0;
	let shakePower = 0;
	let flashUntil = 0;
	let flashColor = 0;
	let lastNow = performance.now();

	function drawEffects(now: number, dt: number): void {
		particles = stepParticles(particles, dt);
		drawParticles(screen.fb, particles);
		popups = popups.filter((popup) => now - popup.bornAt < popup.lifeMs);
		for (const popup of popups) {
			const age = now - popup.bornAt;
			const left = popup.lifeMs - age;
			if (left < 200 && Math.floor(left / 50) % 2 === 0) continue;
			const lift = Math.round(Math.min(1, age / 300) * popup.rise);
			blit(screen.fb, popup.art, popup.x - Math.floor(popup.art.w / 2), popup.y - Math.floor(popup.art.h / 2) - lift);
		}
		if (now < flashUntil) fill(screen.fb, flashColor);
	}

	function shakeOffset(now: number): readonly [number, number] {
		if (now >= shakeUntil) return [0, 0];
		const power = Math.max(1, Math.round(shakePower * ((shakeUntil - now) / 300)));
		return [Math.round((Math.random() * 2 - 1) * power), Math.round((Math.random() * 2 - 1) * power)];
	}

	return {
		screen,
		fb: screen.fb,
		gameTime: (now) => (origin === null ? null : now - origin),
		sync(t) {
			// player.ts는 이번 프레임의 시각(RAF 타임스탬프)으로 t를 잰다. 같은 기준으로 맞춰야
			// 권총 속사 표적처럼 정해진 시각에 뜨는 장면이 한 프레임 늦게 뜨지 않는다. document.timeline은 이번 프레임 시각과 같다.
			const frameNow = document.timeline?.currentTime;
			origin = (typeof frameNow === "number" ? frameNow : lastNow) - t;
		},
		setHint(text, tone = null) {
			if (hint.textContent !== text) hint.textContent = text;
			const nextTone = tone ?? "";
			if (hint.dataset.tone !== nextTone) hint.dataset.tone = nextTone;
		},
		emit(list) {
			particles = [...particles, ...list];
		},
		popup(art, x, y, lifeMs = 700, rise = 6, slot = "shout") {
			popups = [...popups.filter((popup) => popup.slot !== slot), { art, x, y, bornAt: lastNow, lifeMs, rise, slot }];
		},
		shake(power, ms) {
			shakePower = Math.max(power, lastNow < shakeUntil ? shakePower : 0);
			shakeUntil = Math.max(shakeUntil, lastNow + ms);
		},
		flash(color, ms) {
			flashColor = color;
			flashUntil = lastNow + ms;
		},
		run(draw) {
			animate(screen, (now, dt) => {
				lastNow = now;
				draw(now, dt);
				drawEffects(now, dt);
				const [sx, sy] = shakeOffset(now);
				screen.present(sx, sy);
			});
		},
	};
}
