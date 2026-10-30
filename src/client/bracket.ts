import type { PlayerId } from "../domain/player";
import { type Bracket, bracketRounds, type Match, type PlayedMatch, roundTitle } from "../domain/tournament";
import { esc } from "./dom";

/** 대진표 그리기. 진행자 화면과 관전 화면이 같이 쓴다. */

export type BracketView = {
	readonly nameOf: (playerId: PlayerId) => string;
	/** 지금 치르는(또는 곧 치를) 경기를 짚어 준다 */
	readonly now: Match | null;
};

const isSame = (a: Match, b: Match | null) => b !== null && a.roundIndex === b.roundIndex && a.slot === b.slot;

/** 경기 한쪽 자리. 올라올 사람이 아직 없으면 물음표, 1회전 빈자리는 부전승. */
function slotHtml(match: Match, playerId: PlayerId | null, view: BracketView): string {
	const won = playerId !== null && playerId === match.winnerId;
	const lost = match.winnerId !== null && !won;
	const text = playerId !== null ? esc(view.nameOf(playerId)) : match.bye ? "부전승" : "?";
	const tone = playerId === null ? " is-empty" : won ? " is-win" : lost ? " is-lost" : "";
	return `<span class="ax-bk__slot${tone}">${text}</span>`;
}

function matchHtml(match: Match, view: BracketView): string {
	const classes = [
		"ax-bk__match",
		match.bye ? "is-bye" : "",
		match.winnerId !== null && !match.bye ? "is-done" : "",
		isSame(match, view.now) ? "is-now" : "",
	]
		.filter((name) => name !== "")
		.join(" ");
	return `<li class="${classes}">${slotHtml(match, match.aId, view)}${slotHtml(match, match.bId, view)}</li>`;
}

function roundHtml(matches: readonly Match[], roundIndex: number, roundCount: number, view: BracketView): string {
	return `<div class="ax-bk__round">
		<p class="ax-bk__round-name">${esc(roundTitle(roundIndex, roundCount))}</p>
		<ol class="ax-bk__matches">${matches.map((match) => matchHtml(match, view)).join("")}</ol>
	</div>`;
}

/**
 * 대진표. 세로로 길어지지 않게 반으로 갈라 양쪽에서 가운데 결승으로 모이게 놓는다
 * (왼쪽 절반은 왼쪽 끝 1회전부터, 오른쪽 절반은 오른쪽 끝 1회전부터). 뒷 회전 경기는 앞 회전 두 경기 사이 가운데에 온다.
 * 크기는 arcade.css 가 정한다. 그 계산에 쓰도록 한 칸에 쌓이는 경기 수(--bk-per)와 칸 수(--bk-cols)를 넘긴다.
 */
export function bracketHtml(bracket: Bracket, played: readonly PlayedMatch[], view: BracketView): string {
	const rounds = bracketRounds(bracket, played);
	const finalIndex = rounds.length - 1;
	const sides = rounds.slice(0, finalIndex);
	const left = sides.map((matches, index) => roundHtml(matches.slice(0, matches.length / 2), index, rounds.length, view));
	const right = sides.map((matches, index) => roundHtml(matches.slice(matches.length / 2), index, rounds.length, view)).reverse();
	const final = roundHtml(rounds[finalIndex] ?? [], finalIndex, rounds.length, view);
	const perColumn = Math.max(1, (rounds[0]?.length ?? 1) / (sides.length > 0 ? 2 : 1));
	return `<div class="ax-bk" style="--bk-per:${perColumn};--bk-cols:${rounds.length * 2 - 1}">${[...left, final, ...right].join("")}</div>`;
}
