import { BALLOON } from "../../domain/games/balloon";
import type { Button } from "../../domain/games/button";
import { candyTargets } from "../../domain/games/candy";
import { ballSpot, chooseFrom, CUPS, cupRounds, SPOT_BUTTON, type Spot } from "../../domain/games/cups";
import type { GameId } from "../../domain/games/catalog";
import { EYE, EYE_BUTTON, eyeDirections } from "../../domain/games/eye";
import { GRILL, grillCookTimes } from "../../domain/games/grill";
import { JUDGE, judgeBouts, VERDICT_BUTTON, verdictOf } from "../../domain/games/judge";
import { inputFrom, MEMORY_START, memoryPress, memorySequence } from "../../domain/games/memory";
import { MONSTER, monsterQueue } from "../../domain/games/monster";
import { shootingTargets, TARGET_BUTTON } from "../../domain/games/shooting";
import { STAIRS, stairsCourse } from "../../domain/games/stairs";
import { bombDepths, TREASURE } from "../../domain/games/treasure";

/** 시연에서 누르는 입력 하나: [게임 시작 뒤 ms, 버튼] */
export type DemoStep = readonly [number, Button];

/** 게임 설명 화면에서 실제 게임을 저절로 플레이하는 대본. lengthMs가 지나면 처음부터 다시 한다. */
export type DemoScript = {
	readonly seed: number;
	readonly steps: readonly DemoStep[];
	readonly lengthMs: number;
};

/** 시연에 쓰는 seed. 개발용 미리보기(dev-sprites)도 같은 값을 쓴다 */
export const SEED = 20261026;

/** 빨강·파랑 번갈아 탁탁탁 → 다 차면 FINISH → 풍선이 날아간다 */
function balloonDemo(): DemoScript {
	const pumps = Array.from({ length: BALLOON.fullPumps + 1 }, (_, i): DemoStep => [200 + i * 105, i % 2 === 0 ? "red" : "blue"]);
	const finishAt = 200 + pumps.length * 105 + 250;
	return { seed: SEED, steps: [...pumps, [finishAt, "finish"]], lengthMs: finishAt + 2600 };
}

/** 라벨 숫자만큼 +10·+5·+1을 담고 FINISH, 두 병 */
function candyDemo(): DemoScript {
	const steps: DemoStep[] = [];
	let t = 400;
	for (const target of candyTargets(SEED).slice(0, 2)) {
		const presses: Button[] = [
			...Array.from({ length: Math.floor(target / 10) }, (): Button => "blue"),
			...Array.from({ length: Math.floor((target % 10) / 5) }, (): Button => "green"),
			...Array.from({ length: target % 5 }, (): Button => "red"),
		];
		for (const button of presses) {
			steps.push([t, button]);
			t += 300;
		}
		steps.push([t + 150, "finish"]);
		t += 900;
	}
	return { seed: SEED, steps, lengthMs: t + 900 };
}

/** 뚫린 쪽 버튼을 누르고, 네 번째는 일부러 틀려 잠깐 멈추는 모습까지 */
function eyeDemo(): DemoScript {
	const directions = eyeDirections(SEED);
	const steps: DemoStep[] = [];
	let t = 500;
	let index = 0;
	for (let i = 0; i < 9; i++) {
		const right = EYE_BUTTON[directions[index] ?? "left"];
		const wrongTurn = i === 3;
		steps.push([t, wrongTurn ? (right === "red" ? "blue" : "red") : right]);
		if (!wrongTurn) index++;
		t += wrongTurn ? EYE.lockMs + 300 : 480;
	}
	return { seed: SEED, steps, lengthMs: t + 600 };
}

/** 맨 앞 몬스터와 같은 버튼, 여섯 번째는 일부러 틀려 잠깐 멈추고, 드래곤은 FINISH 연타 */
function monsterDemo(): DemoScript {
	const steps: DemoStep[] = [];
	let t = 400;
	monsterQueue(SEED).forEach((color, i) => {
		if (i === 5) {
			steps.push([t, color === "red" ? "blue" : "red"]);
			t += MONSTER.lockMs + 200;
		}
		steps.push([t, color]);
		t += 260;
	});
	for (let i = 0; i < MONSTER.dragonHp; i++) {
		steps.push([t, "finish"]);
		t += 100;
	}
	return { seed: SEED, steps, lengthMs: t + 2100 };
}

/** 이긴 쪽 버튼을 누르고, 네 번째는 일부러 틀려 잠깐 멈추는 모습까지 */
function judgeDemo(): DemoScript {
	const bouts = judgeBouts(SEED);
	const steps: DemoStep[] = [];
	let t = 500;
	let index = 0;
	for (let i = 0; i < 9; i++) {
		const right = VERDICT_BUTTON[verdictOf(bouts[index] ?? { left: "rock", right: "rock" })];
		const wrongTurn = i === 3;
		steps.push([t, wrongTurn ? (right === "red" ? "blue" : "red") : right]);
		if (!wrongTurn) index++;
		t += wrongTurn ? JUDGE.lockMs + 300 : 520;
	}
	return { seed: SEED, steps, lengthMs: t + 600 };
}

/** 표적이 뜨면 같은 모양 버튼으로 쏘고, 네 번째는 일부러 다른 버튼 */
function shootingDemo(): DemoScript {
	const targets = shootingTargets(SEED).slice(0, 7);
	const steps = targets.map((target, i): DemoStep => {
		const right = TARGET_BUTTON[target.color];
		return [target.at + 330, i === 3 ? (right === "red" ? "blue" : "red") : right];
	});
	return { seed: SEED, steps, lengthMs: (targets[targets.length - 1]?.until ?? 8000) + 900 };
}

/** 평지는 빨강·파랑, 계단은 초록으로 오르고, 일곱 번째 칸에서 일부러 틀려 넘어진다 */
function stairsDemo(): DemoScript {
	const steps: DemoStep[] = [];
	let t = 400;
	stairsCourse(SEED)
		.slice(0, 16)
		.forEach((step, i) => {
			if (i === 6) {
				steps.push([t, step === "stair" ? "red" : "green"]);
				t += STAIRS.fallMs + 200;
			}
			steps.push([t, step === "stair" ? "green" : i % 2 === 0 ? "red" : "blue"]);
			t += 330;
		});
	return { seed: SEED, steps, lengthMs: t + 1200 };
}

/** 칸마다 노릇해지면 집는다. 가운데 첫 고기는 일부러 일찍 집어 꽝(덜 익음) */
function grillDemo(): DemoScript {
	const cookTimes = grillCookTimes(SEED);
	const steps: DemoStep[] = [];
	for (const slot of ["red", "green", "blue"] as const) {
		let placedAt: number = GRILL.firstAt[slot];
		for (const [piece, cookMs] of cookTimes[slot].slice(0, 2).entries()) {
			const at = placedAt + (slot === "green" && piece === 0 ? Math.round(cookMs / 2) : cookMs + 200);
			steps.push([at, slot]);
			placedAt = at + GRILL.refillMs;
		}
	}
	const sorted = steps.sort((a, b) => a[0] - b[0]);
	return { seed: SEED, steps: sorted, lengthMs: (sorted[sorted.length - 1]?.[0] ?? 8000) + 1500 };
}

/** 보여준 순서를 따라 눌러 3개를 맞히고, 4개는 세 번째에서 일부러 틀렸다가 다시 보고 맞힌다 */
function memoryDemo(): DemoScript {
	const sequence = memorySequence(SEED);
	const steps: DemoStep[] = [];
	let state = MEMORY_START;
	const answer = (mistakeAt: number | null) => {
		const length = state.length;
		let t = inputFrom(state) + 350;
		for (let i = 0; i < length; i++) {
			const right = sequence[i] ?? "red";
			const button = i === mistakeAt ? (right === "red" ? "blue" : "red") : right;
			steps.push([t, button]);
			state = memoryPress(state, sequence, button, t);
			if (i === mistakeAt) return;
			t += 330;
		}
	};
	answer(null);
	answer(2);
	answer(null);
	return { seed: SEED, steps, lengthMs: state.showAt + 1000 };
}

/** 다 섞이면 공이 든 컵을 고른다. 두 번째 판은 일부러 옆 컵 */
function cupsDemo(): DemoScript {
	const nextSpot: Readonly<Record<Spot, Spot>> = { 0: 1, 1: 2, 2: 0 };
	const steps: DemoStep[] = [];
	let roundAt: number = CUPS.firstAt;
	cupRounds(SEED)
		.slice(0, 3)
		.forEach((round, i) => {
			const t = chooseFrom(round, roundAt) + 400;
			const right = ballSpot(round);
			steps.push([t, SPOT_BUTTON[i === 1 ? nextSpot[right] : right]]);
			roundAt = t + CUPS.resultMs;
		});
	return { seed: SEED, steps, lengthMs: roundAt + 300 };
}

/** 첫 구덩이는 몇 칸 파고 챙기고, 둘째는 욕심내다 폭탄, 셋째는 두 칸 파고 챙긴다 */
function treasureDemo(): DemoScript {
	const bombs = bombDepths(SEED);
	const steps: DemoStep[] = [];
	let t = 500;
	const digButtons = ["red", "green", "blue"] as const;
	const dig = (count: number) => {
		for (let i = 0; i < count; i++) {
			steps.push([t, digButtons[i % digButtons.length] ?? "red"]);
			t += 450;
		}
	};
	const bank = () => {
		steps.push([t, "finish"]);
		t += 800;
	};
	dig(Math.min(3, (bombs[0] ?? 2) - 1));
	bank();
	dig(bombs[1] ?? 2);
	t += TREASURE.bombMs;
	dig(Math.min(2, (bombs[2] ?? 2) - 1));
	bank();
	return { seed: SEED, steps, lengthMs: t + 300 };
}

/** 시연 대본이 있는 게임. 없는 게임은 설명 글과 첫 장면만 보여준다. */
export const DEMO_SCRIPTS: Readonly<Partial<Record<GameId, DemoScript>>> = {
	balloon: balloonDemo(),
	candy: candyDemo(),
	eye: eyeDemo(),
	monster: monsterDemo(),
	judge: judgeDemo(),
	shooting: shootingDemo(),
	stairs: stairsDemo(),
	grill: grillDemo(),
	memory: memoryDemo(),
	cups: cupsDemo(),
	treasure: treasureDemo(),
};
