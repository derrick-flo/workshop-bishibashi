import { type Bitmap, outline, paint } from "../../pixel/bitmap";
import { C, CLEAR } from "../../pixel/palette";
import { insideEllipse } from "../../pixel/shapes";
import { sprite } from "../../pixel/sprite";

/** 버튼 값별 사탕 색: 빨강 +1, 초록 +5, 파랑 +10 */
export const CANDY_COLORS = {
	1: { base: C.r, light: C.p, dark: C.R },
	5: { base: C.g, light: C.l, dark: C.G },
	10: { base: C.b, light: C.c, dark: C.B },
} as const;

export type CandyValue = keyof typeof CANDY_COLORS;

/** 값이 클수록 큰 사탕(색약이어도 크기로 구분된다) */
function candyBall(size: number, value: CandyValue): Bitmap {
	const colors = CANDY_COLORS[value];
	return outline(
		paint(size, size, (x, y) => {
			if (!insideEllipse(x, y, size, size)) return CLEAR;
			if (x === Math.floor(size / 3) && y === Math.floor(size / 3)) return C.w;
			return x + y >= size + 1 ? colors.dark : colors.base;
		}),
		C.k,
	);
}

export const CANDY_BALLS: Readonly<Record<CandyValue, Bitmap>> = {
	1: candyBall(3, 1),
	5: candyBall(4, 5),
	10: candyBall(5, 10),
};

/** 병 뚜껑 */
export const LID = sprite(["kkkkkkkkkkkkkkkkkkkkkk", "ktttttttttttttttttttTk", "kTTTTTTTTTTTTTTTTTTTTk", "kkkkkkkkkkkkkkkkkkkkkk"]);

/** 완성한 병(작게) */
export const MINI_JAR = sprite(["ktttk", "kkkkk", "kclck", "kbrgk", "kgbrk", "kkkkk"]);

/** 게임 고르기·순서표에 쓰는 아이콘 */
export const CANDY_ICON = sprite([
	"................",
	"....kkkkkkkk....",
	"....kTttttTk....",
	"..kkkkkkkkkkkk..",
	"..kWnnnnnnnnnk..",
	"..kWnnnnnnnnnk..",
	"..kWnnnnnnnnnk..",
	"..kWnnnnnnnnnk..",
	"..kWrrnbbnggnk..",
	"..kWrrnbbnggnk..",
	"..kWnggnrrnbbk..",
	"..kWnggnrrnbbk..",
	"..kWrrnbbnggnk..",
	"..kWrrnbbnggnk..",
	"..kkkkkkkkkkkk..",
	"................",
]);
