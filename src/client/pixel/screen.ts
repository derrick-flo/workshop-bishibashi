import { type Bitmap, blank } from "./bitmap";
import { CLEAR, HEX } from "./palette";

/** 팔레트 번호 → ImageData에 바로 쓰는 32비트 색(투명은 0) */
const PACKED = (() => {
	const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
	return Uint32Array.from(HEX, (hex, i) => {
		if (i === 0) return 0;
		const n = Number.parseInt(hex.slice(1), 16);
		const r = (n >> 16) & 255;
		const g = (n >> 8) & 255;
		const b = n & 255;
		return littleEndian ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
	});
})();

export type Screen = {
	/** 매 프레임 그리는 버퍼(가상 해상도). 그린 뒤 present로 화면에 옮긴다. */
	readonly fb: Bitmap;
	readonly canvas: HTMLCanvasElement;
	/** 버퍼를 화면에 옮긴다. shakeX·shakeY는 가상 픽셀 단위 흔들림 */
	present(shakeX?: number, shakeY?: number): void;
};

type Fit = { readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly dpr: number; readonly scale: number };

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const ctx = canvas.getContext("2d");
	if (ctx === null) throw new Error("이 브라우저는 캔버스를 그릴 수 없어요");
	return ctx;
}

/**
 * parent를 꽉 채우는 픽셀 화면을 붙인다.
 * 가상 해상도 w×h를 기기 픽셀 기준 정수 배로만 키우고 기기 픽셀 경계에 맞춰 놓아서 칸이 흐려지지 않는다.
 * 남는 자리는 background 색으로 칠한다(장면 배경과 같은 색이면 이음새가 안 보인다).
 */
export function mountScreen(parent: HTMLElement, w: number, h: number, background: number): Screen {
	// 크기와 배치는 arcade.css 의 .px-screen 이 맡는다
	const frame = document.createElement("div");
	frame.className = "px-screen";
	frame.style.background = HEX[background] ?? "#000";
	const canvas = document.createElement("canvas");
	frame.append(canvas);
	parent.append(frame);

	const low = document.createElement("canvas");
	low.width = w;
	low.height = h;
	const lowCtx = context2d(low);
	const image = lowCtx.createImageData(w, h);
	const pixels = new Uint32Array(image.data.buffer);
	const ctx = context2d(canvas);
	const fb = blank(w, h);
	let fit: Fit = { left: Number.NaN, top: Number.NaN, width: 0, height: 0, dpr: 0, scale: 1 };

	function refit(): void {
		const box = frame.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		if (box.left === fit.left && box.top === fit.top && box.width === fit.width && box.height === fit.height && dpr === fit.dpr) return;
		const scale = Math.max(1, Math.floor(Math.min((box.width * dpr) / w, (box.height * dpr) / h)));
		const deviceW = w * scale;
		const deviceH = h * scale;
		// 화면 전체 기준으로 기기 픽셀 경계에 오도록 가운데 둔다
		const absLeft = Math.round(box.left * dpr + (box.width * dpr - deviceW) / 2);
		const absTop = Math.round(box.top * dpr + (box.height * dpr - deviceH) / 2);
		if (canvas.width !== deviceW || canvas.height !== deviceH) {
			canvas.width = deviceW;
			canvas.height = deviceH;
		}
		Object.assign(canvas.style, {
			left: `${absLeft / dpr - box.left}px`,
			top: `${absTop / dpr - box.top}px`,
			width: `${deviceW / dpr}px`,
			height: `${deviceH / dpr}px`,
		});
		fit = { left: box.left, top: box.top, width: box.width, height: box.height, dpr, scale };
	}

	return {
		fb,
		canvas,
		present(shakeX = 0, shakeY = 0) {
			refit();
			for (let i = 0; i < fb.px.length; i++) pixels[i] = PACKED[fb.px[i] ?? 0] ?? 0;
			lowCtx.putImageData(image, 0, 0);
			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			if (background !== CLEAR) {
				ctx.fillStyle = HEX[background] ?? "#000";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}
			ctx.drawImage(low, Math.round(shakeX) * fit.scale, Math.round(shakeY) * fit.scale, w * fit.scale, h * fit.scale);
		},
	};
}

/** 화면이 문서에 붙어 있는 동안 매 프레임 step을 부른다. 화면이 떨어지면(라운드가 끝나 다시 그리면) 저절로 멈춘다. */
export function animate(screen: Screen, step: (now: number, dtMs: number) => void): void {
	let last = performance.now();
	const tick = (now: number) => {
		if (!screen.canvas.isConnected) return;
		const dt = Math.min(100, Math.max(0, now - last));
		last = now;
		step(now, dt);
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}
