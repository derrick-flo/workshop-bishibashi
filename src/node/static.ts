import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { pipeline } from "node:stream";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".woff2": "font/woff2",
	".svg": "image/svg+xml",
	".png": "image/png",
};

type FileInfo = { readonly path: string; readonly size: number; readonly mtimeMs: number };

/**
 * 주소 경로 → public 안의 파일 경로. Cloudflare 정적 파일처럼 / 는 index.html, /host 는 host.html.
 * 점(.)으로 시작하는 조각(숨김 파일, ..)이 있거나 잘못 인코딩된 주소는 null.
 */
export function assetPath(pathname: string): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	const segments = decoded.split("/").filter((segment) => segment !== "");
	if (segments.some((segment) => segment.startsWith(".") || segment.includes("\\") || segment.includes("\0"))) return null;
	const relative = segments.join("/");
	if (relative === "") return "index.html";
	return extname(relative) === "" ? `${relative}.html` : relative;
}

/** public 폴더의 파일을 내려준다. 파일 이름에 해시가 없으니 매번 다시 확인하게 하고(no-cache), 같으면 304. */
export async function serveStatic(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
	if (request.method !== "GET" && request.method !== "HEAD") return reply(response, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
	const { pathname } = new URL(request.url ?? "/", "http://localhost");
	if (pathname === "/ws") return reply(response, 426, "WebSocket only");
	const relative = assetPath(pathname);
	const file = relative === null ? null : await fileAt(join(root, relative));
	if (file === null) return reply(response, 404, "Not found");

	const etag = `W/"${file.size.toString(16)}-${Math.trunc(file.mtimeMs).toString(16)}"`;
	const headers = { "Cache-Control": "no-cache", ETag: etag };
	if (request.headers["if-none-match"] === etag) {
		response.writeHead(304, headers);
		response.end();
		return;
	}
	response.writeHead(200, { ...headers, "Content-Type": CONTENT_TYPES[extname(file.path)] ?? "application/octet-stream", "Content-Length": file.size });
	if (request.method === "HEAD") {
		response.end();
		return;
	}
	// 받는 쪽이 끊으면 pipeline 이 둘 다 닫는다
	pipeline(createReadStream(file.path), response, () => undefined);
}

async function fileAt(path: string): Promise<FileInfo | null> {
	try {
		const info = await stat(path);
		return info.isFile() ? { path, size: info.size, mtimeMs: info.mtimeMs } : null;
	} catch {
		return null;
	}
}

function reply(response: ServerResponse, status: number, text: string, headers: Readonly<Record<string, string>> = {}): void {
	response.writeHead(status, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
	response.end(text);
}
