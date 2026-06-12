import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../resources/sounds");

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < numSamples; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767 * 0.22), 44 + index * 2);
  }
  writeFileSync(join(OUT_DIR, filename), buffer);
}

function sine(freq, time) {
  return Math.sin(2 * Math.PI * freq * time);
}

function decayEnvelope(time, duration, attack = 0.01, tail = 0.35) {
  if (time < attack) return time / attack;
  const fadeStart = duration * (1 - tail);
  if (time > fadeStart) return Math.max(0, 1 - (time - fadeStart) / (duration - fadeStart));
  return 1;
}

function render(durationSec, renderSample) {
  const length = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    samples[index] = renderSample(time, durationSec);
  }
  return samples;
}

mkdirSync(OUT_DIR, { recursive: true });

writeWav(
  "soft-chime.wav",
  render(0.6, (time, duration) => sine(1046.5, time) * decayEnvelope(time, duration, 0.02, 0.88)),
);

writeWav(
  "double-tap.wav",
  render(0.4, (time) => {
    const first = time < 0.18 ? sine(659.25, time) * decayEnvelope(time, 0.18, 0.005, 0.55) : 0;
    const second =
      time >= 0.12 ? sine(659.25, time - 0.12) * decayEnvelope(time - 0.12, 0.22, 0.005, 0.55) : 0;
    return first + second;
  }),
);

writeWav(
  "wood-tick.wav",
  render(0.12, (time, duration) => {
    const noise = Math.sin(time * 9400) * Math.sin(time * 3700);
    return noise * decayEnvelope(time, duration, 0.001, 0.92) * 0.55;
  }),
);

writeWav(
  "whisper-ping.wav",
  render(0.35, (time, duration) => {
    const fundamental = sine(2093, time);
    const overtone = sine(4186, time) * 0.25;
    return (fundamental + overtone) * decayEnvelope(time, duration, 0.004, 0.75) * 0.35;
  }),
);

console.log(`Wrote 4 WAV files to ${OUT_DIR}`);
