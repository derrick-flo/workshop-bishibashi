const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** innerHTML에 넣는 글자는 모두 이걸 거친다 */
export function esc(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function pick<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (element === null) throw new Error(`${selector} 요소가 없어요`);
	return element;
}

/** 저장소가 막힌 브라우저(사생활 보호 모드 등)에서도 화면은 계속 돌아가게 한다 */
export const store = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string | null): void {
		try {
			if (value === null) localStorage.removeItem(key);
			else localStorage.setItem(key, value);
		} catch {
			// 저장 못 해도 이번 접속 동안은 동작한다
		}
	},
};

/** 서버 시계 기준 지금 시각 */
export function serverTime(offsetMs: number): number {
	return Date.now() + offsetMs;
}
