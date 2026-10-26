import type { GameId } from "../../domain/games/catalog";

/** 편집 동작을 draft에 적용한다 */
export function editDraft(draft: readonly GameId[], action: string, index: number, gameId: GameId | null): readonly GameId[] {
	switch (action) {
		case "plan-add":
			return gameId === null ? draft : [...draft, gameId];
		case "plan-remove":
			return draft.filter((_, i) => i !== index);
		case "plan-up":
		case "plan-down": {
			const other = action === "plan-up" ? index - 1 : index + 1;
			const a = draft[index];
			const b = draft[other];
			if (a === undefined || b === undefined) return draft;
			return draft.map((id, i) => (i === index ? b : i === other ? a : id));
		}
		default:
			return draft;
	}
}
