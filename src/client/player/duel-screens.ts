import { champion, currentMatch, type GameState, type Round } from "../../domain/game";
import { GAMES } from "../../domain/games/catalog";
import type { Player, PlayerId } from "../../domain/player";
import { bracketRounds, matchWinner, roundTitle } from "../../domain/tournament";
import { esc } from "../dom";
import { gameIcon } from "../games/art";
import { svg } from "../ui-art";

/** 토너먼트 방식일 때의 폰 화면 HTML. 상태를 받아 그리기만 한다(입력 처리는 player.ts). */

const TITLE = `<h1 class="ax-title"><span>토너먼트</span><span class="ax-title__big">비시바시</span></h1>`;

const nameOf = (game: GameState, id: PlayerId | null) => (id === null ? "?" : (game.players.find((player) => player.id === id)?.name ?? "?"));

/** 이 사람이 토너먼트에서 어디까지 왔는지 */
type Standing =
	| { readonly kind: "champion" }
	/** 다음 경기를 기다린다 */
	| { readonly kind: "waiting"; readonly roundLabel: string; readonly opponentId: PlayerId | null }
	| { readonly kind: "out"; readonly roundLabel: string }
	/** 대진에 없다(늦게 들어왔거나 대진을 짜기 전) */
	| { readonly kind: "none" };

function standingOf(game: GameState, me: Player): Standing {
	if (game.bracket === null) return { kind: "none" };
	if (champion(game) === me.id) return { kind: "champion" };
	const rounds = bracketRounds(game.bracket, game.history);
	for (const [index, matches] of rounds.entries()) {
		const match = matches.find((other) => other.aId === me.id || other.bId === me.id);
		if (match === undefined) continue;
		const roundLabel = roundTitle(index, rounds.length);
		if (match.winnerId === null) return { kind: "waiting", roundLabel, opponentId: match.aId === me.id ? match.bId : match.aId };
		if (match.winnerId !== me.id) return { kind: "out", roundLabel };
	}
	return { kind: "none" };
}

function nextGameCard(game: GameState): string {
	const match = currentMatch(game);
	if (match === null) return "";
	const gameId = game.plan.length === 0 ? null : (game.plan[game.history.length % game.plan.length] ?? null);
	if (gameId === null) return "";
	const info = GAMES[gameId];
	return `<article class="ax-next ax-box">
		<p class="ax-kicker">다음 경기 · ${esc(nameOf(game, match.aId))} vs ${esc(nameOf(game, match.bId))}</p>
		<div class="ax-next__head">${gameIcon(gameId)}<h2 class="ax-next__title">${esc(info.title)}</h2></div>
		<p class="ax-next__howto">${esc(info.howTo)}</p>
	</article>`;
}

/** 경기 사이. 내 차례인지, 떨어졌는지, 우승했는지 알려 준다. */
export function duelLobbyScreen(game: GameState, me: Player, soundOn: boolean): string {
	const standing = standingOf(game, me);
	const status = (() => {
		switch (standing.kind) {
			case "champion":
				return `<div class="ax-standing ax-box">${svg.trophy}<p class="ax-standing__rank">우승!</p><p class="ax-muted">앞 화면을 봐 주세요</p></div>`;
			case "waiting": {
				const mine = currentMatch(game);
				const myTurn = mine !== null && (mine.aId === me.id || mine.bId === me.id);
				return `<div class="ax-standing ax-box">
					<p class="ax-kicker">${esc(standing.roundLabel)}</p>
					<p class="ax-standing__rank">${myTurn ? "내 차례!" : "다음 차례를 기다려요"}</p>
					<p class="ax-standing__total">상대 <b>${esc(nameOf(game, standing.opponentId))}</b></p>
				</div>`;
			}
			case "out":
				return `<div class="ax-standing ax-box"><p class="ax-kicker">${esc(standing.roundLabel)}</p><p class="ax-standing__rank">아쉽게 탈락</p><p class="ax-muted">앞 화면에서 같이 응원해요!</p></div>`;
			case "none":
				return game.bracket === null
					? `<p class="ax-badge ax-badge--ok">입장 완료</p><p class="ax-lead">진행자가 대진을 짜고 있어요</p>`
					: `<p class="ax-lead">이번 토너먼트 대진에는 없어요.<br>앞 화면에서 구경해 주세요!</p>`;
		}
	})();
	return `<section class="ax-screen">
		<p class="ax-me"><span class="ax-me__tag">P</span>${esc(me.name)}</p>
		${status}
		${nextGameCard(game)}
		${soundOn ? "" : `<button type="button" class="ax-btn ax-btn--wide" data-action="sound">${svg.speaker}소리 켜기</button>`}
	</section>`;
}

/** 남이 붙는 경기를 구경하는 중. 토너먼트에서는 연습 대신 이 화면을 보여 준다. */
export function duelWatchScreen(game: GameState, round: Round): string {
	const [aId, bId] = round.participantIds;
	return `<section class="ax-screen ax-screen--center">
		<p class="ax-kicker">${esc(GAMES[round.gameId].title)}</p>
		<p class="ax-lead"><b>${esc(nameOf(game, aId ?? null))}</b> vs <b>${esc(nameOf(game, bId ?? null))}</b></p>
		<p class="ax-muted">앞 화면에서 두 사람의 플레이를 같이 봐요</p>
	</section>`;
}

/** 경기가 끝난 뒤. 이겼는지 졌는지를 먼저 보여 준다. */
export function duelResultScreen(game: GameState, round: Round, me: Player): string {
	const info = GAMES[round.gameId];
	if (!round.participantIds.includes(me.id)) return duelWatchScreen(game, round);
	const winnerId = matchWinner(round);
	const opponentId = round.participantIds.find((id) => id !== me.id) ?? null;
	const myScore = round.scores[me.id];
	const theirScore = opponentId === null ? undefined : round.scores[opponentId];
	const won = winnerId === me.id;
	const tone = winnerId === null ? "plain" : won ? "gold" : "bad";
	const verdict = winnerId === null ? "동점 · 재경기" : won ? "이겼다!" : "졌어요";
	return `<section class="ax-screen ax-screen--center ax-verdict ax-verdict--${tone}">
		<p class="ax-kicker">${esc(info.title)}</p>
		${won ? svg.crown : ""}
		<p class="ax-verdict__rank">${esc(verdict)}</p>
		<p class="ax-verdict__record">내 기록 ${myScore === undefined ? "없음" : esc(info.formatScore(myScore))}</p>
		<p class="ax-verdict__total">${esc(nameOf(game, opponentId))} ${theirScore === undefined ? "기록 없음" : esc(info.formatScore(theirScore))}</p>
		<p class="ax-muted">진행자가 확정하면 다음 경기로 넘어가요</p>
	</section>`;
}

/** 우승자 발표 */
export function duelFinishScreen(game: GameState, me: Player): string {
	const winnerId = champion(game);
	const mine = winnerId === me.id;
	const standing = standingOf(game, me);
	return `<section class="ax-screen ax-final${mine ? " ax-final--top" : ""}">
		<p class="ax-kicker">CHAMPION</p>
		${mine ? svg.crown : svg.trophy}
		<p class="ax-final__rank">${winnerId === null ? "우승자 없음" : esc(nameOf(game, winnerId))}</p>
		<p class="ax-final__total">${mine ? "축하해요! 우승이에요" : standing.kind === "out" ? `${esc(standing.roundLabel)}까지 올라갔어요` : "앞 화면을 봐 주세요"}</p>
	</section>`;
}

/** 경기 시작 전 게임 설명. 시연은 player.ts가 [data-demo] 칸에 붙인다. */
export function duelIntroScreen(game: GameState, me: Player): string {
	const match = currentMatch(game);
	const gameId = game.plan.length === 0 ? null : (game.plan[game.history.length % game.plan.length] ?? null);
	if (match === null || gameId === null) return duelLobbyScreen(game, me, true);
	const info = GAMES[gameId];
	const mine = match.aId === me.id || match.bId === me.id;
	return `<section class="ax-screen ax-intro">
		<p class="ax-kicker">${esc(nameOf(game, match.aId))} vs ${esc(nameOf(game, match.bId))}</p>
		<div class="ax-next__head">${gameIcon(gameId)}<h1 class="ax-intro__title">${esc(info.title)}</h1></div>
		<p class="ax-intro__howto">${esc(info.howTo)}</p>
		<div class="ax-intro__demo" data-demo="${gameId}"></div>
		<p class="ax-intro__wait ax-blink">${mine ? "내 차례! 곧 3·2·1 뒤에 시작해요" : "구경할 차례예요. 앞 화면을 봐 주세요"}</p>
	</section>`;
}
