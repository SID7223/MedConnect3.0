import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, EncodingType } from 'expo-file-system';

// Synthesized alarm sounds — port of playSound() from src/context/Timer.jsx.
// Web used a Web Audio oscillator; on native we render the same tones to a
// 16-bit PCM WAV and play them through expo-audio.

const SOUNDS: Record<string, { freq: number; type: 'sine' | 'triangle' | 'square'; dur: number }> = {
  beep: { freq: 880, type: 'sine', dur: 0.6 },
  chime: { freq: 1318, type: 'triangle', dur: 0.9 },
  bell: { freq: 660, type: 'square', dur: 0.5 },
};

const SAMPLE_RATE = 22050;

function wave(type: 'sine' | 'triangle' | 'square', phase: number): number {
  const s = Math.sin(phase);
  if (type === 'sine') return s;
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(s);
  return s >= 0 ? 1 : -1;
}

function renderWav(key: string): Uint8Array {
  const s = SOUNDS[key] || SOUNDS.beep;
  const total = Math.ceil(SAMPLE_RATE * (s.dur + 0.4));
  const data = new Int16Array(total);

  const tone = (freq: number, start: number, dur: number, peak: number) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const to = Math.min(total, Math.floor((start + dur) * SAMPLE_RATE));
    for (let i = from; i < to; i++) {
      const t = (i - from) / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.02);
      const decay = Math.exp(-3 * (t / dur));
      const env = 0.001 + (peak - 0.001) * attack * decay;
      data[i] += Math.max(-1, Math.min(1, wave(s.type, 2 * Math.PI * freq * t) * env)) * 32767;
    }
  };

  tone(s.freq, 0, s.dur, 0.3);
  if (key !== 'beep') tone(s.freq * 1.5, 0.25, s.dur, 0.25);

  const buf = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buf);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + total * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i++) v.setInt16(44 + i * 2, data[i], true);
  return new Uint8Array(buf);
}

function base64FromBytes(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

let modeReady = false;

export async function playSound(key: string): Promise<void> {
  try {
    if (!modeReady) {
      await setAudioModeAsync({ playsInSilentMode: true });
      modeReady = true;
    }
    const file = new File(Paths.document, `mc_sound_${key}.wav`);
    if (!file.exists) {
      file.write(base64FromBytes(renderWav(key)), { encoding: EncodingType.Base64 });
    }
    const player = createAudioPlayer({ uri: file.uri });
    player.seekTo(0);
    player.play();
    const release = () => {
      try {
        player.release();
      } catch {
        // already released
      }
    };
    player.addListener('playbackStatusUpdate', (status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) release();
    });
    setTimeout(release, (SOUNDS[key]?.dur || 1) * 1000 + 1500);
  } catch {
    // audio unavailable — timer still works silently
  }
}
