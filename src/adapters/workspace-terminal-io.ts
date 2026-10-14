import type { IOPort } from '@flyingrobots/bijou';
import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { terminalInputStream } from './terminal-input-stream.js';

const MODIFIED_ARROW = /^\u001b\[1;(\d+)([ABCDHF])$/u;
const ARROWS: Readonly<Record<string, string>> = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end' };
const NON_ASCII_PRINTABLE = /^[^\x00-\x7f\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]$/u;
const MODIFIER_BASE = 1;
const SHIFT_BIT = 1;
const ALT_BIT = 2;
const CTRL_BIT = 4;

// Bijou's raw parser handles ASCII, mouse packets and ordinary escape keys.
// Its onData host-message port carries decoded keys that it cannot express.
export function workspaceTerminalIO(io: IOPort): IOPort {
  const subscribers = new Set<(message: KeyMsg) => void>();
  return {
    ...io,
    rawInput(callback) {
      const stream = terminalInputStream((raw) => {
        const message = extendedTerminalKey(raw);
        if (message == null) callback(raw);
        else for (const subscriber of subscribers) subscriber(message);
      });
      const handle = io.rawInput(stream.accept);
      return { dispose() { stream.dispose(); handle.dispose(); } };
    },
    onData(callback) {
      const subscriber = (message: KeyMsg) => callback(message);
      subscribers.add(subscriber);
      const handle = io.onData?.(callback);
      return { dispose() { subscribers.delete(subscriber); handle?.dispose(); } };
    },
  };
}

function extendedTerminalKey(raw: string): KeyMsg | undefined {
  if (NON_ASCII_PRINTABLE.test(raw)) return { type: 'key', key: raw, ctrl: false, alt: false, shift: false };
  const match = MODIFIED_ARROW.exec(raw);
  if (match == null) return undefined;
  const bits = Number(match[1]) - MODIFIER_BASE;
  return {
    type: 'key', key: ARROWS[match[2] ?? ''] ?? '',
    shift: (bits & SHIFT_BIT) !== 0, alt: (bits & ALT_BIT) !== 0, ctrl: (bits & CTRL_BIT) !== 0,
  };
}
