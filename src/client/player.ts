import type { GameState, Phase, Round, Upcoming } from "../domain/game";
import { GAMES } from "../domain/games/catalog";
import type { Player, PlayerId } from "../domain/player";
import { rankScores } from "../domain/ranking";
import type { ServerMessage } from "../protocol";
import { type Controller, createController } from "./controller";
import { esc, pick, serverTime, store } from "./dom";
import { MOUNTS } from "./games";
import type { GameView } from "./games/types";
import { type ConnectionStatus, connect } from "./net";
import { buzz, sfx, soundReady, unlockSound } from "./sound";
import { keepAwake } from "./wake";

const TOKEN_KEY = "bishibashi.token";
const PENDING_KEY = "bishibashi.pending";

/** 게임은 끝났는데 아직 서버가 받았다고 확인하지 않은 기록 */
type Pending = { readonly roundNo: number; readonly score: number };

type View = {
	readonly game: GameState | null;
	readonly offsetMs: number;
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
	readonly practice: boolean;
	readonly perfPlayAt: number;
	readonly durationMs: number;
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

const root = pick(document, "#app");
const banner = pick(document, "#banner");

let view: View = {
	game: null,
	offsetMs: 0,
	me: null,
	identified: false,
	status: "offline",
	picking: null,
	notice: null,
};
let run: Run | null = null;
let painted: string | null = null;
let pending: Pending | null = readPending();
let resultSoundFor = 0;
let noticeTimer = 0;

const connection = connect("/ws", {
	onOpen: () => connection.send({ type: "hello", token: store.get(TOKEN_KEY) }),
	onMessage: handleMessage,
	onStatus: (status) => update({ status }),
});

function update(patch: Partial<View>): void {
	view = { ...view, ...patch };
	render();
}

function handleMessage(message: ServerMessage): void {
	switch (message.type) {
		case "state":
			update({ game: message.game, offsetMs: message.serverNow - Date.now() });
			return flushPending();
		case "you":
			// 토큰이 무효가 됐거나(진행자가 입장을 풀었거나) 새로 입장했을 때 보관한 토큰을 바꾼다
			if (message.token !== null) store.set(TOKEN_KEY, message.token);
			if (message.playerId === null) store.set(TOKEN_KEY, null);
			update({ me: message.playerId, identified: true });
			return flushPending();
		case "rejected":
			if (["already_submitted", "wrong_round", "wrong_phase", "not_participant", "too_late"].includes(message.reason)) {
				setPending(null);
			}
			return notify(REJECTION_TEXT[message.reason] ?? null);
	}
}

function notify(text: string | null): void {
	if (text === null) return;
	clearTimeout(noticeTimer);
	update({ notice: text });
	noticeTimer = window.setTimeout(() => update({ notice: null }), 3500);
}

function readPending(): Pending | null {
	try {
		const raw = store.get(PENDING_KEY);
		return raw === null ? null : (JSON.parse(raw) as Pending);
	} catch {
		return null;
	}
}

function setPending(next: Pending | null): void {
	pending = next;
	store.set(PENDING_KEY, next === null ? null : JSON.stringify(next));
}

/** 못 보낸 기록이 있으면 보낸다. 서버가 이미 받았거나 라운드가 지나갔으면 버린다. */
function flushPending(): void {
	const { game, me } = view;
	if (pending === null || game === null || me === null) return;
	if (game.phase.kind !== "playing" || game.phase.round.no !== pending.roundNo) return setPending(null);
	if (game.phase.round.scores[me] !== undefined) return setPending(null);
	connection.send({ type: "submit", roundNo: pending.roundNo, score: pending.score });
}

// ---------- 그리기 ----------

function render(): void {
	renderBanner();
	const { game } = view;
	if (game === null || !view.identified) return paint(`<section class="screen screen--center"><p class="lead">연결 중…</p></section>`);
	const me = game.players.find((player) => player.id === view.me) ?? null;
	if (me === null) {
		stopRun();
		return paint(joinScreen(game));
	}
	if (game.phase.kind === "playing") return startRun(game.phase.round, me);
	stopRun();
	if (game.phase.kind === "results") return paint(resultScreen(game.phase, me));
	if (game.phase.kind === "finished") return paint(finishScreen(game, game.phase.winnerIds, me));
	return paint(lobbyScreen(game, me));
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

function joinScreen(game: GameState): string {
	if (game.players.length === 0) {
		return `<section class="screen screen--center">
			<h1 class="title">워크샵<br>비시바시</h1>
			<p class="lead">진행자가 명단을 준비하고 있어요.<br>잠시만 기다려 주세요.</p>
		</section>`;
	}
	const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "ko"));
	return `<section class="screen">
		<h1 class="title">워크샵<br>비시바시</h1>
		<p class="lead">내 이름을 눌러 입장하세요</p>
		<ul class="names">${players.map(nameItem).join("")}</ul>
	</section>`;
}

function nameItem(player: Player): string {
	if (player.claimed) {
		return `<li><button type="button" class="name" disabled>${esc(player.name)}<small>입장함</small></button></li>`;
	}
	if (view.picking === player.id) {
		return `<li class="names__confirm">
			<p><b>${esc(player.name)}</b> 님이 맞나요?</p>
			<button type="button" class="btn btn--primary" data-action="claim" data-id="${esc(player.id)}">네, 입장할게요</button>
			<button type="button" class="btn" data-action="unpick">아니에요</button>
		</li>`;
	}
	return `<li><button type="button" class="name" data-action="pick" data-id="${esc(player.id)}">${esc(player.name)}</button></li>`;
}

function lobbyScreen(game: GameState, me: Player): string {
	const aliveCount = game.players.filter((player) => player.status === "alive").length;
	return `<section class="screen">
		<p class="me">${esc(me.name)}</p>
		${statusBlock(game, me, aliveCount)}
		${game.upcoming === null ? `<p class="muted">다음 게임을 고르는 중이에요</p>` : upcomingCard(game.upcoming)}
		${soundReady() ? "" : `<button type="button" class="btn btn--wide" data-action="sound">🔊 소리 켜기</button>`}
	</section>`;
}

function statusBlock(game: GameState, me: Player, aliveCount: number): string {
	if (me.status === "out") {
		return `<p class="badge badge--out">탈락</p><p class="lead">게임은 연습으로 계속 같이 할 수 있어요.<br>남은 사람들을 응원해 주세요!</p>`;
	}
	if (game.roundsPlayed === 0) return `<p class="badge badge--ok">입장 완료</p><p class="lead">앞 화면을 봐주세요. 곧 시작해요!</p>`;
	if (me.status === "alive") return `<p class="badge badge--ok">생존</p><p class="lead">${aliveCount}명 남았어요</p>`;
	return `<p class="badge">대기</p><p class="lead">이미 시작한 게임이에요.<br>진행자에게 넣어 달라고 말해 주세요.</p>`;
}

function upcomingCard(upcoming: Upcoming): string {
	const info = GAMES[upcoming.gameId];
	return `<article class="next">
		<p class="next__label">다음 게임</p>
		<h2 class="next__title">${info.emoji} ${esc(info.title)}</h2>
		<p class="next__howto">${esc(info.howTo)}</p>
		${upcoming.cutCount > 0 ? `<p class="next__cut">이번 라운드 <b>${upcoming.cutCount}명</b> 탈락</p>` : ""}
	</article>`;
}

function resultScreen(phase: Extract<Phase, { kind: "results" }>, me: Player): string {
	const { round, cutIds } = phase;
	if (!round.participantIds.includes(me.id)) {
		return `<section class="screen screen--center"><p class="lead">결과 발표 중이에요.<br>앞 화면을 봐주세요!</p></section>`;
	}
	const info = GAMES[round.gameId];
	const mine = rankScores(round.participantIds, round.scores).find((entry) => entry.playerId === me.id);
	const cut = cutIds.includes(me.id);
	if (resultSoundFor !== round.no) {
		resultSoundFor = round.no;
		if (cut) sfx.bad();
		else sfx.good();
		buzz(cut ? 300 : 60);
	}
	return `<section class="screen screen--center verdict verdict--${cut ? "cut" : "safe"}">
		<p class="verdict__label">라운드 ${round.no} · ${info.emoji} ${esc(info.title)}</p>
		<p class="verdict__score">${mine?.score == null ? "기록 없음" : esc(info.formatScore(mine.score))}</p>
		<p class="verdict__rank">${mine?.rank == null ? "" : `${mine.rank}위 / ${round.participantIds.length}명`}</p>
		<p class="verdict__word">${cut ? "😱 탈락 위기…" : "😮‍💨 생존!"}</p>
		<p class="muted">진행자가 확정하기 전까지는 바뀔 수 있어요</p>
	</section>`;
}

function finishScreen(game: GameState, winnerIds: readonly PlayerId[], me: Player): string {
	const names = game.players.filter((player) => winnerIds.includes(player.id)).map((player) => player.name);
	const won = winnerIds.includes(me.id);
	return `<section class="screen screen--center champion${won ? " champion--me" : ""}">
		<p class="champion__crown" aria-hidden="true">👑</p>
		<h1 class="title">${won ? "우승!" : "우승"}</h1>
		<p class="champion__name">${esc(names.join(", ") || "없음")}</p>
	</section>`;
}

// ---------- 미니게임 한 판 ----------

function startRun(round: Round, me: Player): void {
	if (run !== null && run.roundNo === round.no) return;
	stopRun();
	painted = null;
	const info = GAMES[round.gameId];
	const practice = !round.participantIds.includes(me.id);
	root.innerHTML = `<section class="play" data-game="${round.gameId}">
		<header class="play__top">
			<span class="badge">${practice ? "연습" : `라운드 ${round.no}`}</span>
			<span class="play__title">${info.emoji} ${esc(info.title)}</span>
			<span class="play__timer" aria-label="남은 시간">${(info.durationMs / 1000).toFixed(1)}</span>
		</header>
		<div class="play__stage"></div>
		<div class="play__overlay" role="status"></div>
	</section>`;
	const perfPlayAt = performance.now() + (round.playAt - serverTime(view.offsetMs));
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
		practice,
		perfPlayAt,
		durationMs: info.durationMs,
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
			overlay.innerHTML = `<p class="overlay__go">시작!</p>`;
			setTimeout(() => {
				if (run === current && !current.ended) overlay.innerHTML = "";
			}, 450);
		}
		current.game.frame(t);
		timer.textContent = ((current.durationMs - t) / 1000).toFixed(1);
	} else if (!current.ended) {
		endRun(current);
	}
	current.frameId = requestAnimationFrame(tick);
}

function showCountdown(current: Run, overlay: HTMLElement, t: number): void {
	const seconds = Math.ceil(-t / 1000);
	if (seconds === current.countdown) return;
	current.countdown = seconds;
	if (seconds > 3) {
		overlay.innerHTML = `<p class="overlay__ready">준비!</p>`;
		return;
	}
	overlay.innerHTML = `<p class="overlay__count">${seconds}</p>`;
	sfx.tick();
}

function endRun(current: Run): void {
	current.ended = true;
	current.controller.setActive(false);
	const score = current.game.score();
	sfx.end();
	pick(root, ".play__timer").textContent = "0.0";
	pick(root, ".play__overlay").innerHTML = `<div class="overlay__done">
		<p>${current.practice ? "연습 기록" : "내 기록"}</p>
		<b>${esc(current.formatScore(score))}</b>
		<small>${current.practice ? "순위에는 들어가지 않아요" : "다른 사람을 기다리는 중…"}</small>
	</div>`;
	if (current.practice) return;
	setPending({ roundNo: current.roundNo, score });
	flushPending();
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
