import { describe, expect, it } from "vitest";
import {
	cancelRound,
	claim,
	closeIntro,
	closeRound,
	confirmRound,
	EMPTY_GAME,
	finishGame,
	type GameState,
	isRoundComplete,
	lockedPlanLength,
	nextGame,
	openIntro,
	PLAN_LIMIT,
	release,
	reopenGame,
	resetGame,
	setPlan,
	setRoster,
	startRound,
	submitScore,
	type Transition,
} from "../src/domain/game";
import type { GameId } from "../src/domain/games/catalog";

function ok(transition: Transition): GameState {
	if (!transition.ok) throw new Error(`거절됨: ${transition.reason}`);
	return transition.state;
}

function idMaker(): () => string {
	let next = 0;
	return () => `p${++next}`;
}

function roster(names: readonly string[]): GameState {
	return ok(setRoster(EMPTY_GAME, names, idMaker()));
}

/** p1~p5 명단에서 claimedIds만 입장하고, 순서표를 plan으로 둔 상태 */
function lobbyWith(claimedIds: readonly string[], plan: readonly GameId[] = ["balloon", "eye", "candy"]): GameState {
	const joined = claimedIds.reduce((state, id) => ok(claim(state, id)), roster(["가", "나", "다", "라", "마"]));
	return ok(setPlan(joined, plan));
}

const NOW = 1_000_000;

function playing(claimedIds: readonly string[], plan?: readonly GameId[]): GameState {
	return ok(startRound(lobbyWith(claimedIds, plan), 7, NOW));
}

/** 첫 라운드를 NOW에 시작했을 때의 판 */
const R1 = { no: 1, playAt: 1_004_000 } as const;

function keyOf(state: GameState): { readonly no: number; readonly playAt: number } {
	return state.phase.kind === "playing" ? { no: state.phase.round.no, playAt: state.phase.round.playAt } : { no: 0, playAt: 0 };
}

function submitAll(state: GameState, scores: Readonly<Record<string, number>>): GameState {
	return Object.entries(scores).reduce((acc, [id, score]) => ok(submitScore(acc, id, keyOf(state), score, NOW + 16_500)), state);
}

/** 한 라운드를 끝까지 치르고 확정한다 */
function playRound(state: GameState, scores: Readonly<Record<string, number>>): GameState {
	return ok(confirmRound(ok(closeRound(submitAll(ok(startRound(state, 7, NOW)), scores)))));
}

describe("명단", () => {
	it("이름 앞뒤 공백, 빈 줄, 중복을 정리해 명단을 만든다", () => {
		expect(roster([" 김철수 ", "", "이영희", "김철수"]).players).toEqual([
			{ id: "p1", name: "김철수", claimed: false },
			{ id: "p2", name: "이영희", claimed: false },
		]);
	});

	it("명단을 고쳐도 남은 이름은 입장 상태를 그대로 둔다", () => {
		const newId = idMaker();
		const first = ok(claim(ok(setRoster(EMPTY_GAME, ["김철수", "이영희"], newId)), "p1"));
		expect(ok(setRoster(first, ["이영희", "김철수", "박민수"], newId)).players).toEqual([
			{ id: "p2", name: "이영희", claimed: false },
			{ id: "p1", name: "김철수", claimed: true },
			{ id: "p3", name: "박민수", claimed: false },
		]);
	});

	it("라운드가 끝난 뒤에도 늦게 온 사람을 명단에 넣을 수 있다", () => {
		const afterRound = playRound(lobbyWith(["p1", "p2"]), { p1: 10, p2: 20 });
		const names = [...afterRound.players.map((player) => player.name), "늦은사람"];
		expect(ok(setRoster(afterRound, names, () => "late")).players.at(-1)).toEqual({ id: "late", name: "늦은사람", claimed: false });
	});

	it("게임 중이나 결과 발표 중에는 명단을 바꿀 수 없다", () => {
		const round = playing(["p1", "p2"]);
		expect(setRoster(round, ["가"], idMaker())).toEqual({ ok: false, reason: "wrong_phase" });
		expect(setRoster(ok(closeRound(round)), ["가"], idMaker())).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("입장", () => {
	it("이미 누군가 고른 이름은 다시 고를 수 없다", () => {
		const state = lobbyWith(["p1"]);
		expect(state.players[0]?.claimed).toBe(true);
		expect(claim(state, "p1")).toEqual({ ok: false, reason: "already_claimed" });
	});

	it("명단에 없는 이름은 고를 수 없다", () => {
		expect(claim(lobbyWith([]), "zz")).toEqual({ ok: false, reason: "unknown_player" });
	});

	it("진행자가 입장을 풀면 그 이름을 다시 고를 수 있다", () => {
		const released = ok(release(lobbyWith(["p1"]), "p1"));
		expect(released.players[0]?.claimed).toBe(false);
		expect(release(released, "p1")).toEqual({ ok: false, reason: "not_claimed" });
		expect(claim(released, "p1").ok).toBe(true);
	});
});

describe("순서표", () => {
	it("다음 라운드 게임은 순서표에서 아직 안 한 첫 게임이다", () => {
		const state = lobbyWith(["p1"], ["eye", "balloon"]);
		expect(nextGame(state)).toBe("eye");
		expect(nextGame(playRound(state, { p1: 1 }))).toBe("balloon");
	});

	it("끝난 라운드의 게임은 바꿀 수 없고 그 뒤만 바꾼다", () => {
		const twoDone = playRound(playRound(lobbyWith(["p1"], ["eye", "balloon", "candy"]), { p1: 1 }), { p1: 1 });
		expect(lockedPlanLength(twoDone)).toBe(2);
		expect(ok(setPlan(twoDone, ["grill", "grill"])).plan).toEqual(["eye", "balloon", "grill", "grill"]);
	});

	it("게임 중이거나 결과 발표 중이면 진행 중인 라운드까지 잠근다", () => {
		const round = playing(["p1"], ["eye", "balloon"]);
		expect(lockedPlanLength(round)).toBe(1);
		expect(ok(setPlan(round, ["candy"])).plan).toEqual(["eye", "candy"]);
		expect(ok(setPlan(ok(closeRound(round)), [])).plan).toEqual(["eye"]);
	});

	it(`전체 ${PLAN_LIMIT}라운드를 넘으면 거절한다`, () => {
		const tooMany = Array.from({ length: PLAN_LIMIT + 1 }, (): GameId => "eye");
		expect(setPlan(lobbyWith(["p1"]), tooMany)).toEqual({ ok: false, reason: "plan_too_long" });
		expect(setPlan(lobbyWith(["p1"]), tooMany.slice(1)).ok).toBe(true);
	});

	it("순서표가 끝나면 다음 라운드를 시작할 수 없다", () => {
		const done = playRound(lobbyWith(["p1"], ["eye"]), { p1: 1 });
		expect(nextGame(done)).toBeNull();
		expect(startRound(done, 7, NOW)).toEqual({ ok: false, reason: "no_next_game" });
	});
});

describe("게임 설명 단계", () => {
	it("다음 게임이 있으면 로비에서 설명을 띄운다", () => {
		expect(ok(openIntro(lobbyWith(["p1"]))).phase).toEqual({ kind: "intro" });
	});

	it("순서표가 끝났거나 로비가 아니면 띄울 수 없다", () => {
		expect(openIntro(playRound(lobbyWith(["p1"], ["eye"]), { p1: 1 }))).toEqual({ ok: false, reason: "no_next_game" });
		expect(openIntro(playing(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
	});

	it("뒤로 가면 로비로 돌아가고, 설명 단계가 아니면 뒤로 갈 수 없다", () => {
		expect(ok(closeIntro(ok(openIntro(lobbyWith(["p1"]))))).phase).toEqual({ kind: "lobby" });
		expect(closeIntro(lobbyWith(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
	});

	it("설명 단계에서 다음을 누르면 라운드가 시작된다", () => {
		const round = ok(startRound(ok(openIntro(lobbyWith(["p1", "p2"]))), 7, NOW));
		expect(round.phase.kind === "playing" && round.phase.round.participantIds).toEqual(["p1", "p2"]);
	});

	it("설명 중에는 그 라운드 게임이 잠기고, 명단 수정과 최종 발표는 할 수 없다", () => {
		const intro = ok(openIntro(lobbyWith(["p1"], ["eye", "balloon"])));
		expect(lockedPlanLength(intro)).toBe(1);
		expect(ok(setPlan(intro, ["candy"])).plan).toEqual(["eye", "candy"]);
		expect(setRoster(intro, ["가"], idMaker())).toEqual({ ok: false, reason: "wrong_phase" });
		expect(finishGame(intro)).toEqual({ ok: false, reason: "wrong_phase" });
	});

	it("설명 중에 들어온 사람도 시작할 때 입장해 있으면 참가한다", () => {
		const intro = ok(claim(ok(openIntro(lobbyWith(["p1"]))), "p2"));
		const round = ok(startRound(intro, 7, NOW));
		expect(round.phase.kind === "playing" && round.phase.round.participantIds).toEqual(["p1", "p2"]);
	});
});

describe("라운드 시작", () => {
	it("입장한 전원이 참가하고, 시작·종료·마감 시각을 정한다", () => {
		expect(playing(["p1", "p2", "p4"]).phase).toEqual({
			kind: "playing",
			round: {
				no: 1,
				gameId: "balloon",
				seed: 7,
				playAt: 1_004_000,
				endAt: 1_016_000,
				deadlineAt: 1_024_000,
				participantIds: ["p1", "p2", "p4"],
				scores: {},
			},
		});
	});

	it("입장한 사람이 없으면 시작할 수 없다", () => {
		expect(startRound(lobbyWith([]), 7, NOW)).toEqual({ ok: false, reason: "not_enough_players" });
	});

	it("혼자서도 시작할 수 있다(테스트용)", () => {
		const state = playing(["p1"]);
		expect(state.phase.kind === "playing" && state.phase.round.participantIds).toEqual(["p1"]);
	});

	it("게임 중에는 새 라운드를 시작할 수 없다", () => {
		expect(startRound(playing(["p1"]), 7, NOW)).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("기록 제출", () => {
	const round = playing(["p1", "p2", "p3", "p4"]);

	it("참가자가 마감 전에 낸 기록을 받는다", () => {
		const state = ok(submitScore(round, "p1", R1, 1500, 1_016_500));
		expect(state.phase.kind === "playing" && state.phase.round.scores).toEqual({ p1: 1500 });
	});

	it("같은 사람의 두 번째 기록은 받지 않는다", () => {
		const state = ok(submitScore(round, "p1", R1, 1500, 1_016_500));
		expect(submitScore(state, "p1", R1, 2000, 1_016_600)).toEqual({ ok: false, reason: "already_submitted" });
	});

	it("마감(게임 끝 + 8초)이 지나면 받지 않는다", () => {
		expect(submitScore(round, "p1", R1, 1500, 1_024_000).ok).toBe(true);
		expect(submitScore(round, "p1", R1, 1500, 1_024_001)).toEqual({ ok: false, reason: "too_late" });
	});

	it("참가자가 아니거나 다른 라운드 기록이면 받지 않는다", () => {
		expect(submitScore(round, "p5", R1, 1500, 1_016_500)).toEqual({ ok: false, reason: "not_participant" });
		expect(submitScore(round, "p1", { ...R1, no: 2 }, 1500, 1_016_500)).toEqual({ ok: false, reason: "wrong_round" });
	});

	it("취소하고 같은 번호로 다시 시작한 판에는 이전 판 기록을 받지 않는다", () => {
		const replay = ok(startRound(ok(cancelRound(round)), 9, NOW + 60_000));
		expect(submitScore(replay, "p1", R1, 1500, NOW + 76_500)).toEqual({ ok: false, reason: "wrong_round" });
		expect(submitScore(replay, "p1", { no: 1, playAt: NOW + 64_000 }, 1500, NOW + 76_500).ok).toBe(true);
	});

	it("라운드 중에 입장한 사람은 이번 라운드 참가자가 아니다", () => {
		const lateJoin = ok(claim(round, "p5"));
		expect(submitScore(lateJoin, "p5", R1, 1500, 1_016_500)).toEqual({ ok: false, reason: "not_participant" });
	});

	it("음수, 소수, 게임 최대치를 넘는 점수는 받지 않는다", () => {
		for (const score of [-1, 1.5, 2201, Number.NaN]) {
			expect(submitScore(round, "p1", R1, score, 1_016_500)).toEqual({ ok: false, reason: "invalid_score" });
		}
	});

	it("참가자가 모두 내야 라운드가 다 찼다고 본다", () => {
		const three = submitAll(round, { p1: 1, p2: 2, p3: 3 });
		const four = submitAll(three, { p4: 4 });
		expect(three.phase.kind === "playing" && isRoundComplete(three.phase.round)).toBe(false);
		expect(four.phase.kind === "playing" && isRoundComplete(four.phase.round)).toBe(true);
	});
});

describe("결과 확정과 취소", () => {
	const results = ok(closeRound(submitAll(playing(["p1", "p2", "p3"]), { p1: 2000, p2: 1500 })));

	it("라운드를 닫으면 결과 발표 단계가 된다(아무도 탈락하지 않는다)", () => {
		expect(results.phase.kind).toBe("results");
		expect(results.history).toEqual([]);
	});

	it("결과를 확정하면 기록이 쌓이고 로비로 돌아간다", () => {
		const lobby = ok(confirmRound(results));
		expect(lobby.phase).toEqual({ kind: "lobby" });
		expect(lobby.history).toEqual([{ no: 1, gameId: "balloon", participantIds: ["p1", "p2", "p3"], scores: { p1: 2000, p2: 1500 } }]);
		expect(nextGame(lobby)).toBe("eye");
	});

	it("다음 라운드 번호는 확정한 라운드 수 + 1", () => {
		const second = ok(startRound(ok(confirmRound(results)), 9, NOW));
		expect(second.phase.kind === "playing" && second.phase.round.no).toBe(2);
		expect(second.phase.kind === "playing" && second.phase.round.gameId).toBe("eye");
	});

	it("라운드를 취소하면 기록 없이 로비로 돌아가고 같은 게임을 다시 한다", () => {
		for (const state of [results, playing(["p1", "p2"])]) {
			const cancelled = ok(cancelRound(state));
			expect(cancelled.phase).toEqual({ kind: "lobby" });
			expect(cancelled.history).toEqual([]);
			expect(nextGame(cancelled)).toBe("balloon");
		}
	});

	it("결과 발표 중이 아니면 확정할 수 없다", () => {
		expect(confirmRound(lobbyWith(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
		expect(confirmRound(playing(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("최종 순위 발표", () => {
	it("한 라운드도 확정하지 않았으면 발표할 수 없다", () => {
		expect(finishGame(lobbyWith(["p1"]))).toEqual({ ok: false, reason: "nothing_played" });
	});

	it("로비에서 발표하면 끝난 상태가 되고, 계속하기로 로비에 돌아온다", () => {
		const finished = ok(finishGame(playRound(lobbyWith(["p1"]), { p1: 1 })));
		expect(finished.phase).toEqual({ kind: "finished" });
		expect(ok(reopenGame(finished)).phase).toEqual({ kind: "lobby" });
	});

	it("게임 중에는 발표할 수 없고, 끝난 상태가 아니면 계속하기도 없다", () => {
		expect(finishGame(playing(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
		expect(reopenGame(lobbyWith(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("처음부터 다시", () => {
	it("입장과 순서표는 그대로 두고 라운드 기록만 지운다", () => {
		const reset = resetGame(ok(finishGame(playRound(lobbyWith(["p1", "p2"]), { p1: 3, p2: 2 }))));
		expect(reset.phase).toEqual({ kind: "lobby" });
		expect(reset.history).toEqual([]);
		expect(reset.plan).toEqual(["balloon", "eye", "candy"]);
		expect(reset.players.map((player) => player.claimed)).toEqual([true, true, false, false, false]);
	});
});
