"use client";
// All sounds are synthesised with WebAudio: no audio files to download or license.
// Off by default, only ever started from a user gesture, never the only signal.
let ctx: AudioContext | null = null;

export function soundEnabled() {
  try {
    return localStorage.getItem("yr-sound") === "1";
  } catch {
    return false;
  }
}

function ac() {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function tink() {
  const a = soundEnabled() && ac();
  if (!a) return;
  const t = a.currentTime;
  for (const [f, v] of [[2637, 0.09], [3951, 0.04]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.5);
  }
}

export function whistle(times = 1) {
  const a = soundEnabled() && ac();
  if (!a) return;
  const noise = a.createBuffer(1, a.sampleRate * 1.2, a.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  for (let i = 0; i < times; i++) {
    const t = a.currentTime + i * 1.15;
    const src = a.createBufferSource();
    src.buffer = noise;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 6;
    const o = a.createOscillator();
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(2300, t + 0.35);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    g.gain.setValueAtTime(0.12, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    const og = a.createGain();
    og.gain.value = 0.25;
    src.connect(bp).connect(g);
    o.connect(og).connect(g);
    g.connect(a.destination);
    src.start(t);
    src.stop(t + 1.05);
    o.start(t);
    o.stop(t + 1.05);
  }
}

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
