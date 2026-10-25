import { BALLOON, BALLOON_MAX_SCORE, formatBalloon } from "./balloon";
import { CANDY, CANDY_MAX_SCORE, formatCandy } from "./candy";
import { EYE, EYE_MAX_SCORE, formatEye } from "./eye";
import { formatReaction, REACTION, REACTION_MAX_SCORE } from "./reaction";

export type GameId = "balloon" | "candy" | "eye" | "reaction";

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
	reaction: {
		id: "reaction",
		emoji: "🤠",
		title: "총잡이 결투",
		howTo: "'쏴!'가 뜨면 아무 버튼이나 빨리! 먼저 누르면 그 판은 실격. 5번 겨뤄요.",
		durationMs: REACTION.durationMs,
		maxScore: REACTION_MAX_SCORE,
		formatScore: formatReaction,
	},
};

export const GAME_IDS: readonly GameId[] = ["balloon", "candy", "eye", "reaction"];

export function isGameId(value: unknown): value is GameId {
	return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}
