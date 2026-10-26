import type { Bitmap } from "./bitmap";
import { CLEAR, HEX } from "./palette";

/**
 * 비트맵을 칸이 또렷한 SVG로 바꾼다. 아이콘처럼 DOM에 그대로 넣는 그림에 쓴다(크기는 CSS로).
 * 같은 줄에서 같은 색이 이어지면 사각형 하나로 묶고, 색마다 path 하나로 모은다.
 */
export function toSvg(b: Bitmap, className = "px-art"): string {
	const runs = new Map<number, string[]>();
	for (let y = 0; y < b.h; y++) {
		let x = 0;
		while (x < b.w) {
			const color = b.px[y * b.w + x] ?? CLEAR;
			let end = x + 1;
			while (end < b.w && b.px[y * b.w + end] === color) end++;
			if (color !== CLEAR) runs.set(color, [...(runs.get(color) ?? []), `M${x} ${y}h${end - x}v1h-${end - x}z`]);
			x = end;
		}
	}
	const paths = [...runs].map(([color, parts]) => `<path fill="${HEX[color]}" d="${parts.join("")}"/>`).join("");
	return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.w} ${b.h}" width="${b.w}" height="${b.h}" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`;
}
