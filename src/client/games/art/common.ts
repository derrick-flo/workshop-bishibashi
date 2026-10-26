import type { Button } from "../../../domain/games/button";
import { type Bitmap, outline } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { disc } from "../../pixel/shapes";
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

/**
 * 버튼마다 붙이는 모양(▲ 빨강 · ■ 초록 · ● 파랑 · ★ FINISH). 색약이어도 모양으로 구분된다.
 * 한 색으로 그려 두고 blitAs로 원하는 색을 입혀 쓴다(권총 속사 과녁, 순서 기억하기 칸).
 */
export const MARK: Readonly<Record<Button, Bitmap>> = {
	red: sprite(["...w...", "..www..", "..www..", ".wwwww.", ".wwwww.", "wwwwwww", "wwwwwww"]),
	green: sprite(["wwwwww", "wwwwww", "wwwwww", "wwwwww", "wwwwww", "wwwwww"]),
	blue: disc(7, C.w),
	finish: sprite(["...w...", "...w...", "wwwwwww", ".wwwww.", "..www..", ".ww.ww.", "ww...ww"]),
};
