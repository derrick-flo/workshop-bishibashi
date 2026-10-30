import { describe, expect, it } from "vitest";
import { bracketHtml } from "../../src/client/bracket";
import { drawBracket } from "../../src/domain/tournament";

/** 섞지 않는 난수(명단 순서대로 시드가 붙는다) */
const inOrder = () => 0.999999;

const view = { nameOf: (id: string) => id.toUpperCase(), now: null };

/** 칸(회전)마다 [회전 이름, 그 칸에 적힌 자리 글자들] */
function columns(html: string): readonly (readonly [string, readonly string[]])[] {
	return html
		.split('<div class="ax-bk__round">')
		.slice(1)
		.map((column) => {
			const name = /ax-bk__round-name">([^<]*)</.exec(column)?.[1] ?? "";
			const slots = [...column.matchAll(/class="ax-bk__slot[^"]*">([^<]*)</g)].map((found) => found[1] ?? "");
			return [name, slots] as const;
		});
}

describe("bracketHtml", () => {
	it("두 명이면 결승 한 칸뿐이다", () => {
		const html = bracketHtml(drawBracket(["a", "b"], inOrder), [], view);
		expect(columns(html)).toEqual([["결승", ["A", "B"]]]);
		expect(html).toContain("--bk-per:1;--bk-cols:1");
	});

	it("반으로 갈라 양쪽 1회전에서 가운데 결승으로 모인다(부전승 포함)", () => {
		// 5명 8자리: [a, 빈, d, e, b, 빈, c, 빈]
		const html = bracketHtml(drawBracket(["a", "b", "c", "d", "e"], inOrder), [], view);
		expect(columns(html)).toEqual([
			["8강", ["A", "부전승", "D", "E"]],
			["준결승", ["A", "?"]],
			["결승", ["?", "?"]],
			["준결승", ["B", "C"]],
			["8강", ["B", "부전승", "C", "부전승"]],
		]);
		// 한 칸에 쌓이는 경기는 1회전 한쪽 절반(2경기), 칸은 회전 수 × 2 - 1
		expect(html).toContain("--bk-per:2;--bk-cols:5");
	});

	it("32자리면 한쪽에 8경기씩, 9칸이다", () => {
		const ids = Array.from({ length: 29 }, (_, i) => `p${i}`);
		const html = bracketHtml(drawBracket(ids, inOrder), [], view);
		expect(columns(html).map(([name]) => name)).toEqual(["32강", "16강", "8강", "준결승", "결승", "준결승", "8강", "16강", "32강"]);
		expect(html).toContain("--bk-per:8;--bk-cols:9");
	});

	it("이름은 HTML로 해석되지 않게 바꿔 넣는다", () => {
		const html = bracketHtml(drawBracket(["a", "b"], inOrder), [], { nameOf: () => "<b>&", now: null });
		expect(html).toContain("&lt;b&gt;&amp;");
		expect(html).not.toContain("<b>&");
	});
});
