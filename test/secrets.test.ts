import { describe, expect, it } from "vitest";
import { hashToken, isHostKey, newToken } from "../src/server/secrets";

describe("입장 토큰", () => {
	it("매번 다른 토큰을 만든다", () => {
		const tokens = new Set(Array.from({ length: 50 }, () => newToken()));
		expect(tokens.size).toBe(50);
		expect([...tokens].every((token) => /^[A-Za-z0-9_-]{22}$/.test(token))).toBe(true);
	});

	it("토큰은 그대로 저장하지 않고 SHA-256 해시로 바꿔 저장한다", async () => {
		expect(await hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
		expect(await hashToken("abd")).not.toBe(await hashToken("abc"));
	});
});

describe("진행자 키", () => {
	it("등록된 키와 같을 때만 통과한다", async () => {
		expect(await isHostKey("open-sesame", "open-sesame")).toBe(true);
		expect(await isHostKey("open-sesamE", "open-sesame")).toBe(false);
		expect(await isHostKey(null, "open-sesame")).toBe(false);
	});

	it("키가 등록돼 있지 않으면 아무도 진행자가 될 수 없다", async () => {
		expect(await isHostKey("", "")).toBe(false);
		expect(await isHostKey("anything", undefined)).toBe(false);
	});
});
