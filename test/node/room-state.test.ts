import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeRoomState, type RoomHandlers } from "../../src/node/room-state";

const dirs: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "bishibashi-"));
	dirs.push(dir);
	return dir;
}

afterEach(async () => {
	vi.useRealTimers();
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function handlers(alarm: () => Promise<void>): RoomHandlers {
	return { webSocketMessage: async () => {}, webSocketClose: async () => {}, webSocketError: async () => {}, alarm };
}

describe("Node 저장소(Durable Object 대신)", () => {
	it("저장한 값은 다시 켜도 남는다", async () => {
		const dir = await tempDir();
		const first = await NodeRoomState.open(dir);
		await first.storage.put({ game: { players: ["p1"] }, claims: { hash: "p1" } });

		const second = await NodeRoomState.open(dir);
		expect(await second.storage.get("game")).toEqual({ players: ["p1"] });
		expect(await second.storage.get("claims")).toEqual({ hash: "p1" });
		expect(await second.storage.get("없는 키")).toBeUndefined();
	});

	it("꺼낸 값을 고쳐도 저장된 값은 그대로다", async () => {
		const state = await NodeRoomState.open(await tempDir());
		await state.storage.put({ game: { round: 1 } });
		const game = await state.storage.get<{ round: number }>("game");
		if (game !== undefined) game.round = 99;
		expect(await state.storage.get("game")).toEqual({ round: 1 });
	});

	it("울리기 전에 꺼졌으면 다시 켤 때 알람을 다시 걸고, 울린 뒤에는 지운다", async () => {
		vi.useFakeTimers();
		const dir = await tempDir();
		const first = await NodeRoomState.open(dir);
		await first.storage.setAlarm(Date.now() + 5_000);

		const alarm = vi.fn(async () => {});
		const second = await NodeRoomState.open(dir);
		second.attach(handlers(alarm));
		await vi.advanceTimersByTimeAsync(5_000);
		expect(alarm).toHaveBeenCalledTimes(1);
		await second.flush();

		const afterRing = vi.fn(async () => {});
		const third = await NodeRoomState.open(dir);
		third.attach(handlers(afterRing));
		await vi.advanceTimersByTimeAsync(10_000);
		expect(afterRing).not.toHaveBeenCalled();
	});

	it("알람 처리기가 다시 건 알람은 지우지 않는다(마감 전에 울려서 다시 거는 경우)", async () => {
		vi.useFakeTimers();
		const state = await NodeRoomState.open(await tempDir());
		const deadline = Date.now() + 1_000;
		const alarm = vi.fn(async () => {
			if (alarm.mock.calls.length === 1) await state.storage.setAlarm(deadline);
		});
		state.attach(handlers(alarm));
		await state.storage.setAlarm(deadline - 500);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(alarm).toHaveBeenCalledTimes(2);
		// 두 번째로 울린 뒤 알람을 지우는 저장이 아직 파일에 쓰는 중일 수 있다. 끝나기 전에 임시 폴더를 지우면 ENOTEMPTY 가 난다.
		await state.flush();
	});
});
