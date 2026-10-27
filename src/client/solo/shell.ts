import { addAttempt, type Attempt, passCount } from "../../domain/solo/attempt";
import { DEFAULT_SOLO_RULES, type SoloRules } from "../../domain/solo/rules";
import { applyCrispUnits } from "../crisp";
import { esc, pick } from "../dom";
import { type Kit, mountKit } from "../games/kit";
import { connect } from "../net";
import { unlockSound } from "../sound";

/** 도전 한 번이 끝났다고 알린다. record 는 기록판에 보일 글자. */
export type Report = (passed: boolean, record: string) => void;

export type SoloContext = {
	readonly report: Report;
	/** 지금 성공 기준. 진행자가 바꾸면 값이 달라지므로 판정할 때마다 읽는다. */
	readonly rules: () => SoloRules;
};

export type SoloGame = {
	/** 가상 화면 크기 */
	readonly width: number;
	readonly height: number;
	readonly background: number;
	/** 화면을 붙이고 그리기를 시작한다. stage 는 캔버스와 안내가 들어 있는 칸(누르기를 여기서 받는다). */
	start(stage: HTMLElement, kit: Kit, solo: SoloContext): void;
};

export type SoloPage = {
	readonly title: string;
	/** 지금 기준으로 적은 성공 기준 한 줄 */
	goal(rules: SoloRules): string;
	readonly game: SoloGame;
};

/**
 * 혼자 하는 도전 페이지 하나를 띄운다.
 * 제목·성공 기준·놀이판·기록판을 깔고, 게임이 알려 주는 도전 결과를 기록판에 쌓는다.
 * 기록은 메모리에만 두기 때문에 새로고침하면 사라진다.
 *
 * 성공 기준은 진행자 화면(/host)에서 정한다. 서버에 붙어 기준을 받아 쓰고,
 * 못 붙으면 기본 기준으로 그냥 한다(서버 없이 정적으로 띄워도 된다).
 */
export function startSoloPage(page: SoloPage): void {
	applyCrispUnits();
	const app = pick(document, "#app");
	app.innerHTML = `
		<header class="ax-solo__head">
			<h1 class="ax-solo__title">${esc(page.title)}</h1>
			<p class="ax-solo__goal"></p>
		</header>
		<div class="ax-solo__stage"></div>
		<section class="ax-solo__log">
			<p class="ax-solo__tally"></p>
			<ol class="ax-solo__rows"></ol>
		</section>`;
	const stage = pick(app, ".ax-solo__stage");
	const goal = pick(app, ".ax-solo__goal");
	const tally = pick(app, ".ax-solo__tally");
	const rows = pick(app, ".ax-solo__rows");

	let attempts: readonly Attempt[] = [];
	let rules = DEFAULT_SOLO_RULES;
	/** 진행자 화면과 이어졌는지. 아직 모를 때는 null(연결을 기다리는 사이 경고를 띄우지 않는다) */
	let linked: boolean | null = null;
	let paintedGoal: string | null = null;

	function showGoal(): void {
		const warning = linked === false ? `<span class="ax-solo__unlinked">진행자 화면과 연결 안 됨</span>` : "";
		const html = esc(page.goal(rules)) + warning;
		if (paintedGoal === html) return;
		paintedGoal = html;
		goal.innerHTML = html;
	}

	function showAttempts(): void {
		tally.innerHTML = `도전 <b>${attempts.length}</b>번 · 성공 <b>${passCount(attempts)}</b>번`;
		// 방금 한 도전이 맨 위에
		rows.innerHTML = attempts
			.toReversed()
			.map(
				(attempt) =>
					`<li class="ax-solo__row" data-passed="${attempt.passed}"><span class="ax-solo__no">${attempt.no}</span><span class="ax-solo__record">${esc(attempt.record)}</span><span class="ax-solo__mark">${attempt.passed ? "성공" : "실패"}</span></li>`,
			)
			.join("");
	}

	showGoal();
	showAttempts();
	// 아이폰은 화면을 한 번 눌러야 소리가 난다
	document.addEventListener("pointerdown", unlockSound, { once: true });

	// 참가자 자격으로 붙는다(진행자 권한이 없어서 폰에서는 기준을 바꿀 수 없다)
	const connection = connect("ws", {
		onOpen: () => connection.send({ type: "hello", token: null }),
		onMessage: (message) => {
			if (message.type !== "state") return;
			rules = message.game.soloRules;
			showGoal();
		},
		onStatus: (status) => {
			linked = status === "online";
			showGoal();
		},
	});

	const kit = mountKit(stage, page.game.width, page.game.height, page.game.background);
	page.game.start(stage, kit, {
		rules: () => rules,
		report: (passed, record) => {
			attempts = addAttempt(attempts, passed, record);
			showAttempts();
		},
	});
}
