import type { Button } from "../../domain/games/button";
import {
	currentBout,
	JUDGE,
	JUDGE_START,
	type JudgeState,
	judgeBouts,
	judgePress,
	judgeScore,
	verdictOf,
} from "../../domain/games/judge";
import { arcade } from "../arcade-sound";
import { blit, blitAs, dither, rect } from "../pixel/bitmap";
import { BIG, cachedLabel, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { CHECK, CROSS } from "./art/common";
import { LEFT_HANDS, RIGHT_HANDS, TAG_MARK } from "./art/judge";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 64;
const H = 64;
const HAND_W = LEFT_HANDS.rock.w;
const HAND_Y = 8;
const LEFT_X = 2;
const RIGHT_X = W - 2 - HAND_W;
const TABLE_Y = 35;
const TAG_Y = 39;
/** 표시판: 왼쪽 손 아래 빨강(◀), 가운데 초록(=), 오른쪽 손 아래 파랑(▶). 패드 버튼 자리와 같다 */
const TAGS = [
	{ button: "red", cx: LEFT_X + Math.floor(HAND_W / 2), color: C.r, dark: C.R },
	{ button: "green", cx: W / 2, color: C.g, dark: C.G },
	{ button: "blue", cx: RIGHT_X + Math.floor(HAND_W / 2), color: C.b, dark: C.B },
] as const;
const VS_TEXT = label(BIG, "VS", C.y, C.k);

type Choice = Exclude<Button, "finish">;

export const mountJudge: MountGame = (stage, seed) => {
	const bouts = judgeBouts(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: JudgeState = JUDGE_START;
	let boutAt = Number.NEGATIVE_INFINITY;
	let missAt = Number.NEGATIVE_INFINITY;
	let pressedAt: Readonly<Record<Choice, number>> = { red: -1e9, green: -1e9, blue: -1e9 };

	const locked = (now: number) => (kit.gameTime(now) ?? 0) < state.lockedUntil;

	function drawStage(): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, TABLE_Y, C.n);
		// 손을 비추는 조명
		for (const cx of [LEFT_X + HAND_W / 2, RIGHT_X + HAND_W / 2]) {
			for (let y = 7; y < TABLE_Y; y++) {
				const half = Math.round(5 + (y - 7) * 0.3);
				dither(fb, cx - half, y, half * 2, 1, C.n, C.N, y < 13 ? 1 : 2);
			}
		}
		// 무대 위 빨간 막
		rect(fb, 0, 0, W, 5, C.r);
		for (let x = 0; x < W; x += 6) {
			rect(fb, x, 0, 1, 5, C.R);
			rect(fb, x + 1, 5, 4, 1, C.r);
			rect(fb, x + 2, 6, 2, 1, C.R);
		}
	}

	function drawHands(now: number): void {
		const fb = kit.fb;
		if (kit.gameTime(now) === null) {
			// 시작 전: 둘 다 주먹을 흔든다(가위바위보!)
			const bounce = Math.floor(now / 170) % 2 === 0 ? 0 : -3;
			blit(fb, LEFT_HANDS.rock, LEFT_X, HAND_Y + bounce);
			blit(fb, RIGHT_HANDS.rock, RIGHT_X, HAND_Y + bounce);
			return;
		}
		const bout = currentBout(state, bouts);
		// 새 판은 양옆에서 살짝 밀려 들어온다
		const slide = Math.round((1 - Math.min(1, (now - boutAt) / 90)) * 4);
		const shake = locked(now) && now - missAt < 260 ? (Math.floor(now / 35) % 2 === 0 ? -1 : 1) : 0;
		blit(fb, LEFT_HANDS[bout.left], LEFT_X - slide + shake, HAND_Y);
		blit(fb, RIGHT_HANDS[bout.right], RIGHT_X + slide + shake, HAND_Y);
	}

	function drawCenter(now: number): void {
		const fb = kit.fb;
		blit(fb, VS_TEXT, Math.floor((W - VS_TEXT.w) / 2), 14);
		// 틀리면 잠깐 멈추는 시간이 줄어드는 막대
		const t = kit.gameTime(now) ?? 0;
		if (t < state.lockedUntil) {
			const left = (state.lockedUntil - t) / JUDGE.lockMs;
			rect(fb, 25, 32, 14, 3, C.k);
			rect(fb, 26, 33, Math.round(12 * left), 1, C.r);
		}
	}

	function drawTable(now: number): void {
		const fb = kit.fb;
		rect(fb, 0, TABLE_Y, W, H - TABLE_Y, C.t);
		rect(fb, 0, TABLE_Y, W, 1, C.o);
		rect(fb, 0, TABLE_Y + 1, W, 1, C.T);
		for (let x = 2; x < W; x += 9) rect(fb, x, TABLE_Y + 4 + (x % 2), 5, 1, C.T);
		for (const tag of TAGS) {
			// 방금 누른 표시판은 잠깐 하얗게 눌린다
			const pressed = now - pressedAt[tag.button] < 120;
			const x = Math.round(tag.cx) - 6;
			rect(fb, x, TAG_Y, 13, 10, C.k);
			rect(fb, x + 1, TAG_Y + 1, 11, 8, pressed ? C.W : tag.color);
			rect(fb, x + 1, TAG_Y + 8, 11, 1, pressed ? C.a : tag.dark);
			const mark = TAG_MARK[tag.button];
			blitAs(fb, mark, Math.round(tag.cx) - Math.floor(mark.w / 2), TAG_Y + 1 + Math.floor((7 - mark.h) / 2), pressed ? C.k : C.w);
		}
		// 맞힌 판 수
		const count = cachedLabel(BIG, String(state.correct), C.y, C.k);
		const x = Math.floor((W - CHECK.w - 2 - count.w) / 2);
		blit(fb, CHECK, x, 54);
		blit(fb, count, x + CHECK.w + 2, 53);
	}

	function updateHint(now: number): void {
		if (kit.gameTime(now) === null) return kit.setHint("이긴 쪽! 왼쪽 빨강 · 비김 초록 · 오른쪽 파랑");
		if (locked(now)) return kit.setHint("틀렸어요! 잠깐 멈춤", "bad");
		kit.setHint("이긴 쪽 버튼을 눌러요");
	}

	kit.run((now) => {
		drawStage();
		drawHands(now);
		drawCenter(now);
		drawTable(now);
		updateHint(now);
	});

	return {
		labels: {
			red: { text: "◀승", enabled: true },
			green: { text: "비김", enabled: true },
			blue: { text: "승▶", enabled: true },
			finish: { text: "", enabled: false },
		},
		press(button, t) {
			const before = state;
			state = judgePress(state, bouts, button, t);
			if (state === before || button === "finish") return;
			const now = performance.now();
			pressedAt = { ...pressedAt, [button]: now };
			if (state.event?.kind === "miss") {
				missAt = now;
				kit.popup(CROSS, W / 2, 26, 500, 0, "mark");
				kit.shake(1, 200);
				arcade.wrong();
				buzz(120);
				return;
			}
			// 방금 맞힌 판에서 이긴 쪽에 반짝이
			const verdict = verdictOf(currentBout(before, bouts));
			const x = verdict === "left" ? LEFT_X + HAND_W / 2 : verdict === "right" ? RIGHT_X + HAND_W / 2 : W / 2;
			kit.emit(sparkle(x, HAND_Y + 10, [C.y, C.w, C.l], Math.random, 8, 40, 360));
			boutAt = now;
			arcade.ding();
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => judgeScore(state),
	};
};
