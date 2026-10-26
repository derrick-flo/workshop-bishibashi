import { runningAudio } from "./sound";

/** 오락실 효과음. 파일 없이 오실레이터와 잡음으로 만든다. 소리가 안 켜졌으면 조용히 넘어간다. */

let noiseBuffer: AudioBuffer | null = null;

function whiteNoise(audio: AudioContext): AudioBuffer {
	if (noiseBuffer !== null && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
	const buffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	noiseBuffer = buffer;
	return buffer;
}

function envelope(audio: AudioContext, volume: number, startAt: number, durationMs: number): GainNode {
	const gain = audio.createGain();
	gain.gain.setValueAtTime(volume, startAt);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
	gain.connect(audio.destination);
	return gain;
}

/** 잡음 한 번(펑·탕·쏟아짐). cutoffHz가 낮을수록 둔한 소리 */
function noise(durationMs: number, volume: number, cutoffHz: number, delayMs = 0): void {
	const audio = runningAudio();
	if (audio === null) return;
	const startAt = audio.currentTime + delayMs / 1000;
	const source = audio.createBufferSource();
	source.buffer = whiteNoise(audio);
	const filter = audio.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.setValueAtTime(cutoffHz, startAt);
	source.connect(filter).connect(envelope(audio, volume, startAt, durationMs));
	source.start(startAt);
	source.stop(startAt + durationMs / 1000);
}

/** 높이가 미끄러지는 삑 소리 */
function slide(fromHz: number, toHz: number, durationMs: number, wave: OscillatorType, volume: number, delayMs = 0): void {
	const audio = runningAudio();
	if (audio === null) return;
	const startAt = audio.currentTime + delayMs / 1000;
	const oscillator = audio.createOscillator();
	oscillator.type = wave;
	oscillator.frequency.setValueAtTime(fromHz, startAt);
	oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), startAt + durationMs / 1000);
	oscillator.connect(envelope(audio, volume, startAt, durationMs));
	oscillator.start(startAt);
	oscillator.stop(startAt + durationMs / 1000);
}

/** 음 여러 개를 차례로 */
function notes(frequencies: readonly number[], stepMs: number, wave: OscillatorType, volume: number): void {
	frequencies.forEach((hz, i) => slide(hz, hz, stepMs * 1.6, wave, volume, i * stepMs));
}

export const arcade = {
	/** 풍선에 바람 넣기. level(0~1)이 높을수록 소리가 높아진다 */
	pump: (level: number) => {
		slide(180 + level * 260, 260 + level * 380, 70, "square", 0.025);
		noise(55, 0.035, 1800);
	},
	pop: () => {
		noise(420, 0.3, 1400);
		slide(420, 50, 320, "sawtooth", 0.09);
	},
	tie: () => notes([660, 880, 1175, 1568], 65, "square", 0.045),
	/** 사탕 하나. 값이 클수록 낮고 묵직하다 */
	candy: (value: number) => slide(value >= 10 ? 330 : value >= 5 ? 520 : 880, value >= 10 ? 260 : value >= 5 ? 440 : 760, 90, "triangle", 0.08),
	spill: () => {
		noise(520, 0.14, 3500);
		slide(600, 120, 420, "triangle", 0.07);
	},
	jar: () => notes([523, 659, 784, 1047], 55, "square", 0.045),
	wrong: () => slide(240, 90, 260, "sawtooth", 0.07),
	ding: () => slide(1320, 1320, 70, "square", 0.04),
	gun: () => {
		noise(260, 0.32, 5000);
		slide(900, 120, 120, "square", 0.05);
	},
	whoosh: () => noise(300, 0.05, 900),
	fanfare: () => notes([523, 659, 784, 1047, 784, 1047, 1319, 1568], 105, "square", 0.05),
	reveal: () => slide(660, 990, 60, "square", 0.03),
	drum: () => noise(90, 0.12, 600),
	/** 칼로 베기 */
	slash: () => {
		noise(90, 0.08, 4500);
		slide(900, 260, 90, "square", 0.035);
	},
	/** 보스 등장 */
	roar: () => {
		slide(220, 60, 520, "sawtooth", 0.08);
		noise(450, 0.08, 500);
	},
	/** 한 칸 오르기. 계단이면 더 높게, level(0~1)이 높을수록(높이 오를수록) 음이 올라간다 */
	step: (up: boolean, level: number) =>
		slide((up ? 520 : 380) + level * 300, (up ? 820 : 420) + level * 300, up ? 70 : 45, "square", 0.03),
	/** 순서 기억하기의 칸마다 다른 음: 빨강·초록·파랑·FINISH 순으로 도·미·솔·높은 도 */
	tone: (index: number) => {
		const hz = [523, 659, 784, 1047][index] ?? 523;
		slide(hz, hz, 220, "square", 0.05);
	},
	/** 땅 파기: 흙 소리 뒤에 금 소리. 금이 많을수록 높게 울린다 */
	dig: (gold: number) => {
		noise(70, 0.09, 2000);
		slide(700 + gold * 80, 900 + gold * 80, 80, "square", 0.035, 50);
	},
	/** 표적이 튀어 오름 */
	blip: () => slide(1400, 1800, 35, "square", 0.02),
	/** 보스를 때림 */
	hit: () => {
		noise(80, 0.12, 900);
		slide(320, 140, 80, "square", 0.05);
	},
};
