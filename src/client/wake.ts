let lock: WakeLockSentinel | null = null;

async function request(): Promise<void> {
	if (lock !== null || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
	try {
		lock = await navigator.wakeLock.request("screen");
		lock.addEventListener("release", () => {
			lock = null;
		});
	} catch {
		// https가 아니거나 배터리 절약 모드면 거절될 수 있다. 화면이 꺼져도 다시 붙으니 괜찮다.
	}
}

/** 게임 중 화면이 꺼지지 않게 한다. 다른 앱에 갔다 오면 다시 건다. */
export function keepAwake(): void {
	void request();
	document.addEventListener("visibilitychange", () => void request());
}
