// Attention chime for alerts that need someone to physically come over (a referee call, a
// tie the referee has to check). Synthesized with Web Audio so there's no file to load.
//
// Browsers only let a page make sound after the user has interacted with it, and iOS Safari
// additionally needs the AudioContext resumed inside that interaction — so the context is
// created/resumed on the first tap or key press anywhere (see unlockAudioOnInteraction).

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function getContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    ctx.addEventListener("statechange", () => listeners.forEach((l) => l()));
  }
  return ctx;
}

export function isAudioUnlocked() {
  return ctx?.state === "running";
}

export function subscribeAudioState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function unlockAudio() {
  const c = getContext();
  if (c && c.state !== "running") void c.resume();
}

/** Installs a one-time-ish listener that unlocks audio on the next user interaction. */
export function unlockAudioOnInteraction() {
  const onInteract = () => {
    unlockAudio();
    if (isAudioUnlocked()) remove();
  };
  const remove = () => {
    window.removeEventListener("pointerdown", onInteract, true);
    window.removeEventListener("keydown", onInteract, true);
  };
  window.addEventListener("pointerdown", onInteract, true);
  window.addEventListener("keydown", onInteract, true);
  return remove;
}

/** Three rising two-tone pings — loud enough to cut through a busy hall, short enough not to grate. */
export function playAlertChime() {
  const c = getContext();
  if (!c) return;
  if (c.state !== "running") void c.resume();
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([180, 80, 180]);

  const start = c.currentTime + 0.02;
  [0, 0.32, 0.64].forEach((offset, i) => {
    [880, 1320].forEach((freq, j) => {
      const t = start + offset + j * 0.12;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq + i * 40;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  });
}
