import type { GameState, Round } from "../domain/game";
import { GAMES, isGameId } from "../domain/games/catalog";
import type { Button } from "../domain/games/button";
import type { PlayerId } from "../domain/player";
import type { ServerMessage } from "../protocol";
import { arcade } from "./arcade-sound";
import { connectingScreen, duelScreen, finishedScreen, introScreen, lobbyScreen, pointsModeScreen, resultScreen } from "./arena/screens";
import { createServerClock } from "./clock";
import { applyCrispUnits } from "./crisp";
import { pick } from "./dom";
import { confetti } from "./host/confetti";
import { MOUNTS } from "./games";
import { mountDemo } from "./games/demo";
import type { GameView } from "./games/types";
import { type ConnectionStatus, connect } from "./net";
import { sfx, unlockSound } from "./sound";

/**
 * 관전 화면(/arena). 토너먼트에서 두 사람이 붙는 모습을 모두가 같이 보는 프로젝터 화면이다.
 *
 * 두 폰의 플레이는 서버가 중계하는 버튼 누름(press)으로 되짚어 그린다. 게임 규칙은 seed와 입력만으로 정해지고
 * (domain/games/*), 화면은 GameView.press(button, t)·frame(t) 두 개로만 움직이기 때문에 같은 seed로 띄워 두고
 * 같은 입력을 같은 t에 넣어 주면 폰에서와 같은 장면이 나온다.
 *
 * 중계가 망을 건너오는 동안을 벌어 두려고 REPLAY_DELAY_MS 만큼 늦춰서 그린다(카운트다운도 같이 늦춘다).
 * 진행은 하지 않는다(진행자 메시지를 보낼 수 없는 role=arena 로 붙는다).
 */

/** 중계를 기다리는 여유. 이만큼 늦게 그려서 누른 입력이 제때 도착해 있게 한다. */
const REPLAY_DELAY_MS = 250;

type Press = { readonly button: Button; readonly t: number; readonly score: number };

/** 한쪽 플레이어의 되짚기용 화면 */
type Side = {
	readonly playerId: PlayerId;
	readonly view: GameView;
	readonly scoreBox: HTMLElement;
	/** 아직 되짚지 않은 입력(받은 순서 = t 오름차순) */
	queue: Press[];
	/** 폰이 알려 준 점수. 중계가 하나 빠져도 숫자는 맞게 보이도록 이 값을 먼저 쓴다. */
	reported: number | null;
	painted: string | null;
};

/** 지금 보여주는 1:1 대결 한 판 */
type Duel = {
	readonly roundNo: number;
	readonly playAt: number;
	/** 늦추기를 더한, 이 화면에서의 게임 시작 시각(performance.now 기준) */
	readonly perfPlayAt: number;
	readonly durationMs: number;
	readonly formatScore: (score: number) => string;
	readonly sides: readonly Side[];
	readonly clock: HTMLElement;
	readonly bar: HTMLElement;
	readonly overlay: HTMLElement;
	countdown: number | null;
	started: boolean;
	ended: boolean;
	frameId: number;
};

const stage = pick(document, "#stage");
const banner = pick(document, "#banner");
const clock = createServerClock();

let game: GameState | null = null;
let status: ConnectionStatus = "offline";
let painted: string | null = null;
let duel: Duel | null = null;
/** 결과 공개·우승 연출을 한 번만 하도록 기억한다 */
let revealedFor: string | null = null;

applyCrispUnits();

const connection = connect("ws?role=arena", {
	onOpen: () => connection.send({ type: "hello", token: null }),
	onMessage: handleMessage,
	onStatus: (next) => {
		status = next;
		render();
	},
});

// 아이폰·사파리는 화면을 한 번 눌러야 소리가 난다. 누르지 않으면 조용히 돌아서 진행자 화면 소리와 겹치지 않는다.
document.addEventListener("pointerdown", unlockSound);

function handleMessage(message: ServerMessage): void {
	if (message.type === "state") {
		clock.sample(message.serverNow);
		game = message.game;
		return render();
	}
	if (message.type === "press") return queuePress(message);
}

// ---------- 그리기 ----------

function render(): void {
	banner.hidden = status === "online";
	banner.textContent = status === "refused" ? "서버에 연결할 수 없어요" : "연결이 끊겼어요 · 다시 연결하는 중…";
	banner.dataset.tone = "alert";

	if (game === null) return paint(connectingScreen());
	if (game.mode !== "tournament") {
		stopDuel();
		return paint(pointsModeScreen());
	}
	if (game.phase.kind === "playing") return startDuel(game, game.phase.round);
	stopDuel();
	switch (game.phase.kind) {
		case "lobby":
			paint(lobbyScreen(game));
			break;
		case "intro":
			paint(introScreen(game));
			mountIntroDemo();
			break;
		case "results":
			paint(resultScreen(game, game.phase.round));
			break;
		case "finished":
			paint(finishedScreen(game));
			break;
	}
	effects(game);
}

function paint(html: string): void {
	if (painted === html) return;
	painted = html;
	stage.innerHTML = html;
}

/** 설명 화면의 시연을 한 번만 붙인다(상태가 와서 다시 그려도 이어서 돈다) */
function mountIntroDemo(): void {
	const box = stage.querySelector<HTMLElement>("[data-demo]");
	const gameId = box?.dataset.demo;
	if (box === null || box.childElementCount > 0 || gameId === undefined || !isGameId(gameId)) return;
	mountDemo(box, gameId);
}

/** 결과가 뜰 때 북소리, 우승자가 나올 때 팡파르와 색종이. 화면이 바뀔 때 한 번만. */
function effects(state: GameState): void {
	const key =
		state.phase.kind === "results"
			? `results:${state.phase.round.no}:${state.phase.round.playAt}`
			: state.phase.kind === "finished"
				? `finished:${state.history.length}`
				: null;
	if (key === null || key === revealedFor) {
		if (key === null) revealedFor = null;
		return;
	}
	revealedFor = key;
	if (state.phase.kind === "results") {
		setTimeout(() => arcade.drum(), 200);
		setTimeout(() => arcade.jar(), 700);
		return;
	}
	setTimeout(() => {
		arcade.fanfare();
		const box = stage.querySelector<HTMLElement>(".ax-arena--final");
		if (box !== null) confetti(box, 6000);
	}, 500);
}

// ---------- 1:1 대결 되짚기 ----------

function startDuel(state: GameState, round: Round): void {
	// 같은 번호라도 취소 후 다시 시작한 판이면 새로 띄운다
	if (duel !== null && duel.roundNo === round.no && duel.playAt === round.playAt) return;
	stopDuel();
	painted = null;
	stage.innerHTML = duelScreen(state, round);
	const info = GAMES[round.gameId];
	const sides = [...stage.querySelectorAll<HTMLElement>(".ax-duel__pane")].flatMap((pane): Side[] => {
		const playerId = pane.dataset.player ?? "";
		if (playerId === "") return [];
		return [
			{
				playerId,
				view: MOUNTS[round.gameId](pick(pane, ".ax-duel__stage"), round.seed),
				scoreBox: pick(pane, ".ax-duel__score"),
				queue: [],
				reported: null,
				painted: null,
			},
		];
	});
	duel = {
		roundNo: round.no,
		playAt: round.playAt,
		perfPlayAt: performance.now() + (round.playAt - clock.now()) + REPLAY_DELAY_MS,
		durationMs: info.durationMs,
		formatScore: info.formatScore,
		sides,
		clock: pick(stage, ".ax-duel__clock"),
		bar: pick(stage, ".ax-duel__bar > i"),
		overlay: pick(stage, ".ax-duel__overlay"),
		countdown: null,
		started: false,
		ended: false,
		frameId: 0,
	};
	duel.frameId = requestAnimationFrame(tick);
}

function stopDuel(): void {
	if (duel === null) return;
	cancelAnimationFrame(duel.frameId);
	duel = null;
}

/** 중계로 온 누름을 그 사람 줄에 쌓는다. 지금 판의 것이 아니면 버린다. */
function queuePress(message: Extract<ServerMessage, { type: "press" }>): void {
	if (duel === null || duel.roundNo !== message.roundNo || duel.playAt !== message.playAt) return;
	const side = duel.sides.find((other) => other.playerId === message.playerId);
	if (side === undefined) return;
	side.queue = [...side.queue, { button: message.button, t: message.t, score: message.score }];
}

function tick(now: number): void {
	const current = duel;
	if (current === null) return;
	current.frameId = requestAnimationFrame(tick);
	const t = now - current.perfPlayAt;
	for (const side of current.sides) {
		// 늦게 도착한 누름은 t가 이미 지나 있어서 바로 넣는다(장면이 조금 몰아서 움직인다)
		while (side.queue.length > 0 && (side.queue[0]?.t ?? Number.POSITIVE_INFINITY) <= t) {
			const press = side.queue.shift();
			if (press === undefined) break;
			side.view.press(press.button, press.t);
			side.reported = press.score;
		}
		if (t >= 0) side.view.frame(t);
		paintScore(current, side);
	}
	paintClock(current, t);
}

function paintScore(current: Duel, side: Side): void {
	// 한 번도 안 눌렀으면 비워 둔다(0점을 '실패'로 적는 게임이 있어서 숫자를 먼저 보여주지 않는다)
	const text = side.reported === null ? "-" : current.formatScore(side.reported);
	if (side.painted === text) return;
	side.painted = text;
	side.scoreBox.textContent = text;
}

/** 카운트다운 → 남은 시간 → 집계 중. 늦춰서 그리므로 폰보다 조금 뒤에 움직인다. */
function paintClock(current: Duel, t: number): void {
	if (t < 0) {
		const seconds = Math.ceil(-t / 1000);
		current.clock.textContent = seconds > 3 ? "READY" : String(seconds);
		current.bar.style.transform = "scaleX(1)";
		current.clock.classList.remove("is-hurry");
		if (seconds !== current.countdown) {
			current.countdown = seconds;
			current.overlay.className = "ax-duel__overlay ax-overlay is-counting";
			current.overlay.innerHTML = seconds > 3 ? `<p class="ax-ready">READY</p>` : `<p class="ax-count" data-n="${seconds}">${seconds}</p>`;
			if (seconds <= 3) sfx.tick();
		}
		return;
	}
	if (t <= current.durationMs) {
		if (!current.started) {
			current.started = true;
			sfx.go();
			current.overlay.className = "ax-duel__overlay ax-overlay";
			current.overlay.innerHTML = `<p class="ax-go">GO!</p>`;
			setTimeout(() => {
				if (duel === current && !current.ended) current.overlay.innerHTML = "";
			}, 450);
		}
		const left = (current.durationMs - t) / 1000;
		current.clock.textContent = left.toFixed(1);
		current.clock.classList.toggle("is-hurry", left <= 3);
		// 막대는 칸 단위로 줄어든다(부드럽게 줄면 픽셀 느낌이 깨진다)
		current.bar.style.transform = `scaleX(${Math.ceil((left / (current.durationMs / 1000)) * 40) / 40})`;
		return;
	}
	if (!current.ended) {
		current.ended = true;
		sfx.end();
		arcade.drum();
		current.overlay.innerHTML = "";
	}
	current.clock.textContent = "집계 중";
	current.clock.classList.remove("is-hurry");
	current.bar.style.transform = "scaleX(0)";
}

render();
