import { describe, expect, it } from "vitest";
import {
	cancelRound,
	champion,
	chosenByes,
	claim,
	closeRound,
	confirmRound,
	currentMatch,
	drawTournament,
	EMPTY_GAME,
	type GameState,
	lockedPlanLength,
	nextGame,
	openIntro,
	release,
	resetGame,
	setByes,
	setMode,
	setPlan,
	setRoster,
	startRound,
	submitScore,
	type Transition,
} from "../src/domain/game";
import type { GameId } from "../src/domain/games/catalog";
import type { PlayerId } from "../src/domain/player";

function ok(transition: Transition): GameState {
	if (!transition.ok) throw new Error(`거절됨: ${transition.reason}`);
	return transition.state;
}

function idMaker(): () => string {
	let next = 0;
	return () => `p${++next}`;
}

/** 섞지 않는 난수. 명단 순서대로 시드를 받아 대진을 눈으로 따라갈 수 있다. */
const inOrder = () => 0.999999;

const NOW = 1_000_000;

/** names 를 모두 입장시키고 토너먼트 방식으로 둔 로비 */
function tournamentLobby(names: readonly string[], plan: readonly GameId[] = ["balloon"]): GameState {
	const roster = ok(setRoster(EMPTY_GAME, names, idMaker()));
	const joined = roster.players.reduce((state, player) => ok(claim(state, player.id)), roster);
	return ok(setMode(ok(setPlan(joined, plan)), "tournament"));
}

/** 대진까지 짠 상태 */
function drawn(names: readonly string[], plan?: readonly GameId[]): GameState {
	return ok(drawTournament(tournamentLobby(names, plan), inOrder));
}

/** 다음 경기를 시작해 두 사람의 점수를 넣고 결과 화면까지 간 상태 */
function playMatch(state: GameState, scoreOf: (ids: readonly PlayerId[]) => Readonly<Record<PlayerId, number>>): GameState {
	const playing = ok(startRound(state, 7, NOW));
	if (playing.phase.kind !== "playing") throw new Error("게임 중이 아니에요");
	const { round } = playing.phase;
	const key = { no: round.no, playAt: round.playAt };
	const scores = scoreOf(round.participantIds);
	const filled = Object.entries(scores).reduce((current, [id, score]) => ok(submitScore(current, id, key, score, NOW)), playing);
	return ok(closeRound(filled));
}

/** 참가자 중 앞사람이 이기게 점수를 준다 */
const firstWins = (ids: readonly PlayerId[]): Readonly<Record<PlayerId, number>> =>
	Object.fromEntries(ids.map((id, index) => [id, index === 0 ? 20 : 5]));

describe("진행 방식 고르기", () => {
	it("라운드를 하기 전에만 바꿀 수 있고, 바꾸면 대진을 지운다", () => {
		const lobby = tournamentLobby(["가", "나", "다"]);
		expect(lobby.mode).toBe("tournament");
		const withBracket = ok(drawTournament(lobby, inOrder));
		expect(withBracket.bracket).not.toBeNull();
		expect(ok(setMode(withBracket, "points")).bracket).toBeNull();

		const played = ok(confirmRound(playMatch(withBracket, firstWins)));
		expect(setMode(played, "points")).toEqual({ ok: false, reason: "already_started" });
	});

	it("같은 방식을 다시 골라도 아무 일도 없다", () => {
		const played = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		expect(ok(setMode(played, "tournament"))).toBe(played);
	});

	it("점수전은 예전처럼 입장한 사람 모두가 뛴다", () => {
		const roster = ok(setRoster(EMPTY_GAME, ["가", "나", "다"], idMaker()));
		const joined = roster.players.reduce((state, player) => ok(claim(state, player.id)), roster);
		const playing = ok(startRound(ok(setPlan(joined, ["balloon"])), 7, NOW));
		expect(playing.phase.kind === "playing" && playing.phase.round.participantIds).toEqual(["p1", "p2", "p3"]);
	});
});

describe("대진 짜기", () => {
	it("토너먼트에서 두 명 이상 입장해야 짤 수 있다", () => {
		expect(drawTournament(tournamentLobby(["가"]), inOrder)).toEqual({ ok: false, reason: "not_enough_players" });
		expect(drawn(["가", "나"]).bracket?.slots).toEqual(["p1", "p2"]);
	});

	it("점수전에서는 짤 수 없다", () => {
		const roster = ok(setRoster(EMPTY_GAME, ["가", "나"], idMaker()));
		const joined = roster.players.reduce((state, player) => ok(claim(state, player.id)), roster);
		expect(drawTournament(joined, inOrder)).toEqual({ ok: false, reason: "wrong_mode" });
	});

	it("입장하지 않은 사람은 대진에 들어가지 않는다", () => {
		const lobby = tournamentLobby(["가", "나", "다"]);
		const withoutThird = ok(release(lobby, "p3"));
		expect(ok(drawTournament(withoutThird, inOrder)).bracket?.slots).toEqual(["p1", "p2"]);
	});

	it("경기를 치른 뒤에는 다시 짤 수 없다", () => {
		const played = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		expect(drawTournament(played, inOrder)).toEqual({ ok: false, reason: "already_started" });
	});
});

describe("경기 진행", () => {
	it("대진을 짜기 전에는 시작할 수 없다", () => {
		const lobby = tournamentLobby(["가", "나"]);
		expect(openIntro(lobby)).toEqual({ ok: false, reason: "no_next_match" });
		expect(startRound(lobby, 7, NOW)).toEqual({ ok: false, reason: "no_next_match" });
	});

	it("다음 경기의 두 사람만 뛴다(부전승은 건너뛴다)", () => {
		// 3명이면 1회전은 p1 부전승, p2 대 p3 한 경기
		const state = drawn(["가", "나", "다"]);
		expect(state.bracket?.slots).toEqual(["p1", null, "p2", "p3"]);
		expect(currentMatch(state)).toMatchObject({ aId: "p2", bId: "p3" });
		const playing = ok(startRound(state, 7, NOW));
		expect(playing.phase.kind === "playing" && playing.phase.round.participantIds).toEqual(["p2", "p3"]);
	});

	it("동점이면 확정할 수 없고 재경기해야 한다", () => {
		const results = playMatch(drawn(["가", "나", "다"]), (ids) => Object.fromEntries(ids.map((id) => [id, 7])));
		expect(confirmRound(results)).toEqual({ ok: false, reason: "tie_match" });
		// 재경기는 라운드 취소와 같다: 기록에 남지 않고 같은 두 사람이 다시 붙는다
		const again = ok(cancelRound(results));
		expect(again.history).toHaveLength(0);
		expect(currentMatch(again)).toMatchObject({ aId: "p2", bId: "p3" });
	});

	it("한쪽만 기록을 내면 낸 쪽이 올라간다", () => {
		const results = playMatch(drawn(["가", "나", "다"]), (ids) => ({ [ids[1] ?? ""]: 3 }));
		const next = ok(confirmRound(results));
		expect(currentMatch(next)).toMatchObject({ aId: "p1", bId: "p3" });
	});

	it("결승을 확정하면 바로 최종 발표로 넘어간다", () => {
		// 3명: (p2 대 p3) → (p1 대 승자) 두 경기
		let state = drawn(["가", "나", "다"]);
		state = ok(confirmRound(playMatch(state, firstWins)));
		expect(state.phase.kind).toBe("lobby");
		expect(champion(state)).toBeNull();

		state = ok(confirmRound(playMatch(state, firstWins)));
		expect(state.phase.kind).toBe("finished");
		expect(champion(state)).toBe("p1");
		expect(state.history).toHaveLength(2);
		expect(currentMatch(state)).toBeNull();
	});

	it("5명이면 부전승 세 번과 네 경기로 우승자가 나온다", () => {
		let state = drawn(["가", "나", "다", "라", "마"]);
		const order: string[] = [];
		for (let guard = 0; guard < 10 && currentMatch(state) !== null; guard++) {
			const match = currentMatch(state);
			order.push(`${match?.aId}-${match?.bId}`);
			state = ok(confirmRound(playMatch(state, firstWins)));
		}
		expect(order).toEqual(["p4-p5", "p1-p4", "p2-p3", "p1-p2"]);
		expect(state.phase.kind).toBe("finished");
		expect(champion(state)).toBe("p1");
	});
});

describe("부전승 지정", () => {
	it("토너먼트에서 첫 경기를 치르기 전까지만 바꿀 수 있다", () => {
		const lobby = tournamentLobby(["가", "나", "다"]);
		expect(ok(setByes(lobby, ["p1"])).byeIds).toEqual(["p1"]);
		// 대진을 짠 뒤에도 첫 경기 전이면 바꿀 수 있다('대진 다시 짜기'로 반영)
		expect(ok(setByes(drawn(["가", "나", "다"]), ["p1"])).byeIds).toEqual(["p1"]);

		const points = ok(setMode(lobby, "points"));
		expect(setByes(points, ["p1"])).toEqual({ ok: false, reason: "wrong_mode" });
		const played = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		expect(setByes(played, ["p1"])).toEqual({ ok: false, reason: "already_started" });
	});

	it("명단에 없는 id는 버리고 같은 사람은 한 번만 남긴다", () => {
		expect(ok(setByes(tournamentLobby(["가", "나"]), ["p2", "없는 사람", "p2"])).byeIds).toEqual(["p2"]);
	});

	it("정해 둔 사람이 부전승 자리에 들어간다", () => {
		// 3명이면 부전승 한 자리. 섞지 않으면 p1이 받을 자리를 정해 둔 p3이 받는다.
		const state = ok(drawTournament(ok(setByes(tournamentLobby(["가", "나", "다"]), ["p3"])), inOrder));
		expect(state.bracket?.slots).toEqual(["p3", null, "p1", "p2"]);
		expect(currentMatch(state)).toMatchObject({ aId: "p1", bId: "p2" });
	});

	it("부전승 자리보다 많이 정하면 대진을 짤 수 없다", () => {
		const lobby = ok(setByes(tournamentLobby(["가", "나", "다"]), ["p1", "p2"]));
		expect(drawTournament(lobby, inOrder)).toEqual({ ok: false, reason: "too_many_byes" });
	});

	it("입장하지 않은 사람은 정해 둬도 세지 않고 대진에도 넣지 않는다", () => {
		// 6명 명단에서 5명만 입장: 부전승 세 자리. 정해 둔 셋 중 p6은 입장하지 않았다.
		const roster = ok(setRoster(EMPTY_GAME, ["가", "나", "다", "라", "마", "바"], idMaker()));
		const joined = ["p1", "p2", "p3", "p4", "p5"].reduce((state, id) => ok(claim(state, id)), roster);
		const lobby = ok(setByes(ok(setMode(ok(setPlan(joined, ["balloon"])), "tournament")), ["p1", "p2", "p6"]));
		expect(chosenByes(lobby)).toEqual(["p1", "p2"]);
		const slots = ok(drawTournament(lobby, inOrder)).bracket?.slots ?? [];
		expect(slots).not.toContain("p6");
		// 앞번호 시드 1·2·3이 빈자리와 붙는다: 정해 둔 p1·p2와 나머지 중 하나
		expect(slots.filter((id, index) => id !== null && slots[index ^ 1] === null)).toEqual(expect.arrayContaining(["p1", "p2"]));
	});

	it("명단에서 빠지면 지정도 풀리고, 처음부터 다시 해도 지정은 남는다", () => {
		const lobby = ok(setByes(tournamentLobby(["가", "나", "다"]), ["p2", "p3"]));
		expect(ok(setRoster(lobby, ["가", "나"], idMaker())).byeIds).toEqual(["p2"]);

		const played = ok(confirmRound(playMatch(ok(drawTournament(ok(setByes(tournamentLobby(["가", "나", "다"]), ["p3"])), inOrder)), firstWins)));
		expect(resetGame(played).byeIds).toEqual(["p3"]);
	});
});

describe("순서표", () => {
	it("경기 수가 순서표보다 많으면 순서표를 처음부터 돌려 쓴다", () => {
		let state = drawn(["가", "나", "다"], ["balloon", "eye"]);
		expect(nextGame(state)).toBe("balloon");
		state = ok(confirmRound(playMatch(state, firstWins)));
		expect(nextGame(state)).toBe("eye");
		state = ok(confirmRound(playMatch(state, firstWins)));
		// 두 경기로 끝났지만 돌려 쓰기는 기록 수로 정해진다
		expect(nextGame({ ...state, phase: { kind: "lobby" } })).toBe("balloon");
	});

	it("순서표가 비면 시작할 수 없다", () => {
		const state = drawn(["가", "나"], []);
		expect(nextGame(state)).toBeNull();
		expect(startRound(state, 7, NOW)).toEqual({ ok: false, reason: "no_next_game" });
	});

	it("돌려 쓰기 때문에 잠기는 앞부분이 없다", () => {
		const state = ok(confirmRound(playMatch(drawn(["가", "나", "다"], ["balloon", "eye"]), firstWins)));
		expect(lockedPlanLength(state)).toBe(0);
		expect(ok(setPlan(state, ["candy"])).plan).toEqual(["candy"]);
	});
});

describe("명단·처음부터", () => {
	it("대진에 있는 사람을 명단에서 빼면 대진과 경기 기록을 지운다", () => {
		const state = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		const shrunk = ok(setRoster(state, ["가", "나"], idMaker()));
		expect(shrunk.bracket).toBeNull();
		expect(shrunk.history).toHaveLength(0);
	});

	it("대진에 없는 이름만 바뀌면 대진은 그대로 둔다", () => {
		const state = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		const grown = ok(setRoster(state, ["가", "나", "다", "라"], idMaker()));
		expect(grown.bracket).toEqual(state.bracket);
		expect(grown.history).toHaveLength(1);
	});

	it("처음부터 다시 하면 대진도 지운다", () => {
		const state = ok(confirmRound(playMatch(drawn(["가", "나", "다"]), firstWins)));
		const fresh = resetGame(state);
		expect(fresh.bracket).toBeNull();
		expect(fresh.history).toHaveLength(0);
		expect(fresh.mode).toBe("tournament");
		expect(fresh.players.filter((player) => player.claimed)).toHaveLength(3);
	});
});
