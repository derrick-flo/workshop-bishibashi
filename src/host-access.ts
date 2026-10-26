/**
 * 진행자 키가 필요한 주소인지. 서버(문지기)와 진행자 화면(키 입력 칸을 먼저 띄울지)이 같이 쓴다.
 * 내 컴퓨터(localhost, 127.x)나 사내망(10.x, 172.16~31.x, 192.168.x) 주소로 연 테스트 서버는 키 없이 들어간다.
 * 배포한 주소(*.workers.dev)는 늘 키가 필요하다. Cloudflare는 등록된 도메인으로 온 요청만 Worker에 넘기므로
 * 배포한 서버에 이런 주소로 요청이 들어오지는 않는다.
 * hostname은 URL이 정리해 준 값(new URL(...).hostname, location.hostname)을 넣는다.
 */
export function needsHostKey(hostname: string): boolean {
	return !isLocalAddress(hostname);
}

function isLocalAddress(hostname: string): boolean {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(hostname);
	if (ipv4 === null) return false;
	const first = Number(ipv4[1]);
	const second = Number(ipv4[2]);
	return first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
