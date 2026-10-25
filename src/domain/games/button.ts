/** 폰 아래쪽 컨트롤러: 빨강·초록·파랑 세 버튼과 그 아래 FINISH 버튼 */
export type Button = "red" | "green" | "blue" | "finish";

export const BUTTONS: readonly Button[] = ["red", "green", "blue", "finish"];

/** 게임 시작 뒤 경과 시간(ms)이 제한 시간 안인지 */
export function isWithin(t: number, durationMs: number): boolean {
	return t >= 0 && t <= durationMs;
}
