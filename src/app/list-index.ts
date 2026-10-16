// Pure index arithmetic for selectable lists. A leaf module with no
// dependencies so every surface that moves a selection -- the file explorer,
// the Graft drawer, the scene preview -- shares one implementation instead of
// each growing its own copy.

const EMPTY_SIZE = 0;
const FIRST_INDEX = 0;

// Selection cycles rather than stopping at either end. An empty list has no
// entry to land on, so it stays at the first index instead of wrapping onto
// nothing.
export function wrapIndex(index: number, size: number): number {
  if (size <= EMPTY_SIZE) {
    return FIRST_INDEX;
  }
  return ((index % size) + size) % size;
}
