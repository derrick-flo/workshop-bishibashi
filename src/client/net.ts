import type { ClientMessage, ServerMessage } from "../protocol";

export type ConnectionStatus = "online" | "offline" | "refused";

export type Connection = {
	readonly send: (message: ClientMessage) => boolean;
	/** 지금 연결을 버리고 바로 다시 붙는다(기록을 보냈는데 답이 없을 때) */
	readonly reconnect: () => void;
};

type Handlers = {
	readonly onOpen: () => void;
	readonly onMessage: (message: ServerMessage) => void;
	readonly onStatus: (status: ConnectionStatus) => void;
};

/** ping은 서버가 Durable Object를 깨우지 않고 답해서 요금이 안 든다. 자주 보내 끊김을 빨리 알아챈다. */
const PING_MS = 10_000;
/** 이 시간 동안 아무것도 못 받으면 끊긴 걸로 보고 다시 붙는다(폰이 조용히 망을 잃는 경우) */
const STALE_MS = 25_000;
/** 연결을 여는 데 이보다 오래 걸리면 포기하고 새로 연다 */
const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RETRY_MS = 4000;

/** 끊기면 알아서 다시 붙는 연결. 화면이 다시 켜지거나 망이 돌아오면 바로 다시 붙는다. */
export function connect(path: string, handlers: Handlers): Connection {
	let socket: WebSocket | null = null;
	let connectingSince = 0;
	let retryMs = 500;
	let retryTimer = 0;
	let lastHeard = Date.now();
	let failedOpens = 0;
	/** 한 번이라도 열렸으면 그 뒤의 실패는 망 문제다(진행자 키가 틀려서 거절된 것과 구분한다) */
	let everOpened = false;

	// 페이지 주소 기준 상대 경로라, 하위 경로(예: /bishibashi/)에 올려도 그 아래 ws 로 붙는다
	const url = new URL(path, location.href.replace(/^http/, "ws"));

	function scheduleOpen(): void {
		clearTimeout(retryTimer);
		retryTimer = window.setTimeout(open, retryMs);
		retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
	}

	function open(): void {
		if (socket !== null) return;
		clearTimeout(retryTimer);
		const ws = new WebSocket(url);
		socket = ws;
		connectingSince = Date.now();
		let opened = false;
		ws.onopen = () => {
			opened = true;
			everOpened = true;
			failedOpens = 0;
			retryMs = 500;
			lastHeard = Date.now();
			handlers.onStatus("online");
			handlers.onOpen();
		};
		ws.onmessage = (event) => {
			lastHeard = Date.now();
			if (typeof event.data !== "string" || event.data === "pong") return;
			try {
				handlers.onMessage(JSON.parse(event.data) as ServerMessage);
			} catch {
				// 깨진 메시지는 버린다
			}
		};
		ws.onclose = () => {
			if (socket !== ws) return;
			socket = null;
			if (!opened) failedOpens += 1;
			// 한 번도 열린 적 없이 계속 실패하면 거절(진행자 키가 틀린 경우 등)로 본다
			handlers.onStatus(!everOpened && failedOpens >= 3 ? "refused" : "offline");
			scheduleOpen();
		};
	}

	/**
	 * 지금 연결을 버리고 바로 새로 붙는다. 조용히 죽은 연결은 close 이벤트가 최대 1분 뒤에야 오므로
	 * 기다리지 않고 핸들러를 떼어 낸 뒤 새 연결을 연다.
	 */
	function replace(): void {
		const old = socket;
		socket = null;
		if (old !== null) {
			old.onopen = null;
			old.onmessage = null;
			old.onclose = null;
			try {
				old.close();
			} catch {
				// 이미 닫힌 연결
			}
		}
		handlers.onStatus("offline");
		retryMs = 500;
		open();
	}

	setInterval(() => {
		if (socket?.readyState === WebSocket.CONNECTING && Date.now() - connectingSince > CONNECT_TIMEOUT_MS) return replace();
		if (socket?.readyState !== WebSocket.OPEN) return;
		if (Date.now() - lastHeard > STALE_MS) return replace();
		socket.send("ping");
	}, PING_MS);

	const wake = () => {
		if (document.visibilityState !== "visible") return;
		// 화면이 꺼진 사이 연결이 조용히 죽었을 수 있다. 한동안 아무것도 못 들었으면 새로 붙는다.
		if (socket !== null && Date.now() - lastHeard > PING_MS * 2) return replace();
		open();
	};
	document.addEventListener("visibilitychange", wake);
	window.addEventListener("online", wake);
	open();

	return {
		send(message) {
			if (socket?.readyState !== WebSocket.OPEN) return false;
			socket.send(JSON.stringify(message));
			return true;
		},
		reconnect: replace,
	};
}
