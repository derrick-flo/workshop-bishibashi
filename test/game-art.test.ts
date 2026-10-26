import { describe, expect, it } from "vitest";
import { GAME_ART } from "../src/client/games/art";
import { GAME_IDS } from "../src/domain/games/catalog";

describe("게임 그림", () => {
	// 그림 파일을 불러오다 줄 길이가 틀리거나 모르는 색 글자가 있으면 여기서 바로 걸린다
	it("모든 게임에 16×16 픽셀 아이콘이 있다", () => {
		for (const id of GAME_IDS) {
			const icon = GAME_ART[id]?.icon;
			expect(icon, id).toBeDefined();
			expect([icon?.w, icon?.h], id).toEqual([16, 16]);
		}
	});
});
