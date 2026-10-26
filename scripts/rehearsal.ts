/**
 * 리허설: 가상 참가자 30명이 실제 서버에 붙어 순서표대로 라운드를 돌고 최종 순위까지 확인한다.
 *   npm run rehearsal                      → http://localhost:8787 (진행자 키는 .dev.vars)
 *   npm run rehearsal -- --rounds=2        → 라운드 수를 줄여 빨리
 *   npm run rehearsal -- https://... --allow-remote   → 배포한 서버 (HOST_KEY 환경변수 필요)
 * 명단과 진행 상태를 덮어쓰기 때문에, localhost가 아니면 --allow-remote 없이는 실행하지 않는다.
 */
import { readFileSync } from "node:fs";
import { type GameState, nextGame, type Round } from "../src/domain/game";
import { GAMES, type GameId } from "../src/domain/games/catalog";
import { roundPoints, standings } from "../src/domain/standings";
import type { ClientMessage, ServerMessage } from "../src/protocol";

const PLAYER_COUNT = 30;
const FULL_PLAN: readonly GameId[] = ["balloon", "candy", "eye", "reaction", "balloon", "eye"];
const base = process.argv.find((arg) => arg.startsWith("http")) ?? "http://localhost:8787";
const wsBase = base.replace(/^http/, "ws");
const roundsArg = process.argv.find((arg) => arg.startsWith("--rounds="));
const PLAN = FULL_PLAN.slice(0, roundsArg === undefined ? FULL_PLAN.length : Math.max(2, Number(roundsArg.split("=")[1])));

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && !process.argv.includes("--allow-remote")) {
	console.error(`${base} 는 localhost가 아니에요. 진행 상태를 덮어쓰니 정말 하려면 --allow-remote 를 붙이세요.`);
	process.exit(2);
}

function hostKey(): string {
	if (process.env.HOST_KEY) return process.env.HOST_KEY;
	const line = readFileSync(".dev.vars", "utf8")
		.split("\n")
		.find((row) => row.startsWith("HOST_KEY="));
	if (line === undefined) throw new Error(".dev.vars 에 HOST_KEY 가 없어요");
	return line.slice("HOST_KEY=".length).trim();
}

type Bot = {
	readonly name: string;
	game: GameState | null;
	offsetMs: number;
	playerId: string | null;
	token: string | null;
	readonly rejections: string[];
	send(message: ClientMessage): void;
	until(check: () => boolean, label: string, timeoutMs?: number): Promise<void>;
	close(): void;
};

async function openBot(name: string, path: string): Promise<Bot> {
	const socket = new WebSocket(`${wsBase}${path}`);
	const waiters = new Set<() => void>();
	const bot: Bot = {
		name,
		game: null,
		offsetMs: 0,
		playerId: null,
		token: null,
		rejections: [],
		send: (message) => socket.send(JSON.stringify(message)),
		until(check, label, timeoutMs = 15_000) {
			if (check()) return Promise.resolve();
			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					waiters.delete(waiter);
					reject(new Error(`[${name}] 기다리다 시간 초과: ${label}`));
				}, timeoutMs);
				const waiter = () => {
					if (!check()) return;
					clearTimeout(timer);
					waiters.delete(waiter);
					resolve();
				};
				waiters.add(waiter);
			});
		},
		close: () => socket.close(),
	};
	socket.addEventListener("message", (event) => {
		if (typeof event.data !== "string" || event.data === "pong") return;
		const message = JSON.parse(event.data) as ServerMessage;
		if (message.type === "state") {
			bot.game = message.game;
			bot.offsetMs = message.serverNow - Date.now();
		} else if (message.type === "you") {
			bot.playerId = message.playerId;
			if (message.token !== null) bot.token = message.token;
		} else {
			bot.rejections.push(message.reason);
		}
		for (const waiter of [...waiters]) waiter();
	});
	await new Promise<void>((resolve, reject) => {
		socket.addEventListener("open", () => resolve(), { once: true });
		socket.addEventListener("error", () => reject(new Error(`[${name}] 연결 실패`)), { once: true });
	});
	return bot;
}

/** 열리지 않고 닫히면 거절된 것 */
function isRefused(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new WebSocket(`${wsBase}${path}`);
		socket.addEventListener("open", () => {
			socket.close();
			resolve(false);
		});
		socket.addEventListener("error", () => resolve(true));
	});
}

function check(condition: boolean, message: string): void {
	if (!condition) throw new Error(`확인 실패: ${message}`);
	console.log(`  ✓ ${message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** 같은 토큰으로 새로 붙는다(폰 화면이 꺼졌다 켜진 상황) */
async function reconnect(bot: Bot, bots: Bot[]): Promise<Bot> {
	const before = bot.playerId;
	bot.close();
	await sleep(300);
	const again = await openBot(bot.name, "/ws");
	again.token = bot.token;
	again.send({ type: "hello", token: bot.token });
	await again.until(() => again.playerId !== null && again.game !== null, "다시 붙기");
	if (again.playerId !== before) throw new Error(`${bot.name}: 다시 붙었는데 다른 사람으로 알아봤어요`);
	bots[bots.indexOf(bot)] = again;
	return again;
}

async function joinAll(host: Bot, names: readonly string[]): Promise<Bot[]> {
	const roster = host.game?.players.filter((player) => names.includes(player.name)) ?? [];
	const bots = await Promise.all(roster.map((player) => openBot(player.name, "/ws")));
	for (const bot of bots) bot.send({ type: "hello", token: null });
	await Promise.all(bots.map((bot) => bot.until(() => bot.game !== null, "참가자 첫 상태")));
	bots.forEach((bot, i) => bot.send({ type: "claim", playerId: roster[i]?.id ?? "" }));
	await Promise.all(bots.map((bot) => bot.until(() => bot.playerId !== null && bot.token !== null, "입장")));
	return bots;
}

/** 라운드 하나를 치른다. 끊겼다 붙는 사람, 기록을 안 내는 사람, 두 번 내는 사람을 섞는다. */
async function playRound(host: Bot, bots: Bot[], roundNo: number): Promise<Round> {
	host.send({ type: "startRound" });
	await host.until(() => host.game?.phase.kind === "playing" && host.game.phase.round.no === roundNo, "라운드 시작");
	const phase = host.game?.phase;
	if (phase?.kind !== "playing") throw new Error("라운드가 시작되지 않았어요");
	const { round } = phase;
	const info = GAMES[round.gameId];
	const playing = bots.filter((bot) => bot.playerId !== null && round.participantIds.includes(bot.playerId));
	const silent = roundNo === 1 ? playing[0] : undefined;
	const reconnecting = new Set(playing.slice(1, 4));
	const doubleSubmitter = roundNo === 2 ? playing[5] : undefined;

	await Promise.all(
		playing.map(async (bot) => {
			if (bot === silent) return;
			let current = bot;
			if (reconnecting.has(bot)) {
				await sleep(round.playAt - bot.offsetMs - Date.now() + randomInt(500, info.durationMs - 500));
				current = await reconnect(bot, bots);
			}
			await sleep(round.endAt - current.offsetMs - Date.now() + randomInt(0, 1500));
			current.send({ type: "submit", roundNo, score: randomInt(0, Math.floor(info.maxScore / 2)) });
			if (current === doubleSubmitter) {
				current.send({ type: "submit", roundNo, score: 1 });
				await current.until(() => current.rejections.includes("already_submitted"), "두 번째 기록 거절");
			}
		}),
	);
	const waitMs = round.deadlineAt - (Date.now() + host.offsetMs) + 5000;
	await host.until(() => host.game?.phase.kind === "results" && host.game.phase.round.no === roundNo, "결과", waitMs);
	const results = host.game?.phase;
	if (results?.kind !== "results") throw new Error("결과가 없어요");
	const expected = playing.length - (silent === undefined ? 0 : 1);
	check(Object.keys(results.round.scores).length === expected, `라운드 ${roundNo}: 기록 ${expected}/${playing.length} 도착(끊겼다 붙은 ${reconnecting.size}명 포함)`);
	if (silent?.playerId) check(roundPoints(results.round)[silent.playerId] === 0, "기록을 안 낸 사람은 마감 알람으로 라운드가 닫히고 0점");
	if (doubleSubmitter !== undefined) check(true, "같은 사람의 두 번째 기록은 거절된다");
	return results.round;
}

async function rehearse(): Promise<void> {
	const key = hostKey();
	console.log(`리허설 시작: ${base} (${PLAYER_COUNT}명, ${PLAN.length}라운드)`);

	check(await isRefused(`/ws?role=host&key=wrong-key`), "틀린 진행자 키로는 진행자 화면에 붙을 수 없다");

	const host = await openBot("진행자", `/ws?role=host&key=${encodeURIComponent(key)}`);
	host.send({ type: "hello", token: null });
	await host.until(() => host.game !== null, "첫 상태");
	if (host.game?.phase.kind === "playing" || host.game?.phase.kind === "results") host.send({ type: "cancelRound" });
	if (host.game?.phase.kind === "finished") host.send({ type: "reopenGame" });
	host.send({ type: "reset" });
	host.send({ type: "setRoster", names: [] });
	await host.until(() => host.game?.players.length === 0 && host.game.history.length === 0, "명단 비우기");
	const names = Array.from({ length: PLAYER_COUNT }, (_, i) => `참가자${String(i + 1).padStart(2, "0")}`);
	host.send({ type: "setRoster", names: names.slice(0, PLAYER_COUNT - 1) });
	await host.until(() => host.game?.players.length === PLAYER_COUNT - 1, "명단");
	host.send({ type: "setPlan", gameIds: PLAN });
	await host.until(() => host.game?.plan.length === PLAN.length, "순서표");
	check(true, `순서표 ${PLAN.length}라운드: ${PLAN.map((id) => GAMES[id].title).join(" → ")}`);

	const bots = await joinAll(host, names.slice(0, PLAYER_COUNT - 1));
	await host.until(() => host.game?.players.every((player) => player.claimed) === true, "전원 입장");
	check(true, `${bots.length}명 모두 자기 이름으로 입장했다`);

	const intruder = await openBot("가로채기", "/ws");
	intruder.send({ type: "hello", token: null });
	intruder.send({ type: "claim", playerId: host.game?.players[0]?.id ?? "" });
	await intruder.until(() => intruder.rejections.includes("already_claimed"), "가로채기 거절");
	check(true, "이미 입장한 이름은 다른 폰이 고를 수 없다");
	intruder.send({ type: "setPlan", gameIds: ["eye"] });
	await intruder.until(() => intruder.rejections.includes("not_host"), "진행자 흉내 거절");
	check(true, "참가자 폰은 순서표 같은 진행자 명령을 보낼 수 없다");
	intruder.close();

	let roundNo = 0;
	let cancelled = false;
	while (host.game !== null && nextGame(host.game) !== null) {
		roundNo += 1;
		// 두 번째 라운드 뒤에 늦게 온 사람이 들어온다
		if (roundNo === 3) {
			host.send({ type: "setRoster", names });
			await host.until(() => host.game?.players.length === PLAYER_COUNT, "늦은 사람 명단 추가");
			bots.push(...(await joinAll(host, names.slice(PLAYER_COUNT - 1))));
			check(true, "라운드 사이에 늦게 온 사람을 명단에 넣고 입장시킬 수 있다");
		}
		// 네 번째 라운드는 한 번 취소하고 같은 게임을 다시 한다
		if (roundNo === 4 && !cancelled) {
			cancelled = true;
			const gameId = nextGame(host.game);
			host.send({ type: "startRound" });
			await host.until(() => host.game?.phase.kind === "playing", "취소할 라운드 시작");
			host.send({ type: "cancelRound" });
			await host.until(() => host.game?.phase.kind === "lobby", "라운드 취소");
			check(host.game !== null && nextGame(host.game) === gameId && host.game.history.length === 3, "라운드를 취소하면 기록 없이 같은 게임이 다시 다음 차례");
		}
		const round = await playRound(host, bots, roundNo);
		host.send({ type: "confirmRound" });
		await host.until(() => host.game?.history.length === roundNo, "결과 확정");
		const table = host.game === null ? [] : standings(host.game.players, host.game.history);
		const leader = host.game?.players.find((player) => player.id === table[0]?.playerId)?.name ?? "?";
		console.log(`라운드 ${roundNo} ${GAMES[round.gameId].title}: 참가 ${round.participantIds.length}명 · 선두 ${leader} ${table[0]?.total ?? 0}점`);
	}

	host.send({ type: "finishGame" });
	await host.until(() => host.game?.phase.kind === "finished", "최종 발표");
	const game = host.game;
	if (game === null) throw new Error("상태가 없어요");
	const table = standings(game.players, game.history);
	check(table.length === PLAYER_COUNT, `최종 순위에 ${PLAYER_COUNT}명이 모두 나온다`);
	check(
		table.every((row) => row.total === row.perRound.reduce<number>((sum, points) => sum + (points ?? 0), 0)),
		"모든 사람의 합계가 라운드 점수의 합과 같다",
	);
	check(
		table.every((row, i) => i === 0 || (table[i - 1]?.total ?? 0) >= row.total),
		"최종 순위는 합계가 높은 순이다",
	);
	const late = table.find((row) => game.players.find((player) => player.id === row.playerId)?.name === names[PLAYER_COUNT - 1]);
	check(late?.perRound[0] === null && late.perRound[1] === null, "늦게 온 사람은 들어오기 전 라운드가 비어 있다(0점)");
	const top = table.slice(0, 3).map((row) => `${row.rank}위 ${game.players.find((player) => player.id === row.playerId)?.name} ${row.total}점`);
	console.log(`🏆 ${top.join(" · ")}`);

	host.send({ type: "reopenGame" });
	await host.until(() => host.game?.phase.kind === "lobby", "계속하기");
	host.send({ type: "reset" });
	await host.until(() => host.game?.history.length === 0, "처음부터");
	check(host.game?.plan.length === PLAN.length && host.game.players.every((player) => player.claimed), "처음부터 하면 기록만 지우고 입장·순서표는 남긴다");

	const leaving = bots[0];
	const leavingId = leaving?.playerId;
	if (leaving !== undefined && leavingId != null) {
		host.send({ type: "release", playerId: leavingId });
		await leaving.until(() => leaving.playerId === null, "입장 풀기");
		check(true, "진행자가 입장을 풀면 그 폰은 이름 고르기 화면으로 돌아간다");
	}
	for (const bot of bots) bot.close();
	host.close();
}

rehearse().then(
	() => {
		console.log("리허설 성공");
		process.exit(0);
	},
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	},
);
