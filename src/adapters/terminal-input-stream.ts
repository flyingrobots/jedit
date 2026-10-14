const ESCAPE = '\u001b';
const CSI_START = `${ESCAPE}[`;
const SS3_START = `${ESCAPE}O`;
const CSI_FINAL = /[@-~]/u;
const ESCAPE_DELAY_MS = 25;

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
      if (pending === ESCAPE) {
        timer = setTimeout(() => { pending = ''; emit(ESCAPE); }, ESCAPE_DELAY_MS);
      }
    },
    dispose() { clearTimer(); pending = ''; },
  };
}

function terminalTokenLength(raw: string): number | undefined {
  if (raw === ESCAPE) return undefined;
  if (raw.startsWith(CSI_START)) {
    for (let index = CSI_START.length; index < raw.length; index += 1) {
      if (CSI_FINAL.test(raw[index] ?? '')) return index + 1;
    }
    return undefined;
  }
  if (raw.startsWith(SS3_START)) return raw.length >= 3 ? 3 : undefined;
  return Array.from(raw)[0]?.length;
}
