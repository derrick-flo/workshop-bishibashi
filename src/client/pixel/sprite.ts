import { type Bitmap, paint } from "./bitmap";
import { C, CLEAR, isColorKey } from "./palette";

/**
 * 글자 격자로 스프라이트를 만든다. 한 글자가 한 칸이고 '.'은 투명, 나머지는 palette.ts 의 색 글자.
 * 줄 길이가 다르거나 모르는 글자가 있으면 바로 오류를 낸다(테스트에서 모든 스프라이트를 불러 확인한다).
 */
export function sprite(rows: readonly string[]): Bitmap {
	const width = rows[0]?.length ?? 0;
	rows.forEach((row, y) => {
		if (row.length !== width) throw new Error(`스프라이트 ${y}번째 줄 길이가 ${row.length}칸이에요(${width}칸이어야 해요): "${row}"`);
		for (const char of row) {
			if (char !== "." && !isColorKey(char)) throw new Error(`스프라이트에 모르는 색 글자 "${char}"가 있어요: "${row}"`);
		}
	});
	return paint(width, rows.length, (x, y) => {
		const char = rows[y]?.[x] ?? ".";
		return char !== "." && isColorKey(char) ? C[char] : CLEAR;
	});
}

/** 여러 프레임. 프레임마다 크기가 같아야 한다. */
export function frames(list: readonly (readonly string[])[]): readonly Bitmap[] {
	const bitmaps = list.map(sprite);
	const first = bitmaps[0];
	if (first !== undefined && bitmaps.some((b) => b.w !== first.w || b.h !== first.h)) {
		throw new Error("애니메이션 프레임 크기가 서로 달라요");
	}
	return bitmaps;
}
