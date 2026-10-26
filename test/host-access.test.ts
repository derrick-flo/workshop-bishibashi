import { describe, expect, it } from "vitest";
import { needsHostKey } from "../src/host-access";

describe("진행자 키가 필요한 주소", () => {
	it.each(["localhost", "127.0.0.1", "[::1]", "10.0.0.12", "172.16.0.1", "172.31.255.255", "192.168.0.12"])(
		"내 컴퓨터·사내망 주소(%s)로 연 테스트 서버는 키 없이 들어간다",
		(hostname) => {
			expect(needsHostKey(hostname)).toBe(false);
		},
	);

	it.each([
		"workshop-bishibashi.example.workers.dev",
		"example.com",
		"8.8.8.8",
		"11.0.0.1",
		"172.15.0.1",
		"172.32.0.1",
		"192.169.0.1",
		"10.0.0.1.nip.io",
		"localhost.example.com",
	])("배포한 주소와 그 밖의 주소(%s)는 키가 필요하다", (hostname) => {
		expect(needsHostKey(hostname)).toBe(true);
	});
});
