import type { Button } from "../../domain/games/button";
import { CANDY_START, type CandyState, candyPress, candyScore, candyTargets, currentTarget } from "../../domain/games/candy";
import { arcade } from "../arcade-sound";
import { blit, dither, plot, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label, SMALL } from "../pixel/font";
import { C, CLEAR } from "../pixel/palette";
import { type Particle, sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { CANDY_BALLS, CANDY_COLORS, type CandyValue, LID, MINI_JAR } from "./art/candy";
import { CROSS } from "./art/common";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 72;
const H = 64;
const COUNTER_Y = 52;
/** 병 몸통(바깥) */
const JAR = { x: 22, y: 20, w: 28, h: 32 } as const;
/** 사탕이 쌓이는 칸. 개수가 목표와 같으면 꼭대기(채움선)까지 찬다 */
const FILL = { x: 24, y: 23, w: 24, h: 27 } as const;
const HOPPER_X: Readonly<Record<Exclude<Button, "finish">, number>> = { red: 12, green: 36, blue: 60 };
const VALUE_OF: Readonly<Record<Exclude<Button, "finish">, CandyValue>> = { red: 1, green: 5, blue: 10 };
const BUTTON_OF: Readonly<Record<CandyValue, Exclude<Button, "finish">>> = { 1: "red", 5: "green", 10: "blue" };

const OVER_TEXT = label(BIG, "OVER!", C.y, C.k);
const NO_TEXT = label(BIG, "NO!", C.p, C.k);
const GOOD_TEXT = label(BIG, "GOOD!", C.l, C.k);

/** 떨어지는 사탕(장식). 숫자는 누르는 순간 바로 바뀌고, 사탕은 뒤따라 병에 들어간다. */
type Drop = { readonly value: CandyValue; readonly fromX: number; readonly bornAt: number };

/** 병이 바뀌는 중(완성한 병이 오른쪽으로 나가고 새 병이 들어온다) */
type Swap = { readonly at: number; readonly layers: readonly CandyValue[]; readonly target: number };

const SWAP_MS = 380;
const DROP_MS = 260;

export const mountCandy: MountGame = (stage, seed) => {
	const targets = candyTargets(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: CandyState = CANDY_START;
	/** 지금 병에 넣은 사탕(아래부터) */
	let layers: readonly CandyValue[] = [];
	let drops: readonly Drop[] = [];
	let swap: Swap | null = null;
	let pressedAt: Readonly<Record<Exclude<Button, "finish">, number>> = { red: -1e9, green: -1e9, blue: -1e9 };
	let shakeJarUntil = 0;
	let messageUntil = 0;
	let message: { readonly text: string; readonly tone: "good" | "bad" } | null = null;

	const target = () => currentTarget(state, targets);

	function drawWall(): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, COUNTER_Y, C.N);
		for (let x = 2; x < W; x += 8) rect(fb, x, 0, 3, COUNTER_Y, C.v);
		dither(fb, 0, COUNTER_Y - 6, W, 2, C.N, C.n, 2);
		rect(fb, 0, COUNTER_Y - 4, W, 4, C.n);
	}

	function drawCounter(): void {
		const fb = kit.fb;
		rect(fb, 0, COUNTER_Y, W, H - COUNTER_Y, C.t);
		rect(fb, 0, COUNTER_Y, W, 1, C.o);
		rect(fb, 0, COUNTER_Y + 1, W, 1, C.k);
		for (let x = 5; x < W; x += 12) rect(fb, x, COUNTER_Y + 3, 1, H - COUNTER_Y - 3, C.T);
		// 완성한 병
		const shown = Math.min(state.completed, 5);
		for (let i = 0; i < shown; i++) blit(fb, MINI_JAR, 2 + i * 6, COUNTER_Y + 2);
		if (state.completed > 0) {
			const count = cachedLabel(SMALL, `x${state.completed}`, C.y, C.k);
			blit(fb, count, 3 + shown * 6, COUNTER_Y + 2);
		}
	}

	function drawHoppers(now: number): void {
		const fb = kit.fb;
		for (const button of ["red", "green", "blue"] as const) {
			const value = VALUE_OF[button];
			const colors = CANDY_COLORS[value];
			const cx = HOPPER_X[button];
			const kick = now - pressedAt[button] < 90 ? 1 : 0;
			// 깔때기: 위가 넓고 아래가 좁다
			for (let row = 0; row < 7; row++) {
				const half = 6 - Math.floor(row * 0.7);
				const y = row + kick;
				rect(fb, cx - half, y, half * 2, 1, C.k);
				if (row < 6) {
					rect(fb, cx - half + 1, y, half * 2 - 2, 1, row % 2 === 0 ? colors.base : colors.light);
					if (row % 2 === 1) for (let x = cx - half + 2; x < cx + half - 1; x += 3) plot(fb, x, y, colors.dark);
				}
			}
			rect(fb, cx - 2, 7 + kick, 4, 2, C.k);
			const tag = cachedLabel(SMALL, `+${value}`, C.w, C.k);
			blit(fb, tag, cx - Math.floor(tag.w / 2), 9 + kick);
		}
	}

	/** 병 하나(뚜껑·사탕·라벨 포함)를 x만큼 옆으로 옮겨 그린다 */
	function drawJar(dx: number, jarLayers: readonly CandyValue[], jarTarget: number, lidDrop: number | null, shake: number): void {
		const fb = kit.fb;
		const x = JAR.x + dx + shake;
		const y = JAR.y;
		// 병 목
		rect(fb, x + 4, y - 4, JAR.w - 8, 5, C.k);
		rect(fb, x + 5, y - 3, JAR.w - 10, 3, C.N);
		rect(fb, x + 5, y - 3, 1, 3, C.W);
		// 몸통 유리(모서리는 한 칸 깎는다)
		rect(fb, x, y + 1, JAR.w, JAR.h - 2, C.k);
		rect(fb, x + 1, y, JAR.w - 2, JAR.h, C.k);
		rect(fb, x + 1, y + 1, JAR.w - 2, JAR.h - 2, C.v);
		// 사탕 더미
		const total = jarLayers.reduce<number>((sum, value) => sum + value, 0);
		let below = 0;
		jarLayers.forEach((value, i) => {
			const top = Math.round(((below + value) / jarTarget) * FILL.h);
			const bottom = Math.round((below / jarTarget) * FILL.h);
			const colors = CANDY_COLORS[value];
			const fx = FILL.x + dx + shake;
			const layerTop = FILL.y + FILL.h - top;
			rect(fb, fx, layerTop, FILL.w, top - bottom, colors.base);
			for (let py = layerTop; py < FILL.y + FILL.h - bottom; py++) {
				for (let px = fx + ((py + i) % 2) * 2; px < fx + FILL.w; px += 4) plot(fb, px, py, (py + i) % 3 === 0 ? colors.light : colors.dark);
			}
			below += value;
		});
		// 채움선(여기까지 차면 목표 개수)
		for (let px = x + 1; px < x + JAR.w - 1; px += 2) plot(fb, px, FILL.y - 1, total === jarTarget ? C.l : C.W);
		plot(fb, x - 1, FILL.y - 1, C.W);
		plot(fb, x + JAR.w, FILL.y - 1, C.W);
		// 유리 반사
		rect(fb, x + 2, y + 3, 1, JAR.h - 7, C.W);
		rect(fb, x + 3, y + 3, 1, 4, C.w);
		// 라벨(목표 개수)
		const goal = cachedLabel(BIG, String(jarTarget), C.k, CLEAR);
		const lw = goal.w + 6;
		const lx = x + Math.floor((JAR.w - lw) / 2);
		const ly = y + 7;
		rect(fb, lx, ly, lw, goal.h + 6, C.k);
		rect(fb, lx + 1, ly + 1, lw - 2, goal.h + 4, C.w);
		rect(fb, lx + 1, ly + goal.h + 4, lw - 2, 1, C.W);
		blit(fb, goal, lx + 3, ly + 3);
		// 뚜껑
		if (lidDrop !== null) blit(fb, LID, x + 3, y - 6 - lidDrop);
	}

	/** 사탕 더미 꼭대기 옆에 지금 개수를 단다 */
	function drawCountTag(): void {
		const fb = kit.fb;
		const height = Math.round((state.count / target()) * FILL.h);
		const tagY = Math.max(FILL.y - 4, Math.min(FILL.y + FILL.h - 4, FILL.y + FILL.h - height - 4));
		const done = state.count === target();
		const number = cachedLabel(BIG, String(state.count), done ? C.l : C.y, C.k);
		const x = JAR.x + JAR.w + 2;
		// 화살표
		plot(fb, x, tagY + 4, C.k);
		rect(fb, x + 1, tagY + 3, 1, 3, C.k);
		blit(fb, number, x + 2, tagY);
	}

	function drawDrops(now: number): void {
		const fb = kit.fb;
		drops = drops.filter((drop) => now - drop.bornAt < DROP_MS);
		for (const drop of drops) {
			const p = (now - drop.bornAt) / DROP_MS;
			const ball = CANDY_BALLS[drop.value];
			const x = drop.fromX + (JAR.x + JAR.w / 2 - drop.fromX) * p - ball.w / 2;
			const y = 8 + (JAR.y - 4 - 8) * p * p - ball.h / 2;
			blit(fb, ball, x, y);
		}
	}

	function updateHint(now: number): void {
		if (now < messageUntil && message !== null) return kit.setHint(message.text, message.tone);
		if (kit.gameTime(now) === null) return kit.setHint("라벨 숫자만큼 담고 FINISH!");
		if (state.count === target()) return kit.setHint("지금 FINISH!", "good");
		kit.setHint(`${state.count} / ${target()} · 딱 맞으면 FINISH`);
	}

	kit.run((now) => {
		drawWall();
		drawCounter();
		const jarShake = now < shakeJarUntil ? (Math.floor(now / 40) % 2 === 0 ? -1 : 1) : 0;
		if (swap !== null && now - swap.at < SWAP_MS) {
			const p = (now - swap.at) / SWAP_MS;
			const lid = Math.max(0, Math.round((1 - Math.min(1, p * 3)) * 8));
			const slide = p < 0.35 ? 0 : (p - 0.35) / 0.65;
			drawJar(Math.round(slide * 60), swap.layers, swap.target, lid, 0);
			drawJar(Math.round((slide - 1) * 60), layers, target(), null, 0);
		} else {
			swap = null;
			drawJar(0, layers, target(), null, jarShake);
			drawCountTag();
		}
		drawHoppers(now);
		drawDrops(now);
		updateHint(now);
	});

	function say(text: string, tone: "good" | "bad", ms: number): void {
		message = { text, tone };
		messageUntil = performance.now() + ms;
	}

	/** 병 안 사탕을 파편으로 튀긴다(넘쳤을 때 위로, 틀렸을 때 아래로) */
	function burstPile(upward: boolean): readonly Particle[] {
		const total = layers.reduce<number>((sum, value) => sum + value, 0);
		const height = Math.max(3, Math.round((Math.min(total, target()) / target()) * FILL.h));
		const parts: Particle[] = [];
		const colors = layers.length === 0 ? [C.r] : layers.map((value) => CANDY_COLORS[value].base);
		for (let i = 0; i < 70; i++) {
			const x = FILL.x + Math.random() * FILL.w;
			const y = FILL.y + FILL.h - Math.random() * height;
			parts.push({
				x,
				y,
				vx: (Math.random() - 0.5) * 90,
				vy: upward ? -60 - Math.random() * 90 : 10 + Math.random() * 40,
				color: colors[i % colors.length] ?? C.r,
				life: 700 + Math.random() * 400,
				gravity: 220,
			});
		}
		return parts;
	}

	return {
		labels: {
			red: { text: "+1", enabled: true },
			green: { text: "+5", enabled: true },
			blue: { text: "+10", enabled: true },
			finish: { text: "FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = candyPress(state, targets, button, t);
			if (state === before) return;
			const now = performance.now();
			const kind = state.event?.kind;
			if (button !== "finish") pressedAt = { ...pressedAt, [button]: now };
			if (kind === "add" && button !== "finish") {
				const value = VALUE_OF[button];
				layers = [...layers, value];
				drops = [...drops, { value, fromX: HOPPER_X[BUTTON_OF[value]], bornAt: now }];
				arcade.candy(value);
			} else if (kind === "spill") {
				kit.emit(burstPile(true));
				layers = [];
				kit.popup(OVER_TEXT, JAR.x + JAR.w / 2, 30, 900, 6);
				shakeJarUntil = now + 350;
				kit.shake(2, 300);
				say("넘쳤다! 처음부터 다시", "bad", 900);
				arcade.spill();
				buzz(120);
			} else if (kind === "wrong") {
				kit.emit(burstPile(false));
				layers = [];
				kit.popup(CROSS, JAR.x + JAR.w / 2, 34, 600, 0, "mark");
				kit.popup(NO_TEXT, JAR.x + JAR.w / 2, 24, 900, 6);
				shakeJarUntil = now + 350;
				say("숫자가 달라요! 처음부터", "bad", 900);
				arcade.wrong();
				buzz(120);
			} else if (kind === "done") {
				swap = { at: now, layers, target: currentTarget(before, targets) };
				layers = [];
				kit.emit(sparkle(JAR.x + JAR.w / 2, JAR.y + 6, [C.y, C.w, C.l], Math.random, 14, 50));
				kit.popup(GOOD_TEXT, W / 2, 14, 900, 6);
				say(`한 병 완성! ${state.completed}병째`, "good", 900);
				arcade.jar();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => candyScore(state),
	};
};
