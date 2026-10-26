import { describe, expect, it } from "vitest";
import type { GameId } from "../src/domain/games/catalog";
import { editDraft } from "../src/client/host/plan-draft";

const draft: readonly GameId[] = ["eye", "balloon", "candy"];

describe("editDraft", () => {
	it("게임을 뒤에 넣는다", () => {
		expect(editDraft(draft, "plan-add", -1, "grill")).toEqual(["eye", "balloon", "candy", "grill"]);
	});

	it("빼고, 위아래로 옮긴다", () => {
		expect(editDraft(draft, "plan-remove", 1, null)).toEqual(["eye", "candy"]);
		expect(editDraft(draft, "plan-up", 1, null)).toEqual(["balloon", "eye", "candy"]);
		expect(editDraft(draft, "plan-down", 1, null)).toEqual(["eye", "candy", "balloon"]);
	});

	it("맨 위를 더 올리거나 맨 아래를 더 내리면 그대로", () => {
		expect(editDraft(draft, "plan-up", 0, null)).toEqual(draft);
		expect(editDraft(draft, "plan-down", 2, null)).toEqual(draft);
	});
});
