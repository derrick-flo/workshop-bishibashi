import type { GameState, Round } from "../domain/game";
import { GAMES, isGameId } from "../domain/games/catalog";
import type { Player, PlayerId } from "../domain/player";
import { submittableScore } from "../domain/score";
import type { ServerMessage } from "../protocol";
import { arcade } from "./arcade-sound";
import { createServerClock } from "./clock";
import { type Controller, createController } from "./controller";
import { applyCrispUnits } from "./crisp";
import { esc, pick, store } from "./dom";
import { MOUNTS } from "./games";
import { gameIcon } from "./games/art";
import type { GameView } from "./games/types";
import { type ConnectionStatus, connect } from "./net";
import { mountDemo } from "./games/demo";
import { connectingScreen, finishScreen, introScreen, joinScreen, lobbyScreen, resultScreen, waitScreen } from "./player/screens";
import { buzz, sfx, soundReady, unlockSound } from "./sound";
import { keepAwake } from "./wake";

const TOKEN_KEY = "bishibashi.token";
const PENDING_KEY = "bishibashi.pending";
/** 기록을 보내고 이 시간 안에 서버가 받았다는 소식이 없으면 연결을 새로 한다 */
const ACK_WAIT_MS = 1500;
/** 서버가 받을 때까지 이 간격으로 다시 보낸다 */
const RESEND_MS = 2000;
/** 상태를 받을 때마다 다시 보내되 이 간격보다 자주는 보내지 않는다(라운드 끝에 몰릴 때 중복을 줄인다) */
const MIN_RESEND_GAP_MS = 700;

/**
 * 게임은 끝났는데 아직 서버가 받았다고 확인하지 않은 기록.
 * 라운드 번호만으로는 취소 후 재경기·처음부터 다시 한 라운드와 구분이 안 돼서 시작 시각(playAt)도 같이 본다.
 */
type Pending = { readonly roundNo: number; readonly playAt: number; readonly score: number };


type View = {
	readonly game: GameState | null;
	readonly me: PlayerId | null;
	/** 서버가 이 폰이 누구인지 한 번이라도 알려줬는지 */
	readonly identified: boolean;
	readonly status: ConnectionStatus;
	/** 이름 고르기에서 확인을 기다리는 이름 */
	readonly picking: PlayerId | null;
	readonly notice: string | null;
};

/** 지금 진행 중인 미니게임 한 판. 화면을 다시 그리지 않고 이 안에서만 움직인다. */
type Run = {
	readonly roundNo: number;
	readonly playAt: number;
	readonly practice: boolean;
	readonly perfPlayAt: number;
	readonly durationMs: number;
	readonly maxScore: number;
	readonly formatScore: (score: number) => string;
	readonly game: GameView;
	readonly controller: Controller;
	ended: boolean;
	countdown: number | null;
	frameId: number;
	/** 화면 갱신이 멈춰도(다른 앱으로 갔을 때 등) 끝나는 시각에 기록을 내도록 따로 건 타이머 */
	endTimer: number;
};

const REJECTION_TEXT: Readonly<Record<string, string>> = {
	already_claimed: "그 이름은 이미 누가 골랐어요. 진행자에게 말해 주세요.",
	unknown_player: "명단이 바뀌었어요. 다시 골라 주세요.",
	too_late: "기록이 마감 뒤에 도착했어요.",
};

/** 이 거절을 받으면 보관한 기록을 더 보내지 않는다(이미 받았거나, 지난 라운드거나, 받을 수 없는 기록) */
const DROP_PENDING_ON = new Set(["already_submitted", "wrong_round", "wrong_phase", "not_participant", "too_late", "invalid_score"]);

const root = pick(document, "#app");
const banner = pick(document, "#banner");
const clock = createServerClock();

let view: View = {
	game: null,
	me: null,
	identified: false,
	status: "offline",
	picking: null,
	notice: null,
};
let run: Run | null = null;
let painted: string | null = null;
let pending: Pending | null = null;
const isPendingFor = (round: Pick<Round, "no" | "playAt">) => pending !== null && pending.roundNo === round.no && pending.playAt === round.playAt;
let resendTimer = 0;
let ackTimer = 0;
let lastSubmitAt = Number.NEGATIVE_INFINITY;
/** 입장 토큰. 저장소가 막힌 브라우저(사생활 보호 모드 등)에서도 이 화면이 살아 있는 동안은 다시 붙을 수 있게 메모리에도 둔다. */
let token: string | null = store.get(TOKEN_KEY);
let resultSoundFor = 0;
let noticeTimer = 0;

applyCrispUnits();

const connection = connect("ws", {
	onOpen: () => connection.send({ type: "hello", token }),
	onMessage: handleMessage,
	onStatus: (status) => update({ status }),
});
// 새로고침 전에 못 보낸 기록이 있으면 다시 보내기 시작한다
setPending(readPending());

function setToken(next: string | null): void {
	token = next;
	store.set(TOKEN_KEY, next);
}

function update(patch: Partial<View>): void {
	view = { ...view, ...patch };
	render();
}

function handleMessage(message: ServerMessage): void {
	switch (message.type) {
		case "state":
			clock.sample(message.serverNow);
			update({ game: message.game });
			return flushPending(false);
		case "you":
			// 토큰이 무효가 됐거나(진행자가 입장을 풀었거나) 새로 입장했을 때 보관한 토큰을 바꾼다
			if (message.token !== null) setToken(message.token);
			if (message.playerId === null) setToken(null);
			update({ me: message.playerId, identified: true });
			// 새 연결이면 보관한 기록을 바로 다시 보낸다
			return flushPending(true);
		case "saved":
			if (!isPendingFor({ no: message.roundNo, playAt: message.playAt })) return;
			markAck("saved");
			return setPending(null);
		case "rejected":
			if (message.reason === "already_submitted") markAck("saved");
			else if (DROP_PENDING_ON.has(message.reason)) markAck("lost");
			if (DROP_PENDING_ON.has(message.reason)) setPending(null);
			return notify(REJECTION_TEXT[message.reason] ?? null);
	}
}

function notify(text: string | null): void {
	if (text === null) return;
	clearTimeout(noticeTimer);
	update({ notice: text });
	noticeTimer = window.setTimeout(() => update({ notice: null }), 3500);
}

// ---------- 기록 보내기 ----------

function readPending(): Pending | null {
	try {
		const raw = store.get(PENDING_KEY);
		const value: unknown = raw === null ? null : JSON.parse(raw);
		if (typeof value !== "object" || value === null) return null;
		const { roundNo, playAt, score } = value as Record<string, unknown>;
		return typeof roundNo === "number" && typeof playAt === "number" && typeof score === "number" ? { roundNo, playAt, score } : null;
	} catch {
		return null;
	}
}

/** 보관할 기록을 바꾼다. 기록이 있는 동안에는 서버가 받을 때까지 주기적으로 다시 보낸다. */
function setPending(next: Pending | null): void {
	pending = next;
	store.set(PENDING_KEY, next === null ? null : JSON.stringify(next));
	if (next === null) {
		clearInterval(resendTimer);
		clearTimeout(ackTimer);
		resendTimer = 0;
		ackTimer = 0;
		return;
	}
	if (resendTimer === 0) resendTimer = window.setInterval(() => flushPending(true), RESEND_MS);
}

/**
 * 못 보낸 기록이 있으면 보낸다. 서버가 받은 게 보이면 그만 보내고, 라운드가 지나갔으면 버린다.
 * force가 아니면 직전에 보낸 지 얼마 안 됐을 때 건너뛴다.
 */
function flushPending(force: boolean): void {
	const { game, me } = view;
	if (pending === null || game === null || me === null) return;
	const round = game.phase.kind === "playing" || game.phase.kind === "results" ? game.phase.round : null;
	if (round === null || !isPendingFor(round)) {
		markAck("lost");
		return setPending(null);
	}
	if (round.scores[me] !== undefined) {
		markAck("saved");
		return setPending(null);
	}
	if (game.phase.kind !== "playing") {
		markAck("lost");
		return setPending(null);
	}
	if (!force && performance.now() - lastSubmitAt < MIN_RESEND_GAP_MS) return;
	if (connection.send({ type: "submit", roundNo: pending.roundNo, playAt: pending.playAt, score: pending.score })) lastSubmitAt = performance.now();
}

/** 게임 화면의 '보내는 중…'을 결과에 맞게 바꾼다 */
function markAck(result: "saved" | "lost"): void {
	const note = root.querySelector<HTMLElement>("[data-ack]");
	if (note === null || note.dataset.ack !== "sending") return;
	note.dataset.ack = result;
	note.textContent = result === "saved" ? "서버에 저장됨 ✓ 다른 사람을 기다리는 중…" : "기록이 늦게 도착했어요";
}

// ---------- 그리기 ----------

function render(): void {
	renderBanner();
	const { game } = view;
	if (game === null || !view.identified) return paint(connectingScreen());
	const me = game.players.find((player) => player.id === view.me) ?? null;
	if (me === null) {
		stopRun();
		return paint(joinScreen(game, view.picking));
	}
	if (game.phase.kind === "playing") return startRun(game.phase.round, me);
	stopRun();
	if (game.phase.kind === "intro") {
		paint(introScreen(game));
		return mountIntroDemo();
	}
	if (game.phase.kind === "results") {
		playResultSound(game.phase.round, me);
		return paint(resultScreen(game, game.phase.round, me));
	}
	if (game.phase.kind === "finished") return paint(finishScreen(game, me));
	return paint(lobbyScreen(game, me, soundReady()));
}

/** 설명 화면의 시연을 한 번만 붙인다(상태가 와서 다시 그려도 이어서 돈다) */
function mountIntroDemo(): void {
	const box = root.querySelector<HTMLElement>("[data-demo]");
	const gameId = box?.dataset.demo;
	if (box === null || box.childElementCount > 0 || gameId === undefined || !isGameId(gameId)) return;
	mountDemo(box, gameId);
}

function paint(html: string): void {
	if (painted === html) return;
	painted = html;
	root.innerHTML = html;
}

function renderBanner(): void {
	const text =
		view.status === "online" ? view.notice : view.status === "refused" ? "서버에 연결할 수 없어요" : "연결이 끊겼어요 · 다시 연결하는 중…";
	banner.textContent = text ?? "";
	banner.hidden = text === null;
	banner.dataset.tone = view.status === "online" ? "notice" : "alert";
}

function playResultSound(round: Round, me: Player): void {
	if (resultSoundFor === round.no || !round.participantIds.includes(me.id)) return;
	resultSoundFor = round.no;
	const submitted = round.scores[me.id] !== undefined;
	if (submitted) sfx.good();
	else sfx.bad();
	buzz(submitted ? 60 : 250);
}

// ---------- 미니게임 한 판 ----------

function startRun(round: Round, me: Player): void {
	// 같은 번호라도 취소 후 다시 시작한 판이면 새로 한다
	if (run !== null && run.roundNo === round.no && run.playAt === round.playAt) return;
	stopRun();
	const info = GAMES[round.gameId];
	const practice = !round.participantIds.includes(me.id);
	const perfPlayAt = performance.now() + (round.playAt - clock.now());
	// 이미 기록을 냈거나 보내는 중이면 같은 라운드를 다시 하지 않는다(새로고침 등)
	if (!practice && (round.scores[me.id] !== undefined || isPendingFor(round))) {
		return paint(waitScreen("기록을 보냈어요", "다른 사람을 기다리는 중…"));
	}
	if (performance.now() > perfPlayAt + info.durationMs) {
		return paint(waitScreen("이번 게임은 끝났어요", practice ? "다음 라운드부터 같이 해요!" : "기록이 없어서 이번 라운드는 0점이에요"));
	}
	painted = null;
	root.innerHTML = `<section class="play ax-play" data-game="${round.gameId}">
		<header class="play__top ax-play__top">
			<span class="ax-badge${practice ? "" : " ax-badge--round"}">${practice ? "연습" : `R${round.no}`}</span>
			<span class="play__title ax-play__title">${gameIcon(round.gameId, "ax-play__icon")}${esc(info.title)}</span>
			<span class="play__timer ax-timer" aria-label="남은 시간">${(info.durationMs / 1000).toFixed(1)}</span>
		</header>
		<div class="play__stage"></div>
		<div class="play__overlay ax-overlay" role="status"></div>
	</section>`;
	const game = MOUNTS[round.gameId](pick(root, ".play__stage"), round.seed);
	const controller = createController((button, at) => {
		const t = at - perfPlayAt;
		if (run === null || run.ended || t < 0 || t > info.durationMs) return;
		run.game.press(button, t);
	});
	controller.setLabels(game.labels);
	pick(root, ".play").append(controller.element);
	run = {
		roundNo: round.no,
		playAt: round.playAt,
		practice,
		perfPlayAt,
		durationMs: info.durationMs,
		maxScore: info.maxScore,
		formatScore: info.formatScore,
		game,
		controller,
		ended: false,
		countdown: null,
		frameId: 0,
		endTimer: 0,
	};
	const current = run;
	current.endTimer = window.setTimeout(
		() => {
			if (run === current && !current.ended) endRun(current);
		},
		Math.max(0, perfPlayAt + info.durationMs - performance.now()) + 50,
	);
	current.frameId = requestAnimationFrame(tick);
}

function tick(now: number): void {
	const current = run;
	if (current === null) return;
	const t = now - current.perfPlayAt;
	const overlay = root.querySelector<HTMLElement>(".play__overlay");
	const timer = root.querySelector<HTMLElement>(".play__timer");
	if (overlay === null || timer === null) return;

	if (t < 0) {
		showCountdown(current, overlay, t);
	} else if (t <= current.durationMs) {
		if (!current.controller.element.classList.contains("is-active")) {
			current.controller.setActive(true);
			sfx.go();
			overlay.className = "play__overlay ax-overlay";
			overlay.innerHTML = `<p class="ax-go">GO!</p>`;
			setTimeout(() => {
				if (run === current && !current.ended) overlay.innerHTML = "";
			}, 450);
		}
		current.game.frame(t);
		const left = (current.durationMs - t) / 1000;
		timer.textContent = left.toFixed(1);
		timer.classList.toggle("is-hurry", left <= 3);
	} else if (!current.ended) {
		endRun(current);
	}
	current.frameId = requestAnimationFrame(tick);
}

function showCountdown(current: Run, overlay: HTMLElement, t: number): void {
	const seconds = Math.ceil(-t / 1000);
	if (seconds === current.countdown) return;
	current.countdown = seconds;
	overlay.className = "play__overlay ax-overlay is-counting";
	if (seconds > 3) {
		overlay.innerHTML = `<p class="ax-ready">READY</p>`;
		return;
	}
	overlay.innerHTML = `<p class="ax-count" data-n="${seconds}">${seconds}</p>`;
	sfx.tick();
}

function endRun(current: Run): void {
	current.ended = true;
	current.controller.setActive(false);
	const score = submittableScore(current.game.score(), current.maxScore);
	sfx.end();
	arcade.drum();
	pick(root, ".play__timer").textContent = "0.0";
	const overlay = pick(root, ".play__overlay");
	overlay.className = "play__overlay ax-overlay is-done";
	overlay.innerHTML = `<div class="ax-done ax-box">
		<p class="ax-done__head">TIME UP!</p>
		<p class="ax-done__label">${current.practice ? "연습 기록" : "내 기록"}</p>
		<b class="ax-done__score">${esc(current.formatScore(score))}</b>
		<small class="ax-done__note" ${current.practice ? "" : 'data-ack="sending"'}>${current.practice ? "순위에는 들어가지 않아요" : "기록 보내는 중…"}</small>
	</div>`;
	if (current.practice) return;
	setPending({ roundNo: current.roundNo, playAt: current.playAt, score });
	flushPending(true);
	// 보냈는데 답이 없으면 연결이 조용히 끊긴 것일 수 있다. 새로 붙으면 hello 뒤에 다시 보낸다.
	clearTimeout(ackTimer);
	ackTimer = window.setTimeout(() => {
		if (isPendingFor({ no: current.roundNo, playAt: current.playAt })) connection.reconnect();
	}, ACK_WAIT_MS);
}

function stopRun(): void {
	if (run === null) return;
	cancelAnimationFrame(run.frameId);
	clearTimeout(run.endTimer);
	run.controller.destroy();
	run = null;
}

// ---------- 입력 ----------

let awake = false;
document.addEventListener("pointerdown", () => {
	unlockSound();
	if (!awake) {
		awake = true;
		keepAwake();
	}
});

root.addEventListener("click", (event) => {
	const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
	if (target === null) return;
	switch (target.dataset.action) {
		case "pick":
			return update({ picking: target.dataset.id ?? null });
		case "unpick":
			return update({ picking: null });
		case "claim": {
			const playerId = target.dataset.id;
			if (playerId === undefined) return;
			if (connection.send({ type: "claim", playerId })) return update({ picking: null });
			return notify("연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요.");
		}
		case "sound":
			// 소리가 켜지는 데 잠깐 걸려서 조금 뒤에 버튼을 감춘다
			unlockSound();
			painted = null;
			setTimeout(render, 100);
			return;
	}
});

render();
