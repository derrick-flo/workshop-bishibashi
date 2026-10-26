import { outline, rotate90 } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { frames, sprite } from "../../pixel/sprite";

/** 등산객(오른쪽을 본다): 서 있음 · 걸음 · 뛰어오름. 외곽선 없이 그리고 outline으로 두른다 */
const [stand, walk, hop] = frames([
	["..rrr..", "..rrrrr", "..sss..", "..ssk..", ".tbbbb.", ".tbbbs.", ".tbbb..", "..BBB..", "..B.B..", ".TT.TT."],
	["..rrr..", "..rrrrr", "..sss..", "..ssk..", ".tbbbb.", ".tbbbs.", ".tbbb..", "..BBB..", ".B...B.", "TT...TT"],
	["..rrr..", "..rrrrr", "..sss..", "..ssk..", ".tbbbbs", ".tbbb..", ".tbbb..", "..BBB..", "..BB...", "..TTT.."],
]).map((frame) => outline(frame, C.k));
if (stand === undefined || walk === undefined || hop === undefined) throw new Error("등산객 그림이 없어요");

export const RUNNER = { stand, walk, hop } as const;

/** 넘어져 누운 모습 */
export const RUNNER_DOWN = rotate90(RUNNER.stand);

/** 정상 깃발 두 프레임(펄럭인다) */
export const FLAG = frames([
	["rrrr.", "rrrrr", "rrrr.", "r...."],
	["rrrrr", "rrrr.", "rrrrr", "r...."],
]);

/** 게임 고르기·순서표에 쓰는 아이콘(돌계단과 깃발) */
export const STAIRS_ICON = sprite([
	"................",
	"...........Wrr..",
	"...........Wrrr.",
	"...........Wr...",
	"...........W....",
	"..........kkkkkk",
	"..........klllll",
	"......kkkkkaaaaa",
	"......klllkaAaaa",
	"..kkkkkaaaaaaAaa",
	"..klllkaaAaaaaaa",
	"kkkaaaaaaaaaaaaa",
	"lllaAaaaaaAaaaaa",
	"aaaaaaaaaaaaaaaa",
	"aaAaaaaaAaaaaaAa",
	"aaaaaaaaaaaaaaaa",
]);
