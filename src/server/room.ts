import { DurableObject } from "cloudflare:workers";
import {
	cancelRound,
	claim,
	closeRound,
	confirmRound,
	EMPTY_GAME,
	finishGame,
	type GameState,
	isRoundComplete,
	release,
	reopenGame,
	resetGame,
	setPlan,
	setRoster,
	startRound,
	submitScore,
	type Transition,
} from "../domain/game";
import type { PlayerId } from "../domain/player";
import { type HostMessage, isHostMessage, type PlayerMessage, parseClientMessage, type ServerMessage } from "../protocol";
import { restoreGame } from "./restore";
import { hashToken, newToken } from "./secrets";

/** Worker가 진행자 키를 확인한 뒤 붙여 주는 헤더. 폰이 보낸 같은 이름의 헤더는 Worker가 덮어쓴다. */
export const ROLE_HEADER = "x-bishibashi-role";

/** 상태가 잇달아 바뀌면(라운드 끝에 30명이 한꺼번에 기록을 낼 때 등) 이만큼 모았다가 한 번만 보낸다 */
const BROADCAST_DELAY_MS = 40;

type Role = "host" | "player";

/** 연결마다 붙여 두는 정보. Durable Object가 잠들었다 깨어나도 남는다. */
type Attachment = { readonly role: Role; readonly playerId: PlayerId | null };

/** 토큰 해시 → 참가자 id */
type Claims = Readonly<Record<string, PlayerId>>;

/** 게임 한 판 전체. 상태가 바뀔 때마다 저장하고 모든 화면에 새 상태를 보낸다. */
export class GameRoom extends DurableObject<Env> {
	private game: GameState = EMPTY_GAME;
	private claims: Claims = {};
	private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// 폰이 연결 유지용으로 보내는 ping에는 Durable Object를 깨우지 않고 바로 답한다(요금에도 안 잡힌다).
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
		void ctx.blockConcurrencyWhile(async () => {
			this.game = restoreGame(await ctx.storage.get("game"));
			this.claims = (await ctx.storage.get<Claims>("claims")) ?? {};
		});
	}

	override async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
		const role: Role = request.headers.get(ROLE_HEADER) === "host" ? "host" : "player";
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ role, playerId: null } satisfies Attachment);
		return new Response(null, { status: 101, webSocket: client });
	}

	override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const message = typeof raw === "string" ? parseClientMessage(raw) : null;
		if (message === null) return send(ws, { type: "rejected", reason: "bad_message" });
		const attachment = attachmentOf(ws);
		if (!isHostMessage(message)) return this.handlePlayer(ws, attachment, message);
		if (attachment.role !== "host") return send(ws, { type: "rejected", reason: "not_host" });
		return this.handleHost(ws, message);
	}

	override async webSocketClose(ws: WebSocket): Promise<void> {
		try {
			ws.close(1000, "bye");
		} catch {
			// 이미 닫힌 연결
		}
		this.broadcast(ws);
	}

	override async webSocketError(ws: WebSocket): Promise<void> {
		this.broadcast(ws);
	}

	/** 기록 마감 시각에 울린다. 기록을 다 받지 못했어도 라운드를 닫는다. */
	override async alarm(): Promise<void> {
		if (this.game.phase.kind !== "playing") return;
		const { deadlineAt } = this.game.phase.round;
		if (Date.now() < deadlineAt) return this.ctx.storage.setAlarm(deadlineAt);
		const closed = closeRound(this.game);
		if (closed.ok) await this.apply(closed.state);
	}

	private async handlePlayer(ws: WebSocket, attachment: Attachment, message: PlayerMessage): Promise<void> {
		switch (message.type) {
			case "hello": {
				const playerId = attachment.role === "player" && message.token !== null ? await this.playerIdOf(message.token) : null;
				ws.serializeAttachment({ ...attachment, playerId } satisfies Attachment);
				if (attachment.role === "player") send(ws, { type: "you", playerId, token: null });
				return this.scheduleBroadcast();
			}
			case "claim": {
				if (attachment.role !== "player" || attachment.playerId !== null) return send(ws, { type: "rejected", reason: "already_joined" });
				const claimed = claim(this.game, message.playerId);
				if (!claimed.ok) return send(ws, { type: "rejected", reason: claimed.reason });
				// 해시를 계산하는 동안 들어온 같은 이름 요청이 거절되도록 상태부터 바꾼다.
				this.game = claimed.state;
				const token = newToken();
				this.claims = { ...this.claims, [await hashToken(token)]: message.playerId };
				ws.serializeAttachment({ ...attachment, playerId: message.playerId } satisfies Attachment);
				send(ws, { type: "you", playerId: message.playerId, token });
				return this.apply(this.game);
			}
			case "submit": {
				if (attachment.playerId === null) return send(ws, { type: "rejected", reason: "not_joined" });
				const submitted = submitScore(this.game, attachment.playerId, message.roundNo, message.score, Date.now());
				if (!submitted.ok) return send(ws, { type: "rejected", reason: submitted.reason });
				const { phase } = submitted.state;
				const everyoneIn = phase.kind === "playing" && isRoundComplete(phase.round);
				const closed = everyoneIn ? closeRound(submitted.state) : submitted;
				return this.apply(closed.ok ? closed.state : submitted.state);
			}
		}
	}

	private async handleHost(ws: WebSocket, message: HostMessage): Promise<void> {
		const transition = this.hostTransition(message);
		if (!transition.ok) return send(ws, { type: "rejected", reason: transition.reason });
		if (message.type === "release") this.forget([message.playerId]);
		if (message.type === "setRoster") {
			const remaining = new Set(transition.state.players.map((player) => player.id));
			this.forget(Object.values(this.claims).filter((id) => !remaining.has(id)));
		}
		return this.apply(transition.state);
	}

	private hostTransition(message: HostMessage): Transition {
		switch (message.type) {
			case "setRoster":
				return setRoster(this.game, message.names, () => crypto.randomUUID());
			case "setPlan":
				return setPlan(this.game, message.gameIds);
			case "startRound":
				return startRound(this.game, crypto.getRandomValues(new Uint32Array(1))[0] ?? 1, Date.now());
			case "closeRound":
				return closeRound(this.game);
			case "confirmRound":
				return confirmRound(this.game);
			case "cancelRound":
				return cancelRound(this.game);
			case "finishGame":
				return finishGame(this.game);
			case "reopenGame":
				return reopenGame(this.game);
			case "release":
				return release(this.game, message.playerId);
			case "reset":
				return { ok: true, state: resetGame(this.game) };
		}
	}

	/** 새 상태로 바꾸고, 라운드가 열리고 닫힐 때 마감 알람을 맞춘 뒤, 저장하고 모두에게 보낸다. */
	private async apply(next: GameState): Promise<void> {
		const wasPlaying = this.game.phase.kind === "playing";
		this.game = next;
		if (next.phase.kind === "playing" && !wasPlaying) await this.ctx.storage.setAlarm(next.phase.round.deadlineAt);
		if (next.phase.kind !== "playing" && wasPlaying) await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.put({ game: this.game, claims: this.claims });
		this.scheduleBroadcast();
	}

	/** 곧 지금 상태를 모두에게 보낸다. 이미 보내기로 했으면 그때 최신 상태가 나간다. */
	private scheduleBroadcast(): void {
		if (this.broadcastTimer !== null) return;
		this.broadcastTimer = setTimeout(() => {
			this.broadcastTimer = null;
			this.broadcast(null);
		}, BROADCAST_DELAY_MS);
	}

	private async playerIdOf(token: string): Promise<PlayerId | null> {
		const playerId = this.claims[await hashToken(token)] ?? null;
		const stillClaimed = this.game.players.some((player) => player.id === playerId && player.claimed);
		return stillClaimed ? playerId : null;
	}

	/** 그 사람들의 토큰을 지우고, 열려 있는 폰은 이름 고르기 화면으로 돌려보낸다. 저장은 apply가 한다. */
	private forget(playerIds: readonly PlayerId[]): void {
		if (playerIds.length === 0) return;
		this.claims = Object.fromEntries(Object.entries(this.claims).filter(([, id]) => !playerIds.includes(id)));
		for (const ws of this.ctx.getWebSockets()) {
			const attachment = attachmentOf(ws);
			if (attachment.playerId === null || !playerIds.includes(attachment.playerId)) continue;
			ws.serializeAttachment({ ...attachment, playerId: null } satisfies Attachment);
			send(ws, { type: "you", playerId: null, token: null });
		}
	}

	/** 지금 상태를 모든 화면에 보낸다. 닫히는 중인 연결(leaving)은 접속자에서 뺀다. */
	private broadcast(leaving: WebSocket | null): void {
		const sockets = this.ctx.getWebSockets().filter((ws) => ws !== leaving);
		const onlineIds = [...new Set(sockets.map((ws) => attachmentOf(ws).playerId).filter((id) => id !== null))];
		const json = JSON.stringify({ type: "state", game: this.game, onlineIds, serverNow: Date.now() } satisfies ServerMessage);
		for (const ws of sockets) {
			try {
				ws.send(json);
			} catch {
				// 끊긴 연결은 닫힘 이벤트 때 정리된다
			}
		}
	}
}

function attachmentOf(ws: WebSocket): Attachment {
	return (ws.deserializeAttachment() as Attachment | null) ?? { role: "player", playerId: null };
}

function send(ws: WebSocket, message: ServerMessage): void {
	try {
		ws.send(JSON.stringify(message));
	} catch {
		// 끊긴 연결
	}
}
