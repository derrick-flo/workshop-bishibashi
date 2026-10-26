import { type GameState, nextGame, type Round } from "../../domain/game";
import { GAMES } from "../../domain/games/catalog";
import type { Player, PlayerId } from "../../domain/player";
import { rankScores } from "../../domain/ranking";
import { roundPoints, type Standing, standings } from "../../domain/standings";
import { esc } from "../dom";
import { gameIcon } from "../games/art";
import { svg } from "../ui-art";

/** 폰 화면 HTML. 상태를 받아 그리기만 한다(입력 처리는 player.ts). */

const TITLE = `<h1 class="ax-title"><span>워크샵</span><span class="ax-title__big">비시바시</span></h1>`;

function rowOf(table: readonly Standing[], playerId: PlayerId): Standing | null {
	return table.find((row) => row.playerId === playerId) ?? null;
}

/** 순위 변화 표시. 올랐으면 ▲, 내려갔으면 ▼ */
function movement(before: Standing | null, after: Standing | null): string {
	if (before === null || after === null || before.rank === after.rank) return "";
	const up = before.rank > after.rank;
	return `<span class="ax-move ax-move--${up ? "up" : "down"}">${up ? "▲" : "▼"}${Math.abs(before.rank - after.rank)}</span>`;
}

export function connectingScreen(): string {
	return `<section class="ax-screen ax-screen--center">${TITLE}<p class="ax-lead ax-blink">연결 중…</p></section>`;
}

export function joinScreen(game: GameState, picking: PlayerId | null): string {
	if (game.players.length === 0) {
		return `<section class="ax-screen ax-screen--center">${TITLE}<p class="ax-lead">진행자가 명단을 준비하고 있어요.<br>잠시만 기다려 주세요.</p></section>`;
	}
	const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "ko"));
	return `<section class="ax-screen">
		${TITLE}
		<p class="ax-lead">내 이름을 눌러 입장하세요</p>
		<ul class="ax-names">${players.map((player) => nameItem(player, picking)).join("")}</ul>
	</section>`;
}

function nameItem(player: Player, picking: PlayerId | null): string {
	if (player.claimed) {
		return `<li><button type="button" class="ax-name" disabled>${esc(player.name)}<small>입장함</small></button></li>`;
	}
	if (picking === player.id) {
		return `<li class="ax-names__confirm ax-box">
			<p><b>${esc(player.name)}</b> 님이 맞나요?</p>
			<button type="button" class="ax-btn ax-btn--go" data-action="claim" data-id="${esc(player.id)}">네, 입장할게요</button>
			<button type="button" class="ax-btn" data-action="unpick">아니에요</button>
		</li>`;
	}
	return `<li><button type="button" class="ax-name" data-action="pick" data-id="${esc(player.id)}">${esc(player.name)}</button></li>`;
}

export function lobbyScreen(game: GameState, me: Player, soundOn: boolean): string {
	const table = standings(game.players, game.history);
	const mine = rowOf(table, me.id);
	const status =
		mine === null
			? `<p class="ax-badge ax-badge--ok">입장 완료</p><p class="ax-lead">앞 화면을 봐 주세요. 곧 시작해요!</p>`
			: `<div class="ax-standing ax-box">
				<p class="ax-kicker">지금 순위</p>
				<p class="ax-standing__rank"><b>${mine.rank}</b>위 <small>/ ${table.length}명</small></p>
				<p class="ax-standing__total">합계 <b>${mine.total}</b>점</p>
			</div>`;
	return `<section class="ax-screen">
		<p class="ax-me"><span class="ax-me__tag">P</span>${esc(me.name)}</p>
		${status}
		${upcomingCard(game)}
		${soundOn ? "" : `<button type="button" class="ax-btn ax-btn--wide" data-action="sound">${svg.speaker}소리 켜기</button>`}
	</section>`;
}

function upcomingCard(game: GameState): string {
	const gameId = nextGame(game);
	if (gameId === null) return `<p class="ax-muted">다음 게임을 고르는 중이에요</p>`;
	const info = GAMES[gameId];
	return `<article class="ax-next ax-box">
		<p class="ax-kicker">ROUND ${game.history.length + 1} · 다음 게임</p>
		<div class="ax-next__head">${gameIcon(gameId)}<h2 class="ax-next__title">${esc(info.title)}</h2></div>
		<p class="ax-next__howto">${esc(info.howTo)}</p>
	</article>`;
}

export function resultScreen(game: GameState, round: Round, me: Player): string {
	const info = GAMES[round.gameId];
	if (!round.participantIds.includes(me.id)) {
		return `<section class="ax-screen ax-screen--center"><p class="ax-kicker">ROUND ${round.no}</p><p class="ax-lead">이번 라운드는 구경했어요.<br>다음 라운드부터 같이 해요!</p></section>`;
	}
	const entry = rankScores(round.participantIds, round.scores).find((row) => row.playerId === me.id);
	const points = roundPoints(round)[me.id] ?? 0;
	const before = standings(game.players, game.history);
	const after = standings(game.players, [...game.history, round]);
	const now = rowOf(after, me.id);
	const rank = entry?.rank ?? null;
	const tone = rank === 1 ? "gold" : rank !== null && rank <= 3 ? "good" : rank === null ? "bad" : "plain";
	return `<section class="ax-screen ax-screen--center ax-verdict ax-verdict--${tone}">
		<p class="ax-kicker">ROUND ${round.no} · ${esc(info.title)}</p>
		${rank === 1 ? svg.crown : ""}
		<p class="ax-verdict__rank">${rank === null ? "기록 없음" : `<b>${rank}</b>위`}<small> / ${round.participantIds.length}명</small></p>
		<p class="ax-verdict__record">${entry?.score == null ? "기록이 도착하지 않았어요" : `기록 ${esc(info.formatScore(entry.score))}`}</p>
		<p class="ax-verdict__points">+${points}<small>점</small></p>
		${now === null ? "" : `<p class="ax-verdict__total">합계 ${now.total}점 · 전체 <b>${now.rank}</b>위 ${movement(rowOf(before, me.id), now)}</p>`}
		<p class="ax-muted">진행자가 확정하면 반영돼요</p>
	</section>`;
}

export function finishScreen(game: GameState, me: Player): string {
	const table = standings(game.players, game.history);
	const mine = rowOf(table, me.id);
	if (mine === null) {
		return `<section class="ax-screen ax-screen--center">${svg.trophy}<p class="ax-lead">최종 순위 발표!<br>앞 화면을 봐 주세요</p></section>`;
	}
	const top = mine.rank <= 3;
	const rounds = game.history
		.map((round, i) => {
			const points = mine.perRound[i] ?? null;
			const width = points === null ? 0 : Math.round((points / Math.max(1, round.participantIds.length)) * 100);
			return `<li><span class="ax-rounds__no">R${round.no}</span><span class="ax-rounds__name">${esc(GAMES[round.gameId].title)}</span><span class="ax-rounds__bar"><i style="width:${width}%"></i></span><b>${points === null ? "-" : points}</b></li>`;
		})
		.join("");
	return `<section class="ax-screen ax-final${top ? " ax-final--top" : ""}">
		<p class="ax-kicker">FINAL</p>
		${mine.rank === 1 ? svg.crown : top ? svg.trophy : ""}
		<p class="ax-final__rank"><b>${mine.rank}</b>위 <small>/ ${table.length}명</small></p>
		<p class="ax-final__total">합계 <b>${mine.total}</b>점${mine.wins > 0 ? ` · 1등 ${mine.wins}번` : ""}</p>
		<ol class="ax-rounds ax-box">${rounds}</ol>
	</section>`;
}

/** 게임 화면 대신 보여주는 안내(이미 기록을 냈거나 늦게 들어왔을 때) */
export function waitScreen(title: string, detail: string): string {
	return `<section class="ax-screen ax-screen--center"><p class="ax-lead"><b>${esc(title)}</b></p><p class="ax-muted">${esc(detail)}</p></section>`;
}
