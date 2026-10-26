import { type GameState, lockedPlanLength, PLAN_LIMIT } from "../../domain/game";
import { GAME_IDS, GAMES, type GameId } from "../../domain/games/catalog";
import { esc } from "../dom";
import { gameIcon } from "../games/art";

/** 순서표 편집기. draft는 아직 안 한 라운드들(잠긴 앞부분 뒤). 저장하면 setPlan으로 보낸다. */
export function planEditor(game: GameState, draft: readonly GameId[]): string {
	const locked = lockedPlanLength(game);
	const done = game.plan.slice(0, locked).map(
		(gameId, i) => `<li class="ax-plan-edit__row is-locked">
			<span class="ax-plan-edit__no">R${i + 1}</span>${gameIcon(gameId)}<span class="ax-plan-edit__name">${esc(GAMES[gameId].title)}</span>
			<span class="ax-plan-edit__tag">${i < game.history.length ? "끝남" : "진행 중"}</span>
		</li>`,
	);
	const upcoming = draft.map(
		(gameId, i) => `<li class="ax-plan-edit__row">
			<span class="ax-plan-edit__no">R${locked + i + 1}</span>${gameIcon(gameId)}<span class="ax-plan-edit__name">${esc(GAMES[gameId].title)}</span>
			<span class="ax-plan-edit__tools">
				<button type="button" class="ax-btn ax-btn--icon" data-action="plan-up" data-index="${i}" ${i === 0 ? "disabled" : ""} aria-label="위로">▲</button>
				<button type="button" class="ax-btn ax-btn--icon" data-action="plan-down" data-index="${i}" ${i === draft.length - 1 ? "disabled" : ""} aria-label="아래로">▼</button>
				<button type="button" class="ax-btn ax-btn--icon ax-btn--danger" data-action="plan-remove" data-index="${i}" aria-label="빼기">×</button>
			</span>
		</li>`,
	);
	const full = locked + draft.length >= PLAN_LIMIT;
	const adders = GAME_IDS.map(
		(gameId) =>
			`<button type="button" class="ax-btn ax-btn--game" data-action="plan-add" data-id="${gameId}" ${full ? "disabled" : ""}>${gameIcon(gameId)}${esc(GAMES[gameId].title)}</button>`,
	).join("");
	return `<section class="ax-editor ax-box">
		<h2 class="ax-editor__title">순서표</h2>
		<p class="ax-muted">끝난 라운드는 바꿀 수 없어요. 같은 게임을 여러 번 넣어도 돼요. (최대 ${PLAN_LIMIT}라운드)</p>
		<ol class="ax-plan-edit">${[...done, ...upcoming].join("") || `<li class="ax-muted">아래에서 게임을 눌러 라운드를 넣어 주세요</li>`}</ol>
		<div class="ax-plan-add"><span class="ax-muted">추가</span>${adders}</div>
		<div class="ax-editor__actions">
			<button type="button" class="ax-btn" data-action="plan-close">닫기</button>
			<button type="button" class="ax-btn ax-btn--go" data-action="plan-save">저장</button>
		</div>
	</section>`;
}
