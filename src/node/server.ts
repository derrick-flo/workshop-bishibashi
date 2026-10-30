import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { needsHostKey } from "../host-access";
import { GameRoom, roleFrom } from "../server/room";
import { isHostKey } from "../server/secrets";
import { NodeRoomState } from "./room-state";
import { serveStatic } from "./static";

/**
 * Docker·Node 로 띄우는 서버. Cloudflare 에서 Worker(src/server/index.ts)와 Durable Object 가 하던 일을 한 프로세스가 한다.
 * - 정적 파일: public/ (빌드한 public/js, public/fonts 포함)
 * - /ws: Worker 와 같은 규칙으로 진행자 키를 확인하고 GameRoom 하나에 넘긴다.
 * 환경변수: PORT(기본 8787), DATA_DIR(기본 data), HOST_KEY(없으면 내 컴퓨터·사내망 주소에서만 진행자 화면이 열린다)
 */

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? "data";
const HOST_KEY = process.env.HOST_KEY;
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url).href);
/** Cloudflare 가 WebSocket 메시지 하나에 허용하는 크기와 같게 */
const MAX_MESSAGE_BYTES = 1024 * 1024;

const state = await NodeRoomState.open(DATA_DIR);
// GameRoom 은 env 를 쓰지 않는다(진행자 키는 아래 upgrade 에서 확인한다)
const room = new GameRoom(state.asDurableObjectState(), {} as Env);
state.attach(room);
await state.whenReady();

const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

const server = createServer((request, response) => {
	serveStatic(PUBLIC_DIR, request, response).catch((error: unknown) => {
		console.error("[http]", error);
		if (!response.headersSent) response.writeHead(500);
		response.end();
	});
});

server.on("upgrade", (request, socket, head) => {
	upgrade(request, socket, head).catch((error: unknown) => {
		console.error("[ws]", error);
		socket.destroy();
	});
});

/**
 * /ws?role=host 는 키가 맞을 때만(내 컴퓨터·사내망 주소면 키 없이) 진행자로 붙인다. src/server/index.ts 와 같은 규칙.
 * /ws?role=arena 는 보기만 하는 관전 화면이라 키 없이 붙는다.
 */
async function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
	const host = request.headers.host;
	if (host === undefined) return refuse(socket, 400, "Bad Request");
	const url = new URL(request.url ?? "/", `http://${host}`);
	if (url.pathname !== "/ws") return refuse(socket, 404, "Not Found");
	const role = roleFrom(url.searchParams.get("role"));
	if (role === "host" && needsHostKey(url.hostname) && !(await isHostKey(url.searchParams.get("key"), HOST_KEY))) {
		return refuse(socket, 403, "Forbidden");
	}
	sockets.handleUpgrade(request, socket, head, (ws) => room.accept(state.wrap(ws), role));
}

function refuse(socket: Duplex, status: number, text: string): void {
	socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

server.listen(PORT, () => {
	const key = HOST_KEY ? "있음" : "없음(내 컴퓨터·사내망 주소에서만 진행)";
	console.log(`[bishibashi] :${PORT} 에서 기다려요 · 저장 ${DATA_DIR} · 진행자 키 ${key}`);
});

// docker stop: 연결을 닫고(폰은 알아서 다시 붙는다) 남은 저장을 마친 뒤 끝낸다
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		console.log(`[bishibashi] ${signal} — 저장을 마치고 끝내요`);
		server.close();
		for (const client of sockets.clients) client.close(1001, "restart");
		void state.flush().finally(() => process.exit(0));
	});
}
