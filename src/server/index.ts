import { ROLE_HEADER } from "./room";
import { isHostKey } from "./secrets";

export { GameRoom } from "./room";

/**
 * 화면(index.html, host.html)은 정적 파일로 나가고, 여기는 /ws 연결만 받는다.
 * 진행자 화면은 /ws?role=host&key=... 로 붙고, 키가 맞을 때만 진행자 권한을 준다.
 */
export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
		if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });

		const wantsHost = url.searchParams.get("role") === "host";
		if (wantsHost && !(await isHostKey(url.searchParams.get("key"), env.HOST_KEY))) {
			return new Response("Forbidden", { status: 403 });
		}
		const headers = new Headers(request.headers);
		headers.set(ROLE_HEADER, wantsHost ? "host" : "player");
		const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName("main"));
		return room.fetch(new Request(`${url.origin}/ws`, { headers }));
	},
} satisfies ExportedHandler<Env>;
