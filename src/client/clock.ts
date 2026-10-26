/** 표본을 이만큼만 기억한다(폰 시계가 조금씩 어긋나도 따라가게) */
const KEEP = 12;

export type ServerClock = {
	/** 서버가 보낸 시각을 받은 순간에 부른다 */
	sample(serverNow: number): void;
	/** 서버 시계 - 폰 시계(ms) */
	offset(): number;
	/** 서버 시계 기준 지금 */
	now(): number;
};

/**
 * 폰과 서버의 시계 차이를 추정한다. 메시지는 늦게 도착할 수만 있어서(빨리 올 수는 없다)
 * 받은 순간 계산한 차이는 실제보다 작게만 나온다. 그래서 최근 표본 중 가장 큰 값이 실제에 가장 가깝다.
 * 모든 폰이 같은 순간에 '시작!'을 보게 하는 데 쓴다(점수는 폰 안에서 재서 이 값과 상관없다).
 */
export function createServerClock(localNow: () => number = Date.now): ServerClock {
	let samples: readonly number[] = [];
	const offset = () => (samples.length === 0 ? 0 : Math.max(...samples));
	return {
		sample(serverNow) {
			samples = [...samples, serverNow - localNow()].slice(-KEEP);
		},
		offset,
		now: () => localNow() + offset(),
	};
}
