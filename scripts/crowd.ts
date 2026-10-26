/**
 * 가상 관객: 가상 참가자들이 입장해 있다가, 진행자가 라운드를 시작하면 게임마다 그럴듯한 기록을 낸다.
 * 진행은 진행자 화면에서 직접 한다(혼자 화면을 점검하거나 진행 연습을 할 때). Ctrl-C로 끝낸다.
 *   npm run crowd                       → http://localhost:8787, 29명 + 빈자리 '나' 1명
 *   npm run crowd -- --count=10
 * 시작할 때 명단·기록을 지우고 다시 만든다. localhost가 아니면 --allow-remote 가 있어야 한다.
 */
import { readFileSync } from "node:fs";
import type { GameState, Round } from "../src/domain/game";
import { GAMES, type GameId } from "../src/domain/games/catalog";
import type { ClientMessage, ServerMessage } from "../src/protocol";

const base = process.argv.find((arg) => arg.startsWith("http")) ?? "http://localhost:8787";
const wsBase = base.replace(/^http/, "ws");
const countArg = process.argv.find((arg) => arg.startsWith("--count="));
const COUNT = Math.max(1, Math.min(99, Number(countArg?.split("=")[1] ?? 29)));
const DEFAULT_PLAN: readonly GameId[] = ["balloon", "candy", "eye", "reaction"];

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && !process.argv.includes("--allow-remote")) {
	console.error(`${base} 는 localhost가 아니에요. 명단과 기록을 덮어쓰니 정말 하려면 --allow-remote 를 붙이세요.`);
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

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** 게임마다 사람이 낼 법한 기록 */
function plausibleScore(gameId: GameId): number {
	const roll = Math.random();
	switch (gameId) {
		case "balloon":
			return roll < 0.15 ? 0 : roll < 0.3 ? randomInt(20, 49) : 1000 + randomInt(150, 700);
		case "candy":
			return randomInt(1, 6) * 100_000 + randomInt(0, 19_000);
		case "eye":
			return randomInt(6, 30) * 100_000 + randomInt(0, 14_000);
		case "reaction":
			return roll < 0.1 ? randomInt(200, 500) : 1000 - randomInt(180, 420);
		default:
			return Math.floor(Math.random() * Math.floor(GAMES[gameId].maxScore / 3));
	}
}

type Socket = { game: GameState | null; offsetMs: number; playerId: string | null; send(message: ClientMessage): void };

function open(path: string, onState: (socket: Socket) => void): Promise<Socket> {
	const ws = new WebSocket(`${wsBase}${path}`);
	const socket: Socket = { game: null, offsetMs: 0, playerId: null, send: (message) => ws.send(JSON.stringify(message)) };
	ws.addEventListener("message", (event) => {
		if (typeof event.data !== "string" || event.data === "pong") return;
		const message = JSON.parse(event.data) as ServerMessage;
		if (message.type === "state") {
			socket.game = message.game;
			socket.offsetMs = message.serverNow - Date.now();
			onState(socket);
		} else if (message.type === "you") {
			socket.playerId = message.playerId;
		}
	});
	setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 10_000);
	return new Promise((resolve, reject) => {
		ws.addEventListener("open", () => resolve(socket), { once: true });
		ws.addEventListener("error", () => reject(new Error("연결 실패")), { once: true });
	});
}

/** 라운드마다 한 번, 게임이 끝난 직후 기록을 낸다 */
function submitter(): (socket: Socket) => void {
	const handled = new Set<number>();
	return (socket) => {
		const phase = socket.game?.phase;
		if (phase?.kind !== "playing" || socket.playerId === null || handled.has(phase.round.no)) return;
		const round: Round = phase.round;
		if (!round.participantIds.includes(socket.playerId)) return;
		handled.add(round.no);
		const delay = round.endAt - socket.offsetMs - Date.now() + randomInt(100, 1800);
		setTimeout(() => socket.send({ type: "submit", roundNo: round.no, score: plausibleScore(round.gameId) }), Math.max(0, delay));
	};
}

async function main(): Promise<void> {
	const host = await open(`/ws?role=host&key=${encodeURIComponent(hostKey())}`, () => {});
	host.send({ type: "hello", token: null });
	const waitFor = async (check: () => boolean) => {
		for (let i = 0; i < 100 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 50));
	};
	await waitFor(() => host.game !== null);
	if (host.game?.phase.kind === "playing" || host.game?.phase.kind === "results") host.send({ type: "cancelRound" });
	if (host.game?.phase.kind === "finished") host.send({ type: "reopenGame" });
	host.send({ type: "reset" });
	const names = Array.from({ length: COUNT }, (_, i) => `참가자${String(i + 1).padStart(2, "0")}`);
	host.send({ type: "setRoster", names: [] });
	host.send({ type: "setRoster", names: [...names, "나"] });
	if ((host.game?.plan.length ?? 0) === 0) host.send({ type: "setPlan", gameIds: DEFAULT_PLAN });
	await waitFor(() => host.game?.players.length === COUNT + 1);
	const roster = host.game?.players.filter((player) => names.includes(player.name)) ?? [];
	for (const player of roster) {
		const bot = await open("/ws", submitter());
		bot.send({ type: "hello", token: null });
		bot.send({ type: "claim", playerId: player.id });
	}
	console.log(`가상 참가자 ${roster.length}명 입장 완료. 빈자리 '나'는 폰으로 입장하세요. 진행자 화면에서 라운드를 시작하면 기록을 냅니다. (Ctrl-C로 끝)`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
