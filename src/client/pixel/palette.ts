/**
 * 픽셀 그림에 쓰는 색. 스프라이트 글자 하나가 색 하나다('.'은 투명).
 * 빨강·초록·파랑은 폰 버튼 색과 같은 값이라 arcade.css 와 맞춰 둔다.
 */
const ENTRIES = [
	["k", "#0b0920"], // 먹색(외곽선)
	["n", "#1b1740"], // 밤하늘
	["N", "#2a2466"], // 밤하늘 밝은 쪽
	["v", "#3b3486"], // 보라 그림자
	["m", "#6a5fc1"], // 연보라
	["A", "#5b5778"], // 진회색
	["a", "#9a96b8"], // 회색
	["W", "#d8d3f5"], // 연한 흰색
	["w", "#ffffff"], // 흰색
	["R", "#9c2219"], // 진빨강
	["r", "#e63b2e"], // 빨강
	["p", "#ff8a7a"], // 분홍(빨강 밝은 쪽)
	["O", "#b85a12"], // 진주황
	["o", "#ff9b3d"], // 주황
	["Y", "#b8860b"], // 황토
	["y", "#ffd23f"], // 노랑
	["G", "#127a40"], // 진초록
	["g", "#2bc06a"], // 초록
	["l", "#a8ff7a"], // 연두
	["B", "#173c8f"], // 진파랑
	["b", "#2f6fe0"], // 파랑
	["c", "#7fd0ff"], // 하늘
	["S", "#c4825c"], // 진살구
	["s", "#f3c39a"], // 살구(피부)
	["T", "#4f2e19"], // 진갈색
	["t", "#8a5532"], // 갈색
] as const;

export type ColorKey = (typeof ENTRIES)[number][0];

/** 투명. 팔레트 번호 0은 아무것도 그리지 않는다. */
export const CLEAR = 0;

/** 글자 → 팔레트 번호(1부터) */
export const C: Readonly<Record<ColorKey, number>> = Object.fromEntries(ENTRIES.map(([key], i) => [key, i + 1])) as Record<ColorKey, number>;

/** 팔레트 번호 → 색 코드. 0번은 투명 */
export const HEX: readonly string[] = ["transparent", ...ENTRIES.map(([, hex]) => hex)];

export function isColorKey(value: string): value is ColorKey {
	// Object.hasOwn은 iOS 15.4 미만에 없다
	return Object.prototype.hasOwnProperty.call(C, value);
}
