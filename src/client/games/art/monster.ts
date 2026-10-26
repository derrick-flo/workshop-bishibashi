import type { MonsterColor } from "../../../domain/games/monster";
import { type Bitmap, outline, rotate90 } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { sprite } from "../../pixel/sprite";

/**
 * 몬스터 세 종류. 색만으로 가리지 않도록 생김새가 버튼 모양과 같다:
 * 빨강은 ▲(뿔 달린 세모 도깨비), 초록은 ■(네모 젤리), 파랑은 ●(동그란 유령).
 */
export const MONSTERS: Readonly<Record<MonsterColor, Bitmap>> = {
	red: sprite([
		"......y......",
		".....kyk.....",
		"....krrrk....",
		"....krrrk....",
		"...krrrrrk...",
		"...kwwrwwk...",
		"..krwkrkwrk..",
		"..krrrrrrrk..",
		".krrkwkwkrrk.",
		".krrrrrrrrrk.",
		"krrRRRRRRRRrk",
		"kkkkkkkkkkkkk",
	]),
	green: sprite([
		"kkkkkkkkkkkk",
		"kllgggggggGk",
		"klgggggggGGk",
		"kgwwgggwwgGk",
		"kgwkgggkwgGk",
		"kggggggggGGk",
		"kgggkkkkgGGk",
		"kgggglllgGGk",
		"kggggggggGGk",
		"kgggggggGGGk",
		"kGGGGGGGGGGk",
		"kkkkkkkkkkkk",
	]),
	blue: sprite([
		"....kkkkk....",
		"..kkcbbbbkk..",
		".kcbbbbbbbbk.",
		".kbbwwbwwbBk.",
		"kbbbwkbkwbbBk",
		"kbbbbbbbbbbBk",
		"kbbbbkkkbbbBk",
		"kbbbbkRkbbbBk",
		".kbbbbbbbbBk.",
		".kBbbbbbbBBk.",
		"..kkBBBBBkk..",
		"....kkkkk....",
	]),
};

/** 용사(오른쪽을 본다). 외곽선 없이 그리고 outline으로 두른다 */
const KNIGHT = sprite([
	"...rr.....",
	"..WWWa....",
	".WWWWWa...",
	".WWkkkk...",
	".WWWWWa...",
	"..aaaa....",
	".aaWaaaa..",
	".aWyaaaa..",
	".aaaaaaa..",
	"..aaaaa...",
	"..AA.AA...",
	"..AA.AA...",
	".TTT.TTT..",
]);

export const HERO = outline(KNIGHT, C.k);

/** 칼(위로 세움). 휘두를 때는 돌려서 앞으로 내민다 */
export const SWORD_UP = outline(sprite([".w.", ".w.", ".w.", ".w.", ".w.", "yYy", ".t."]), C.k);
export const SWORD_FORWARD = rotate90(SWORD_UP);

/** 휘두른 자리에 남는 빛 */
export const SLASH = sprite(["....ww", "...wW.", "..wW..", ".wW...", "wW....", "W....."]);

/** 마지막 보스: 황금 드래곤 머리(왼쪽을 본다). FINISH 버튼과 같은 노란색이다 */
export const DRAGON = outline(
	sprite([
		"...............aa.......",
		"..............aWa.......",
		"............aWa...aa....",
		"...........yyyy..aWa....",
		".........yyyyyyyyWa.....",
		".......yyyyyyyyyyyyy....",
		".....yyyywwyyyyyyyyyy...",
		"....yyyywkwyyyyyyyyyyy..",
		"..yyyyyyyyyyyyyyyyyyyyy.",
		".yYyyyyyyyyyyyyyyyyyyyyy",
		"yyyyyyyyyyyyyyyyyyyyyyyy",
		"yykyyyyyyyyyyyyyYYYYYYYY",
		"wRwRwRwRwRRRRRRRYYYYYYYY",
		"RRRRRRRRRRRRRRRRYYYYYYYY",
		"wRwRwRwRwRRRRRRRYYYYYYYY",
		"yyyyyyyyyyyyyyyYYYYYYYYY",
		".YYYYYYYYYYYYYYYYYYYYYYY",
		"..YYYYYYYYYYYYYYYYYYYYYY",
	]),
	C.k,
);

/** 횃불 불꽃 두 프레임 */
export const TORCH_FLAME = [sprite([".y.", "yoy", "oro", ".o."]), sprite(["y..", ".yo", "oro", ".o."])] as const;

/** 게임 고르기·순서표에 쓰는 아이콘(세모 도깨비) */
export const MONSTER_ICON = sprite([
	"................",
	".......y........",
	"......kyk.......",
	".....krrrk......",
	".....krrrk......",
	"....krrrrrk.....",
	"....kwwrwwk.....",
	"...krwkrkwrk....",
	"...krrrrrrrk....",
	"..krrkwkwkrrk...",
	"..krrrrrrrrrk...",
	".krrRRRRRRRRrk..",
	".kkkkkkkkkkkkk..",
	"................",
	"................",
	"................",
]);
