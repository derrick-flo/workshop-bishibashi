import type { ClientMessage, ServerMessage } from "../protocol";

export type ConnectionStatus = "online" | "offline" | "refused";

export type Connection = { readonly send: (message: ClientMessage) => boolean };

type Handlers = {
	readonly onOpen: () => void;
	readonly onMessage: (message: ServerMessage) => void;
	readonly onStatus: (status: ConnectionStatus) => void;
};

const PING_MS = 25_000;
/** 이 시간 동안 아무것도 못 받으면 끊긴 걸로 보고 다시 붙는다(폰이 조용히 망을 잃는 경우) */
const STALE_MS = 60_000;
const MAX_RETRY_MS = 4000;

/** 끊기면 알아서 다시 붙는 연결. 화면이 다시 켜지거나 망이 돌아오면 바로 다시 붙는다. */
export function connect(path: string, handlers: Handlers): Connection {
	let socket: WebSocket | null = null;
	let retryMs = 500;
	let lastHeard = Date.now();
	let failedOpens = 0;

	const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`;

	function open(): void {
		if (socket !== null) return;
		const ws = new WebSocket(url);
		socket = ws;
		let opened = false;
		ws.onopen = () => {
			opened = true;
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
			if (socket === ws) socket = null;
			if (!opened) failedOpens += 1;
			// 한 번도 열리지 않고 계속 실패하면 거절(진행자 키가 틀린 경우 등)로 본다
			handlers.onStatus(failedOpens >= 3 ? "refused" : "offline");
			setTimeout(open, retryMs);
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
		};
	}

	setInterval(() => {
		if (socket?.readyState !== WebSocket.OPEN) return;
		if (Date.now() - lastHeard > STALE_MS) return socket.close();
		socket.send("ping");
	}, PING_MS);

	const reopenIfVisible = () => {
		if (document.visibilityState === "visible") open();
	};
	document.addEventListener("visibilitychange", reopenIfVisible);
	window.addEventListener("online", reopenIfVisible);
	open();

	return {
		send(message) {
			if (socket?.readyState !== WebSocket.OPEN) return false;
			socket.send(JSON.stringify(message));
			return true;
		},
	};
}
