import { type GameState, PLAN_LIMIT } from "./domain/game";
import { type GameId, isGameId } from "./domain/games/catalog";
import type { PlayerId } from "./domain/player";

/** 폰 → 서버 */
export type PlayerMessage =
	| { readonly type: "hello"; readonly token: string | null }
	| { readonly type: "claim"; readonly playerId: PlayerId }
	/** playAt은 어느 판의 기록인지 가리킨다(같은 번호로 다시 한 판과 구분) */
	| { readonly type: "submit"; readonly roundNo: number; readonly playAt: number; readonly score: number };

/** 진행자 화면 → 서버 */
export type HostMessage =
	| { readonly type: "setRoster"; readonly names: readonly string[] }
	/** 순서표에서 아직 안 한 부분을 통째로 바꾼다 */
	| { readonly type: "setPlan"; readonly gameIds: readonly GameId[] }
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
	| { readonly type: "rejected"; readonly reason: string };

const LIMITS = { id: 64, token: 128, name: 30, roster: 100 } as const;

type Fields = Readonly<Record<string, unknown>>;

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

function parseNames(value: unknown): readonly string[] | null {
	if (!Array.isArray(value) || value.length > LIMITS.roster) return null;
	return value.every((name) => isText(name, LIMITS.name)) ? (value as string[]) : null;
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
	setRoster: ({ names }) => {
		const parsed = parseNames(names);
		return parsed === null ? null : { type: "setRoster", names: parsed };
	},
	setPlan: ({ gameIds }) => {
		const parsed = parseGameIds(gameIds);
		return parsed === null ? null : { type: "setPlan", gameIds: parsed };
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
	"setPlan",
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
