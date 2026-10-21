// Thin wrapper around the browser speechSynthesis API.
// All speech here is generated locally by the browser: no audio is
// recorded, uploaded, or stored. These helpers fail quietly with a boolean
// so the UI can show the text instead when no voice is available.

/** True when this browser exposes speech synthesis at all. */
export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak a short text aloud, cancelling anything already speaking.
 * Returns true when speech was started, false when unavailable.
 */
export function speakText(text: string, rate = 0.95): boolean {
  if (!ttsSupported() || !text.trim()) return false;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  synthesis.speak(utterance);
  return true;
}

/** Stop any speech in progress. Safe to call when unsupported. */
export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
