import type { Screen } from "./screen";

/** 누른 자리를 가상 픽셀 좌표로 바꾸는 함수. 캔버스 밖을 누르면 0~w, 0~h 를 벗어난 값이 나온다. */
export type PointerFrame = (event: { readonly clientX: number; readonly clientY: number }) => { readonly x: number; readonly y: number };

/**
 * 캔버스가 지금 놓인 자리를 재서 좌표를 바꿀 함수를 만든다.
 * 끄는 동안 자리를 다시 재지 않도록(손가락을 움직일 때마다 화면 계산을 하지 않도록) 누르기 시작할 때 한 번 부른다.
 */
export function pointerFrame(screen: Screen, w: number, h: number): PointerFrame {
	const box = screen.canvas.getBoundingClientRect();
	const width = box.width || 1;
	const height = box.height || 1;
	return (event) => ({ x: ((event.clientX - box.left) / width) * w, y: ((event.clientY - box.top) / height) * h });
}
