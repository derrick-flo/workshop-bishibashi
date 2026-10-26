import { type Bitmap, flipX, outline, recolor, rotate90 } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { frames, sprite } from "../../pixel/sprite";

/**
 * 오른쪽을 보는 카우보이(외곽선 없이 그리고 outline으로 두른다).
 * 0: 서 있음(총은 허리에), 1: 총을 뽑아 겨눔
 */
const COWBOY_RIGHT = frames([
	[
		"...tttt.......",
		"..tttttt......",
		"..TTTTTT......",
		"tttttttttt....",
		"...sssss......",
		"...sssks......",
		"...ssssss.....",
		"...rrrrr......",
		"..bbbrbbb.....",
		"..bbbbbBb.....",
		"..bbbbbBb.....",
		"..bbbbbBs.....",
		"..kkykkAa.....",
		"..AAAAAA......",
		"..AA..AA......",
		"..AA..AA......",
		"..AA..AA......",
		"..TT..TTT.....",
		"..TTT.TTTT....",
	],
	[
		"...tttt.......",
		"..tttttt......",
		"..TTTTTT......",
		"tttttttttt....",
		"...sssss......",
		"...sssks......",
		"...ssssss.....",
		"...rrrrr......",
		"..bbbrbbb.....",
		"..bbbbbBBBsaaa",
		"..bbbbbb..AA..",
		"..bbbbbb......",
		"..kkykkk......",
		"..AAAAAA......",
		"..AA..AA......",
		"..AA..AA......",
		"..AA..AA......",
		"..TT..TTT.....",
		"..TTT.TTTT....",
	],
]).map((frame) => outline(frame, C.k));

/** 상대 카우보이 색: 빨간 셔츠, 노란 손수건, 회색 모자, 갈색 바지 */
const RIVAL_COLORS: Readonly<Record<number, number>> = {
	[C.b]: C.r,
	[C.B]: C.R,
	[C.r]: C.y,
	[C.t]: C.a,
	[C.T]: C.A,
	[C.A]: C.T,
};

export type Pose = "stand" | "aim" | "down";

export type Cowboy = Readonly<Record<Pose, Bitmap>>;

function cowboy(right: readonly Bitmap[], facingLeft: boolean, colors: Readonly<Record<number, number>>): Cowboy {
	const [stand, aim] = right.map((frame) => recolor(facingLeft ? flipX(frame) : frame, colors));
	if (stand === undefined || aim === undefined) throw new Error("카우보이 그림이 없어요");
	// 쓰러지면 뒤로 눕는다: 왼쪽 사람은 머리가 왼쪽, 오른쪽 사람은 머리가 오른쪽
	const down = facingLeft ? rotate90(stand) : rotate90(rotate90(rotate90(stand)));
	return { stand, aim, down };
}

export const PLAYER = cowboy(COWBOY_RIGHT, false, {});
export const RIVAL = cowboy(COWBOY_RIGHT, true, RIVAL_COLORS);

/** 총구 불꽃 */
export const MUZZLE = sprite(["..y..", ".yoy.", "ywwwy", ".yoy.", "..y.."]);

/** 굴러다니는 마른 덤불 두 프레임 */
export const TUMBLEWEED = frames([
	[".tTt.", "tT.Tt", "T.t.T", "tT.Tt", ".tTt."],
	[".TtT.", "Tt.tT", "t.T.t", "Tt.tT", ".TtT."],
]);

/** 선인장 */
export const CACTUS = outline(
	sprite(["..g..", "..g.g", "g.ggg", "ggg..", "..g..", "..g.."]),
	C.G,
);

/** 게임 고르기·순서표에 쓰는 아이콘(카우보이 모자) */
export const DUEL_ICON = sprite([
	"................",
	"................",
	"......kkkk......",
	".....kttttk.....",
	"....kttTTttk....",
	"....kttttttk....",
	"....kttttttk....",
	"....kyyyyyyk....",
	"k...kttttttk...k",
	"kk..kttttttk..kk",
	"ktkkkkkkkkkkkktk",
	"kttttttttttttttk",
	".kttttttttttttk.",
	"..kkkkkkkkkkkk..",
	"................",
	"................",
]);
