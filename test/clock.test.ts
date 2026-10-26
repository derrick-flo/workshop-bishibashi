import { describe, expect, it } from "vitest";
import { createServerClock } from "../src/client/clock";

describe("createServerClock", () => {
	it("표본이 없으면 폰 시계를 그대로 쓴다", () => {
		const clock = createServerClock(() => 1000);
		expect(clock.offset()).toBe(0);
		expect(clock.now()).toBe(1000);
	});

	it("늦게 도착한 메시지는 무시하고 가장 덜 늦은 표본을 쓴다", () => {
		let local = 0;
		const clock = createServerClock(() => local);
		// 서버 시계가 폰보다 5000ms 빠르다. 전달에 각각 300, 40, 900ms 걸렸다.
		for (const [sentAt, delay] of [
			[10_000, 300],
			[11_000, 40],
			[12_000, 900],
		] as const) {
			local = sentAt - 5000 + delay;
			clock.sample(sentAt);
		}
		expect(clock.offset()).toBe(5000 - 40);
		local = 20_000;
		expect(clock.now()).toBe(20_000 + 4960);
	});

	it("오래된 표본은 잊는다", () => {
		let local = 0;
		const clock = createServerClock(() => local);
		local = 0;
		clock.sample(9000);
		for (let i = 1; i <= 12; i++) {
			local = i * 1000;
			clock.sample(i * 1000 + 100);
		}
		expect(clock.offset()).toBe(100);
	});
});
