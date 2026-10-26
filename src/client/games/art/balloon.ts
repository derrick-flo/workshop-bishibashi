import { type Bitmap, paint } from "../../pixel/bitmap";
import { C, CLEAR } from "../../pixel/palette";
import { sprite } from "../../pixel/sprite";

export type BalloonTone = "normal" | "bright" | "hot";

const bodies = new Map<string, Bitmap>();

/**
 * 풍선 몸통. 아래로 갈수록 좁아지는 물방울 모양이고, 빛은 왼쪽 위에서 온다.
 * 크기마다 새로 그려야 칸 크기가 그대로라서(키우면 칸이 뭉개진다) 크기별로 만들어 둔다.
 */
export function balloonBody(w: number, h: number, tone: BalloonTone): Bitmap {
	const key = `${w}x${h}:${tone}`;
	const cached = bodies.get(key);
	if (cached !== undefined) return cached;
	const base = tone === "bright" ? C.p : tone === "hot" ? C.o : C.r;
	const shade = tone === "hot" ? C.r : C.R;
	const light = tone === "normal" ? C.p : C.w;
	const rx = w / 2;
	const ry = h / 2;
	const inside = (x: number, y: number) => {
		const nx = (x + 0.5 - rx) / rx;
		const ny = (y + 0.5 - ry) / ry;
		const taper = ny > 0 ? 1 + ny * 0.55 : 1;
		return (nx * taper) ** 2 + ny ** 2 <= 1;
	};
	const body = paint(w, h, (x, y) => {
		if (!inside(x, y)) return CLEAR;
		if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) return C.k;
		const nx = (x + 0.5 - rx) / rx;
		const ny = (y + 0.5 - ry) / ry;
		if (((nx + 0.4) / 0.13) ** 2 + ((ny + 0.52) / 0.2) ** 2 <= 1) return C.w;
		if (nx * 0.55 + ny * 0.8 > 0.5) return shade;
		if (-nx * 0.7 - ny * 0.7 > 0.45) return light;
		return base;
	});
	bodies.set(key, body);
	return body;
}

/** 바람이 들어간 횟수 → 풍선 크기. 다 차면(50) 높이 42칸, 터지기 직전(57) 46칸 */
export function balloonSize(pumps: number, fullPumps: number, burstPumps: number): { readonly w: number; readonly h: number } {
	const filled = Math.min(pumps, fullPumps) / fullPumps;
	const over = Math.max(0, pumps - fullPumps) / Math.max(1, burstPumps - 1 - fullPumps);
	const h = Math.round(8 + 34 * filled + 4 * over);
	return { w: Math.round(h * 0.84), h };
}

/** 풍선 주둥이 매듭 */
export const KNOT = sprite(["krk", ".k."]);

/** 묶은 매듭(리본) */
export const TIED = sprite(["k.k.k", "kykyk", ".kyk.", "..k.."]);

/** 터지고 남은 고무 조각 */
export const SCRAP = sprite(["..kk.", ".krRk", "krRk.", ".kk.."]);

/** 펑! 할 때 가운데 터지는 모양 */
export const BURST = sprite([
	"....y....",
	".y..y..y.",
	"..y.w.y..",
	"...www...",
	"yywwwwwyy",
	"...www...",
	"..y.w.y..",
	".y..y..y.",
	"....y....",
]);

/** 반짝이는 별 두 단계 */
export const STAR = [sprite([".", "W", "."]), sprite([".w.", "wWw", ".w."])] as const;

/** 풀잎 */
export const TUFT = sprite(["l.l", "lgl"]);

/** 게임 고르기·순서표에 쓰는 아이콘 */
export const BALLOON_ICON = sprite([
	"................",
	".....kkkkk......",
	"....krrrrrk.....",
	"...krpwrrrrk....",
	"...krwprrrRk....",
	"...krrrrrrRk....",
	"...krrrrrRRk....",
	"....krrrRRk.....",
	".....krRRk......",
	"......kRk.......",
	".......k........",
	"........W.......",
	".......W........",
	"........W.......",
	".......W........",
	"................",
]);
