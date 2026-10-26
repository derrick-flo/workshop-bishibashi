let audio: AudioContext | null = null;

/** 아이폰은 화면을 한 번 눌러야 소리가 난다. 첫 터치 때 부른다. */
export function unlockSound(): void {
	try {
		audio ??= new AudioContext();
		void audio.resume();
	} catch {
		audio = null;
	}
}

export function soundReady(): boolean {
	return audio?.state === "running";
}

function beep(frequency: number, durationMs: number, wave: OscillatorType = "square", volume = 0.06, delayMs = 0): void {
	if (audio === null || audio.state !== "running") return;
	const startAt = audio.currentTime + delayMs / 1000;
	const oscillator = audio.createOscillator();
	const gain = audio.createGain();
	oscillator.type = wave;
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(volume, startAt);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
	oscillator.connect(gain).connect(audio.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + durationMs / 1000);
}

export const sfx = {
	tick: () => beep(880, 90),
	go: () => beep(1320, 260),
	press: () => beep(520, 25, "square", 0.025),
	good: () => {
		beep(660, 90, "square", 0.06);
		beep(990, 160, "square", 0.06, 90);
	},
	bad: () => beep(150, 320, "sawtooth", 0.07),
	end: () => {
		beep(990, 120, "triangle", 0.08);
		beep(740, 220, "triangle", 0.08, 120);
	},
};

/** 안드로이드만 진동한다(아이폰 사파리는 진동 기능이 없다) */
export function buzz(ms: number): void {
	navigator.vibrate?.(ms);
}

/** 다른 효과음 모듈이 같은 오디오를 쓰게 꺼내 준다. 소리가 아직 안 켜졌으면 null */
export function runningAudio(): AudioContext | null {
	return audio !== null && audio.state === "running" ? audio : null;
}
