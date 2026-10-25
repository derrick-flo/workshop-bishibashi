import { describe, expect, it } from "vitest";
import {
	cancelRound,
	claim,
	closeRound,
	confirmCut,
	EMPTY_GAME,
	type GameState,
	isRoundComplete,
	nextParticipants,
	prepareRound,
	release,
	resetGame,
	setRoster,
	setStatus,
	startRound,
	submitScore,
	suggestCutCount,
	toggleCut,
	type Transition,
} from "../src/domain/game";

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

/** p1~p5 명단에서 claimedIds만 입장한 상태 */
function lobbyWith(claimedIds: readonly string[]): GameState {
	return claimedIds.reduce((state, id) => ok(claim(state, id)), roster(["가", "나", "다", "라", "마"]));
}

const NOW = 1_000_000;

function playing(claimedIds: readonly string[], cutCount: number): GameState {
	return ok(startRound(ok(prepareRound(lobbyWith(claimedIds), "balloon", cutCount)), 7, NOW));
}

function submitAll(state: GameState, scores: Readonly<Record<string, number>>): GameState {
	return Object.entries(scores).reduce((acc, [id, score]) => ok(submitScore(acc, id, 1, score, NOW + 16_500)), state);
}

function statuses(state: GameState): Readonly<Record<string, string>> {
	return Object.fromEntries(state.players.map((player) => [player.id, player.status]));
}

describe("명단", () => {
	it("이름 앞뒤 공백, 빈 줄, 중복을 정리해 명단을 만든다", () => {
		expect(roster([" 김철수 ", "", "이영희", "김철수"]).players).toEqual([
			{ id: "p1", name: "김철수", claimed: false, status: "lobby" },
			{ id: "p2", name: "이영희", claimed: false, status: "lobby" },
		]);
	});

	it("명단을 고쳐도 남은 이름은 입장 상태를 그대로 둔다", () => {
		const newId = idMaker();
		const first = ok(claim(ok(setRoster(EMPTY_GAME, ["김철수", "이영희"], newId)), "p1"));
		expect(ok(setRoster(first, ["이영희", "김철수", "박민수"], newId)).players).toEqual([
			{ id: "p2", name: "이영희", claimed: false, status: "lobby" },
			{ id: "p1", name: "김철수", claimed: true, status: "lobby" },
			{ id: "p3", name: "박민수", claimed: false, status: "lobby" },
		]);
	});

	it("첫 라운드 탈락을 확정한 뒤에는 명단을 바꿀 수 없다", () => {
		const afterRound = ok(confirmCut(ok(closeRound(submitAll(playing(["p1", "p2"], 1), { p1: 10, p2: 20 })))));
		const revived = ok(setStatus(afterRound, "p1", "alive"));
		expect(setRoster(revived, ["새사람"], idMaker())).toEqual({ ok: false, reason: "roster_locked" });
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

describe("라운드 시작", () => {
	it("다음 게임을 고르지 않으면 시작할 수 없다", () => {
		expect(startRound(lobbyWith(["p1", "p2"]), 7, NOW)).toEqual({ ok: false, reason: "no_upcoming" });
	});

	it("첫 라운드는 입장한 사람만 참가하고, 시작·종료·마감 시각을 정한다", () => {
		const state = playing(["p1", "p2", "p3", "p4"], 1);
		expect(state.phase).toEqual({
			kind: "playing",
			round: {
				no: 1,
				gameId: "balloon",
				seed: 7,
				playAt: 1_004_000,
				endAt: 1_016_000,
				deadlineAt: 1_020_000,
				cutCount: 1,
				participantIds: ["p1", "p2", "p3", "p4"],
				scores: {},
			},
		});
		expect(statuses(state)).toEqual({ p1: "alive", p2: "alive", p3: "alive", p4: "alive", p5: "lobby" });
		expect(state.upcoming).toBeNull();
	});

	it("입장한 사람이 없으면 시작할 수 없다", () => {
		const state = ok(prepareRound(lobbyWith([]), "balloon", 0));
		expect(startRound(state, 7, NOW)).toEqual({ ok: false, reason: "not_enough_players" });
	});

	it("혼자서도 시작할 수 있다(테스트용, 탈락 0명)", () => {
		const state = ok(startRound(ok(prepareRound(lobbyWith(["p1"]), "balloon", 0)), 7, NOW));
		expect(state.phase.kind === "playing" && state.phase.round.participantIds).toEqual(["p1"]);
	});

	it("탈락 인원은 0 이상이고 참가자 수보다 적어야 한다", () => {
		const lobby = lobbyWith(["p1", "p2", "p3", "p4"]);
		expect(prepareRound(lobby, "balloon", -1)).toEqual({ ok: false, reason: "invalid_cut" });
		expect(startRound(ok(prepareRound(lobby, "balloon", 4)), 7, NOW)).toEqual({ ok: false, reason: "invalid_cut" });
	});

	it("게임 중에는 다음 게임을 고를 수 없다", () => {
		expect(prepareRound(playing(["p1", "p2"], 1), "eye", 1)).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("기록 제출", () => {
	const round = playing(["p1", "p2", "p3", "p4"], 1);

	it("참가자가 마감 전에 낸 기록을 받는다", () => {
		const state = ok(submitScore(round, "p1", 1, 1500, 1_016_500));
		expect(state.phase.kind === "playing" && state.phase.round.scores).toEqual({ p1: 1500 });
	});

	it("같은 사람의 두 번째 기록은 받지 않는다", () => {
		const state = ok(submitScore(round, "p1", 1, 1500, 1_016_500));
		expect(submitScore(state, "p1", 1, 2000, 1_016_600)).toEqual({ ok: false, reason: "already_submitted" });
	});

	it("마감이 지나면 받지 않는다", () => {
		expect(submitScore(round, "p1", 1, 1500, 1_020_001)).toEqual({ ok: false, reason: "too_late" });
	});

	it("참가자가 아니거나 다른 라운드 기록이면 받지 않는다", () => {
		expect(submitScore(round, "p5", 1, 1500, 1_016_500)).toEqual({ ok: false, reason: "not_participant" });
		expect(submitScore(round, "p1", 2, 1500, 1_016_500)).toEqual({ ok: false, reason: "wrong_round" });
	});

	it("음수, 소수, 게임 최대치를 넘는 점수는 받지 않는다", () => {
		for (const score of [-1, 1.5, 2201, Number.NaN]) {
			expect(submitScore(round, "p1", 1, score, 1_016_500)).toEqual({ ok: false, reason: "invalid_score" });
		}
	});

	it("참가자가 모두 내야 라운드가 다 찼다고 본다", () => {
		const three = submitAll(round, { p1: 1, p2: 2, p3: 3 });
		const four = submitAll(three, { p4: 4 });
		expect(three.phase.kind === "playing" && isRoundComplete(three.phase.round)).toBe(false);
		expect(four.phase.kind === "playing" && isRoundComplete(four.phase.round)).toBe(true);
	});
});

describe("결과와 탈락", () => {
	const results = ok(closeRound(submitAll(playing(["p1", "p2", "p3", "p4"], 1), { p1: 2000, p2: 1500, p3: 900, p4: 40 })));

	it("라운드를 닫으면 점수가 가장 낮은 사람이 탈락 예정이 된다", () => {
		expect(results.phase.kind === "results" && results.phase.cutIds).toEqual(["p4"]);
	});

	it("진행자는 탈락 예정자를 살렸다가 다시 탈락 예정으로 돌릴 수 있다", () => {
		const spared = ok(toggleCut(results, "p4"));
		expect(spared.phase.kind === "results" && spared.phase.cutIds).toEqual([]);
		const cutAgain = ok(toggleCut(spared, "p4"));
		expect(cutAgain.phase.kind === "results" && cutAgain.phase.cutIds).toEqual(["p4"]);
		expect(toggleCut(results, "p5")).toEqual({ ok: false, reason: "not_participant" });
	});

	it("탈락을 확정하면 생존자만 다음 라운드에 나간다", () => {
		const lobby = ok(confirmCut(results));
		expect(lobby.phase).toEqual({ kind: "lobby" });
		expect(lobby.roundsPlayed).toBe(1);
		expect(statuses(lobby)).toEqual({ p1: "alive", p2: "alive", p3: "alive", p4: "out", p5: "lobby" });
		expect(nextParticipants(lobby).map((player) => player.id)).toEqual(["p1", "p2", "p3"]);
	});

	it("첫 라운드 뒤에 들어온 사람은 진행자가 살려야 참가한다", () => {
		const lateJoin = ok(claim(ok(confirmCut(results)), "p5"));
		expect(nextParticipants(lateJoin).map((player) => player.id)).toEqual(["p1", "p2", "p3"]);
		const revived = ok(setStatus(lateJoin, "p5", "alive"));
		expect(nextParticipants(revived).map((player) => player.id)).toEqual(["p1", "p2", "p3", "p5"]);
	});

	it("한 명만 남으면 우승이 정해진다", () => {
		const final = ok(closeRound(submitAll(playing(["p1", "p2"], 1), { p1: 10, p2: 5 })));
		expect(ok(confirmCut(final)).phase).toEqual({ kind: "finished", winnerIds: ["p1"] });
	});

	it("아무도 탈락하지 않은 라운드 뒤에는 혼자 남아도 게임이 끝나지 않는다", () => {
		const solo = ok(confirmCut(ok(closeRound(submitAll(playing(["p1"], 0), { p1: 1500 })))));
		expect(solo.phase).toEqual({ kind: "lobby" });
		expect(solo.roundsPlayed).toBe(1);
		const again = ok(startRound(ok(prepareRound(solo, "eye", 0)), 9, NOW));
		expect(again.phase.kind === "playing" && again.phase.round.no).toBe(2);
	});

	it("우승이 정해진 뒤 탈락자를 살리면 다시 로비로 돌아간다", () => {
		const finished = ok(confirmCut(ok(closeRound(submitAll(playing(["p1", "p2"], 1), { p1: 10, p2: 5 })))));
		expect(ok(setStatus(finished, "p2", "alive")).phase).toEqual({ kind: "lobby" });
	});

	it("라운드를 취소하면 아무도 탈락하지 않고 로비로 돌아간다", () => {
		const cancelled = ok(cancelRound(results));
		expect(cancelled.phase).toEqual({ kind: "lobby" });
		expect(cancelled.roundsPlayed).toBe(0);
		expect(statuses(cancelled)).toEqual({ p1: "alive", p2: "alive", p3: "alive", p4: "alive", p5: "lobby" });
	});

	it("결과 화면이 아니면 탈락을 확정할 수 없다", () => {
		expect(confirmCut(lobbyWith(["p1"]))).toEqual({ ok: false, reason: "wrong_phase" });
	});
});

describe("추천 탈락 인원", () => {
	it("최소 1명은 남기고, 3명 이하면 한 명만 남긴다", () => {
		for (let n = 2; n <= 40; n++) {
			const cut = suggestCutCount(n);
			expect(cut).toBeGreaterThanOrEqual(1);
			expect(cut).toBeLessThanOrEqual(n - 1);
		}
		expect(suggestCutCount(3)).toBe(2);
		expect(suggestCutCount(2)).toBe(1);
	});

	it("28명이면 8라운드 안에 우승자가 나온다", () => {
		let alive = 28;
		let rounds = 0;
		while (alive > 1) {
			alive -= suggestCutCount(alive);
			rounds++;
		}
		expect(rounds).toBeLessThanOrEqual(8);
	});
});

describe("처음부터 다시", () => {
	it("입장은 그대로 두고 상태와 라운드만 처음으로 돌린다", () => {
		const reset = resetGame(ok(confirmCut(ok(closeRound(submitAll(playing(["p1", "p2", "p3"], 1), { p1: 3, p2: 2, p3: 1 }))))));
		expect(reset.phase).toEqual({ kind: "lobby" });
		expect(reset.roundsPlayed).toBe(0);
		expect(reset.players.map((player) => [player.status, player.claimed])).toEqual([
			["lobby", true],
			["lobby", true],
			["lobby", true],
			["lobby", false],
			["lobby", false],
		]);
	});
});
