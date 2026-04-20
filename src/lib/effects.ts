// Confettis + petit son pour célébrer un match enregistré.
// Import dynamique pour éviter d'alourdir le bundle initial.

export async function fireVictoryEffects() {
  if (typeof window === "undefined") return;

  try {
    const { default: confetti } = await import("canvas-confetti");
    const duration = 1200;
    const end = Date.now() + duration;
    const colors = ["#4f81ff", "#f2a14a", "#5fd49a", "#e35c5c"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        startVelocity: 55,
        origin: { x: 0, y: 0.8 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        startVelocity: 55,
        origin: { x: 1, y: 0.8 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  } catch {
    // Confetti non disponible : silencieux
  }

  playVictorySound();
}

function playVictorySound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Petit arpège ascendant do-mi-sol (C5-E5-G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Pas de Web Audio API : silencieux
  }
}
