import { outline } from "./pixel/bitmap";
import { C } from "./pixel/palette";
import { sprite } from "./pixel/sprite";
import { toSvg } from "./pixel/svg";

/** 화면(DOM)에 넣는 작은 픽셀 그림. 외곽선 없이 그리고 outline으로 두른다. */

export const CROWN = outline(
	sprite(["y....y....y", "yy..yyy..yy", "yyyyyyyyyyy", "yYyyyryyyYy", "yyyyyyyyyyy", "YYYYYYYYYYY"]),
	C.k,
);

export const SPEAKER = outline(
	sprite(["...w.....", "..ww..w..", "wwww...w.", "wwww.w.w.", "wwww...w.", "..ww..w..", "...w....."]),
	C.k,
);

export const TROPHY = outline(
	sprite([
		"..yyyyyyyy..",
		"yyywyyyyyyyy",
		"y.ywyyyyyy.y",
		"y.ywyyyyyy.y",
		".yywyyyyyyy.",
		"...yyyyyY...",
		"....yyyY....",
		".....yY.....",
		".....yY.....",
		"....YYYY....",
		"...tttttt...",
		"...TTTTTT...",
	]),
	C.k,
);

export const STAR = outline(sprite(["..y..", ".yyy.", "yyyyy", ".yyy.", ".y.y."]), C.k);

export const svg = {
	crown: toSvg(CROWN, "px-art ax-icon-crown"),
	speaker: toSvg(SPEAKER, "px-art ax-icon-inline"),
	trophy: toSvg(TROPHY, "px-art ax-icon-trophy"),
	star: toSvg(STAR, "px-art ax-icon-inline"),
};
