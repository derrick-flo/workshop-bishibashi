import { outline } from "../../pixel/bitmap";
import { C } from "../../pixel/palette";
import { frames, sprite } from "../../pixel/sprite";

/** 광부(노란 안전모): 곡괭이를 든 모습과 내리찍은 모습. 외곽선 없이 그리고 outline으로 두른다 */
const [up, down] = frames([
	[
		"......AaaA.",
		".......t...",
		"..yyy..t...",
		".yyyyy.t...",
		"..sss.st...",
		"..ssk.s....",
		".bbbbbb....",
		".bbbbb.....",
		".bbbbb.....",
		".TTTTT.....",
		".TT.TT.....",
		".AA.AA.....",
	],
	[
		"...........",
		"...........",
		"..yyy......",
		".yyyyy.....",
		"..sss......",
		"..ssk......",
		".bbbbbbs...",
		".bbbbb.tt..",
		".bbbbb...t.",
		".TTTTT..AaA",
		".TT.TT.....",
		".AA.AA.....",
	],
]).map((frame) => outline(frame, C.k));
if (up === undefined || down === undefined) throw new Error("광부 그림이 없어요");

export const MINER = { up, down } as const;

/** 금고(가방의 금을 넣는 곳) */
export const CHEST = sprite([".kkkkkkk.", "kOoooooOk", "kkkkykkkk", "kOooyooOk", "kOoooooOk", "kOoooooOk", "kkkkkkkkk"]);

/** 아직 금고에 안 넣은 금을 담는 가방 */
export const BAG = sprite(["..kkk..", "...k...", ".kSSSk.", "kSsssSk", "kSsyySk", "kSSSSSk", ".kkkkk."]);

/** 땅에서 나온 금덩이 */
export const NUGGET = outline(sprite([".yy.", "yyYy", ".YY."]), C.k);

/** 게임 고르기·순서표에 쓰는 아이콘(반짝이는 보물 상자) */
export const TREASURE_ICON = sprite([
	"................",
	"......y.........",
	".....yyy....y...",
	"......y.........",
	"..kkkkkkkkkkkk..",
	".kTOOOOOOOOOOTk.",
	".kOooooooooooOk.",
	".kOooooooooooOk.",
	".kkkkkkyykkkkkk.",
	".kToooyyyyoooTk.",
	".kOooooyyooooOk.",
	".kOooooooooooOk.",
	".kTooooooooooTk.",
	".kkkkkkkkkkkkkk.",
	"................",
	"................",
]);
