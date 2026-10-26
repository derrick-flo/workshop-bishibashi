import { type TargetColor, TARGET_BUTTON } from "../../../domain/games/shooting";
import { type Bitmap, blitAs, outline, paint } from "../../pixel/bitmap";
import { C, CLEAR } from "../../pixel/palette";
import { insideEllipse } from "../../pixel/shapes";
import { sprite } from "../../pixel/sprite";
import { MARK } from "./common";

const TARGET_D = 21;

const COLORS: Readonly<Record<TargetColor, { readonly base: number; readonly dark: number; readonly mark: number }>> = {
	red: { base: C.r, dark: C.R, mark: C.w },
	green: { base: C.g, dark: C.G, mark: C.w },
	blue: { base: C.b, dark: C.B, mark: C.w },
	gold: { base: C.y, dark: C.Y, mark: C.k },
};

/** 과녁: 바깥 색 고리 · 흰 고리 · 가운데 색 원에 버튼 모양(▲■●★)을 새긴다 */
function target(color: TargetColor): Bitmap {
	const { base, dark, mark } = COLORS[color];
	const half = TARGET_D / 2;
	const art = paint(TARGET_D, TARGET_D, (x, y) => {
		if (!insideEllipse(x, y, TARGET_D, TARGET_D)) return CLEAR;
		const nx = x + 0.5 - half;
		const ny = y + 0.5 - half;
		const r = Math.hypot(nx, ny);
		if (r > half - 1) return C.k;
		if (r > 7.5) return nx + ny > 4 ? dark : base;
		if (r > 5.5) return C.w;
		return base;
	});
	const shape = MARK[TARGET_BUTTON[color]];
	blitAs(art, shape, Math.floor((TARGET_D - shape.w) / 2), Math.floor((TARGET_D - shape.h) / 2), mark);
	return art;
}

export const TARGETS: Readonly<Record<TargetColor, Bitmap>> = {
	red: target("red"),
	green: target("green"),
	blue: target("blue"),
	gold: target("gold"),
};

/** 뒤에서 본 권총과 손(위를 겨눈다) */
export const GUN = outline(
	sprite([
		"...aa....",
		"...aW....",
		"...aW....",
		"...aW....",
		"...aW....",
		"..aaWa...",
		"..aAAa...",
		"..aAAa...",
		"..ssss...",
		".sssssS..",
		".ssSssS..",
		".sssssS..",
		"..ssss...",
		"..bbbb...",
		"..bbbb...",
	]),
	C.k,
);

/** 총구 불꽃 */
export const FLASH = sprite(["..y..", ".yoy.", "ywwwy", ".yoy.", "..y.."]);

/** 게임 고르기·순서표에 쓰는 아이콘(과녁) */
export const SHOOTING_ICON = sprite([
	"................",
	".....kkkkkk.....",
	"...kkrrrrrrkk...",
	"..krrrrrrrrrrk..",
	"..krrwwwwwwrrk..",
	".krrwwwwwwwwrrk.",
	".krrwwrrrrwwrrk.",
	".krrwwrrkrwwrrk.",
	".krrwwrrrrwwrrk.",
	".krrwwrrrrwwrrk.",
	".krrwwwwwwwwrrk.",
	"..krrwwwwwwrrk..",
	"..krrrrrrrrrrk..",
	"...kkrrrrrrkk...",
	".....kkkkkk.....",
	"................",
]);
