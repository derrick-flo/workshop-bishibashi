import { defineConfig } from "vitest/config";

// 게임 규칙(src/domain)과 메시지 해석(src/protocol.ts)은 순수 함수라 Node 환경에서 바로 테스트한다.
export default defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
	},
});
