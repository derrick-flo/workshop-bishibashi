/**
 * 혼자 하는 도전 페이지(반응속도·10초 맞추기·원 그리기)가 같이 쓰는 도전 기록.
 * 이 탭에서 한 도전만 담는다. 새로고침하면 사라진다(어디에도 저장하지 않는다).
 */
export type Attempt = {
	/** 몇 번째 도전인지. 1부터 */
	readonly no: number;
	readonly passed: boolean;
	/** 기록판에 보이는 글자("213ms", "10.23초", "96.4%", "반칙") */
	readonly record: string;
};

export function addAttempt(list: readonly Attempt[], passed: boolean, record: string): readonly Attempt[] {
	return [...list, { no: list.length + 1, passed, record }];
}

export function passCount(list: readonly Attempt[]): number {
	return list.filter((attempt) => attempt.passed).length;
}
