import { describe, expect, it } from "vitest";
import {
	blank,
	blit,
	colorAt,
	dither,
	flipX,
	line,
	outline,
	paint,
	rect,
	recolor,
	rotate90,
	scale,
} from "../src/client/pixel/bitmap";
import { BIG, type Font, SMALL, text, textWidth } from "../src/client/pixel/font";
import { C, CLEAR, HEX } from "../src/client/pixel/palette";
import { drawParticles, shatter, sparkle, stepParticles } from "../src/client/pixel/particles";
import { disc, ring } from "../src/client/pixel/shapes";
import { frames, sprite } from "../src/client/pixel/sprite";
import { toSvg } from "../src/client/pixel/svg";

/** 비트맵을 다시 글자 격자로(검사용) */
function rows(b: ReturnType<typeof blank>): string[] {
	const keys = Object.fromEntries(Object.entries(C).map(([key, index]) => [index, key]));
	return Array.from({ length: b.h }, (_, y) => Array.from({ length: b.w }, (_, x) => keys[colorAt(b, x, y)] ?? ".").join(""));
}

const L_SHAPE = ["r..", "rr.", "rrb"];

describe("sprite", () => {
	it("글자 격자를 팔레트 번호 그림으로 바꾼다", () => {
		const b = sprite(L_SHAPE);
		expect([b.w, b.h]).toEqual([3, 3]);
		expect(colorAt(b, 0, 0)).toBe(C.r);
		expect(colorAt(b, 1, 0)).toBe(CLEAR);
		expect(rows(b)).toEqual(L_SHAPE);
	});

	it("줄 길이가 다르거나 모르는 색 글자가 있으면 오류", () => {
		expect(() => sprite(["rr", "r"])).toThrow("길이");
		expect(() => sprite(["rZ"])).toThrow("모르는 색");
	});

	it("애니메이션 프레임 크기가 다르면 오류", () => {
		expect(() => frames([["rr"], ["rrr"]])).toThrow("크기");
	});

	it("팔레트 글자는 모두 다른 색이다", () => {
		expect(new Set(HEX).size).toBe(HEX.length);
	});
});

describe("그림 바꾸기", () => {
	it("좌우를 뒤집는다", () => {
		expect(rows(flipX(sprite(L_SHAPE)))).toEqual(["..r", ".rr", "brr"]);
	});

	it("시계 방향으로 돌리고, 네 번 돌리면 원래대로", () => {
		const b = sprite(L_SHAPE);
		expect(rows(rotate90(b))).toEqual(["rrr", "rr.", "b.."]);
		expect(rows(rotate90(rotate90(rotate90(rotate90(b)))))).toEqual(L_SHAPE);
	});

	it("색을 바꾼다", () => {
		expect(rows(recolor(sprite(L_SHAPE), { [C.r]: C.g }))).toEqual(["g..", "gg.", "ggb"]);
	});

	it("외곽선을 두르면 사방으로 한 칸 커진다", () => {
		expect(rows(outline(sprite(["r"]), C.k))).toEqual([".k.", "krk", ".k."]);
	});

	it("정수 배로 키운다", () => {
		expect(rows(scale(sprite(["rb"]), 2))).toEqual(["rrbb", "rrbb"]);
	});
});

describe("화면 버퍼에 그리기", () => {
	it("투명한 칸은 건너뛰고 화면 밖은 잘라낸다", () => {
		const fb = paint(4, 3, () => C.n);
		blit(fb, sprite(L_SHAPE), 2, 1);
		expect(rows(fb)).toEqual(["nnnn", "nnrn", "nnrr"]);
		blit(fb, sprite(["yy"]), -1, 0);
		expect(rows(fb)[0]).toBe("ynnn");
	});

	it("사각형과 직선", () => {
		const fb = blank(5, 5);
		rect(fb, 1, 1, 3, 2, C.g);
		line(fb, 0, 4, 4, 4, C.b);
		expect(rows(fb)).toEqual([".....", ".ggg.", ".ggg.", ".....", "bbbbb"]);
	});

	it("바이엘 무늬는 단계만큼 두 번째 색이 섞인다", () => {
		const count = (level: 0 | 1 | 2 | 3 | 4) => {
			const fb = blank(4, 4);
			dither(fb, 0, 0, 4, 4, C.n, C.N, level);
			return [...fb.px].filter((c) => c === C.N).length;
		};
		expect([0, 1, 2, 3, 4].map((level) => count(level as 0 | 1 | 2 | 3 | 4))).toEqual([0, 4, 8, 12, 16]);
	});
});

describe("도형", () => {
	it("동그라미는 위아래·좌우 대칭이다", () => {
		const b = disc(9, C.r);
		expect(rows(b)).toEqual(rows(flipX(b)));
		expect(rows(b)).toEqual(rows(rotate90(b)));
	});

	it("고리는 가운데가 비어 있다", () => {
		const b = ring(12, 3, C.k);
		expect(colorAt(b, 6, 6)).toBe(CLEAR);
		expect(colorAt(b, 6, 1)).toBe(C.k);
	});
});

describe("글꼴", () => {
	const check = (font: Font) => {
		for (const [char, glyph] of Object.entries(font.glyphs)) {
			expect(glyph, `글자 "${char}"`).toHaveLength(font.height);
			const width = glyph[0]?.length ?? 0;
			for (const row of glyph) {
				expect(row, `글자 "${char}"`).toMatch(/^[#.]+$/);
				expect(row.length, `글자 "${char}"`).toBe(width);
			}
		}
	};

	it("모든 글자는 높이가 같고 줄 길이가 고르다", () => {
		check(BIG);
		check(SMALL);
	});

	it("큰 글꼴은 대문자 A~Z와 숫자를 모두 갖는다", () => {
		for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") expect(BIG.glyphs[char], char).toBeDefined();
	});

	it("숫자는 폭이 같아서 바뀌어도 자리가 흔들리지 않는다", () => {
		const widths = new Set([..."0123456789"].map((char) => BIG.glyphs[char]?.[0]?.length));
		expect(widths.size).toBe(1);
		const small = new Set([..."0123456789"].map((char) => SMALL.glyphs[char]?.[0]?.length));
		expect(small.size).toBe(1);
	});

	it("글자 폭은 글자들과 사이 빈칸을 더한 값", () => {
		expect(textWidth(BIG, "GO!")).toBe(6 + 1 + 6 + 1 + 2);
		const b = text(BIG, "1", C.y);
		expect(rows(b)[0]).toBe("..yy..");
	});

	it("모르는 글자는 ?로 그린다", () => {
		expect(rows(text(SMALL, "가", C.w))).toEqual(rows(text(SMALL, "?", C.w)));
	});
});

describe("SVG", () => {
	it("같은 줄에서 이어진 같은 색은 사각형 하나로 묶는다", () => {
		const svg = toSvg(sprite(["rrb", "..b"]));
		expect(svg).toContain('viewBox="0 0 3 2"');
		expect(svg).toContain(`<path fill="${HEX[C.r]}" d="M0 0h2v1h-2z"/>`);
		expect(svg).toContain(`<path fill="${HEX[C.b]}" d="M2 0h1v1h-1zM2 1h1v1h-1z"/>`);
	});
});

describe("파편", () => {
	const random = (() => {
		let seed = 1;
		return () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
	})();

	it("수명이 다한 점은 사라지고 남은 점은 움직인다", () => {
		const moved = stepParticles([{ x: 0, y: 0, vx: 10, vy: 0, color: C.r, life: 500, gravity: 0 }], 100);
		expect(moved).toEqual([{ x: 1, y: 0, vx: 10, vy: 0, color: C.r, life: 400, gravity: 0 }]);
		expect(stepParticles(moved, 400)).toEqual([]);
	});

	it("부순 그림의 점은 원래 그림의 색만 쓴다", () => {
		const parts = shatter(sprite(["rrr", "rbr"]), 10, 10, random, 50, 800, 1);
		expect(parts).toHaveLength(6);
		expect(new Set(parts.map((p) => p.color))).toEqual(new Set([C.r, C.b]));
	});

	it("반짝이는 정한 개수만큼 생기고 버퍼 밖으로 나가도 그리기가 안전하다", () => {
		const parts = sparkle(2, 2, [C.y, C.w], random, 8);
		expect(parts).toHaveLength(8);
		const fb = blank(4, 4);
		drawParticles(fb, stepParticles(parts, 300));
		expect(fb.px.length).toBe(16);
	});
});
