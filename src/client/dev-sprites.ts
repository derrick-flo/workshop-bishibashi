/**
 * 개발용 미리보기(/_dev/sprites.html). 배포에는 들어가지 않는다(public/.assetsignore).
 * 게임마다 폰 크기 상자에 붙이고 정해 둔 입력을 흘려 넣어 장면을 눈으로 확인한다.
 *   ?game=balloon      한 게임만 크게
 *   ?script=burst      풍선을 터뜨리는 시나리오 등(게임별)
 *   ?w=390&h=360       무대 크기(CSS px)
 *   ?at=5000           이 시각(ms)에 멈춘 장면(스크린샷용)
 */
import { BALLOON } from "../domain/games/balloon";
import type { Button } from "../domain/games/button";
import { CANDY, candyTargets } from "../domain/games/candy";
import { GAME_IDS, GAMES, type GameId } from "../domain/games/catalog";
import { EYE, EYE_BUTTON, eyeDirections } from "../domain/games/eye";
import { reactionSignals } from "../domain/games/reaction";
import { createController } from "./controller";
import { applyCrispUnits } from "./crisp";
import { esc } from "./dom";
import { MOUNTS } from "./games";
import { GAME_ART } from "./games/art";
import { BIG, SMALL, text } from "./pixel/font";
import { C, HEX } from "./pixel/palette";
import { toSvg } from "./pixel/svg";
import { unlockSound } from "./sound";

type Step = readonly [number, Button];

const params = new URLSearchParams(location.search);
const SEED = 20261026;

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

function reactionScript(): readonly Step[] {
	return reactionSignals(SEED).map((signal, i): Step => [i === 1 ? signal - 400 : signal + 180 + i * 40, "red"]);
}

function scriptFor(gameId: GameId, kind: string): readonly Step[] {
	switch (gameId) {
		case "balloon":
			return balloonScript(kind);
		case "candy":
			return candyScript(kind);
		case "eye":
			return eyeAnswers();
		case "reaction":
			return reactionScript();
		default:
			return [];
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
		if (id !== undefined) mountLab(box, id, params.get("script") ?? "", at === null ? null : Number(at));
	}
}
