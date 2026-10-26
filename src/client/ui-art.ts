import { flipX, outline, rotate90 } from "./pixel/bitmap";
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

/** 시연에서 버튼을 누르는 손. 위를 가리키는 손을 뒤집어 손가락 끝이 아래(가로 58% 지점)에 오게 한다. */
export const HAND = rotate90(
	rotate90(
		sprite([
			"....kk......",
			"...kwwk.....",
			"...kwwk.....",
			"...kwwk.....",
			"...kwwkkk...",
			"...kwwkwwkk.",
			".kkkwwkwwkwk",
			"kwwkwwwwwkwk",
			"kwwkwwwwwwwk",
			".kwwwwwwwwwk",
			"..kwwwwwwwWk",
			"..kwwwwwwWk.",
			"...kwwwwwWk.",
			"...kWWWWWk..",
			"....kaaaak..",
			"....kkkkkk..",
		]),
	),
);

export const svg = {
	crown: toSvg(CROWN, "px-art ax-icon-crown"),
	speaker: toSvg(SPEAKER, "px-art ax-icon-inline"),
	trophy: toSvg(TROPHY, "px-art ax-icon-trophy"),
	star: toSvg(STAR, "px-art ax-icon-inline"),
	/** 오른손(그대로)과 왼손(좌우 뒤집음) */
	hand: toSvg(HAND, "px-art"),
	leftHand: toSvg(flipX(HAND), "px-art"),
};
