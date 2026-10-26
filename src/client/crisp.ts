/**
 * 픽셀 글꼴(12칸 격자)과 픽셀 테두리가 기기 픽셀에 딱 맞도록 CSS 단위를 정한다.
 * 한 칸이 기기 픽셀 정수 개가 되어야 글자 가장자리가 번지지 않는다. arcade.css 가 이 값의 배수를 쓴다.
 */
export function applyCrispUnits(root: HTMLElement = document.documentElement): void {
	const update = () => {
		const dpr = window.devicePixelRatio || 1;
		/** target(CSS px)에 가장 가까운, 기기 픽셀 정수 개짜리 길이 */
		const unit = (target: number) => `${Math.max(1, Math.round(target * dpr)) / dpr}px`;
		// 폰: 본문 글자 한 칸 ≈ 1.4px(12칸이면 약 17px)
		root.style.setProperty("--fp", unit(1.4));
		root.style.setProperty("--fp2", unit(2));
		root.style.setProperty("--fp3", unit(3));
		root.style.setProperty("--fp5", unit(5));
		// 테두리 한 칸
		root.style.setProperty("--px", unit(3));
		// 진행자 화면(프로젝터): 화면 폭 1600px 기준 본문 글자 한 칸 ≈ 2.5px(약 30px). 화면이 좁으면 줄인다.
		const wide = Math.min(1.4, Math.max(0.55, window.innerWidth / 1600));
		root.style.setProperty("--hp", unit(2.5 * wide));
		root.style.setProperty("--hps", unit(1.6 * wide));
		root.style.setProperty("--hp2", unit(4 * wide));
		root.style.setProperty("--hp3", unit(6 * wide));
		root.style.setProperty("--hp4", unit(9 * wide));
	};
	update();
	// 화면을 다른 모니터로 옮기거나 확대하면 배율이 바뀐다
	window.addEventListener("resize", update);
}
