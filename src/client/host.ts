import { type GameState, joinedPlayers, lockedPlanLength, nextGame } from "../domain/game";
import { GAMES, type GameId, isGameId } from "../domain/games/catalog";
import type { PlayerId } from "../domain/player";
import { needsHostKey } from "../host-access";
import type { HostMessage, ServerMessage } from "../protocol";
import { arcade } from "./arcade-sound";
import { createServerClock } from "./clock";
import { applyCrispUnits } from "./crisp";
import { esc, pick } from "./dom";
import { confetti } from "./host/confetti";
import { editDraft } from "./host/plan-draft";
import { planEditor } from "./host/plan-editor";
import { mountDemo } from "./games/demo";
import { finishedStage, introStage, lobbyStage, resultsStage, roundStage, type StageOptions } from "./host/stages";
import { type ConnectionStatus, connect } from "./net";
import { sfx, unlockSound } from "./sound";

const KEY_STORE = "bishibashi.hostKey";

type View = {
	readonly game: GameState | null;
	readonly onlineIds: readonly PlayerId[];
	readonly status: ConnectionStatus;
	/** 앞 화면에서 고치는 중인 것. 고치는 동안에는 앞 화면을 다시 그리지 않는다. */
	readonly editing: "roster" | "plan" | null;
	/** 순서표 편집 중인 아직 안 한 라운드들 */
	readonly draft: readonly GameId[];
	readonly selected: PlayerId | null;
	readonly notice: string | null;
	readonly resultsTab: "round" | "total";
};

const REJECTION_TEXT: Readonly<Record<string, string>> = {
	no_next_game: "순서표에 남은 게임이 없어요. 순서표에 게임을 넣어 주세요.",
	not_enough_players: "입장한 사람이 있어야 시작할 수 있어요.",
	plan_too_long: "순서표는 30라운드까지예요.",
	nothing_played: "끝난 라운드가 있어야 최종 순위를 낼 수 있어요.",
	wrong_phase: "지금은 할 수 없는 동작이에요.",
	not_host: "진행자 권한이 없어요.",
	bad_message: "형식이 맞지 않아요. 이름은 30자, 명단은 100명까지 넣을 수 있어요.",
};

const stage = pick(document, "#stage");
const controls = pick(document, "#controls");
const banner = pick(document, "#banner");
const clock = createServerClock();

let view: View = {
	game: null,
	onlineIds: [],
	status: "offline",
	editing: null,
	draft: [],
	selected: null,
	notice: null,
	resultsTab: "round",
};
let paintedStage: string | null = null;
let paintedControls: string | null = null;
let noticeTimer = 0;
/** 앞 화면 카운트다운 소리를 판(playAt)마다 한 번씩만 내도록 마지막으로 낸 소리를 기억한다 */
let lastCue: string | null = null;
/** 진행 버튼을 다시 그린 시각. 바로 뒤의 클릭은 더블클릭의 두 번째로 보고 무시한다. */
let controlsPaintedAt = 0;
/** 진행 버튼 자리가 바뀐 직후 이 시간 안의 클릭은 무시한다(더블클릭이 다음 단계 버튼을 누르지 않게) */
const CONTROLS_GUARD_MS = 400;
/** 결과 공개·시상대 연출을 한 번만 하도록 기억한다 */
let revealedFor: string | null = null;

applyCrispUnits();

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

// 내 컴퓨터·사내망 주소로 연 테스트 서버는 키 없이 바로 붙는다
if (hostKey === null && needsHostKey(location.hostname)) {
	showKeyGate("");
} else {
	const connection = connect(hostKey === null ? "/ws?role=host" : `/ws?role=host&key=${encodeURIComponent(hostKey)}`, {
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
	controls.addEventListener("click", (event) => {
		if (performance.now() - controlsPaintedAt < CONTROLS_GUARD_MS) return;
		handleClick(event, send);
	});
	requestAnimationFrame(tickClock);
}

function showKeyGate(message: string): void {
	sessionStorage.removeItem(KEY_STORE);
	// 다시 그릴 때 예전 화면과 같다고 건너뛰지 않게 기억을 지운다
	paintedStage = null;
	paintedControls = null;
	controls.innerHTML = "";
	stage.innerHTML = `<section class="ax-gate ax-box">
		<h1 class="ax-logo"><span>진행자</span><b>비시바시</b></h1>
		${message ? `<p class="ax-gate__error">${esc(message)}</p>` : ""}
		<form class="ax-gate__form">
			<label for="host-key">진행자 키</label>
			<input id="host-key" name="key" type="password" autocomplete="off" required>
			<button type="submit" class="ax-btn ax-btn--go">들어가기</button>
		</form>
	</section>`;
	pick<HTMLFormElement>(stage, ".ax-gate__form").addEventListener("submit", (event) => {
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
		clock.sample(message.serverNow);
		// 결과·최종 발표에 들어서면 이번 라운드(시상대) 탭부터 보여준다
		const kind = message.game.phase.kind;
		const entering = (kind === "results" || kind === "finished") && view.game?.phase.kind !== kind;
		return update({ game: message.game, onlineIds: message.onlineIds, ...(entering ? { resultsTab: "round" as const } : {}) });
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
	if (game === null) return paintStage(`<section class="ax-gate"><p class="ax-lead ax-blink">연결 중…</p></section>`);
	if (view.editing === "plan") paintStage(planEditor(game, view.draft));
	else if (view.editing === null) paintStage(stageHtml(game));
	paintControls(controlsHtml(game));
	stageEffects(game);
	mountStageDemo();
}

function paintStage(html: string): void {
	if (paintedStage === html) return;
	paintedStage = html;
	stage.innerHTML = html;
}

/** 설명 화면의 시연을 한 번만 붙인다(상태가 와서 다시 그려도 이어서 돈다) */
function mountStageDemo(): void {
	const box = stage.querySelector<HTMLElement>("[data-demo]");
	const gameId = box?.dataset.demo;
	if (box === null || box.childElementCount > 0 || gameId === undefined || !isGameId(gameId)) return;
	mountDemo(box, gameId);
}

function paintControls(html: string): void {
	if (paintedControls === html) return;
	paintedControls = html;
	controlsPaintedAt = performance.now();
	controls.innerHTML = html;
}

function stageOptions(): StageOptions {
	return { onlineIds: view.onlineIds, selected: view.selected, resultsTab: view.resultsTab };
}

function stageHtml(game: GameState): string {
	switch (game.phase.kind) {
		case "lobby":
			return lobbyStage(game, stageOptions());
		case "intro":
			return introStage(game);
		case "playing":
			return roundStage(game, game.phase.round, stageOptions());
		case "results":
			return resultsStage(game, game.phase.round, stageOptions());
		case "finished":
			return finishedStage(game, view.resultsTab);
	}
}

/** 결과를 한 줄씩 공개할 때 틱 소리, 최종 발표 때 색종이와 팡파르. 화면이 바뀔 때 한 번만. */
function stageEffects(game: GameState): void {
	const key =
		game.phase.kind === "results"
			? `results:${game.phase.round.no}:${view.resultsTab}`
			: game.phase.kind === "finished"
				? `finished:${game.history.length}:${view.resultsTab}`
				: null;
	if (key === null || key === revealedFor || view.editing !== null) {
		if (key === null) revealedFor = null;
		return;
	}
	revealedFor = key;
	if (game.phase.kind === "results" && view.resultsTab === "round") {
		const count = game.phase.round.participantIds.length;
		for (let i = 0; i < count; i++) setTimeout(() => arcade.reveal(), 300 + i * 110);
		setTimeout(() => arcade.jar(), 300 + count * 110);
	}
	if (game.phase.kind === "finished" && view.resultsTab === "round") {
		setTimeout(() => arcade.drum(), 600);
		setTimeout(() => arcade.drum(), 2000);
		setTimeout(() => {
			arcade.fanfare();
			const host = stage.querySelector<HTMLElement>(".ax-final-stage");
			if (host !== null) confetti(host, 6000);
		}, 3400);
	}
}

/** 같은 소리를 두 번 내지 않는다(화면을 다시 그려도) */
function cue(key: string, play: () => void): void {
	if (lastCue === key) return;
	lastCue = key;
	play();
}

/** 앞 화면 카운트다운·남은 시간 막대·기록 기다리는 사람 표시. 상태 메시지 없이도 매 프레임 움직인다. */
function tickClock(): void {
	requestAnimationFrame(tickClock);
	const round = stage.querySelector<HTMLElement>(".ax-round");
	const clockText = stage.querySelector<HTMLElement>(".ax-round__clock");
	const bar = stage.querySelector<HTMLElement>(".ax-round__bar > i");
	if (round === null || clockText === null || bar === null) return;
	const now = clock.now();
	const playAt = Number(round.dataset.playAt);
	const endAt = Number(round.dataset.endAt);
	if (now < playAt) {
		const seconds = Math.ceil((playAt - now) / 1000);
		clockText.textContent = seconds > 3 ? "READY" : String(seconds);
		if (seconds <= 3) cue(`${playAt}:${seconds}`, sfx.tick);
		bar.style.transform = "scaleX(1)";
	} else if (now <= endAt) {
		cue(`${playAt}:go`, sfx.go);
		clockText.textContent = ((endAt - now) / 1000).toFixed(1);
		// 막대는 칸 단위로 줄어든다(부드럽게 줄면 픽셀 느낌이 깨진다)
		bar.style.transform = `scaleX(${Math.ceil(((endAt - now) / (endAt - playAt)) * 40) / 40})`;
	} else {
		cue(`${playAt}:end`, sfx.end);
		clockText.textContent = "집계 중";
		bar.style.transform = "scaleX(0)";
	}
	round.classList.toggle("is-collecting", now > endAt);
}

function controlsHtml(game: GameState): string {
	if (view.editing !== null) return "";
	switch (game.phase.kind) {
		case "lobby":
			return lobbyControls(game);
		case "intro":
			return `<div class="ax-controls">
				<button type="button" class="ax-btn" data-action="intro-back">← 뒤로</button>
				<span class="ax-controls__hint">설명을 다 봤으면 다음을 눌러요(바로 눌러도 돼요)</span>
				<span class="ax-controls__spacer"></span>
				<button type="button" class="ax-btn ax-btn--go" data-action="start">다음 ▶ 3·2·1</button>
			</div>`;
		case "playing":
			return `<div class="ax-controls">
				<span class="ax-controls__hint">게임 중이에요</span>
				<span class="ax-controls__spacer"></span>
				<button type="button" class="ax-btn" data-action="cancel-round">라운드 취소</button>
				<button type="button" class="ax-btn ax-btn--go" data-action="close-round">지금 마감</button>
			</div>`;
		case "results": {
			const last = nextGame({ ...game, history: [...game.history, game.phase.round] }) === null;
			return `<div class="ax-controls">
				<div class="ax-tabs" role="group" aria-label="결과 보기">
					<button type="button" class="ax-btn${view.resultsTab === "round" ? " is-selected" : ""}" data-action="tab-round">이번 라운드</button>
					<button type="button" class="ax-btn${view.resultsTab === "total" ? " is-selected" : ""}" data-action="tab-total">누적 순위</button>
				</div>
				<span class="ax-controls__spacer"></span>
				<button type="button" class="ax-btn" data-action="cancel-round">라운드 취소</button>
				${last ? `<button type="button" class="ax-btn" data-action="confirm-round">확정만</button><button type="button" class="ax-btn ax-btn--go" data-action="confirm-finish">확정하고 최종 발표 ▶</button>` : `<button type="button" class="ax-btn ax-btn--go" data-action="confirm-round">결과 확정 ▶</button>`}
			</div>`;
		}
		case "finished":
			return `<div class="ax-controls">
				<div class="ax-tabs" role="group" aria-label="최종 순위 보기">
					<button type="button" class="ax-btn${view.resultsTab === "round" ? " is-selected" : ""}" data-action="tab-round">시상대</button>
					<button type="button" class="ax-btn${view.resultsTab === "total" ? " is-selected" : ""}" data-action="tab-total">전체 순위</button>
				</div>
				<span class="ax-controls__spacer"></span>
				<button type="button" class="ax-btn" data-action="reopen">계속하기</button>
				<button type="button" class="ax-btn" data-action="reset">처음부터 다시</button>
			</div>`;
	}
}

function lobbyControls(game: GameState): string {
	const next = nextGame(game);
	const joined = joinedPlayers(game).length;
	const canStart = next !== null && joined >= 1;
	const startLabel = next === null ? "시작 ▶" : `R${game.history.length + 1} ${esc(GAMES[next].title)} ▶`;
	return `<div class="ax-controls">
		<button type="button" class="ax-btn" data-action="plan">순서표</button>
		<button type="button" class="ax-btn" data-action="roster">명단</button>
		<button type="button" class="ax-btn" data-action="reset">처음부터</button>
		<span class="ax-controls__spacer"></span>
		${game.history.length > 0 ? `<button type="button" class="ax-btn" data-action="finish">최종 순위 발표</button>` : ""}
		<button type="button" class="ax-btn ax-btn--go" data-action="intro" ${canStart ? "" : "disabled"}>${startLabel}</button>
	</div>`;
}

function rosterEditor(game: GameState): string {
	return `<section class="ax-editor ax-box">
		<h2 class="ax-editor__title">명단</h2>
		<p class="ax-muted">한 줄에 한 명씩 적어 주세요. 이미 입장한 사람은 이름을 그대로 두면 입장과 기록이 유지돼요. 이름을 지우면 그 사람 기록도 순위에서 빠져요.</p>
		<textarea id="roster-text" rows="14" spellcheck="false">${esc(game.players.map((player) => player.name).join("\n"))}</textarea>
		<div class="ax-editor__actions">
			<button type="button" class="ax-btn" data-action="roster-close">닫기</button>
			<button type="button" class="ax-btn ax-btn--go" data-action="roster-save">저장</button>
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
	const action = target.dataset.action ?? "";
	switch (action) {
		case "intro":
			return send({ type: "openIntro" });
		case "intro-back":
			return send({ type: "closeIntro" });
		case "start":
			return send({ type: "startRound" });
		case "close-round":
			return send({ type: "closeRound" });
		case "cancel-round":
			if (confirm("이번 라운드를 없던 일로 할까요? 점수 없이 같은 게임을 다시 해요.")) send({ type: "cancelRound" });
			return;
		case "confirm-round":
			return send({ type: "confirmRound" });
		case "confirm-finish":
			send({ type: "confirmRound" });
			return send({ type: "finishGame" });
		case "finish":
			if (confirm("최종 순위를 발표할까요? '계속하기'로 다시 돌아올 수 있어요.")) send({ type: "finishGame" });
			return;
		case "reopen":
			return send({ type: "reopenGame" });
		case "reset":
			if (confirm("처음부터 다시 할까요? 입장과 순서표는 그대로 두고 라운드 기록만 지워요.")) send({ type: "reset" });
			return;
		case "tab-round":
			return update({ resultsTab: "round" });
		case "tab-total":
			return update({ resultsTab: "total" });
		case "select":
			return update({ selected: view.selected === id ? null : id });
		case "release":
			if (confirm("입장을 풀면 그 사람 폰은 이름 고르기 화면으로 돌아가요. 풀까요?")) send({ type: "release", playerId: id });
			return update({ selected: null });
		case "roster":
			view = { ...view, editing: "roster" };
			paintedStage = null;
			stage.innerHTML = rosterEditor(game);
			return render();
		case "roster-close":
			return update({ editing: null });
		case "roster-save": {
			const text = pick<HTMLTextAreaElement>(stage, "#roster-text").value;
			const before = new Set(game.players.map((player) => player.name));
			const names = text
				.split("\n")
				.map((name) => name.trim())
				.filter((name) => name.length > 0);
			const removed = [...before].filter((name) => !names.includes(name));
			if (removed.length > 0 && game.history.length > 0 && !confirm(`${removed.join(", ")} 님을 빼면 그 사람 기록도 순위에서 빠져요. 저장할까요?`)) return;
			send({ type: "setRoster", names });
			return update({ editing: null });
		}
		case "plan":
			return update({ editing: "plan", draft: game.plan.slice(lockedPlanLength(game)) });
		case "plan-add":
		case "plan-remove":
		case "plan-up":
		case "plan-down":
			return update({ draft: editDraft(view.draft, action, Number(target.dataset.index ?? -1), isGameId(id) ? id : null) });
		case "plan-close":
			return update({ editing: null });
		case "plan-save":
			send({ type: "setPlan", gameIds: view.draft });
			return update({ editing: null });
	}
}
