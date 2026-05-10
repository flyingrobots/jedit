export type WordCharClass = 'punct' | 'space' | 'word';

export function classifyWordChar(char: string | undefined): WordCharClass {
  if (char == null || /\s/.test(char)) {
    return 'space';
  }
  if (/[A-Za-z0-9_]/.test(char)) {
    return 'word';
  }
  return 'punct';
}

export function nextWordStartIndex(text: string, index: number, allowEnd = false): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (classifyWordChar(text[cursor]) === 'space') {
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  } else {
    const currentClass = classifyWordChar(text[cursor]);
    while (cursor < text.length && classifyWordChar(text[cursor]) === currentClass) {
      cursor += 1;
    }
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  }

  if (allowEnd) {
    return Math.max(0, Math.min(text.length, cursor));
  }

  return Math.max(0, Math.min(text.length - 1, cursor));
}

export function previousWordStartIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (cursor === 0) {
    return 0;
  }

  cursor -= 1;
  while (cursor > 0 && classifyWordChar(text[cursor]) === 'space') {
    cursor -= 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor > 0 && classifyWordChar(text[cursor - 1]) === currentClass) {
    cursor -= 1;
  }

  return cursor;
}

export function wordEndIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
    cursor += 1;
  }
  if (cursor >= text.length) {
    return text.length - 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor < text.length - 1 && classifyWordChar(text[cursor + 1]) === currentClass) {
    cursor += 1;
  }

  return cursor;
}
