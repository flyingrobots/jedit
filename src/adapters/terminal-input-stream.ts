const ESCAPE = '\u001b';
const CSI_START = `${ESCAPE}[`;
const SS3_START = `${ESCAPE}O`;
const CSI_FINAL = /[@-~]/u;
const ESCAPE_DELAY_MS = 25;
const FIRST_SEQUENCE_CODE = 0x20;
const LAST_SEQUENCE_CODE = 0x7e;

export function terminalInputStream(emit: (token: string) => void) {
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clearTimer = () => { if (timer != null) clearTimeout(timer); };
  return {
    accept(raw: string) {
      clearTimer();
      pending += raw;
      while (pending.length > 0) {
        const length = terminalTokenLength(pending);
        if (length == null) break;
        emit(pending.slice(0, length));
        pending = pending.slice(length);
      }
      // A bare Escape or an unfinished sequence (e.g. Alt+[ sending ESC[) is
      // flushed after the delay so it can never hold later input hostage.
      if (pending.length > 0) {
        timer = setTimeout(() => { const flushed = pending; pending = ''; emit(flushed); }, ESCAPE_DELAY_MS);
      }
    },
    dispose() { clearTimer(); pending = ''; },
  };
}

function terminalTokenLength(raw: string): number | undefined {
  if (raw === ESCAPE) return undefined;
  if (raw.startsWith(CSI_START)) return csiTokenLength(raw);
  if (raw.startsWith(SS3_START)) return raw.length >= 3 ? 3 : undefined;
  return Array.from(raw)[0]?.length;
}

function csiTokenLength(raw: string): number | undefined {
  for (let index = CSI_START.length; index < raw.length; index += 1) {
    const character = raw[index] ?? '';
    // A control byte (Ctrl+C, Escape) cannot belong to a CSI sequence: end the
    // unfinished prefix there so the control key is delivered on its own.
    if (!isSequenceByte(character)) return index;
    if (CSI_FINAL.test(character)) return index + 1;
  }
  return undefined;
}

function isSequenceByte(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= FIRST_SEQUENCE_CODE && code <= LAST_SEQUENCE_CODE;
}
