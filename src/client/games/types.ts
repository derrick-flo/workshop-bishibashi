import type { Button } from "../../domain/games/button";
import type { ControllerLabels } from "../controller";

/** 미니게임 화면 하나. 규칙은 domain에 있고 여기선 그리기만 한다. t는 게임 시작 뒤 경과 ms. */
export type GameView = {
	readonly labels: ControllerLabels;
	press(button: Button, t: number): void;
	frame(t: number): void;
	score(): number;
};

export type MountGame = (stage: HTMLElement, seed: number) => GameView;
