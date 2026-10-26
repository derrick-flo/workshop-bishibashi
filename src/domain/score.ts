/**
 * 폰이 계산한 점수를 서버가 받는 모양(0 이상 maxScore 이하 정수)으로 맞춘다.
 * 버튼 누른 시각이 소수라 점수에 소수가 섞이면 서버가 기록을 거절해 그 사람이 '기록 없음'이 되기 때문이다.
 */
export function submittableScore(raw: number, maxScore: number): number {
	if (!Number.isFinite(raw)) return 0;
	return Math.min(maxScore, Math.max(0, Math.floor(raw)));
}
