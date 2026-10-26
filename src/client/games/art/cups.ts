import { outline, paint } from "../../pixel/bitmap";
import { C, CLEAR } from "../../pixel/palette";
import { insideEllipse } from "../../pixel/shapes";
import { sprite } from "../../pixel/sprite";

const CUP_W = 13;
const CUP_H = 13;

/** 엎어 놓은 나무 컵: 위가 좁고 아래(입구)가 넓다. 빛은 왼쪽에서 온다 */
export const CUP = outline(
	paint(CUP_W, CUP_H, (x, y) => {
		const half = 3.5 + y * 0.23;
		const dx = x - (CUP_W - 1) / 2;
		if (Math.abs(dx) > half) return CLEAR;
		if (y === 3 || y === CUP_H - 3) return C.O;
		if (dx < -half + 1.5) return C.o;
		if (dx > half - 2) return C.T;
		return C.t;
	}),
	C.k,
);

/** 하얀 공 */
export const BALL = outline(
	paint(5, 5, (x, y) => {
		if (!insideEllipse(x, y, 5, 5)) return CLEAR;
		return x + y >= 6 ? C.W : C.w;
	}),
	C.k,
);

/** 게임 고르기·순서표에 쓰는 아이콘(가운데 컵을 들어 공을 보여준다) */
export const CUPS_ICON = sprite([
	"................",
	"................",
	"......kkkk......",
	".....kottTk.....",
	".....kottTk.....",
	"....kotttTTk....",
	"....kkkkkkkk....",
	"................",
	"................",
	"..kkk......kkk..",
	".kotTk.ww.kotTk.",
	".kotTk.ww.kotTk.",
	"kottTTk..kottTTk",
	"kkkkkkk..kkkkkkk",
	"................",
	"................",
]);
