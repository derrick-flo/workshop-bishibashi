import { type GameState, isMode, type Mode, PLAN_LIMIT } from "./domain/game";
import { type Button, isButton } from "./domain/games/button";
import { type GameId, isGameId } from "./domain/games/catalog";
import type { PlayerId } from "./domain/player";
import { parseSoloRules, type SoloRules } from "./domain/solo/rules";

/** 폰 → 서버 */
export type PlayerMessage =
	| { readonly type: "hello"; readonly token: string | null }
	| { readonly type: "claim"; readonly playerId: PlayerId }
	/** playAt은 어느 판의 기록인지 가리킨다(같은 번호로 다시 한 판과 구분) */
	| { readonly type: "submit"; readonly roundNo: number; readonly playAt: number; readonly score: number }
	/**
	 * 토너먼트에서 버튼을 누른 순간을 관전 화면에 중계해 달라고 보낸다.
	 * t는 게임 시작 뒤 경과 ms, score는 그 누름까지의 점수(관전 화면이 숫자를 그대로 보여 준다).
	 */
	| {
			readonly type: "press";
			readonly roundNo: number;
			readonly playAt: number;
			readonly button: Button;
			readonly t: number;
			readonly score: number;
	  };

/** 진행자 화면 → 서버 */
export type HostMessage =
	| { readonly type: "setRoster"; readonly names: readonly string[] }
	/** 진행 방식(점수전·토너먼트)을 고른다 */
	| { readonly type: "setMode"; readonly mode: Mode }
	/** 토너먼트에서 부전승으로 정해 둘 사람을 통째로 바꾼다 */
	| { readonly type: "setByes"; readonly playerIds: readonly PlayerId[] }
	/** 입장한 사람으로 토너먼트 대진을 짠다 */
	| { readonly type: "drawBracket" }
	/** 순서표에서 아직 안 한 부분을 통째로 바꾼다 */
	| { readonly type: "setPlan"; readonly gameIds: readonly GameId[] }
	/** 혼자 하는 도전 세 종목의 성공 기준을 바꾼다 */
	| { readonly type: "setSoloRules"; readonly rules: SoloRules }
	/** 다음 라운드 게임 설명(시연)을 띄운다 / 접고 로비로 */
	| { readonly type: "openIntro" }
	| { readonly type: "closeIntro" }
	| { readonly type: "startRound" }
	| { readonly type: "closeRound" }
	| { readonly type: "confirmRound" }
	| { readonly type: "cancelRound" }
	| { readonly type: "finishGame" }
	| { readonly type: "reopenGame" }
	| { readonly type: "release"; readonly playerId: PlayerId }
	| { readonly type: "reset" };

export type ClientMessage = PlayerMessage | HostMessage;

/** 서버 → 폰·진행자 화면 */
export type ServerMessage =
	| {
			readonly type: "state";
			readonly game: GameState;
			readonly onlineIds: readonly PlayerId[];
			/** 폰 시계와 서버 시계 차이를 맞추는 데 쓴다 */
			readonly serverNow: number;
	  }
	/** 이 연결이 누구인지. 처음 입장할 때만 token을 준다(폰이 보관). */
	| { readonly type: "you"; readonly playerId: PlayerId | null; readonly token: string | null }
	/** 이 폰의 기록을 저장했다. 전체 상태가 오기 전에 바로 알려서 폰이 다시 보내지 않게 한다. */
	| { readonly type: "saved"; readonly roundNo: number; readonly playAt: number }
	/**
	 * 토너먼트 중계. 어느 폰이 언제 무슨 버튼을 눌렀는지 관전 화면·진행자 화면에만 바로 보낸다.
	 * 상태가 아니라 중계라서 저장하지 않고 모아 보내지도 않는다.
	 */
	| {
			readonly type: "press";
			readonly playerId: PlayerId;
			readonly roundNo: number;
			readonly playAt: number;
			readonly button: Button;
			readonly t: number;
			readonly score: number;
	  }
	| { readonly type: "rejected"; readonly reason: string };

const LIMITS = { id: 64, token: 128, name: 30, roster: 100 } as const;

type Fields = Readonly<Record<string, unknown>>;

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

function parseNames(value: unknown): readonly string[] | null {
	if (!Array.isArray(value) || value.length > LIMITS.roster) return null;
	return value.every((name) => isText(name, LIMITS.name)) ? (value as string[]) : null;
}

function parsePlayerIds(value: unknown): readonly PlayerId[] | null {
	if (!Array.isArray(value) || value.length > LIMITS.roster) return null;
	return value.every((id) => isText(id, LIMITS.id)) ? (value as PlayerId[]) : null;
}

function parseGameIds(value: unknown): readonly GameId[] | null {
	if (!Array.isArray(value) || value.length > PLAN_LIMIT) return null;
	return value.every(isGameId) ? (value as GameId[]) : null;
}

const PARSERS: Readonly<Record<ClientMessage["type"], (fields: Fields) => ClientMessage | null>> = {
	hello: ({ token }) => {
		if (token === null) return { type: "hello", token: null };
		return isText(token, LIMITS.token) ? { type: "hello", token } : null;
	},
	claim: ({ playerId }) => (isText(playerId, LIMITS.id) ? { type: "claim", playerId } : null),
	submit: ({ roundNo, playAt, score }) =>
		isInteger(roundNo) && isInteger(playAt) && typeof score === "number" ? { type: "submit", roundNo, playAt, score } : null,
	press: ({ roundNo, playAt, button, t, score }) =>
		isInteger(roundNo) && isInteger(playAt) && isButton(button) && isInteger(t) && t >= 0 && isInteger(score) && score >= 0
			? { type: "press", roundNo, playAt, button, t, score }
			: null,
	setRoster: ({ names }) => {
		const parsed = parseNames(names);
		return parsed === null ? null : { type: "setRoster", names: parsed };
	},
	setMode: ({ mode }) => (isMode(mode) ? { type: "setMode", mode } : null),
	setByes: ({ playerIds }) => {
		const parsed = parsePlayerIds(playerIds);
		return parsed === null ? null : { type: "setByes", playerIds: parsed };
	},
	drawBracket: () => ({ type: "drawBracket" }),
	setPlan: ({ gameIds }) => {
		const parsed = parseGameIds(gameIds);
		return parsed === null ? null : { type: "setPlan", gameIds: parsed };
	},
	setSoloRules: ({ rules }) => {
		const parsed = parseSoloRules(rules);
		return parsed === null ? null : { type: "setSoloRules", rules: parsed };
	},
	openIntro: () => ({ type: "openIntro" }),
	closeIntro: () => ({ type: "closeIntro" }),
	startRound: () => ({ type: "startRound" }),
	closeRound: () => ({ type: "closeRound" }),
	confirmRound: () => ({ type: "confirmRound" }),
	cancelRound: () => ({ type: "cancelRound" }),
	finishGame: () => ({ type: "finishGame" }),
	reopenGame: () => ({ type: "reopenGame" }),
	release: ({ playerId }) => (isText(playerId, LIMITS.id) ? { type: "release", playerId } : null),
	reset: () => ({ type: "reset" }),
};

/** 받은 문자열을 메시지로 바꾼다. 형식이 하나라도 틀리면 null. 필요한 필드만 남긴다. */
export function parseClientMessage(raw: string): ClientMessage | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const fields = value as Fields;
	const type = fields.type;
	if (typeof type !== "string" || !Object.hasOwn(PARSERS, type)) return null;
	return PARSERS[type as ClientMessage["type"]](fields);
}

const HOST_TYPES: ReadonlySet<ClientMessage["type"]> = new Set([
	"setRoster",
	"setMode",
	"setByes",
	"drawBracket",
	"setPlan",
	"setSoloRules",
	"openIntro",
	"closeIntro",
	"startRound",
	"closeRound",
	"confirmRound",
	"cancelRound",
	"finishGame",
	"reopenGame",
	"release",
	"reset",
]);

export function isHostMessage(message: ClientMessage): message is HostMessage {
	return HOST_TYPES.has(message.type);
}
