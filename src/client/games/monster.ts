import {
	formatMonster,
	frontMonster,
	MONSTER,
	MONSTER_START,
	type MonsterState,
	monsterPress,
	monsterQueue,
	monsterScore,
} from "../../domain/games/monster";
import { arcade } from "../arcade-sound";
import { type Bitmap, blit, blitAs, dither, rect } from "../pixel/bitmap";
import { BIG, label } from "../pixel/font";
import { C } from "../pixel/palette";
import { shatter, sparkle } from "../pixel/particles";
import { buzz } from "../sound";
import { CROSS } from "./art/common";
import { DRAGON, HERO, MONSTERS, SLASH, SWORD_FORWARD, SWORD_UP, TORCH_FLAME } from "./art/monster";
import { mountKit } from "./kit";
import type { MountGame } from "./types";

const W = 80;
const H = 64;
const FLOOR_Y = 50;
const HERO_X = 3;
/** 맨 앞 몬스터의 가운데와 몬스터 사이 간격 */
const FRONT_CX = 30;
const GAP = 14;
/** 맨 앞을 포함해 줄에 보이는 몬스터 수 */
const SHOWN = 4;
const ADVANCE_MS = 120;
const DRAGON_X = W - DRAGON.w + 3;
const DRAGON_Y = FLOOR_Y - DRAGON.h + 3;
const PIP_X = 10;
const LOCK_Y = 58;

const BOSS_TEXT = label(BIG, "BOSS!", C.p, C.k);
const CLEAR_TEXT = label(BIG, "CLEAR!", C.y, C.k);

export const mountMonster: MountGame = (stage, seed) => {
	const queue = monsterQueue(seed);
	const kit = mountKit(stage, W, H, C.n);
	let state: MonsterState = MONSTER_START;
	let attackAt = Number.NEGATIVE_INFINITY;
	let advanceAt = Number.NEGATIVE_INFINITY;
	let dragonAt: number | null = null;
	let dragonHitAt = Number.NEGATIVE_INFINITY;
	/** 칼 자국을 그릴 자리: 몬스터를 베면 맨 앞, 드래곤을 때리면 드래곤 얼굴 */
	let slashAt: readonly [number, number] = [FRONT_CX - 4, FLOOR_Y - 13];

	const isDragon = () => frontMonster(state, queue) === null;
	const locked = (now: number) => (kit.gameTime(now) ?? 0) < state.lockedUntil;

	/** 줄에서 i번째(0이 맨 앞) 몬스터를 그릴 왼쪽 위 자리 */
	function slotOf(art: Bitmap, i: number, now: number): readonly [number, number] {
		const p = Math.min(1, (now - advanceAt) / ADVANCE_MS);
		const shift = Math.round((1 - p) * GAP);
		const bob = Math.floor(now / 260 + i * 0.7) % 2;
		return [FRONT_CX + i * GAP + shift - Math.floor(art.w / 2), FLOOR_Y - art.h + 1 - bob];
	}

	function drawDungeon(now: number): void {
		const fb = kit.fb;
		rect(fb, 0, 0, W, FLOOR_Y, C.N);
		// 벽돌
		for (let row = 0; row * 6 < FLOOR_Y; row++) {
			const y = row * 6;
			rect(fb, 0, y + 5, W, 1, C.n);
			for (let x = row % 2 === 0 ? 3 : 9; x < W; x += 12) rect(fb, x, y, 1, 5, C.n);
		}
		dither(fb, 0, 0, W, 4, C.n, C.N, 1);
		// 횃불
		for (const x of [20, 62]) {
			rect(fb, x, 18, 1, 5, C.t);
			rect(fb, x - 1, 17, 3, 1, C.T);
			const flame = TORCH_FLAME[Math.floor(now / 120 + x) % TORCH_FLAME.length];
			if (flame !== undefined) blit(fb, flame, x - 1, 13);
		}
		// 돌바닥
		rect(fb, 0, FLOOR_Y, W, H - FLOOR_Y, C.A);
		rect(fb, 0, FLOOR_Y, W, 1, C.a);
		for (let x = 6; x < W; x += 13) rect(fb, x, FLOOR_Y + 1, 1, 6, C.v);
		rect(fb, 0, FLOOR_Y + 7, W, 1, C.v);
	}

	function drawHero(now: number): void {
		const fb = kit.fb;
		const attacking = now - attackAt < 140;
		const x = HERO_X + (attacking ? 3 : 0);
		const y = FLOOR_Y - HERO.h + 1;
		// 틀리면 멈춘 동안 분홍으로 깜빡인다
		if (locked(now) && Math.floor(now / 80) % 2 === 0) blitAs(fb, HERO, x - 1, y, C.p);
		else blit(fb, HERO, x, y);
		if (attacking) blit(fb, SWORD_FORWARD, x + 9, y + 6);
		else blit(fb, SWORD_UP, x + 9, y + 1);
	}

	function drawQueue(now: number): void {
		const fb = kit.fb;
		for (let i = SHOWN - 1; i >= 0; i--) {
			const color = queue[state.defeated + i];
			if (color === undefined) continue;
			const art = MONSTERS[color];
			const [x, y] = slotOf(art, i, now);
			blit(fb, art, x, y);
		}
		if (now - attackAt < 100) blit(fb, SLASH, slashAt[0], slashAt[1]);
	}

	function drawDragon(now: number): void {
		if (dragonAt === null || state.clearedAt !== null) return;
		const fb = kit.fb;
		const p = Math.min(1, (now - dragonAt) / 400);
		const hit = now - dragonHitAt < 70;
		const shake = now - dragonHitAt < 160 ? (Math.floor(now / 40) % 2 === 0 ? -1 : 1) : 0;
		const x = DRAGON_X + Math.round((1 - p) * 40) + shake;
		const y = DRAGON_Y + (Math.floor(now / 400) % 2);
		if (hit) blitAs(fb, DRAGON, x, y, C.w);
		else blit(fb, DRAGON, x, y);
	}

	/** 위쪽: 몬스터 줄은 남은 몬스터 색 점, 드래곤 때는 체력 막대 */
	function drawTop(): void {
		const fb = kit.fb;
		if (isDragon()) {
			const left = MONSTER.dragonHp - state.dragonHits;
			rect(fb, PIP_X - 1, 1, MONSTER.dragonHp * 3 + 1, 5, C.k);
			rect(fb, PIP_X, 2, MONSTER.dragonHp * 3 - 1, 3, C.R);
			rect(fb, PIP_X, 2, left * 3 - 1, 3, C.y);
			rect(fb, PIP_X, 2, left * 3 - 1, 1, C.w);
			return;
		}
		queue.forEach((color, i) => {
			const x = PIP_X + i * 3;
			rect(fb, x, 2, 2, 3, i < state.defeated ? C.v : { red: C.r, green: C.g, blue: C.b }[color]);
		});
	}

	function drawLockBar(now: number): void {
		const t = kit.gameTime(now) ?? 0;
		if (t >= state.lockedUntil) return;
		const fb = kit.fb;
		const left = (state.lockedUntil - t) / MONSTER.lockMs;
		rect(fb, 4, LOCK_Y, W - 8, 3, C.k);
		rect(fb, 5, LOCK_Y + 1, Math.round((W - 10) * left), 1, C.r);
	}

	function updateHint(now: number): void {
		if (state.clearedAt !== null) return kit.setHint(`클리어! ${formatMonster(monsterScore(state))}`, "good");
		if (kit.gameTime(now) === null) return kit.setHint("맨 앞 몬스터와 같은 모양 버튼!");
		if (locked(now)) return kit.setHint("틀렸어요! 잠깐 멈춤", "bad");
		if (isDragon()) return kit.setHint("드래곤! FINISH 연타!", "good");
		kit.setHint("▲빨강 · ■초록 · ●파랑");
	}

	kit.run((now) => {
		drawDungeon(now);
		drawDragon(now);
		drawQueue(now);
		drawHero(now);
		drawTop();
		drawLockBar(now);
		updateHint(now);
	});

	return {
		labels: {
			red: { text: "▲", enabled: true },
			green: { text: "■", enabled: true },
			blue: { text: "●", enabled: true },
			finish: { text: "FINISH", enabled: true },
		},
		press(button, t) {
			const before = state;
			state = monsterPress(state, queue, button, t);
			if (state === before) return;
			const now = performance.now();
			const kind = state.event?.kind;
			if (kind === "miss") {
				const front = frontMonster(state, queue);
				if (front !== null) {
					const [x, y] = slotOf(MONSTERS[front], 0, now);
					kit.popup(CROSS, x + Math.floor(MONSTERS[front].w / 2), y - 6, 500, 0, "mark");
				}
				kit.shake(1, 200);
				arcade.wrong();
				buzz(120);
				return;
			}
			attackAt = now;
			slashAt = kind === "hit" ? [FRONT_CX - 4, FLOOR_Y - 13] : [DRAGON_X + 1, DRAGON_Y + 6];
			if (kind === "hit") {
				// 쓰러뜨린 몬스터는 맨 앞 자리에서 부서진다
				const defeated = queue[state.defeated - 1];
				if (defeated !== undefined) {
					const art = MONSTERS[defeated];
					kit.emit(shatter(art, FRONT_CX - Math.floor(art.w / 2), FLOOR_Y - art.h + 1, Math.random, 60, 700, 0.5));
				}
				advanceAt = now;
				arcade.slash();
				if (isDragon()) {
					dragonAt = now;
					kit.popup(BOSS_TEXT, W / 2, 20, 1100, 6);
					kit.shake(2, 400);
					arcade.roar();
				}
			} else if (kind === "dragon") {
				dragonHitAt = now;
				kit.emit(sparkle(DRAGON_X + 6, DRAGON_Y + 12, [C.y, C.w, C.o], Math.random, 6, 40, 300));
				arcade.hit();
			} else if (kind === "clear") {
				kit.emit(shatter(DRAGON, DRAGON_X, DRAGON_Y, Math.random, 90, 1100, 0.5));
				kit.popup(CLEAR_TEXT, W / 2, 20, 1800, 8);
				kit.flash(C.w, 60);
				kit.shake(3, 450);
				arcade.fanfare();
			}
		},
		frame(t) {
			kit.sync(t);
		},
		score: () => monsterScore(state),
	};
};
