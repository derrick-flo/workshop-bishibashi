import { champion, chosenByes, currentMatch, type GameState, joinedPlayers, nextGame, type Round } from "../../domain/game";
import { GAMES } from "../../domain/games/catalog";
import type { PlayerId } from "../../domain/player";
import { bracketRounds, byeCount, entrantCount, type Match, matchTotal, matchWinner, MIN_ENTRANTS, roundTitle } from "../../domain/tournament";
import { bracketHtml, type BracketView } from "../bracket";
import { esc } from "../dom";
import { gameIcon } from "../games/art";
import { svg } from "../ui-art";
import { chips, joinCard, nameOf, planStrip, type StageOptions } from "./stages";

/** 토너먼트 방식일 때의 진행자(프로젝터) 앞 화면. 두 사람의 플레이 자체는 관전 화면(/arena)이 보여 준다. */

/** 관전 화면 주소. 진행자 화면과 같은 경로 아래라 하위 경로(예: /bishibashi/)에 올려도 맞다. */
function arenaLabel(): string {
	const url = new URL("arena", location.href);
	return `${url.host}${url.pathname}`;
}

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

/** 두 사람 이름을 맞세운 패. 승자가 갈렸으면 밝게 짚는다. */
function versus(game: GameState, aId: PlayerId | null, bId: PlayerId | null, winnerId: PlayerId | null): string {
	const side = (id: PlayerId | null) => {
		const tone = winnerId === null ? "" : id === winnerId ? " is-win" : " is-lost";
		return `<p class="ax-vs__name${tone}">${id === null ? "?" : esc(nameOf(game, id))}</p>`;
	};
	return `<div class="ax-vs">${side(aId)}<span class="ax-vs__mark">VS</span>${side(bId)}</div>`;
}

function bracketPanel(game: GameState): string {
	if (game.bracket === null) return "";
	return `<div class="ax-bk-panel">${bracketHtml(game.bracket, game.history, viewOf(game))}</div>`;
}

function gameCard(game: GameState, kicker: string): string {
	const gameId = nextGame(game);
	if (gameId === null) return `<aside class="ax-next-up ax-box"><p class="ax-kicker">${esc(kicker)}</p><p class="ax-muted">순서표가 비어 있어요. 아래 '순서표'에서 게임을 넣어 주세요.</p></aside>`;
	const info = GAMES[gameId];
	return `<aside class="ax-next-up ax-box">
		<p class="ax-kicker">${esc(kicker)}</p>
		<div class="ax-next-up__head">${gameIcon(gameId, "ax-next-up__icon")}<p class="ax-next-up__title">${esc(info.title)}</p></div>
		<p class="ax-next-up__howto">${esc(info.howTo)}</p>
	</aside>`;
}

/** 정해 둔 부전승이 자리보다 많은 수. 넘치면 대진을 짤 수 없다(진행자 버튼도 막는다). */
export function byeOverflow(game: GameState): number {
	return Math.max(0, chosenByes(game).length - byeCount(joinedPlayers(game).length));
}

/** 부전승 자리와 정해 둔 사람 수. 자리는 지금 입장한 사람 수로 센다. */
function byeLine(game: GameState): string {
	const joined = joinedPlayers(game).length;
	if (joined < MIN_ENTRANTS) return "";
	const slots = byeCount(joined);
	const chosen = chosenByes(game).length;
	const over = byeOverflow(game);
	if (slots === 0 && chosen === 0) return `<p class="ax-muted">입장 ${joined}명이라 부전승 자리가 없어요.</p>`;
	const detail =
		over > 0
			? `${over}명 줄여 주세요`
			: chosen === 0
				? "이름을 누르면 부전승으로 정해 둘 수 있어요"
				: chosen < slots
					? `남은 ${slots - chosen}자리는 무작위`
					: "";
	return `<p class="ax-bye-line${over > 0 ? " is-over" : ""}">부전승 자리 <b>${slots}</b> · 지정 <b>${chosen}</b>명${detail === "" ? "" : ` · ${detail}`}</p>`;
}

/** 대진을 짜기 전 로비. 명단을 모으고 관전 화면 주소를 알려 준다. */
function drawStage(game: GameState, options: StageOptions): string {
	const joined = joinedPlayers(game).length;
	return `<section class="ax-lobby">
		${joinCard()}
		<div class="ax-lobby__side">
			<h2 class="ax-section-title">토너먼트 · 입장 <b>${joined}</b> / ${game.players.length}</h2>
			${game.players.length === 0 ? `<p class="ax-muted">아래 '명단' 버튼으로 참가자 이름을 넣어 주세요.</p>` : chips(game, options)}
			<aside class="ax-next-up ax-box">
				<p class="ax-kicker">대진</p>
				<p class="ax-muted">${joined < MIN_ENTRANTS ? `${MIN_ENTRANTS}명 이상 입장하면 대진을 짤 수 있어요.` : `입장한 ${joined}명으로 아래 '대진 짜기'를 누르면 1:1 대진을 섞어 짜요. 사람 수가 2의 거듭제곱이 아니면 부전승이 생겨요.`}</p>
				${byeLine(game)}
				<p class="ax-muted">관전 화면은 <b>${esc(arenaLabel())}</b> 에 띄워 주세요.</p>
			</aside>
			${planStrip(game)}
		</div>
	</section>`;
}

/** 경기 사이 로비. 다음 경기와 대진표를 보여 준다. */
function betweenStage(game: GameState, options: StageOptions): string {
	if (game.bracket === null) return drawStage(game, options);
	const match = currentMatch(game);
	const left = Math.max(0, matchTotal(game.bracket) - game.history.length);
	return `<section class="ax-lobby ax-lobby--between">
		<div class="ax-lobby__main">
			<h2 class="ax-section-title">${match === null ? "경기가 다 끝났어요" : `다음 경기 · ${esc(matchLabel(game, match))}`}</h2>
			${match === null ? "" : versus(game, match.aId, match.bId, null)}
			${match === null ? "" : gameCard(game, "다음 게임")}
			<p class="ax-muted">${entrantCount(game.bracket)}명 · 치른 경기 ${game.history.length} · 남은 경기 ${left} · 관전 화면 ${esc(arenaLabel())}</p>
			${game.history.length === 0 ? `${byeLine(game)}<p class="ax-muted">부전승 지정을 바꾸면 '대진 다시 짜기'를 눌러야 대진에 반영돼요.</p>` : ""}
			${planStrip(game)}
			<div class="ax-chips--compact">${chips(game, options)}</div>
		</div>
		<div class="ax-lobby__side">
			<h2 class="ax-section-title">대진표</h2>
			${bracketPanel(game)}
		</div>
	</section>`;
}

/** 경기 시작 전 게임 설명. 시연은 host.ts가 [data-demo] 칸에 붙인다. */
function introStage(game: GameState): string {
	const match = currentMatch(game);
	const gameId = nextGame(game);
	if (match === null || gameId === null) return `<section class="ax-round"><p class="ax-muted">다음 경기나 게임이 없어요</p></section>`;
	const info = GAMES[gameId];
	return `<section class="ax-intro-stage">
		<div class="ax-intro-stage__info">
			<p class="ax-kicker">${esc(matchLabel(game, match))} · 게임 설명</p>
			${versus(game, match.aId, match.bId, null)}
			<div class="ax-round__title">${gameIcon(gameId, "ax-round__icon")}<h1>${esc(info.title)}</h1></div>
			<p class="ax-intro-stage__howto">${esc(info.howTo)}</p>
			<p class="ax-intro-stage__next ax-blink">다음 ▶ 을 누르면 READY → 3 · 2 · 1 → GO!</p>
		</div>
		<div class="ax-intro-stage__demo" data-demo="${gameId}"></div>
	</section>`;
}

/** 경기 중. 시계와 남은 시간 막대는 host.ts의 tickClock이 .ax-round 를 보고 채운다. */
function roundStage(game: GameState, round: Round, options: StageOptions): string {
	const info = GAMES[round.gameId];
	const submitted = Object.keys(round.scores).length;
	const waiting = round.participantIds.filter((id) => round.scores[id] === undefined);
	return `<section class="ax-round" data-play-at="${round.playAt}" data-end-at="${round.endAt}">
		<p class="ax-kicker">${esc(matchLabel(game, currentMatch(game)))}</p>
		${versus(game, round.participantIds[0] ?? null, round.participantIds[1] ?? null, null)}
		<div class="ax-round__title">${gameIcon(round.gameId, "ax-round__icon")}<h1>${esc(info.title)}</h1></div>
		<p class="ax-round__clock">READY</p>
		<div class="ax-round__bar" aria-hidden="true"><i></i></div>
		<p class="ax-round__count">기록 <b>${submitted}</b> / ${round.participantIds.length}</p>
		<ul class="ax-waiting">${waiting
			.map((id) => `<li class="${options.onlineIds.includes(id) ? "is-online" : ""}"><i class="ax-chip__dot" aria-hidden="true"></i>${esc(nameOf(game, id))}</li>`)
			.join("")}</ul>
		<p class="ax-muted">두 사람의 플레이는 관전 화면(${esc(arenaLabel())})에서 나란히 보여요.</p>
	</section>`;
}

/** 경기 결과. 동점이면 승자를 가릴 수 없어서 재경기해야 한다. */
function resultsStage(game: GameState, round: Round): string {
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
	return `<section class="ax-results">
		<header class="ax-results__head">
			<p class="ax-kicker">${esc(matchLabel(game, currentMatch(game)))} 결과 · ${esc(info.title)}</p>
			${
				winnerId === null
					? `<p class="ax-duel-result__tie ax-blink">동점 · 승자를 가릴 수 없어요. '재경기'를 눌러 주세요.</p>`
					: `<p class="ax-duel-result__winner">${svg.crown}<b>${esc(nameOf(game, winnerId))}</b> 승!</p>`
			}
		</header>
		<ol class="ax-duel-result">${row(round.participantIds[0])}${row(round.participantIds[1])}</ol>
		${bracketPanel(game)}
	</section>`;
}

/** 우승자 발표 */
function finishedStage(game: GameState): string {
	const winnerId = champion(game);
	return `<section class="ax-final-stage ax-final-stage--duel">
		<div class="ax-champion">
			<p class="ax-kicker">CHAMPION</p>
			${svg.trophy}
			<p class="ax-champion__name">${winnerId === null ? "아직 우승자가 없어요" : esc(nameOf(game, winnerId))}</p>
		</div>
		${bracketPanel(game)}
	</section>`;
}

export function tournamentStage(game: GameState, options: StageOptions): string {
	switch (game.phase.kind) {
		case "lobby":
			return game.bracket === null ? drawStage(game, options) : betweenStage(game, options);
		case "intro":
			return introStage(game);
		case "playing":
			return roundStage(game, game.phase.round, options);
		case "results":
			return resultsStage(game, game.phase.round);
		case "finished":
			return finishedStage(game);
	}
}
