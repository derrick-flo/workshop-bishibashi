import { BALLOON, BALLOON_START, type BalloonState, balloonPress, balloonScore, formatBalloon } from "../../domain/games/balloon";
import { arcade } from "../arcade-sound";
import { blit, dither, line, plot, rect } from "../pixel/bitmap";
import { BIG, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { shatter, sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { BURST, balloonBody, balloonSize, KNOT, SCRAP, STAR, TIED, TUFT } from "./art/balloon";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
/** 풍선 주둥이(매듭 위) 위치 */
const NECK_X = 40;
const NECK_Y = 50;
const GROUND_Y = 56;
const STARS: readonly (readonly [number, number])[] = [
	[6, 12],
	[21, 9],
	[55, 15],
	[30, 21],
	[59, 33],
	[11, 27],
	[47, 7],
];

const FULL_TEXT = label(BIG, "FULL!", C.l, C.k);
const DANGER_TEXT = label(BIG, "STOP!", C.y, C.k);
const POP_TEXT = label(BIG, "POP!", C.y, C.k);
const NICE_TEXT = label(BIG, "NICE!", C.l, C.k);

export const mountBalloon: MountGame = (stage) => {
	const kit = mountKit(stage, W, H, C.n);
	let state: BalloonState = BALLOON_START;
	let lastPumpAt = Number.NEGATIVE_INFINITY;
	let finishedAt: number | null = null;
	let wrongUntil = 0;

	function tone(now: number): "normal" | "bright" | "hot" {
		if (state.pumps > BALLOON.fullPumps + 3) return Math.floor(now / 90) % 2 === 0 ? "hot" : "normal";
		if (state.pumps >= BALLOON.fullPumps) return Math.floor(now / 160) % 2 === 0 ? "bright" : "normal";
		return "normal";
	}

	function drawSky(now: number): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, GROUND_Y, C.n);
		// 지평선 쪽으로 밝아진다(두 줄씩 섞은 띠)
		dither(fb, 0, 28, W, 2, C.n, C.N, 1);
		dither(fb, 0, 30, W, 2, C.n, C.N, 2);
		dither(fb, 0, 32, W, 2, C.n, C.N, 3);
		rect(fb, 0, 34, W, GROUND_Y - 34, C.N);
		STARS.forEach(([x, y], i) => {
			const twinkle = Math.floor(now / 400 + i * 1.7) % 3 === 0;
			const star = twinkle ? STAR[1] : STAR[0];
			blit(fb, star, x - Math.floor(star.w / 2), y - 1);
		});
		// 먼 언덕
		for (let x = 0; x < W; x++) {
			const top = 49 + Math.round(Math.sin(x / 9) * 2 + Math.sin(x / 4 + 1) * 1);
			rect(fb, x, top, 1, GROUND_Y - top, C.v);
		}
	}

	function drawGround(): void {
		const fb = kit.fb;
		rect(fb, 0, GROUND_Y, W, H - GROUND_Y, C.G);
		rect(fb, 0, GROUND_Y, W, 1, C.g);
		for (let x = 1; x < W; x += 4) rect(fb, x, GROUND_Y + 1, 1, 1, C.g);
		for (let x = 3; x < W; x += 6) rect(fb, x, GROUND_Y + 4, 2, 1, C.k);
		for (const x of [3, 20, 31, 52, 60]) blit(fb, TUFT, x, GROUND_Y - 1);
	}

	/** 펌프 몸통의 압력계. 바늘이 바람 양에 따라 돈다 */
	function drawGauge(x: number, y: number): void {
		const fb = kit.fb;
		rect(fb, x, y + 1, 7, 5, C.k);
		rect(fb, x + 1, y, 5, 7, C.k);
		rect(fb, x + 1, y + 1, 5, 5, C.w);
		// 비었을 때 왼쪽 아래(-135°)에서 터지기 직전 오른쪽 아래(+135°)까지
		const level = Math.min(1, state.pumps / BALLOON.burstPumps);
		const theta = (-0.75 + 1.5 * level) * Math.PI;
		const cx = x + 3;
		const cy = y + 3;
		line(fb, cx, cy, cx + Math.round(Math.sin(theta) * 2), cy - Math.round(Math.cos(theta) * 2), state.pumps > BALLOON.fullPumps ? C.r : C.k);
	}

	function drawMeter(now: number): void {
		const fb = kit.fb;
		const inner = BALLOON.burstPumps; // 한 번에 한 칸
		const x0 = Math.floor((W - inner - 2) / 2);
		rect(fb, x0, 1, inner + 2, 5, C.k);
		rect(fb, x0 + 1, 2, inner, 3, C.v);
		dither(fb, x0 + 1 + BALLOON.fullPumps, 2, inner - BALLOON.fullPumps, 3, C.v, C.R, 2);
		const filled = Math.min(state.pumps, inner);
		const danger = state.pumps > BALLOON.fullPumps + 3;
		const color = state.burst ? C.A : state.finishedAt !== null || state.pumps >= BALLOON.fullPumps ? (danger && Math.floor(now / 90) % 2 === 0 ? C.y : C.g) : C.r;
		rect(fb, x0 + 1, 2, filled, 3, color);
		rect(fb, x0 + 1, 2, filled, 1, state.burst ? C.a : C.w);
		rect(fb, x0 + 1 + BALLOON.fullPumps, 0, 1, 7, C.w);
	}

	function drawPump(now: number): void {
		const fb = kit.fb;
		const pressed = now - lastPumpAt < 90;
		const wobble = now < wrongUntil ? (Math.floor(now / 40) % 2 === 0 ? -1 : 1) : 0;
		const handleY = pressed ? 33 : 27;
		const x = 4 + wobble;
		// 손잡이 막대
		rect(fb, x + 5, handleY + 2, 2, 37 - handleY, C.a);
		rect(fb, x + 5, handleY + 2, 1, 37 - handleY, C.W);
		// 손잡이
		rect(fb, x, handleY, 12, 3, C.k);
		rect(fb, x + 1, handleY + 1, 10, 1, C.t);
		// 몸통
		rect(fb, x + 2, 36, 8, 17, C.k);
		rect(fb, x + 3, 37, 6, 15, C.b);
		rect(fb, x + 4, 37, 1, 15, C.c);
		rect(fb, x + 7, 37, 2, 15, C.B);
		rect(fb, x + 3, 42, 6, 1, C.B);
		drawGauge(x + 2, 44);
		// 받침
		rect(fb, x - 1, 52, 14, 4, C.k);
		rect(fb, x, 53, 12, 2, C.t);
		rect(fb, x, 54, 12, 1, C.T);
	}

	function drawHose(): void {
		const fb = kit.fb;
		line(fb, 16, 54, NECK_X - 1, 54, C.k);
		line(fb, 16, 53, NECK_X - 1, 53, C.a);
		rect(fb, NECK_X - 1, NECK_Y + 2, 2, 3, C.a);
		rect(fb, NECK_X - 2, NECK_Y + 2, 1, 3, C.k);
		rect(fb, NECK_X + 1, NECK_Y + 2, 1, 3, C.k);
	}

	function drawBalloon(now: number): void {
		const fb = kit.fb;
		if (state.burst) {
			blit(fb, SCRAP, NECK_X - 2, NECK_Y - 2);
			return;
		}
		const size = balloonSize(state.pumps, BALLOON.fullPumps, BALLOON.burstPumps);
		const squash = now - lastPumpAt < 80 ? 1 : 0;
		const w = size.w + squash * 2;
		const h = size.h - squash * 2;
		const wobble = state.pumps > BALLOON.fullPumps + 3 ? (Math.floor(now / 60) % 2 === 0 ? -1 : 1) : 0;
		let x = NECK_X - Math.floor(w / 2) + wobble;
		let y = NECK_Y - h;
		if (finishedAt !== null) {
			// 묶은 풍선은 하늘로 날아간다
			const flying = (now - finishedAt) / 1000;
			y -= Math.round(flying * flying * 18 + flying * 6);
			x += Math.round(Math.sin(flying * 3) * 2);
			const knotX = x + Math.floor(w / 2) - 2;
			blit(fb, TIED, knotX, y + h - 1);
			// 풍선 끈
			for (let i = 0; i < 10; i++) plot(fb, knotX + 2 + Math.round(Math.sin(i * 0.9 + flying * 6)), y + h + 3 + i, C.W);
		} else if (kit.gameTime(now) === null) {
			// 시작 전에는 살짝 둥실거린다
			y += Math.floor(now / 500) % 2 === 0 ? 0 : -1;
		}
		blit(fb, balloonBody(w, h, tone(now)), x, y);
		if (finishedAt === null) blit(fb, KNOT, NECK_X - 1 + wobble, NECK_Y);
	}

	function drawLabels(now: number): void {
		const fb = kit.fb;
		const centerX = (art: { w: number }) => Math.floor((W - art.w) / 2);
		if (state.burst || state.finishedAt !== null) return;
		const blinkOn = Math.floor(now / 200) % 2 === 0;
		if (state.pumps > BALLOON.fullPumps + 3 && blinkOn) blit(fb, DANGER_TEXT, centerX(DANGER_TEXT), 9);
		else if (state.pumps >= BALLOON.fullPumps && blinkOn) blit(fb, FULL_TEXT, centerX(FULL_TEXT), 9);
	}

	function updateHint(now: number): void {
		if (state.burst) return kit.setHint("펑! 터졌어요", "bad");
		if (state.finishedAt !== null) return kit.setHint(`묶었다! ${formatBalloon(balloonScore(state))}`, "good");
		if (now < wrongUntil) return kit.setHint("빨강·파랑을 번갈아 눌러요!", "bad");
		if (state.pumps > BALLOON.fullPumps + 3) return kit.setHint("곧 터져요! FINISH!", "bad");
		if (state.pumps >= BALLOON.fullPumps) return kit.setHint("지금 FINISH!", "good");
		if (kit.gameTime(now) === null) return kit.setHint("빨강·파랑 번갈아 눌러 바람을 넣어요");
		kit.setHint("빨강·파랑 번갈아!");
	}

	kit.run((now) => {
		drawSky(now);
		drawGround();
		if (finishedAt === null && !state.burst) drawHose();
		drawPump(now);
		drawBalloon(now);
		drawMeter(now);
		drawLabels(now);
		updateHint(now);
	});

	return {
		labels: {
			red: { text: "펌프", enabled: true },
			green: { text: "", enabled: false },
			blue: { text: "펌프", enabled: true },
			finish: { text: "FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = balloonPress(state, button, t);
			const now = performance.now();
			if (state === before) {
				// 같은 색을 또 눌렀거나 초록을 눌렀을 때만 알려 준다(끝난 뒤나 다 차기 전 FINISH는 조용히)
				if (!before.burst && before.finishedAt === null && button !== "finish") {
					wrongUntil = now + 500;
					arcade.wrong();
				}
				return;
			}
			if (state.burst && !before.burst) {
				const size = balloonSize(before.pumps, BALLOON.fullPumps, BALLOON.burstPumps);
				kit.emit(shatter(balloonBody(size.w, size.h, "normal"), NECK_X - Math.floor(size.w / 2), NECK_Y - size.h, Math.random, 80, 1000, 0.5));
				kit.popup(BURST, NECK_X, NECK_Y - Math.floor(size.h / 2), 250, 0, "mark");
				kit.popup(POP_TEXT, W / 2, 24, 1400, 8);
				kit.shake(3, 400);
				kit.flash(C.w, 50);
				arcade.pop();
				buzz(220);
			} else if (state.finishedAt !== null && before.finishedAt === null) {
				finishedAt = now;
				kit.emit(sparkle(NECK_X, NECK_Y - 20, [C.y, C.w, C.l], Math.random, 16, 55));
				kit.popup(NICE_TEXT, W / 2, 24, 1600, 8);
				arcade.tie();
			} else {
				lastPumpAt = now;
				arcade.pump(state.pumps / BALLOON.burstPumps);
				if (state.pumps === BALLOON.fullPumps) arcade.ding();
				kit.emit(sparkle(NECK_X, NECK_Y + 2, [C.W, C.w], Math.random, 3, 18, 260));
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => balloonScore(state),
	};
};
