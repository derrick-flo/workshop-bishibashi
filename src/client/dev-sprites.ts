/**
 * 개발용 미리보기(/_dev/sprites.html). 배포에는 들어가지 않는다(public/.assetsignore).
 * 게임마다 폰 크기 상자에 붙이고 정해 둔 입력을 흘려 넣어 장면을 눈으로 확인한다.
 *   ?game=balloon      한 게임만 크게
 *   ?script=burst      풍선을 터뜨리는 시나리오 등(게임별)
 *   ?w=390&h=360       무대 크기(CSS px)
 *   ?at=5000           이 시각(ms)에 멈춘 장면(스크린샷용)
 *   ?demo=1            게임 설명 화면의 시연(실제 게임 자동 플레이 + 손가락)으로 보기
 */
import { BALLOON } from "../domain/games/balloon";
import type { Button } from "../domain/games/button";
import { CANDY, candyTargets } from "../domain/games/candy";
import { GAME_IDS, GAMES, type GameId } from "../domain/games/catalog";
import { EYE, EYE_BUTTON, eyeDirections } from "../domain/games/eye";
import { GRILL, GRILL_SLOTS, grillCookTimes } from "../domain/games/grill";
import { JUDGE, judgeBouts, VERDICT_BUTTON, verdictOf } from "../domain/games/judge";
import { MONSTER, monsterQueue } from "../domain/games/monster";
import { shootingTargets, TARGET_BUTTON } from "../domain/games/shooting";
import { STAIRS, stairsCourse } from "../domain/games/stairs";
import { createController } from "./controller";
import { applyCrispUnits } from "./crisp";
import { esc } from "./dom";
import { MOUNTS } from "./games";
import { mountDemo } from "./games/demo";
import { DEMO_SCRIPTS, SEED as DEMO_SEED } from "./games/demo-scripts";
import { GAME_ART } from "./games/art";
import { BIG, SMALL, text } from "./pixel/font";
import { C, HEX } from "./pixel/palette";
import { toSvg } from "./pixel/svg";
import { unlockSound } from "./sound";

type Step = readonly [number, Button];

const params = new URLSearchParams(location.search);
/** 시연과 같은 seed: 따로 시나리오가 없는 게임은 시연 대본으로 돌려 본다 */
const SEED = DEMO_SEED;

function balloonScript(kind: string): readonly Step[] {
	const count = kind === "burst" ? BALLOON.burstPumps : BALLOON.fullPumps + 2;
	const pumps = Array.from({ length: count }, (_, i): Step => [300 + i * 150, i % 2 === 0 ? "red" : "blue"]);
	const wrong: readonly Step[] = kind === "wrong" ? [[300 + 4 * 150 + 70, "blue"]] : [];
	const finish: readonly Step[] = kind === "burst" ? [] : [[300 + count * 150 + 200, "finish"]];
	return [...pumps, ...wrong, ...finish].sort((a, b) => a[0] - b[0]);
}

function candyScript(kind: string): readonly Step[] {
	const steps: Step[] = [];
	let t = 400;
	candyTargets(SEED)
		.slice(0, 6)
		.forEach((target, jar) => {
			const presses: Button[] = [
				...Array.from({ length: Math.floor(target / 10) }, (): Button => "blue"),
				...Array.from({ length: Math.floor((target % 10) / 5) }, (): Button => "green"),
				...Array.from({ length: target % 5 }, (): Button => "red"),
			];
			// 두 번째 병에서 한 번 넘치게 한다
			if (kind !== "clean" && jar === 1) presses.splice(presses.length - 1, 0, "blue");
			for (const button of presses) {
				steps.push([t, button]);
				t += 260;
			}
			steps.push([t, "finish"]);
			t += 420;
		});
	return steps.filter(([at]) => at < CANDY.durationMs);
}

/** 맨 앞 몬스터와 같은 색을 누르고(일곱 번째는 일부러 틀린다) 드래곤은 FINISH 연타 */
function monsterScript(): readonly Step[] {
	const steps: Step[] = [];
	let t = 400;
	monsterQueue(SEED).forEach((color, i) => {
		if (i === 6) {
			steps.push([t, color === "red" ? "blue" : "red"]);
			t += MONSTER.lockMs + 200;
		}
		steps.push([t, color]);
		t += 280;
	});
	for (let i = 0; i < MONSTER.dragonHp; i++) {
		steps.push([t, "finish"]);
		t += 110;
	}
	return steps;
}

/** 이긴 쪽 버튼을 누르고, 일곱 판에 한 번은 일부러 틀린다 */
function judgeScript(): readonly Step[] {
	const bouts = judgeBouts(SEED);
	const steps: Step[] = [];
	let t = 500;
	let index = 0;
	for (let i = 0; i < 40 && t < JUDGE.durationMs; i++) {
		const right = VERDICT_BUTTON[verdictOf(bouts[index] ?? { left: "rock", right: "rock" })];
		const wrongTurn = i % 7 === 4;
		steps.push([t, wrongTurn ? (right === "red" ? "blue" : "red") : right]);
		if (!wrongTurn) index++;
		t += wrongTurn ? JUDGE.lockMs + 250 : 450;
	}
	return steps;
}

/** 표적이 뜨고 0.3초쯤 뒤 같은 버튼으로 쏜다. 다섯 번째는 다른 버튼, 열 번째는 쏘지 않고 보낸다 */
function shootingScript(): readonly Step[] {
	return shootingTargets(SEED).flatMap((target, i): Step[] => {
		if (i === 9) return [];
		const right = TARGET_BUTTON[target.color];
		return [[target.at + 300 + (i % 3) * 40.5, i === 4 ? (right === "red" ? "blue" : "red") : right]];
	});
}

/** 칸에 맞는 버튼으로 오르고(평지는 빨강·파랑 번갈아), 열한 번째 칸에서 한 번 틀려 넘어진다 */
function stairsScript(): readonly Step[] {
	const steps: Step[] = [];
	let t = 400;
	stairsCourse(SEED).forEach((step, i) => {
		if (i === 10) {
			steps.push([t, step === "stair" ? "red" : "green"]);
			t += STAIRS.fallMs + 150;
		}
		steps.push([t, step === "stair" ? "green" : i % 2 === 0 ? "red" : "blue"]);
		t += 260;
	});
	return steps;
}

/** 칸마다 알맞게 익으면 집는다. 두 번째 고기는 일부러 일찍(덜 익음), 네 번째는 늦게(탐) 집는다 */
function grillScript(): readonly Step[] {
	const cookTimes = grillCookTimes(SEED);
	const steps: Step[] = [];
	for (const slot of GRILL_SLOTS) {
		let placedAt: number = GRILL.firstAt[slot];
		for (const [piece, cookMs] of cookTimes[slot].entries()) {
			const late = cookMs + GRILL.goodMs + 900;
			const at = placedAt + (piece === 1 ? cookMs * 0.5 : piece === 3 ? late : cookMs + 150 + (piece % 2) * 120);
			if (at >= GRILL.durationMs) break;
			steps.push([at, slot]);
			placedAt = at + GRILL.refillMs;
		}
	}
	return steps.sort((a, b) => a[0] - b[0]);
}

function scriptFor(gameId: GameId, kind: string): readonly Step[] {
	switch (gameId) {
		case "balloon":
			return balloonScript(kind);
		case "candy":
			return candyScript(kind);
		case "eye":
			return eyeAnswers();
		case "monster":
			return monsterScript();
		case "judge":
			return judgeScript();
		case "shooting":
			return shootingScript();
		case "stairs":
			return stairsScript();
		case "grill":
			return grillScript();
		default:
			// 따로 시나리오가 없는 게임은 게임 설명 시연 대본으로 돌려 본다
			return DEMO_SCRIPTS[gameId]?.steps ?? [];
	}
}

/** 시력검사 대본은 몇 번째 문제인지 알아야 해서 맞힌 개수를 따라간다 */
function eyeAnswers(): readonly Step[] {
	const directions = eyeDirections(SEED);
	const steps: Step[] = [];
	let t = 500;
	let index = 0;
	for (let i = 0; i < 40 && t < EYE.durationMs; i++) {
		const right = EYE_BUTTON[directions[index] ?? "left"];
		const wrongTurn = i % 7 === 4;
		steps.push([t, wrongTurn ? (right === "red" ? "blue" : "red") : right]);
		if (!wrongTurn) index++;
		t += wrongTurn ? EYE.lockMs + 250 : 420;
	}
	return steps;
}

function mountLab(box: HTMLElement, gameId: GameId, kind: string, freezeAt: number | null): void {
	const info = GAMES[gameId];
	const steps = scriptFor(gameId, kind);
	const lead = 1500;
	const tail = 2500;

	function start(): void {
		box.innerHTML = `<section class="play ax-play dev-play" data-game="${gameId}">
			<header class="play__top"><span class="badge">연습</span><span class="play__title">${esc(info.title)}</span><span class="play__timer">${(info.durationMs / 1000).toFixed(1)}</span></header>
			<div class="play__stage"></div>
			<div class="play__overlay" role="status"></div>
		</section>`;
		const stage = box.querySelector<HTMLElement>(".play__stage");
		const play = box.querySelector<HTMLElement>(".play");
		if (stage === null || play === null) return;
		const view = MOUNTS[gameId](stage, SEED);
		const controller = createController(() => {});
		controller.setLabels(view.labels);
		controller.setActive(true);
		play.append(controller.element);
		const begin = performance.now() + lead;
		let next = 0;
		const loop = (now: number) => {
			if (!stage.isConnected) return;
			const t = freezeAt ?? now - begin;
			while (next < steps.length && (steps[next]?.[0] ?? Infinity) <= t) {
				const [at, button] = steps[next] ?? [0, "red"];
				view.press(button, at);
				next++;
			}
			if (t >= 0 && t <= info.durationMs) view.frame(t);
			const timer = box.querySelector(".play__timer");
			if (timer !== null) timer.textContent = (Math.max(0, info.durationMs - Math.max(0, t)) / 1000).toFixed(1);
			if (freezeAt === null && t > info.durationMs + tail) return start();
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	}
	start();
}

function palette(): string {
	return HEX.slice(1)
		.map((hex, i) => `<span class="dev-swatch" style="background:${hex}" title="${hex}">${Object.keys(C)[i] ?? ""}</span>`)
		.join("");
}

function fonts(): string {
	const sample = (value: string) => toSvg(text(BIG, value, C.y), "px-art dev-font");
	return [
		sample("ABCDEFGHIJKLM"),
		sample("NOPQRSTUVWXYZ"),
		sample("0123456789 +-.:!?/x"),
		toSvg(text(SMALL, "0123456789 .:+-/x!?", C.w), "px-art dev-font"),
	].join("");
}

function icons(): string {
	return GAME_IDS.map((id) => {
		const art = GAME_ART[id];
		return `<figure class="dev-icon">${art === undefined ? `<span>${GAMES[id].emoji}</span>` : toSvg(art.icon, "px-art")}<figcaption>${esc(GAMES[id].title)}</figcaption></figure>`;
	}).join("");
}

applyCrispUnits();
document.addEventListener("pointerdown", unlockSound);
const root = document.querySelector<HTMLElement>("#dev");
if (root !== null) {
	const only = params.get("game");
	const ids = GAME_IDS.filter((id) => only === null || id === only);
	const w = Number(params.get("w") ?? 360);
	const h = Number(params.get("h") ?? 700);
	const at = params.get("at");
	root.innerHTML = `
		<h1 class="dev-title">픽셀 미리보기</h1>
		<div class="dev-labs">${ids.map((id) => `<div class="dev-phone" data-id="${id}" style="width:${w}px;height:${h}px"></div>`).join("")}</div>
		<h2>게임 아이콘</h2><div class="dev-icons">${icons()}</div>
		<h2>글꼴</h2><div class="dev-fonts">${fonts()}</div>
		<h2>팔레트</h2><div class="dev-palette">${palette()}</div>`;
	for (const box of root.querySelectorAll<HTMLElement>(".dev-phone")) {
		const id = GAME_IDS.find((gameId) => gameId === box.dataset.id);
		if (id === undefined) continue;
		if (params.has("demo")) mountDemo(box, id);
		else mountLab(box, id, params.get("script") ?? "", at === null ? null : Number(at));
	}
}
