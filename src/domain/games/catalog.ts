import { BALLOON, BALLOON_MAX_SCORE, formatBalloon } from "./balloon";
import { CANDY, CANDY_MAX_SCORE, formatCandy } from "./candy";
import { CUPS, CUPS_MAX_SCORE, formatCups } from "./cups";
import { EYE, EYE_MAX_SCORE, formatEye } from "./eye";
import { formatGrill, GRILL, GRILL_MAX_SCORE } from "./grill";
import { formatJudge, JUDGE, JUDGE_MAX_SCORE } from "./judge";
import { formatMemory, MEMORY, MEMORY_MAX_SCORE } from "./memory";
import { formatMonster, MONSTER, MONSTER_MAX_SCORE } from "./monster";
import { formatShooting, SHOOTING, SHOOTING_MAX_SCORE } from "./shooting";
import { formatStairs, STAIRS, STAIRS_MAX_SCORE } from "./stairs";
import { formatTreasure, TREASURE, TREASURE_MAX_SCORE } from "./treasure";

export type GameId =
	| "balloon"
	| "candy"
	| "eye"
	| "monster"
	| "judge"
	| "shooting"
	| "stairs"
	| "grill"
	| "memory"
	| "cups"
	| "treasure";

export type GameInfo = {
	readonly id: GameId;
	readonly emoji: string;
	readonly title: string;
	readonly howTo: string;
	readonly durationMs: number;
	/** 이보다 큰 점수는 조작으로 보고 받지 않는다 */
	readonly maxScore: number;
	readonly formatScore: (score: number) => string;
};

export const GAMES: Readonly<Record<GameId, GameInfo>> = {
	balloon: {
		id: "balloon",
		emoji: "🎈",
		title: "풍선 불기",
		howTo: "빨강·파랑을 번갈아 눌러 풍선을 불어요. 다 차면 FINISH! 더 불면 펑 터져요.",
		durationMs: BALLOON.durationMs,
		maxScore: BALLOON_MAX_SCORE,
		formatScore: formatBalloon,
	},
	candy: {
		id: "candy",
		emoji: "🍬",
		title: "알사탕 담기",
		howTo: "빨강 +1, 초록 +5, 파랑 +10. 병에 적힌 숫자만큼 담고 FINISH! 넘치면 쏟아져요.",
		durationMs: CANDY.durationMs,
		maxScore: CANDY_MAX_SCORE,
		formatScore: formatCandy,
	},
	eye: {
		id: "eye",
		emoji: "👁️",
		title: "시력검사",
		howTo: "고리가 뚫린 쪽을 눌러요. ← 빨강 · ↑ 초록 · → 파랑 · ↓ FINISH. 틀리면 잠깐 멈춰요.",
		durationMs: EYE.durationMs,
		maxScore: EYE_MAX_SCORE,
		formatScore: formatEye,
	},
	monster: {
		id: "monster",
		emoji: "👾",
		title: "몬스터 퇴치",
		howTo: "맨 앞 몬스터와 같은 버튼을 눌러요(▲ 빨강 · ■ 초록 · ● 파랑). 틀리면 잠깐 멈춰요. 마지막 드래곤은 FINISH 연타!",
		durationMs: MONSTER.durationMs,
		maxScore: MONSTER_MAX_SCORE,
		formatScore: formatMonster,
	},
	judge: {
		id: "judge",
		emoji: "✌️",
		title: "가위바위보 판정",
		howTo: "이긴 쪽을 눌러요. 왼쪽이 이기면 빨강 · 비기면 초록 · 오른쪽이 이기면 파랑. 틀리면 잠깐 멈춰요.",
		durationMs: JUDGE.durationMs,
		maxScore: JUDGE_MAX_SCORE,
		formatScore: formatJudge,
	},
	shooting: {
		id: "shooting",
		emoji: "🎯",
		title: "권총 속사",
		howTo: "표적과 같은 버튼을 빨리 쏴요(▲ 빨강 · ■ 초록 · ● 파랑 · ★ FINISH). 틀리면 그 표적은 놓쳐요. 점점 빨라져요!",
		durationMs: SHOOTING.durationMs,
		maxScore: SHOOTING_MAX_SCORE,
		formatScore: formatShooting,
	},
	stairs: {
		id: "stairs",
		emoji: "🪜",
		title: "계단 오르기",
		howTo: "평지는 빨강·파랑, 계단은 초록으로 한 칸씩 올라가요. 틀리면 넘어져서 잠깐 멈춰요.",
		durationMs: STAIRS.durationMs,
		maxScore: STAIRS_MAX_SCORE,
		formatScore: formatStairs,
	},
	grill: {
		id: "grill",
		emoji: "🥓",
		title: "삼겹살 굽기",
		howTo: "불판 왼쪽·가운데·오른쪽 고기는 빨강·초록·파랑으로 집어요. 노릇노릇 익어 느낌표(!)가 뜰 때 집어야 1개! 덜 익거나 타면 꽝.",
		durationMs: GRILL.durationMs,
		maxScore: GRILL_MAX_SCORE,
		formatScore: formatGrill,
	},
	memory: {
		id: "memory",
		emoji: "🧠",
		title: "순서 기억하기",
		howTo: "칸이 차례로 반짝이면 그대로 따라 눌러요. 맞히면 하나씩 늘어나요. 틀리면 같은 순서를 다시 보여줘요.",
		durationMs: MEMORY.durationMs,
		maxScore: MEMORY_MAX_SCORE,
		formatScore: formatMemory,
	},
	cups: {
		id: "cups",
		emoji: "🥤",
		title: "야바위",
		howTo: "공이 든 컵을 눈으로 따라가요. 다 섞이면 그 자리 버튼! 왼쪽 빨강 · 가운데 초록 · 오른쪽 파랑.",
		durationMs: CUPS.durationMs,
		maxScore: CUPS_MAX_SCORE,
		formatScore: formatCups,
	},
	treasure: {
		id: "treasure",
		emoji: "⛏️",
		title: "보물 캐기",
		howTo: "빨강·초록·파랑으로 파 내려가요. 깊을수록 금이 많지만 폭탄을 만나면 가방이 날아가요. FINISH로 금고에!",
		durationMs: TREASURE.durationMs,
		maxScore: TREASURE_MAX_SCORE,
		formatScore: formatTreasure,
	},
};

export const GAME_IDS: readonly GameId[] = [
	"balloon",
	"candy",
	"eye",
	"monster",
	"judge",
	"shooting",
	"stairs",
	"grill",
	"memory",
	"cups",
	"treasure",
];

export function isGameId(value: unknown): value is GameId {
	return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}
