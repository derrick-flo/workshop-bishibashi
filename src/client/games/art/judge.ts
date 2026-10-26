import type { Hand } from "../../../domain/games/judge";
import { type Bitmap, flipX, outline, recolor } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { sprite } from "../../pixel/sprite";

/** 손등이 보이게 세운 손(손목 아래는 소매). 외곽선 없이 그리고 outline으로 두른다 */
const SHAPES: Readonly<Record<Hand, readonly string[]>> = {
	rock: [
		"....................",
		"....................",
		"....................",
		"....................",
		"....................",
		"....................",
		"....................",
		".....sss.sss.sss....",
		"....sssssssssssssss.",
		"....sSssSssSssSsssS.",
		"....sSssSssSssSsssS.",
		"...ssSssSssSssSsssS.",
		"..sssssssssssssssss.",
		"..sSSSSSSSSssssssss.",
		"..ssssssssSssssssSS.",
		"...sssssssssssssSS..",
		"....sssssssssssSS...",
		".....ssssssssssS....",
		"......sssssssssS....",
		"......sssssssssS....",
		"......WWWWWWWWWW....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
	],
	scissors: [
		".....sss......sss...",
		".....sss......sss...",
		"......sss....sss....",
		"......sss....sss....",
		".......sss..sss.....",
		".......sss..sss.....",
		"........sss.sss.....",
		"........sssssss.....",
		".......ssssssssss...",
		"......ssssssSssSss..",
		"......sssssssssssS..",
		".....ssssssssssssS..",
		"...sssssssssssssssS.",
		"..sSSSSSSSsssssssS..",
		"..ssssssssSsssssSS..",
		"...ssssssssssssSS...",
		"....sssssssssssS....",
		".....ssssssssssS....",
		"......sssssssssS....",
		"......sssssssssS....",
		"......WWWWWWWWWW....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
	],
	paper: [
		".........sss........",
		".........sss........",
		".....sss.sss.sss....",
		".....sss.sss.sss....",
		".....sss.sss.sss....",
		".....sss.sss.sss.sss",
		".....sss.sss.sss.sss",
		".....sss.sss.sss.sss",
		".....sss.sss.sss.sss",
		".....sss.sss.sss.sss",
		".....sssssssssssssss",
		"ss...sssssssssssssss",
		"sss..ssssssssssssssS",
		".sss.ssssssssssssssS",
		"..sssssssssssssssssS",
		"...ssssssssssssssssS",
		"....sssssssssssssssS",
		".....ssssssssssssSS.",
		".....sssssssssssSS..",
		"......sssssssssSS...",
		"......WWWWWWWWWW....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
		"......rrrrrrrrrR....",
	],
};

function hands(right: boolean): Readonly<Record<Hand, Bitmap>> {
	const make = (hand: Hand) => {
		const art = sprite(SHAPES[hand]);
		// 오른쪽 사람은 좌우를 뒤집고 소매를 파랑으로
		return outline(right ? recolor(flipX(art), { [C.r]: C.b, [C.R]: C.B }) : art, C.k);
	};
	return { rock: make("rock"), scissors: make("scissors"), paper: make("paper") };
}

/** 왼쪽 사람 손(빨간 소매) — 왼쪽이 이기면 빨강 */
export const LEFT_HANDS = hands(false);
/** 오른쪽 사람 손(파란 소매) — 오른쪽이 이기면 파랑 */
export const RIGHT_HANDS = hands(true);

/** 아래 표시판 무늬: ◀(왼쪽 승) · =(비김) · ▶(오른쪽 승) */
const ARROW = sprite(["..w", ".ww", "www", ".ww", "..w"]);
export const TAG_MARK = {
	red: ARROW,
	green: sprite(["www", "...", "www"]),
	blue: flipX(ARROW),
} as const;

/** 게임 고르기·순서표에 쓰는 아이콘(브이) */
export const JUDGE_ICON = sprite([
	"................",
	"...kk.....kk....",
	"..kssk...kssk...",
	"..kssk...kssk...",
	"...kssk.kssk....",
	"...kssk.kssk....",
	"....ksskssk.....",
	"...kkssssssk....",
	"..ksssSsSsSsk...",
	".kssssssssssk...",
	".ksssSSSSsssk...",
	"..kssssssssk....",
	"...kssssssk.....",
	"...kWWWWWWk.....",
	"...krrrrrrk.....",
	"...kkkkkkkk.....",
]);
