import { BALLOON } from "../../domain/games/balloon";
import type { Button } from "../../domain/games/button";
import { candyTargets } from "../../domain/games/candy";
import type { GameId } from "../../domain/games/catalog";
import { EYE, EYE_BUTTON, eyeDirections } from "../../domain/games/eye";
import { reactionSignals } from "../../domain/games/reaction";

/** 시연에서 누르는 입력 하나: [게임 시작 뒤 ms, 버튼] */
export type DemoStep = readonly [number, Button];

/** 게임 설명 화면에서 실제 게임을 저절로 플레이하는 대본. lengthMs가 지나면 처음부터 다시 한다. */
export type DemoScript = {
	readonly seed: number;
	readonly steps: readonly DemoStep[];
	readonly lengthMs: number;
};

const SEED = 20261026;

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

/** 기다렸다가 FIRE!가 뜨면 누르기, 두 판 */
function reactionDemo(): DemoScript {
	const signals = reactionSignals(SEED);
	const steps = signals.slice(0, 2).map((signal, i): DemoStep => [signal + 230 + i * 40, i === 0 ? "red" : "blue"]);
	return { seed: SEED, steps, lengthMs: (signals[1] ?? 6000) + 2400 };
}

/** 시연 대본이 있는 게임. 없는 게임은 설명 글과 첫 장면만 보여준다. */
export const DEMO_SCRIPTS: Readonly<Partial<Record<GameId, DemoScript>>> = {
	balloon: balloonDemo(),
	candy: candyDemo(),
	eye: eyeDemo(),
	reaction: reactionDemo(),
};
