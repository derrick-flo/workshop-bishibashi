import { champion, currentMatch, type GameState, joinedPlayers, nextGame, type Round } from "../../domain/game";
import { GAMES } from "../../domain/games/catalog";
import type { PlayerId } from "../../domain/player";
import { bracketRounds, entrantCount, type Match, matchTotal, matchWinner, roundTitle } from "../../domain/tournament";
import { bracketHtml, type BracketView } from "../bracket";
import { esc } from "../dom";
import { gameIcon } from "../games/art";
import { svg } from "../ui-art";

/** 관전 화면(프로젝터) HTML. 상태를 받아 그리기만 한다. 살아 있는 두 플레이 장면은 arena.ts가 붙인다. */

const nameOf = (game: GameState, id: PlayerId) => game.players.find((player) => player.id === id)?.name ?? "?";

function viewOf(game: GameState): BracketView {
	return { nameOf: (id) => nameOf(game, id), now: currentMatch(game) };
}

/** 몇 번째 회전의 몇 번째 경기인지(예: 준결승 · 2경기) */
export function matchLabel(game: GameState, match: Match | null): string {
	if (game.bracket === null || match === null) return "";
	const rounds = bracketRounds(game.bracket, game.history);
	const played = rounds[match.roundIndex]?.filter((other) => !other.bye) ?? [];
	const order = played.findIndex((other) => other.slot === match.slot);
	const title = roundTitle(match.roundIndex, rounds.length);
	return played.length > 1 && order >= 0 ? `${title} · ${order + 1}경기` : title;
}

function bracketPanel(game: GameState): string {
	if (game.bracket === null) return "";
	return `<section class="ax-arena__bracket">${bracketHtml(game.bracket, game.history, viewOf(game))}</section>`;
}

/** 두 사람 이름을 크게 맞세운 패 */
function versus(game: GameState, aId: PlayerId | null, bId: PlayerId | null, winnerId: PlayerId | null): string {
	const side = (id: PlayerId | null) => {
		const tone = winnerId === null ? "" : id === winnerId ? " is-win" : " is-lost";
		return `<p class="ax-vs__name${tone}">${id === null ? "?" : esc(nameOf(game, id))}</p>`;
	};
	return `<div class="ax-vs">${side(aId)}<span class="ax-vs__mark">VS</span>${side(bId)}</div>`;
}

export function connectingScreen(): string {
	return `<section class="ax-arena ax-arena--center"><p class="ax-lead ax-blink">연결 중…</p></section>`;
}

/** 점수전으로 돌고 있을 때. 관전 화면은 토너먼트용이라 할 일이 없다. */
export function pointsModeScreen(): string {
	return `<section class="ax-arena ax-arena--center">
		<h1 class="ax-logo"><span>관전 화면</span><b>비시바시</b></h1>
		<p class="ax-lead">지금은 <b>점수전</b>으로 돌고 있어요.</p>
		<p class="ax-muted">진행자 화면에서 방식을 <b>토너먼트</b>로 바꾸면 여기에 1:1 대결이 나와요.</p>
	</section>`;
}

export function lobbyScreen(game: GameState): string {
	if (game.bracket === null) {
		const joined = joinedPlayers(game);
		return `<section class="ax-arena ax-arena--center">
			<h1 class="ax-logo"><span>토너먼트</span><b>비시바시</b></h1>
			<p class="ax-lead ax-blink">진행자가 대진을 짜는 중이에요</p>
			<p class="ax-muted">입장 <b>${joined.length}</b> / ${game.players.length}명</p>
			<ul class="ax-arena__names">${joined.map((player) => `<li>${esc(player.name)}</li>`).join("")}</ul>
		</section>`;
	}
	const match = currentMatch(game);
	const left = matchTotal(game.bracket) - game.history.length;
	return `<section class="ax-arena ax-arena--split">
		<div class="ax-arena__info">
			<p class="ax-kicker">토너먼트 · ${entrantCount(game.bracket)}명 · 남은 경기 ${Math.max(0, left)}</p>
			${match === null ? `<h1 class="ax-section-title">경기가 다 끝났어요</h1>` : `<h1 class="ax-section-title">다음 경기 · ${esc(matchLabel(game, match))}</h1>`}
			${match === null ? "" : versus(game, match.aId, match.bId, null) + nextGameCard(game)}
		</div>
		${bracketPanel(game)}
	</section>`;
}

function nextGameCard(game: GameState): string {
	const gameId = nextGame(game);
	if (gameId === null) return `<p class="ax-muted">순서표가 비어 있어요</p>`;
	const info = GAMES[gameId];
	return `<aside class="ax-arena__game ax-box">
		<div class="ax-arena__game-head">${gameIcon(gameId, "ax-arena__game-icon")}<p class="ax-arena__game-title">${esc(info.title)}</p></div>
		<p class="ax-arena__game-howto">${esc(info.howTo)}</p>
	</aside>`;
}

/** 경기 시작 전 설명. 시연은 arena.ts가 [data-demo] 칸에 붙인다. */
export function introScreen(game: GameState): string {
	const match = currentMatch(game);
	const gameId = nextGame(game);
	if (match === null || gameId === null) return lobbyScreen(game);
	const info = GAMES[gameId];
	return `<section class="ax-arena ax-arena--intro">
		<header class="ax-arena__head">
			<p class="ax-kicker">${esc(matchLabel(game, match))}</p>
			${versus(game, match.aId, match.bId, null)}
		</header>
		<div class="ax-arena__intro">
			<div class="ax-arena__intro-info">
				<div class="ax-round__title">${gameIcon(gameId, "ax-round__icon")}<h1>${esc(info.title)}</h1></div>
				<p class="ax-arena__game-howto">${esc(info.howTo)}</p>
				<p class="ax-arena__wait ax-blink">곧 READY → 3 · 2 · 1 → GO!</p>
			</div>
			<div class="ax-arena__demo" data-demo="${gameId}"></div>
		</div>
	</section>`;
}

/**
 * 1:1 대결 화면의 틀. 두 놀이판(.ax-duel__stage)은 비워 두고 arena.ts가 게임을 붙여 되짚어 그린다.
 * 남은 시간과 카운트다운도 arena.ts가 매 프레임 채운다.
 */
export function duelScreen(game: GameState, round: Round): string {
	const info = GAMES[round.gameId];
	const label = matchLabel(game, currentMatch(game));
	const pane = (id: PlayerId | undefined, side: string) => `<article class="ax-duel__pane" data-side="${side}" data-player="${esc(id ?? "")}">
		<p class="ax-duel__name">${id === undefined ? "?" : esc(nameOf(game, id))}</p>
		<div class="ax-duel__stage"></div>
		<p class="ax-duel__score">-</p>
	</article>`;
	return `<section class="ax-duel" data-round="${round.no}" data-play-at="${round.playAt}">
		<header class="ax-duel__top">
			<span class="ax-kicker">${esc(label)}</span>
			<span class="ax-duel__game">${gameIcon(round.gameId, "ax-duel__icon")}${esc(info.title)}</span>
			<span class="ax-duel__clock ax-timer">READY</span>
		</header>
		<div class="ax-duel__bar" aria-hidden="true"><i></i></div>
		<div class="ax-duel__panes">
			${pane(round.participantIds[0], "a")}
			<span class="ax-duel__vs">VS</span>
			${pane(round.participantIds[1], "b")}
		</div>
		<div class="ax-duel__overlay ax-overlay" role="status"></div>
	</section>`;
}

/** 경기 결과. 승자를 밝히고 두 사람 기록을 나란히 보여 준다. */
export function resultScreen(game: GameState, round: Round): string {
	const info = GAMES[round.gameId];
	const winnerId = matchWinner(round);
	const row = (id: PlayerId | undefined) => {
		if (id === undefined) return "";
		const score = round.scores[id];
		const tone = winnerId === null ? "" : id === winnerId ? " is-win" : " is-lost";
		return `<li class="ax-duel-result__row${tone}">
			<span class="ax-duel-result__name">${esc(nameOf(game, id))}</span>
			<span class="ax-duel-result__score">${score === undefined ? "기록 없음" : esc(info.formatScore(score))}</span>
			<span class="ax-duel-result__mark">${winnerId === null ? "DRAW" : id === winnerId ? "WIN" : "LOSE"}</span>
		</li>`;
	};
	const verdict =
		winnerId === null
			? `<p class="ax-duel-result__tie ax-blink">동점 · 재경기</p>`
			: `<p class="ax-duel-result__winner">${svg.crown}<b>${esc(nameOf(game, winnerId))}</b> 승!</p>`;
	return `<section class="ax-arena ax-arena--split">
		<div class="ax-arena__info">
			<p class="ax-kicker">${esc(matchLabel(game, currentMatch(game)))} 결과 · ${esc(info.title)}</p>
			${verdict}
			<ol class="ax-duel-result">${row(round.participantIds[0])}${row(round.participantIds[1])}</ol>
		</div>
		${bracketPanel(game)}
	</section>`;
}

/** 우승자 발표 */
export function finishedScreen(game: GameState): string {
	const winnerId = champion(game);
	return `<section class="ax-arena ax-arena--split ax-arena--final">
		<div class="ax-arena__info ax-champion">
			<p class="ax-kicker">CHAMPION</p>
			${svg.trophy}
			<p class="ax-champion__name">${winnerId === null ? "아직 우승자가 없어요" : esc(nameOf(game, winnerId))}</p>
		</div>
		${bracketPanel(game)}
	</section>`;
}
