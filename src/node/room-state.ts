import { mkdir, open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { RawData, WebSocket as NodeSocket } from "ws";

/**
 * GameRoom 은 Durable Object 로 짜여 있다. Node 에서는 이 모듈이 Durable Object 런타임이 해 주던 일을 대신한다.
 * - 연결: ws 소켓을 감싸 첨부(serializeAttachment)를 들고 다니고, 메시지·닫힘을 GameRoom 에 넘긴다. "ping" 에는 바로 "pong".
 * - 저장소: 한 판의 상태를 DATA_DIR 의 JSON 파일 하나에 통째로 쓴다(임시 파일에 쓴 뒤 이름을 바꿔서 반쯤 쓴 파일이 남지 않게).
 * - 알람: 기록 마감 시각을 같은 파일에 적고 setTimeout 으로 울린다. 다시 켜면 남은 알람을 다시 건다.
 */

const STATE_FILE = "room.json";

type Snapshot = {
	readonly values: Readonly<Record<string, unknown>>;
	readonly alarmAt: number | null;
};

const EMPTY: Snapshot = { values: {}, alarmAt: null };

/** Durable Object 런타임이 부르는 GameRoom 의 처리기 */
export type RoomHandlers = {
	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>;
	webSocketError(ws: WebSocket, error: unknown): Promise<void>;
	alarm(): Promise<void>;
};

/** ws 소켓 껍데기. GameRoom 에게는 Durable Object 의 WebSocket 으로 보인다(쓰는 기능만 갖췄다). */
class RoomSocket {
	readonly raw: NodeSocket;
	private attachment: unknown = null;

	constructor(raw: NodeSocket) {
		this.raw = raw;
	}

	get readyState(): number {
		return this.raw.readyState;
	}

	send(message: string): void {
		this.raw.send(message);
	}

	close(code?: number, reason?: string): void {
		this.raw.close(code, reason);
	}

	serializeAttachment(value: unknown): void {
		this.attachment = structuredClone(value);
	}

	deserializeAttachment(): unknown {
		return structuredClone(this.attachment);
	}
}

const asWebSocket = (socket: RoomSocket): WebSocket => socket as unknown as WebSocket;

export class NodeRoomState {
	private readonly file: string;
	private snapshot: Snapshot;
	private readonly sockets = new Set<RoomSocket>();
	private handlers: RoomHandlers | null = null;
	private autoResponse: { readonly request: string; readonly response: string } | null = null;
	private ready: Promise<unknown> = Promise.resolve();
	private writes: Promise<void> = Promise.resolve();
	private alarmTimer: ReturnType<typeof setTimeout> | null = null;
	/** 알람을 걸거나 지울 때마다 늘린다. 울린 뒤 지울 때 그사이 새로 건 알람을 지우지 않게. */
	private alarmVersion = 0;

	/** GameRoom 이 ctx.storage 로 쓰는 것 */
	readonly storage = {
		get: async <T>(key: string): Promise<T | undefined> => structuredClone(this.snapshot.values[key]) as T | undefined,
		put: (entries: Readonly<Record<string, unknown>>): Promise<void> => this.write(entries),
		setAlarm: (at: number): Promise<void> => this.setAlarm(at),
		deleteAlarm: (): Promise<void> => this.setAlarm(null),
	};

	private constructor(file: string, snapshot: Snapshot) {
		this.file = file;
		this.snapshot = snapshot;
	}

	static async open(dataDir: string): Promise<NodeRoomState> {
		await mkdir(dataDir, { recursive: true });
		const file = join(dataDir, STATE_FILE);
		return new NodeRoomState(file, await loadSnapshot(file));
	}

	/** new GameRoom(ctx, env) 의 ctx 로 넘긴다 */
	asDurableObjectState(): DurableObjectState {
		return this as unknown as DurableObjectState;
	}

	/** 연결을 GameRoom.accept 로 넘길 모양으로 감싼다 */
	wrap(raw: NodeSocket): WebSocket {
		return asWebSocket(new RoomSocket(raw));
	}

	/** 메시지·닫힘·알람을 받을 GameRoom 을 정한다. 저장돼 있던 알람도 이때 다시 건다. */
	attach(handlers: RoomHandlers): void {
		this.handlers = handlers;
		this.schedule(this.snapshot.alarmAt);
	}

	/** GameRoom 생성자의 blockConcurrencyWhile 이 끝날 때까지 */
	whenReady(): Promise<void> {
		return this.ready.then(() => undefined);
	}

	/** 남은 저장을 다 마친다(끝내기 전에) */
	flush(): Promise<void> {
		return this.writes;
	}

	// ---- 아래는 GameRoom 이 ctx.* 로 부르는 것 ----

	blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
		const result = this.ready.then(callback);
		this.ready = result.catch(() => undefined);
		return result;
	}

	setWebSocketAutoResponse(pair: { readonly request: string; readonly response: string }): void {
		this.autoResponse = pair;
	}

	acceptWebSocket(socket: RoomSocket): void {
		this.sockets.add(socket);
		socket.raw.on("message", (data, isBinary) => this.onMessage(socket, data, isBinary));
		socket.raw.on("close", (code, reason) => {
			this.sockets.delete(socket);
			void this.dispatch((handlers) => handlers.webSocketClose(asWebSocket(socket), code, reason.toString(), code !== 1006));
		});
		socket.raw.on("error", (error) => void this.dispatch((handlers) => handlers.webSocketError(asWebSocket(socket), error)));
	}

	getWebSockets(): WebSocket[] {
		return [...this.sockets].map(asWebSocket);
	}

	// ---- 내부 ----

	private onMessage(socket: RoomSocket, data: RawData, isBinary: boolean): void {
		const bytes = toBuffer(data);
		const message = isBinary ? new Uint8Array(bytes).buffer : bytes.toString("utf8");
		if (this.autoResponse !== null && message === this.autoResponse.request) return socket.send(this.autoResponse.response);
		void this.dispatch((handlers) => handlers.webSocketMessage(asWebSocket(socket), message));
	}

	/** Durable Object 처럼 준비(blockConcurrencyWhile)가 끝난 뒤에 넘긴다. 처리기 오류는 기록만 하고 서버는 계속 돈다. */
	private async dispatch(call: (handlers: RoomHandlers) => Promise<void>): Promise<void> {
		await this.ready;
		if (this.handlers === null) return;
		try {
			await call(this.handlers);
		} catch (error) {
			console.error("[room]", error);
		}
	}

	private write(entries: Readonly<Record<string, unknown>>): Promise<void> {
		this.snapshot = { ...this.snapshot, values: { ...this.snapshot.values, ...structuredClone(entries) } };
		return this.save();
	}

	private setAlarm(at: number | null): Promise<void> {
		this.alarmVersion += 1;
		this.snapshot = { ...this.snapshot, alarmAt: at };
		this.schedule(at);
		return this.save();
	}

	private schedule(at: number | null): void {
		if (this.alarmTimer !== null) clearTimeout(this.alarmTimer);
		this.alarmTimer = null;
		if (at === null || this.handlers === null) return;
		const version = this.alarmVersion;
		this.alarmTimer = setTimeout(() => void this.ring(version), Math.max(0, at - Date.now()));
	}

	/** 알람 처리기가 끝난 뒤 그 알람을 지운다(Durable Object 처럼). 처리기가 새 알람을 걸었으면 그대로 둔다. */
	private async ring(version: number): Promise<void> {
		this.alarmTimer = null;
		await this.dispatch((handlers) => handlers.alarm());
		if (this.alarmVersion !== version) return;
		this.snapshot = { ...this.snapshot, alarmAt: null };
		await this.save().catch(() => undefined);
	}

	/** 지금 상태를 파일에 쓴다. 쓰기는 한 줄로 세워 순서가 뒤바뀌지 않게 하고, 실패하면 그 쓰기를 기다리던 쪽에 알린다. */
	private save(): Promise<void> {
		const next = this.writes.then(() => writeAtomically(this.file, JSON.stringify(this.snapshot)));
		this.writes = next.catch((error: unknown) => console.error("[room] 저장 실패", error));
		return next;
	}
}

function toBuffer(data: RawData): Buffer {
	if (Array.isArray(data)) return Buffer.concat(data);
	return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

async function writeAtomically(file: string, text: string): Promise<void> {
	const temp = `${file}.tmp`;
	const handle = await open(temp, "w");
	try {
		await handle.writeFile(text);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(temp, file);
}

async function loadSnapshot(file: string): Promise<Snapshot> {
	let text: string;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return EMPTY;
		throw error;
	}
	const parsed: unknown = JSON.parse(text);
	if (!isSnapshot(parsed)) throw new Error(`${file} 을(를) 읽을 수 없어요. 다른 곳으로 옮기거나 지운 뒤 다시 켜 주세요.`);
	return parsed;
}

function isSnapshot(value: unknown): value is Snapshot {
	if (typeof value !== "object" || value === null) return false;
	const { values, alarmAt } = value as Record<string, unknown>;
	return typeof values === "object" && values !== null && (alarmAt === null || typeof alarmAt === "number");
}
