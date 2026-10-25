import qrcode from "qrcode-generator";
import { type GameState, nextParticipants, type Phase, type Round, suggestCutCount } from "../domain/game";
import { GAME_IDS, GAMES } from "../domain/games/catalog";
import type { Player, PlayerId } from "../domain/player";
import { rankScores } from "../domain/ranking";
import type { HostMessage, ServerMessage } from "../protocol";
import { esc, pick, serverTime } from "./dom";
import { type ConnectionStatus, connect } from "./net";
import { sfx, unlockSound } from "./sound";

const KEY_STORE = "bishibashi.hostKey";

type View = {
	readonly game: GameState | null;
	readonly onlineIds: readonly PlayerId[];
	readonly offsetMs: number;
	readonly status: ConnectionStatus;
	readonly editingRoster: boolean;
	readonly selected: PlayerId | null;
	readonly notice: string | null;
};

const REJECTION_TEXT: Readonly<Record<string, string>> = {
	invalid_cut: "탈락 인원은 참가자 수보다 적어야 해요.",
	not_enough_players: "입장한 사람이 있어야 시작할 수 있어요.",
	no_upcoming: "먼저 게임을 고르세요.",
	roster_locked: "첫 라운드가 끝나면 명단을 바꿀 수 없어요.",
	wrong_phase: "지금은 할 수 없는 동작이에요.",
	not_host: "진행자 권한이 없어요.",
	bad_message: "형식이 맞지 않아요. 이름은 30자, 명단은 100명까지 넣을 수 있어요.",
};

const stage = pick(document, "#stage");
const controls = pick(document, "#controls");
const banner = pick(document, "#banner");

let view: View = {
	game: null,
	onlineIds: [],
	offsetMs: 0,
	status: "offline",
	editingRoster: false,
	selected: null,
	notice: null,
};
let paintedStage: string | null = null;
let paintedControls: string | null = null;
let noticeTimer = 0;
let lastCountdown: number | null = null;

/** 주소창의 키는 바로 지운다(프로젝터 화면에 키가 보이지 않게). 이 탭에서만 기억한다. */
function readHostKey(): string | null {
	const params = new URLSearchParams(location.search);
	const fromUrl = params.get("key");
	if (fromUrl !== null && fromUrl.length > 0) {
		sessionStorage.setItem(KEY_STORE, fromUrl);
		history.replaceState(null, "", location.pathname);
		return fromUrl;
	}
	return sessionStorage.getItem(KEY_STORE);
}

const hostKey = readHostKey();

if (hostKey === null) {
	showKeyGate("");
} else {
	const connection = connect(`/ws?role=host&key=${encodeURIComponent(hostKey)}`, {
		onOpen: () => connection.send({ type: "hello", token: null }),
		onMessage: handleMessage,
		onStatus: (status) => {
			if (status === "refused") return showKeyGate("진행자 키가 맞지 않아요. 다시 넣어 주세요.");
			update({ status });
		},
	});
	const send = (message: HostMessage) => {
		if (!connection.send(message)) notify("연결이 끊겨서 보내지 못했어요.");
	};
	stage.addEventListener("click", (event) => handleClick(event, send));
	controls.addEventListener("click", (event) => handleClick(event, send));
	requestAnimationFrame(tickClock);
}

function showKeyGate(message: string): void {
	sessionStorage.removeItem(KEY_STORE);
	controls.innerHTML = "";
	stage.innerHTML = `<section class="gate">
		<h1>진행자 화면</h1>
		${message ? `<p class="gate__error">${esc(message)}</p>` : ""}
		<form class="gate__form">
			<label for="host-key">진행자 키</label>
			<input id="host-key" name="key" type="password" autocomplete="off" required>
			<button type="submit" class="btn btn--primary">들어가기</button>
		</form>
	</section>`;
	pick<HTMLFormElement>(stage, ".gate__form").addEventListener("submit", (event) => {
		event.preventDefault();
		const key = new FormData(event.currentTarget as HTMLFormElement).get("key");
		if (typeof key !== "string" || key.length === 0) return;
		sessionStorage.setItem(KEY_STORE, key);
		location.reload();
	});
}

function update(patch: Partial<View>): void {
	view = { ...view, ...patch };
	render();
}

function handleMessage(message: ServerMessage): void {
	if (message.type === "state") {
		return update({ game: message.game, onlineIds: message.onlineIds, offsetMs: message.serverNow - Date.now() });
	}
	if (message.type === "rejected") notify(REJECTION_TEXT[message.reason] ?? `거절됨: ${message.reason}`);
}

function notify(text: string): void {
	clearTimeout(noticeTimer);
	update({ notice: text });
	noticeTimer = window.setTimeout(() => update({ notice: null }), 4000);
}

// ---------- 그리기 ----------

function render(): void {
	const offline = view.status !== "online";
	banner.hidden = !offline && view.notice === null;
	banner.textContent = offline ? "서버 연결이 끊겼어요 · 다시 연결하는 중…" : (view.notice ?? "");
	banner.dataset.tone = offline ? "alert" : "notice";

	const { game } = view;
	if (game === null) return paintStage(`<section class="gate"><p class="lead">연결 중…</p></section>`);
	// 명단을 고치는 중에는 입력이 날아가지 않게 앞 화면을 다시 그리지 않는다
	if (!view.editingRoster) paintStage(stageHtml(game));
	paintControls(controlsHtml(game));
}

function paintStage(html: string): void {
	if (paintedStage === html) return;
	paintedStage = html;
	stage.innerHTML = html;
	lastCountdown = null;
}

function paintControls(html: string): void {
	if (paintedControls === html) return;
	paintedControls = html;
	controls.innerHTML = html;
}

function stageHtml(game: GameState): string {
	switch (game.phase.kind) {
		case "lobby":
			return lobbyStage(game);
		case "playing":
			return roundStage(game.phase.round);
		case "results":
			return resultsStage(game, game.phase);
		case "finished":
			return championStage(game, game.phase.winnerIds);
	}
}

function lobbyStage(game: GameState): string {
	const next = game.upcoming === null ? "" : nextBanner(game.upcoming.gameId, game.upcoming.cutCount);
	if (game.roundsPlayed === 0) {
		const claimed = game.players.filter((player) => player.claimed).length;
		return `<section class="lobby">
			<div class="join">
				<div class="join__qr">${joinQr()}</div>
				<p class="join__url">${esc(location.host)}</p>
				<p class="join__hint">폰 카메라로 찍고 내 이름을 누르세요</p>
			</div>
			<div class="people">
				<h2 class="people__title">입장 <b>${claimed}</b> / ${game.players.length}</h2>
				${game.players.length === 0 ? `<p class="lead">아래 ‘명단’ 버튼으로 참가자 이름을 넣어 주세요.</p>` : chips(game)}
			</div>
		</section>${next}`;
	}
	const alive = game.players.filter((player) => player.status === "alive").length;
	return `<section class="lobby lobby--between">
		<div class="people">
			<h2 class="people__title">생존 <b>${alive}</b>명</h2>
			${chips(game)}
		</div>
	</section>${next}`;
}

function joinQr(): string {
	const qr = qrcode(0, "M");
	qr.addData(`${location.origin}/`);
	qr.make();
	return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function chips(game: GameState): string {
	return `<ul class="chips">${game.players.map((player) => chip(player, game)).join("")}</ul>`;
}

function chip(player: Player, game: GameState): string {
	const online = view.onlineIds.includes(player.id);
	const classes = [
		"chip",
		`chip--${player.status}`,
		player.claimed ? "is-claimed" : "",
		online ? "is-online" : "",
		view.selected === player.id ? "is-selected" : "",
	].join(" ");
	const menu = view.selected === player.id ? playerMenu(player, game) : "";
	return `<li><button type="button" class="${classes}" data-action="select" data-id="${esc(player.id)}" aria-pressed="${view.selected === player.id}">
		<span class="chip__dot" aria-hidden="true"></span>${esc(player.name)}
	</button>${menu}</li>`;
}

function playerMenu(player: Player, game: GameState): string {
	const canRevive = player.status !== "alive" && (game.roundsPlayed > 0 || player.status === "out");
	return `<div class="chip-menu">
		${canRevive ? `<button type="button" class="btn btn--small" data-action="alive" data-id="${esc(player.id)}">살리기</button>` : ""}
		${player.status !== "out" ? `<button type="button" class="btn btn--small" data-action="out" data-id="${esc(player.id)}">탈락시키기</button>` : ""}
		${player.claimed ? `<button type="button" class="btn btn--small" data-action="release" data-id="${esc(player.id)}">입장 풀기</button>` : ""}
	</div>`;
}

function nextBanner(gameId: keyof typeof GAMES, cutCount: number): string {
	const info = GAMES[gameId];
	return `<aside class="next-up">
		<p class="next-up__label">다음 게임</p>
		<p class="next-up__title">${info.emoji} ${esc(info.title)}</p>
		<p class="next-up__howto">${esc(info.howTo)}</p>
		<p class="next-up__cut">${cutCount}명 탈락</p>
	</aside>`;
}

function roundStage(round: Round): string {
	const info = GAMES[round.gameId];
	const submitted = Object.keys(round.scores).length;
	return `<section class="round">
		<p class="round__no">라운드 ${round.no} · ${round.cutCount}명 탈락</p>
		<h1 class="round__title">${info.emoji} ${esc(info.title)}</h1>
		<p class="round__howto">${esc(info.howTo)}</p>
		<p class="round__clock" data-play-at="${round.playAt}" data-end-at="${round.endAt}">준비</p>
		<div class="round__bar" aria-hidden="true"><div></div></div>
		<p class="round__count">기록 <b>${submitted}</b> / ${round.participantIds.length}</p>
	</section>`;
}

/** 앞 화면 카운트다운과 남은 시간 막대. 상태 메시지 없이도 매 프레임 움직인다. */
function tickClock(): void {
	requestAnimationFrame(tickClock);
	const clock = stage.querySelector<HTMLElement>(".round__clock");
	const bar = stage.querySelector<HTMLElement>(".round__bar > div");
	if (clock === null || bar === null) return;
	const now = serverTime(view.offsetMs);
	const playAt = Number(clock.dataset.playAt);
	const endAt = Number(clock.dataset.endAt);
	if (now < playAt) {
		const seconds = Math.ceil((playAt - now) / 1000);
		clock.textContent = seconds > 3 ? "준비" : String(seconds);
		if (seconds <= 3 && seconds !== lastCountdown) sfx.tick();
		lastCountdown = seconds;
		bar.style.transform = "scaleX(1)";
	} else if (now <= endAt) {
		if (lastCountdown !== 0) sfx.go();
		lastCountdown = 0;
		clock.textContent = ((endAt - now) / 1000).toFixed(1);
		bar.style.transform = `scaleX(${(endAt - now) / (endAt - playAt)})`;
	} else {
		if (lastCountdown !== -1) sfx.end();
		lastCountdown = -1;
		clock.textContent = "집계 중";
		bar.style.transform = "scaleX(0)";
	}
}

function resultsStage(game: GameState, phase: Extract<Phase, { kind: "results" }>): string {
	const { round, cutIds } = phase;
	const info = GAMES[round.gameId];
	const nameOf = (id: PlayerId) => game.players.find((player) => player.id === id)?.name ?? "?";
	const rows = rankScores(round.participantIds, round.scores).map((entry) => {
		const cut = cutIds.includes(entry.playerId);
		return `<li><button type="button" class="rank${cut ? " is-cut" : ""}" data-action="toggle-cut" data-id="${esc(entry.playerId)}">
			<span class="rank__no">${entry.rank ?? "-"}</span>
			<span class="rank__name">${esc(nameOf(entry.playerId))}</span>
			<span class="rank__score">${entry.score === null ? "기록 없음" : esc(info.formatScore(entry.score))}</span>
			${cut ? `<span class="rank__stamp">탈락</span>` : ""}
		</button></li>`;
	});
	return `<section class="results">
		<header class="results__head">
			<p class="results__no">라운드 ${round.no} 결과</p>
			<h1 class="results__title">${info.emoji} ${esc(info.title)}</h1>
			<p class="results__sum">탈락 <b>${cutIds.length}</b>명 · 생존 <b>${round.participantIds.length - cutIds.length}</b>명</p>
		</header>
		<ol class="ranking">${rows.join("")}</ol>
	</section>`;
}

function championStage(game: GameState, winnerIds: readonly PlayerId[]): string {
	const names = game.players.filter((player) => winnerIds.includes(player.id)).map((player) => player.name);
	return `<section class="champion">
		<p class="champion__crown" aria-hidden="true">👑</p>
		<h1 class="champion__title">우승</h1>
		<p class="champion__name">${esc(names.join(", ") || "없음")}</p>
	</section>`;
}

function controlsHtml(game: GameState): string {
	if (view.editingRoster) return "";
	switch (game.phase.kind) {
		case "lobby":
			return lobbyControls(game);
		case "playing":
			return `<div class="controls__row">
				<span class="controls__hint">게임 중이에요</span>
				<span class="controls__spacer"></span>
				<button type="button" class="btn" data-action="cancel-round">라운드 취소</button>
				<button type="button" class="btn" data-action="close-round">지금 마감</button>
			</div>`;
		case "results":
			return `<div class="controls__row">
				<span class="controls__hint">이름을 누르면 살리기·탈락을 바꿀 수 있어요</span>
				<span class="controls__spacer"></span>
				<button type="button" class="btn" data-action="cancel-round">라운드 취소</button>
				<button type="button" class="btn btn--primary" data-action="confirm-cut">탈락 확정 ▶</button>
			</div>`;
		case "finished":
			return `<div class="controls__row">
				<span class="controls__spacer"></span>
				<button type="button" class="btn" data-action="reset">처음부터 다시</button>
			</div>`;
	}
}

function lobbyControls(game: GameState): string {
	const participants = nextParticipants(game).length;
	const upcoming = game.upcoming;
	const cut = upcoming?.cutCount ?? suggestCutCount(participants);
	const games = GAME_IDS.map((id) => {
		const selected = upcoming?.gameId === id;
		return `<button type="button" class="btn btn--game${selected ? " is-selected" : ""}" data-action="game" data-id="${id}" aria-pressed="${selected}">${GAMES[id].emoji} ${esc(GAMES[id].title)}</button>`;
	}).join("");
	const canStart = upcoming !== null && participants >= 1 && upcoming.cutCount <= participants - 1;
	return `<div class="controls__row">
		<div class="controls__group" role="group" aria-label="다음 게임">${games}</div>
		<div class="controls__group stepper" role="group" aria-label="탈락 인원">
			<button type="button" class="btn btn--icon" data-action="cut-down" ${upcoming === null || cut <= 0 ? "disabled" : ""} aria-label="탈락 인원 줄이기">−</button>
			<span class="stepper__value"><b>${cut}</b>명 탈락</span>
			<button type="button" class="btn btn--icon" data-action="cut-up" ${upcoming === null || cut >= participants - 1 ? "disabled" : ""} aria-label="탈락 인원 늘리기">+</button>
			<span class="controls__hint">참가 ${participants}명 · 추천 ${suggestCutCount(participants)}명</span>
		</div>
		<span class="controls__spacer"></span>
		${game.roundsPlayed === 0 ? `<button type="button" class="btn" data-action="roster">명단</button>` : ""}
		<button type="button" class="btn" data-action="reset">처음부터</button>
		<button type="button" class="btn btn--primary" data-action="start" ${canStart ? "" : "disabled"}>시작 ▶</button>
	</div>`;
}

function rosterEditor(game: GameState): string {
	return `<section class="roster-edit">
		<h2>명단</h2>
		<p class="muted">한 줄에 한 명씩 적어 주세요. 이미 입장한 사람은 이름을 그대로 두면 입장이 유지돼요.</p>
		<textarea id="roster-text" rows="14" spellcheck="false">${esc(game.players.map((player) => player.name).join("\n"))}</textarea>
		<div class="roster-edit__actions">
			<button type="button" class="btn" data-action="roster-close">닫기</button>
			<button type="button" class="btn btn--primary" data-action="roster-save">저장</button>
		</div>
	</section>`;
}

// ---------- 입력 ----------

function handleClick(event: MouseEvent, send: (message: HostMessage) => void): void {
	unlockSound();
	const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
	const game = view.game;
	if (target === null || game === null) return;
	const id = target.dataset.id ?? "";
	const participants = nextParticipants(game).length;
	switch (target.dataset.action) {
		case "game":
			return send({
				type: "prepareRound",
				gameId: GAME_IDS.find((gameId) => gameId === id) ?? "balloon",
				cutCount: game.upcoming?.cutCount ?? suggestCutCount(participants),
			});
		case "cut-down":
		case "cut-up": {
			if (game.upcoming === null) return;
			const change = target.dataset.action === "cut-up" ? 1 : -1;
			const cutCount = Math.min(Math.max(game.upcoming.cutCount + change, 0), Math.max(participants - 1, 0));
			return send({ type: "prepareRound", gameId: game.upcoming.gameId, cutCount });
		}
		case "start":
			return send({ type: "startRound" });
		case "close-round":
			return send({ type: "closeRound" });
		case "cancel-round":
			if (confirm("이번 라운드를 없던 일로 할까요? 아무도 탈락하지 않아요.")) send({ type: "cancelRound" });
			return;
		case "toggle-cut":
			return send({ type: "toggleCut", playerId: id });
		case "confirm-cut":
			return send({ type: "confirmCut" });
		case "select":
			return update({ selected: view.selected === id ? null : id });
		case "alive":
		case "out":
			update({ selected: null });
			return send({ type: "setStatus", playerId: id, status: target.dataset.action === "alive" ? "alive" : "out" });
		case "release":
			if (confirm("입장을 풀면 그 사람 폰은 이름 고르기 화면으로 돌아가요. 풀까요?")) send({ type: "release", playerId: id });
			return update({ selected: null });
		case "reset":
			if (confirm("처음부터 다시 할까요? 입장한 사람은 그대로 두고 탈락·라운드 기록만 지워요.")) send({ type: "reset" });
			return;
		case "roster":
			view = { ...view, editingRoster: true };
			paintedStage = null;
			stage.innerHTML = rosterEditor(game);
			return render();
		case "roster-close":
			return update({ editingRoster: false });
		case "roster-save": {
			const text = pick<HTMLTextAreaElement>(stage, "#roster-text").value;
			const names = text
				.split("\n")
				.map((name) => name.trim())
				.filter((name) => name.length > 0);
			send({ type: "setRoster", names });
			return update({ editingRoster: false });
		}
	}
}
