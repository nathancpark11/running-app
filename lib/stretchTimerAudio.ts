let sharedAudioContext: AudioContext | null = null;

function canResumeContext(context: AudioContext) {
  return context.state === "suspended" || context.state === "interrupted";
}

function getAudioContextClass() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function getOrCreateAudioContext() {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    return null;
  }

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

function warmAudioOutput(context: AudioContext, frequency: number, durationSeconds: number, peakGain: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationSeconds);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + durationSeconds + 0.02);
}

export function primeStretchTimerAudio() {
  try {
    const context = getOrCreateAudioContext();
    if (!context) {
      return;
    }

    if (canResumeContext(context)) {
      void context.resume();
    }

    warmAudioOutput(context, 880, 0.05, 0.03);
  } catch {
    // Ignore audio priming failures on unsupported browsers.
  }
}

export function playStretchTimerTone(frequency: number, durationSeconds: number) {
  try {
    const context = getOrCreateAudioContext();
    if (!context) {
      return;
    }

    if (canResumeContext(context)) {
      void context.resume();
    }

    warmAudioOutput(context, frequency, durationSeconds, 0.2);
  } catch {
    // Ignore audio playback failures (browser/device restrictions).
  }
}