/**
 * Generates short, quiet WAV cues for in-app handoff feedback.
 * Run: node scripts/generate-sensory-sounds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;
const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "sounds",
);

function tone(freq, durationSec, { gain = 0.16, attack = 0.008, release = 0.05 } = {}) {
  const n = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (t < attack) {
      env = t / attack;
    } else if (t > durationSec - release) {
      env = Math.max(0, (durationSec - t) / release);
    }
    samples[i] = Math.sin(2 * Math.PI * freq * t) * gain * env;
  }
  return samples;
}

function silence(durationSec) {
  return new Float64Array(Math.floor(durationSec * SAMPLE_RATE));
}

function concat(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float64Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writeWav(fileName, samples) {
  const dataSize = samples.length * 2;
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
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  writeFileSync(join(outDir, fileName), buffer);
}

mkdirSync(outDir, { recursive: true });

writeWav(
  "success.wav",
  concat([
    tone(523.25, 0.11, { gain: 0.14 }),
    silence(0.03),
    tone(659.25, 0.16, { gain: 0.15 }),
  ]),
);

writeWav(
  "claim-received.wav",
  concat([
    tone(392.0, 0.09, { gain: 0.17 }),
    silence(0.025),
    tone(523.25, 0.12, { gain: 0.18 }),
    silence(0.02),
    tone(659.25, 0.18, { gain: 0.16 }),
  ]),
);

writeWav(
  "handoff-complete.wav",
  concat([
    tone(523.25, 0.09, { gain: 0.14 }),
    silence(0.02),
    tone(659.25, 0.1, { gain: 0.15 }),
    silence(0.02),
    tone(783.99, 0.18, { gain: 0.16 }),
  ]),
);
