const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

async function sha256(text: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/** 폰이 보관하는 입장 토큰(128비트) */
export function newToken(): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/** 토큰은 원문 대신 이 해시로만 저장한다 */
export async function hashToken(token: string): Promise<string> {
	return [...(await sha256(token))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 진행자 키 비교. 해시끼리 끝까지 비교해서 일치 길이로 키를 추측할 수 없게 한다. 키가 없으면 항상 거절. */
export async function isHostKey(given: string | null, expected: string | undefined): Promise<boolean> {
	if (given === null || expected === undefined || expected.length === 0) return false;
	const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
	return a.reduce((diff, byte, i) => diff | (byte ^ (b[i] ?? 0)), 0) === 0;
}
