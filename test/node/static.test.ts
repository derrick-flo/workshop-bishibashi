import { describe, expect, it } from "vitest";
import { assetPath, withoutTrailingSlash } from "../../src/node/static";

describe("Node 서버의 정적 파일 주소", () => {
	it.each([
		["/", "index.html"],
		["/host", "host.html"],
		["/styles.css", "styles.css"],
		["/js/player.js", "js/player.js"],
		["/fonts/Galmuri11-Bold.woff2", "fonts/Galmuri11-Bold.woff2"],
	])("%s → %s", (pathname, file) => {
		expect(assetPath(pathname)).toBe(file);
	});

	it.each(["/../package.json", "/%2e%2e/package.json", "/js/%2e%2e%2f%2e%2e%2fpackage.json", "/.assetsignore", "/%E0%A4%A", "/a\\b"])(
		"public 밖이나 숨김 파일(%s)은 내주지 않는다",
		(pathname) => {
			expect(assetPath(pathname)).toBeNull();
		},
	);

	it("끝에 / 를 붙인 화면 주소는 상대 주소로 / 없는 주소에 보낸다(하위 경로 아래에서도 맞게)", () => {
		expect(withoutTrailingSlash("/host/", "")).toBe("../host");
		expect(withoutTrailingSlash("/host/", "?key=abc")).toBe("../host?key=abc");
		expect(withoutTrailingSlash("/", "")).toBeNull();
		expect(withoutTrailingSlash("//", "")).toBeNull();
		expect(withoutTrailingSlash("/host", "")).toBeNull();
	});
});
