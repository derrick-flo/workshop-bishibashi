/**
 * 리허설: 가상 참가자 28명이 실제 서버에 붙어 우승자가 나올 때까지 한 판을 진행한다.
 *   npm run rehearsal                      → http://localhost:8787 (진행자 키는 .dev.vars)
 *   npm run rehearsal -- https://... --allow-remote   → 배포한 서버 (HOST_KEY 환경변수 필요)
 * 명단과 진행 상태를 덮어쓰기 때문에, localhost가 아니면 --allow-remote 없이는 실행하지 않는다.
 */
import { readFileSync } from "node:fs";
import { type GameState, nextParticipants, suggestCutCount } from "../src/domain/game";
import { GAME_IDS, GAMES } from "../src/domain/games/catalog";
import type { ClientMessage, ServerMessage } from "../src/protocol";

const PLAYER_COUNT = 28;
const base = process.argv.find((arg) => arg.startsWith("http")) ?? "http://localhost:8787";
const wsBase = base.replace(/^http/, "ws");

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

async function rehearse(): Promise<void> {
	const key = hostKey();
	console.log(`리허설 시작: ${base}`);

	check(await isRefused(`/ws?role=host&key=wrong-key`), "틀린 진행자 키로는 진행자 화면에 붙을 수 없다");

	const host = await openBot("진행자", `/ws?role=host&key=${encodeURIComponent(key)}`);
	host.send({ type: "hello", token: null });
	await host.until(() => host.game !== null, "첫 상태");
	host.send({ type: "reset" });
	host.send({ type: "setRoster", names: [] });
	await host.until(() => host.game?.players.length === 0, "명단 비우기");
	const names = Array.from({ length: PLAYER_COUNT }, (_, i) => `참가자${String(i + 1).padStart(2, "0")}`);
	host.send({ type: "setRoster", names });
	await host.until(() => host.game?.players.length === PLAYER_COUNT, "명단 28명");

	const roster = host.game?.players ?? [];
	const bots = await Promise.all(roster.map((player) => openBot(player.name, "/ws")));
	for (const bot of bots) bot.send({ type: "hello", token: null });
	await Promise.all(bots.map((bot) => bot.until(() => bot.game !== null, "참가자 첫 상태")));
	bots.forEach((bot, i) => bot.send({ type: "claim", playerId: roster[i]?.id ?? "" }));
	await Promise.all(bots.map((bot) => bot.until(() => bot.playerId !== null && bot.token !== null, "입장")));
	await host.until(() => host.game?.players.every((player) => player.claimed) === true, "전원 입장");
	check(true, `${PLAYER_COUNT}명 모두 자기 이름으로 입장했다`);

	const intruder = await openBot("가로채기", "/ws");
	intruder.send({ type: "hello", token: null });
	intruder.send({ type: "claim", playerId: roster[0]?.id ?? "" });
	await intruder.until(() => intruder.rejections.includes("already_claimed"), "가로채기 거절");
	check(true, "이미 입장한 이름은 다른 폰이 고를 수 없다");
	intruder.send({ type: "startRound" });
	await intruder.until(() => intruder.rejections.includes("not_host"), "진행자 흉내 거절");
	check(true, "참가자 폰은 진행자 명령을 보낼 수 없다");
	intruder.close();

	let roundNo = 0;
	while (host.game?.phase.kind === "lobby") {
		roundNo += 1;
		const game: GameState = host.game;
		const participants = nextParticipants(game);
		const gameId = GAME_IDS[(roundNo - 1) % GAME_IDS.length] ?? "balloon";
		const info = GAMES[gameId];
		const cut = suggestCutCount(participants.length);
		host.send({ type: "prepareRound", gameId, cutCount: cut });
		await host.until(() => host.game?.upcoming?.gameId === gameId && host.game.upcoming.cutCount === cut, "다음 게임 고르기");
		host.send({ type: "startRound" });
		await host.until(() => host.game?.phase.kind === "playing" && host.game.phase.round.no === roundNo, "라운드 시작");
		const phase = host.game?.phase;
		if (phase?.kind !== "playing") throw new Error("라운드가 시작되지 않았어요");
		const { round } = phase;

		const playing = bots.filter((bot) => bot.playerId !== null && round.participantIds.includes(bot.playerId));
		// 1라운드: 한 명은 기록을 안 낸다(마감 알람으로 라운드가 닫혀야 한다). 2라운드: 한 명이 게임 중에 끊겼다 다시 붙는다.
		const silent = roundNo === 1 ? playing[0] : undefined;
		const reconnecting = roundNo === 2 ? playing[1] : undefined;
		const doubleSubmitter = roundNo === 3 ? playing[2] : undefined;

		await Promise.all(
			playing.map(async (bot) => {
				if (bot === silent) return;
				const localEnd = round.endAt - bot.offsetMs;
				let current = bot;
				if (bot === reconnecting) {
					await sleep(round.playAt - bot.offsetMs - Date.now() + 2000);
					current = await reconnect(bot, bots);
				}
				await sleep(localEnd - Date.now() + randomInt(0, 1500));
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
		const submitted = Object.keys(results.round.scores).length;
		check(results.cutIds.length <= cut, `라운드 ${roundNo} 탈락 예정 ${results.cutIds.length}명 (정한 인원 ${cut}명 이하)`);
		if (silent?.playerId) check(results.cutIds.includes(silent.playerId), "기록을 안 낸 사람은 마감 알람으로 라운드가 닫힌 뒤 탈락 예정이 된다");
		if (reconnecting?.playerId) {
			check(results.round.scores[reconnecting.playerId] !== undefined, "게임 중에 끊겼다 다시 붙은 사람의 기록도 들어간다");
		}
		if (doubleSubmitter !== undefined) check(true, "같은 사람의 두 번째 기록은 거절된다");

		host.send({ type: "confirmCut" });
		await host.until(() => host.game?.roundsPlayed === roundNo, "탈락 확정");
		const alive = host.game?.players.filter((player) => player.status === "alive").length ?? 0;
		console.log(`라운드 ${roundNo} ${info.emoji} ${info.title}: ${participants.length}명 → ${alive}명 (기록 ${submitted}/${participants.length}, 탈락 ${results.cutIds.length})`);
	}

	const final = host.game?.phase;
	check(final?.kind === "finished" && final.winnerIds.length === 1, "우승자가 한 명 나왔다");
	const winnerId = final?.kind === "finished" ? final.winnerIds[0] : undefined;
	const winner = bots.find((bot) => bot.playerId === winnerId);
	console.log(`👑 우승: ${winner?.name ?? "?"} (${roundNo}라운드)`);

	if (winner !== undefined && winnerId !== undefined) {
		host.send({ type: "release", playerId: winnerId });
		await winner.until(() => winner.playerId === null, "입장 풀기");
		check(true, "진행자가 입장을 풀면 그 폰은 이름 고르기 화면으로 돌아간다");
	}
	for (const bot of bots) bot.close();
	host.close();
}

/** 같은 토큰으로 새로 붙는다(폰 화면이 꺼졌다 켜진 상황) */
async function reconnect(bot: Bot, bots: Bot[]): Promise<Bot> {
	const before = bot.playerId;
	bot.close();
	await sleep(300);
	const again = await openBot(bot.name, "/ws");
	again.token = bot.token;
	again.send({ type: "hello", token: bot.token });
	await again.until(() => again.playerId !== null && again.game !== null, "다시 붙기");
	check(again.playerId === before, `${bot.name}: 다시 붙어도 같은 사람으로 알아본다`);
	bots[bots.indexOf(bot)] = again;
	return again;
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
