import { outline } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { sprite } from "../../pixel/sprite";

/** 틀렸을 때 나오는 큰 X */
export const CROSS = outline(
	sprite([
		"rr....rr",
		"rrr..rrr",
		".rrrrrr.",
		"..rrrr..",
		"..rrrr..",
		".rrrrrr.",
		"rrr..rrr",
		"rr....rr",
	]),
	C.k,
);

/** 맞혔을 때 체크 */
export const CHECK = outline(sprite([".....gg", "....gg.", "g..gg..", "gggg...", ".gg...."]), C.k);
