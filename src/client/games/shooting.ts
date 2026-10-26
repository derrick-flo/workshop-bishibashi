import {
	type Shot,
	SHOOTING_START,
	type ShootingState,
	shootingPress,
	shootingScore,
	shootingTargets,
	targetAt,
} from "../../domain/games/shooting";
import { arcade } from "../arcade-sound";
import { type Bitmap, blit, dither, line, plot, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label, SMALL } from "../pixel/font";
import { C } from "../pixel/palette";
import { shatter } from "../pixel/particles";
import { buzz } from "../sound";
import { FLASH, GUN, TARGETS } from "./art/shooting";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
const CENTER_X = 32;
const CENTER_Y = 25;
const COUNTER_Y = 44;
const TRACK_Y = 7;
const GUN_X = 41;
/** 표적이 계산대 뒤에서 올라오는 시간 */
const RISE_MS = 90;
/** 빗나간 표적이 넘어가는 시간 */
const FALL_MS = 160;

const HIT_TEXT = label(BIG, "HIT!", C.l, C.k);
const MISS_TEXT = label(BIG, "MISS!", C.p, C.k);
const READY_TEXT = label(BIG, "READY", C.y, C.k);
const END_TEXT = label(BIG, "END", C.y, C.k);

export const mountShooting: MountGame = (stage, seed) => {
	const targets = shootingTargets(seed);
	const firstAt = targets[0]?.at ?? 0;
	const lastUntil = targets[targets.length - 1]?.until ?? 0;
	const kit = mountKit(stage, W, H, C.T);
	let state: ShootingState = SHOOTING_START;
	/** 마지막으로 쏜 화면 시각과 그 결과 */
	let shotAt = Number.NEGATIVE_INFINITY;
	let lastShot: Shot | null = null;
	let shownFor = -1;
	/** 쏘지 않고 지나간 표적을 어디까지 셌는지 */
	let passed = 0;
	let passedAt = Number.NEGATIVE_INFINITY;

	const shotOf = (index: number) => state.shots.find((shot) => shot.target === index);
	const hits = () => state.shots.filter((shot) => shot.hit).length;

	function drawBooth(): void {
		const fb = kit.fb;
		// 나무 벽(세로 판자)
		rect(fb, 0, 0, W, COUNTER_Y, C.t);
		for (let x = 2; x < W; x += 6) rect(fb, x, 0, 1, COUNTER_Y, C.T);
		dither(fb, 0, 11, W, 3, C.T, C.t, 2);
		// 빨강·흰 줄무늬 차양
		for (let x = 0; x < W; x++) {
			const color = Math.floor(x / 4) % 2 === 0 ? C.r : C.w;
			rect(fb, x, 0, 1, 5, color);
			if (x % 4 === 1 || x % 4 === 2) plot(fb, x, 5, color);
		}
		rect(fb, 0, TRACK_Y - 1, W, 4, C.k);
	}

	/** 위쪽 기록판: 20발 각각 명중(연두) · 빗나감(빨강) · 놓침(진빨강) · 지금(노랑) */
	function drawTracker(now: number, t: number | null, current: number | null): void {
		const fb = kit.fb;
		targets.forEach((target, i) => {
			const shot = shotOf(i);
			const color =
				shot !== undefined
					? shot.hit
						? C.l
						: C.r
					: t !== null && t >= target.until
						? C.R
						: i === current
							? Math.floor(now / 120) % 2 === 0
								? C.y
								: C.o
							: C.A;
			rect(fb, 2 + i * 3, TRACK_Y, 2, 2, color);
		});
	}

	function drawTarget(now: number, t: number | null, current: number | null): void {
		const fb = kit.fb;
		const center = (art: Bitmap, y: number) => blit(fb, art, CENTER_X - Math.floor(art.w / 2), y);
		if (t === null || t < firstAt) {
			if (Math.floor(now / 400) % 2 === 0) center(READY_TEXT, CENTER_Y - 4);
			return;
		}
		if (t >= lastUntil) {
			center(END_TEXT, CENTER_Y - 9);
			center(cachedLabel(BIG, `${hits()}/${targets.length}`, C.w, C.k), CENTER_Y + 1);
			return;
		}
		const target = current === null ? undefined : targets[current];
		if (current === null || target === undefined) return;
		const shot = shotOf(current);
		// 맞힌 표적은 부서져 없다
		if (shot?.hit) return;
		const art = TARGETS[target.color];
		const rise = shot === undefined ? 1 - Math.min(1, (t - target.at) / RISE_MS) : Math.min(1, (now - shotAt) / FALL_MS);
		const y = CENTER_Y - Math.floor(art.h / 2) + Math.round(rise * 30);
		rect(fb, CENTER_X - 1, y + art.h - 1, 2, Math.max(0, COUNTER_Y - y - art.h + 1), C.A);
		blit(fb, art, CENTER_X - Math.floor(art.w / 2), y);
		// 표적이 다 올라와 있는 동안 남은 시간 막대
		if (shot === undefined && rise === 0) {
			const left = Math.max(0, (target.until - t) / (target.until - target.at));
			rect(fb, CENTER_X - 11, CENTER_Y + 13, 22, 3, C.k);
			rect(fb, CENTER_X - 10, CENTER_Y + 14, Math.round(20 * left), 1, left < 0.35 ? C.r : C.y);
		}
	}

	function drawCounter(): void {
		const fb = kit.fb;
		rect(fb, 0, COUNTER_Y, W, H - COUNTER_Y, C.O);
		rect(fb, 0, COUNTER_Y, W, 1, C.y);
		rect(fb, 0, COUNTER_Y + 1, W, 1, C.o);
		rect(fb, 0, COUNTER_Y + 3, W, 1, C.T);
		for (let x = 5; x < W; x += 10) rect(fb, x, COUNTER_Y + 4, 1, H - COUNTER_Y - 4, C.T);
	}

	function drawGun(now: number): void {
		const fb = kit.fb;
		const kick = now - shotAt < 80 ? 2 : 0;
		const y = H - GUN.h + 3 + kick;
		const muzzleX = GUN_X + 4;
		if (now - shotAt < 40) line(fb, muzzleX, y - 1, CENTER_X, CENTER_Y, C.w);
		blit(fb, GUN, GUN_X, y);
		if (now - shotAt < 70) blit(fb, FLASH, muzzleX - 2, y - 5);
	}

	function updateHint(now: number, t: number | null): void {
		if (t === null) return kit.setHint("표적과 같은 모양 버튼으로! ★는 FINISH");
		if (t >= lastUntil) return kit.setHint(`끝! ${hits()}발 명중`);
		if (now - shotAt < 500 && lastShot !== null) {
			return lastShot.hit ? kit.setHint(`명중! ${(lastShot.ms / 1000).toFixed(2)}초`, "good") : kit.setHint("빗나감!", "bad");
		}
		if (now - passedAt < 400) return kit.setHint("놓쳤어요!", "bad");
		kit.setHint("▲빨강 · ■초록 · ●파랑 · ★FINISH");
	}

	/** 새 표적이 뜰 때 소리, 쏘지 않고 지나간 표적은 놓친 것으로 센다 */
	function cue(now: number, t: number | null, current: number | null): void {
		if (current !== null && current !== shownFor) {
			shownFor = current;
			arcade.blip();
		}
		for (let target = targets[passed]; t !== null && target !== undefined && target.until <= t; target = targets[passed]) {
			if (shotOf(passed) === undefined) passedAt = now;
			passed++;
		}
	}

	kit.run((now) => {
		const t = kit.gameTime(now);
		const current = t === null ? null : targetAt(targets, t);
		drawBooth();
		drawTracker(now, t, current);
		drawTarget(now, t, current);
		drawCounter();
		drawGun(now);
		updateHint(now, t);
		cue(now, t, current);
	});

	return {
		labels: {
			red: { text: "▲", enabled: true },
			green: { text: "■", enabled: true },
			blue: { text: "●", enabled: true },
			finish: { text: "★ FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = shootingPress(state, targets, button, t);
			const shot = state.shots[state.shots.length - 1];
			if (state === before || shot === undefined) return;
			const now = performance.now();
			shotAt = now;
			lastShot = shot;
			kit.shake(1, 120);
			arcade.gun();
			const target = targets[shot.target];
			if (shot.hit && target !== undefined) {
				const art = TARGETS[target.color];
				kit.emit(shatter(art, CENTER_X - Math.floor(art.w / 2), CENTER_Y - Math.floor(art.h / 2), Math.random, 70, 800, 0.5));
				kit.popup(HIT_TEXT, CENTER_X, CENTER_Y - 6, 600, 6);
				kit.popup(cachedLabel(SMALL, (shot.ms / 1000).toFixed(2), C.w, C.k), CENTER_X, CENTER_Y + 5, 600, 4, "time");
				arcade.ding();
			} else {
				kit.popup(MISS_TEXT, CENTER_X, CENTER_Y - 6, 600, 6);
				arcade.wrong();
				buzz(120);
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => shootingScore(state),
	};
};
