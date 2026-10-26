import qrcode from "qrcode-generator";
import { type GameState, joinedPlayers, lockedPlanLength, nextGame, type Round } from "../../domain/game";
import { GAMES } from "../../domain/games/catalog";
import type { Player, PlayerId } from "../../domain/player";
import { rankScores } from "../../domain/ranking";
import { roundPoints, type Standing, standings } from "../../domain/standings";
import { esc } from "../dom";
import { gameIcon } from "../games/art";
import { svg } from "../ui-art";

/** 진행자(프로젝터) 앞 화면 HTML. 상태를 받아 그리기만 한다. */

export type StageOptions = {
	readonly onlineIds: readonly PlayerId[];
	readonly selected: PlayerId | null;
	readonly resultsTab: "round" | "total";
};

const nameOf = (game: GameState, id: PlayerId) => game.players.find((player) => player.id === id)?.name ?? "?";

function joinQr(): string {
	const qr = qrcode(0, "M");
	qr.addData(`${location.origin}/`);
	qr.make();
	return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

/** 순서표 띠: 끝난 라운드는 흐리게, 다음 라운드는 강조 */
function planStrip(game: GameState): string {
	if (game.plan.length === 0) return `<p class="ax-muted">순서표가 비어 있어요. 아래 '순서표'에서 게임을 넣어 주세요.</p>`;
	const locked = lockedPlanLength(game);
	const next = game.history.length;
	return `<ol class="ax-plan">${game.plan
		.map((gameId, i) => {
			const state = i < game.history.length ? "is-done" : i === next ? "is-next" : i < locked ? "is-now" : "";
			return `<li class="ax-plan__item ${state}"><span class="ax-plan__no">R${i + 1}</span>${gameIcon(gameId)}</li>`;
		})
		.join("")}</ol>`;
}

function nextCard(game: GameState): string {
	const gameId = nextGame(game);
	if (gameId === null) return `<aside class="ax-next-up ax-box"><p class="ax-kicker">순서표 끝</p><p class="ax-muted">게임을 더 넣거나 최종 순위를 발표하세요</p></aside>`;
	const info = GAMES[gameId];
	return `<aside class="ax-next-up ax-box">
		<p class="ax-kicker">ROUND ${game.history.length + 1} · 다음 게임</p>
		<div class="ax-next-up__head">${gameIcon(gameId, "ax-next-up__icon")}<p class="ax-next-up__title">${esc(info.title)}</p></div>
		<p class="ax-next-up__howto">${esc(info.howTo)}</p>
	</aside>`;
}

function chips(game: GameState, options: StageOptions): string {
	return `<ul class="ax-chips">${game.players.map((player) => chip(player, options)).join("")}</ul>`;
}

function chip(player: Player, options: StageOptions): string {
	const online = options.onlineIds.includes(player.id);
	const selected = options.selected === player.id;
	const classes = ["ax-chip", player.claimed ? "is-claimed" : "", online ? "is-online" : "", selected ? "is-selected" : ""].join(" ");
	const menu = selected && player.claimed ? `<div class="ax-chip-menu"><button type="button" class="ax-btn ax-btn--small" data-action="release" data-id="${esc(player.id)}">입장 풀기</button></div>` : "";
	return `<li><button type="button" class="${classes}" data-action="select" data-id="${esc(player.id)}" aria-pressed="${selected}"><i class="ax-chip__dot" aria-hidden="true"></i>${esc(player.name)}</button>${menu}</li>`;
}

export function lobbyStage(game: GameState, options: StageOptions): string {
	const joined = joinedPlayers(game).length;
	if (game.history.length === 0) {
		return `<section class="ax-lobby">
			<div class="ax-join ax-box">
				<h1 class="ax-logo"><span>워크샵</span><b>비시바시</b></h1>
				<div class="ax-join__qr">${joinQr()}</div>
				<p class="ax-join__url">${esc(location.host)}</p>
				<p class="ax-join__hint ax-blink">폰 카메라로 찍고 이름을 눌러요</p>
			</div>
			<div class="ax-lobby__side">
				<h2 class="ax-section-title">입장 <b>${joined}</b> / ${game.players.length}</h2>
				${game.players.length === 0 ? `<p class="ax-muted">아래 '명단' 버튼으로 참가자 이름을 넣어 주세요.</p>` : chips(game, options)}
				${nextCard(game)}
				${planStrip(game)}
			</div>
		</section>`;
	}
	const table = standings(game.players, game.history);
	return `<section class="ax-lobby ax-lobby--between">
		<div class="ax-lobby__main">
			${nextCard(game)}
			${planStrip(game)}
			<p class="ax-muted">입장 ${joined} / ${game.players.length} · 라운드 ${game.history.length}개 끝남 · 이름을 누르면 입장을 풀 수 있어요</p>
			<div class="ax-chips--compact">${chips(game, options)}</div>
		</div>
		<div class="ax-lobby__side">
			<h2 class="ax-section-title">지금 순위</h2>
			${standingTable(game, table.slice(0, 10), null)}
		</div>
	</section>`;
}

/** 라운드 시작 전 게임 설명. 시연은 host.ts가 [data-demo] 칸에 붙인다. */
export function introStage(game: GameState): string {
	const gameId = nextGame(game);
	if (gameId === null) return `<section class="ax-round"><p class="ax-muted">순서표에 다음 게임이 없어요</p></section>`;
	const info = GAMES[gameId];
	return `<section class="ax-intro-stage">
		<div class="ax-intro-stage__info">
			<p class="ax-kicker">ROUND ${game.history.length + 1} · 게임 설명</p>
			<div class="ax-round__title">${gameIcon(gameId, "ax-round__icon")}<h1>${esc(info.title)}</h1></div>
			<p class="ax-intro-stage__howto">${esc(info.howTo)}</p>
			<p class="ax-intro-stage__next ax-blink">다음 ▶ 을 누르면 READY → 3 · 2 · 1 → GO!</p>
		</div>
		<div class="ax-intro-stage__demo" data-demo="${gameId}"></div>
	</section>`;
}

export function roundStage(game: GameState, round: Round, options: StageOptions): string {
	const info = GAMES[round.gameId];
	const submitted = Object.keys(round.scores).length;
	const missing = round.participantIds.filter((id) => round.scores[id] === undefined);
	const shown = missing.slice(0, 14);
	return `<section class="ax-round" data-play-at="${round.playAt}" data-end-at="${round.endAt}">
		<p class="ax-kicker">ROUND ${round.no}</p>
		<div class="ax-round__title">${gameIcon(round.gameId, "ax-round__icon")}<h1>${esc(info.title)}</h1></div>
		<p class="ax-round__howto">${esc(info.howTo)}</p>
		<p class="ax-round__clock">READY</p>
		<div class="ax-round__bar" aria-hidden="true"><i></i></div>
		<p class="ax-round__count">기록 <b>${submitted}</b> / ${round.participantIds.length}</p>
		<ul class="ax-waiting">${shown
			.map((id) => `<li class="${options.onlineIds.includes(id) ? "is-online" : ""}"><i class="ax-chip__dot" aria-hidden="true"></i>${esc(nameOf(game, id))}</li>`)
			.join("")}${missing.length > shown.length ? `<li class="ax-muted">외 ${missing.length - shown.length}명</li>` : ""}</ul>
	</section>`;
}

export function resultsStage(game: GameState, round: Round, options: StageOptions): string {
	const info = GAMES[round.gameId];
	const head = `<header class="ax-results__head">
		<p class="ax-kicker">ROUND ${round.no} 결과</p>
		<div class="ax-results__title">${gameIcon(round.gameId, "ax-results__icon")}<h1>${esc(info.title)}</h1></div>
	</header>`;
	if (options.resultsTab === "total") {
		const before = standings(game.players, game.history);
		const after = standings(game.players, [...game.history, round]);
		return `<section class="ax-results">${head}<h2 class="ax-section-title">누적 순위 <small>(확정 전)</small></h2>${standingTable(game, after, before)}</section>`;
	}
	const points = roundPoints(round);
	const entries = rankScores(round.participantIds, round.scores);
	const rows = entries.map((entry, i) => {
		const order = entries.length - 1 - i;
		const tone = entry.rank === 1 ? "is-gold" : entry.rank !== null && entry.rank <= 3 ? "is-top" : entry.rank === null ? "is-none" : "";
		return `<li class="ax-rank ${tone}" style="--order:${order}">
			<span class="ax-rank__no">${entry.rank ?? "-"}</span>
			<span class="ax-rank__name">${esc(nameOf(game, entry.playerId))}</span>
			<span class="ax-rank__score">${entry.score === null ? "기록 없음" : esc(info.formatScore(entry.score))}</span>
			<span class="ax-rank__points">+${points[entry.playerId] ?? 0}</span>
		</li>`;
	});
	return `<section class="ax-results">${head}<ol class="ax-ranking" style="--count:${entries.length}">${rows.join("")}</ol></section>`;
}

/** 누적 순위표. before가 있으면 순위 변화를 붙인다 */
function standingTable(game: GameState, table: readonly Standing[], before: readonly Standing[] | null): string {
	if (table.length === 0) return `<p class="ax-muted">아직 순위가 없어요</p>`;
	const rows = table.map((row) => {
		const old = before?.find((other) => other.playerId === row.playerId) ?? null;
		const change = old === null || old.rank === row.rank ? "" : old.rank > row.rank ? `<i class="ax-move ax-move--up">▲${old.rank - row.rank}</i>` : `<i class="ax-move ax-move--down">▼${row.rank - old.rank}</i>`;
		const tone = row.rank === 1 ? "is-gold" : row.rank <= 3 ? "is-top" : "";
		return `<li class="ax-rank ${tone}"><span class="ax-rank__no">${row.rank}</span><span class="ax-rank__name">${esc(nameOf(game, row.playerId))}</span><span class="ax-rank__points">${row.total}점</span>${change}</li>`;
	});
	return `<ol class="ax-ranking ax-ranking--static">${rows.join("")}</ol>`;
}

/** 최종 발표. "round" 탭은 시상대, "total" 탭은 전체 순위표 */
export function finishedStage(game: GameState, tab: StageOptions["resultsTab"]): string {
	const table = standings(game.players, game.history);
	if (tab === "total") {
		return `<section class="ax-results"><header class="ax-results__head"><p class="ax-kicker">FINAL</p><h1 class="ax-section-title">전체 순위</h1></header>${standingTable(game, table, null)}</section>`;
	}
	const podium = [2, 1, 3]
		.map((place) => {
			const winners = table.filter((row) => row.rank === place);
			const names = winners.map((row) => esc(nameOf(game, row.playerId))).join("<br>");
			const total = winners[0]?.total;
			return `<div class="ax-podium__place ax-podium__place--${place}">
				${place === 1 ? svg.crown : ""}
				<p class="ax-podium__name">${names || "-"}</p>
				<p class="ax-podium__total">${total === undefined ? "" : `${total}점`}</p>
				<div class="ax-podium__block"><b>${place}</b></div>
			</div>`;
		})
		.join("");
	return `<section class="ax-final-stage">
		<h1 class="ax-final-stage__title">최종 순위</h1>
		<div class="ax-podium">${podium}</div>
	</section>`;
}
