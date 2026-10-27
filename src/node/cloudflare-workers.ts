/**
 * Node 로 빌드할 때 "cloudflare:workers" 대신 묶는 모듈(package.json build:node 의 alias).
 * GameRoom(src/server/room.ts)이 Workers 런타임에서 가져다 쓰는 것만 둔다.
 */

/** Durable Object 밑 클래스. GameRoom 은 this.ctx 만 쓴다. */
export class DurableObject<E = unknown> {
	protected readonly ctx: unknown;
	protected readonly env: E;

	constructor(ctx: unknown, env: E) {
		this.ctx = ctx;
		this.env = env;
	}
}

/** 자동 응답 짝(ping → pong). Workers 에서는 전역이라 전역에 둔다. */
class WebSocketRequestResponsePair {
	readonly request: string;
	readonly response: string;

	constructor(request: string, response: string) {
		this.request = request;
		this.response = response;
	}
}

Object.assign(globalThis, { WebSocketRequestResponsePair });
