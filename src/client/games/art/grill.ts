import { type Bitmap, outline, paint } from "../../pixel/bitmap";
import { C, CLEAR } from "../../pixel/palette";
import { sprite } from "../../pixel/sprite";

/** 고기가 익어 가는 모습. 덜 익음 → 익는 중 → 거의 익음 → 딱 좋음(화면에 느낌표) → 탐 → 숯덩이 */
export type MeatLook = "raw" | "warm" | "brown" | "good" | "burnt" | "charred";

/** 위에서 본 삼겹살 한 줄: m 살코기, f 비계, d 그늘 */
const PATTERN = [
	"mmmmmmmmmmmmmm",
	"ffffffffffffff",
	"mmmmmmmmmmmmmd",
	"mmmmmmmmmmmmdd",
	"ffffffffffffff",
	"mmmmmmmmmmmmmd",
	"dddddddddddddd",
] as const;

const LOOKS: Readonly<Record<MeatLook, { readonly m: number; readonly f: number; readonly d: number; readonly marks: number }>> = {
	raw: { m: C.p, f: C.w, d: C.r, marks: CLEAR },
	warm: { m: C.s, f: C.W, d: C.S, marks: CLEAR },
	brown: { m: C.o, f: C.s, d: C.O, marks: C.O },
	good: { m: C.O, f: C.y, d: C.T, marks: C.T },
	burnt: { m: C.T, f: C.t, d: C.k, marks: C.k },
	charred: { m: C.k, f: C.T, d: C.k, marks: C.A },
};

function meat(look: MeatLook): Bitmap {
	const colors = LOOKS[look];
	const w = PATTERN[0].length;
	return outline(
		paint(w, PATTERN.length, (x, y) => {
			const cell = PATTERN[y]?.[x] ?? ".";
			// 석쇠 자국(대각선)
			if (colors.marks !== CLEAR && cell === "m" && x > 1 && x < w - 2 && (x + y) % 5 === 0) return colors.marks;
			return cell === "f" ? colors.f : cell === "d" ? colors.d : colors.m;
		}),
		C.k,
	);
}

export const MEAT: Readonly<Record<MeatLook, Bitmap>> = {
	raw: meat("raw"),
	warm: meat("warm"),
	brown: meat("brown"),
	good: meat("good"),
	burnt: meat("burnt"),
	charred: meat("charred"),
};

/** 접시에 쌓는 작은 고기 */
export const MINI_MEAT = outline(sprite(["OOOOO", "yyyyy", "OOTOO"]), C.k);

/** 상추 */
export const LETTUCE = sprite([
	"..ll.ll...",
	".llgllgl..",
	"llgggggll.",
	"lgggGgggl.",
	".lgGGGgl..",
	"..lgGgl...",
	"...lGl....",
]);

/** 게임 고르기·순서표에 쓰는 아이콘(불판 위 삼겹살) */
export const GRILL_ICON = sprite([
	"................",
	"....W....W......",
	".....W....W.....",
	"....W....W......",
	"................",
	".kkkkkkkkkkkkkk.",
	".kOOTOOOOTOOOOk.",
	".kyyyyyyyyyyyyk.",
	".kOOOOTOOOOTOOk.",
	".kTTTTTTTTTTTTk.",
	".kkkkkkkkkkkkkk.",
	"kAkAkAkAkAkAkAkk",
	"kkkkkkkkkkkkkkkk",
	"..roy.roy.roy...",
	"...o...o...o....",
	"................",
]);
