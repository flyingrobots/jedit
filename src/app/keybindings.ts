import { DuplicateKeyBindingError } from '../domain/errors.js';

export const JEDIT_KEY_ACTION = {
  OpenSettings: Symbol('jedit.key.action.open-settings'),
  ToggleMarkdownPreview: Symbol('jedit.key.action.toggle-markdown-preview'),
  ToggleTheme: Symbol('jedit.key.action.toggle-theme'),
  OpenScenePicker: Symbol('jedit.key.action.open-scene-picker'),
} as const;

export type JeditKeyAction = typeof JEDIT_KEY_ACTION[keyof typeof JEDIT_KEY_ACTION];

export interface JeditKeyBinding {
  readonly action: JeditKeyAction;
  readonly key: string;
  readonly label: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
}

type JeditKeyChord = Pick<JeditKeyBinding, 'key' | 'ctrl' | 'alt' | 'shift'>;

const KEY_F2 = 'f2';
const KEY_F3 = 'f3';
const KEY_L = 'l';
const KEY_T = 't';
const MODIFIER_CTRL = 'ctrl';
const MODIFIER_ALT = 'alt';
const MODIFIER_SHIFT = 'shift';
const KEY_SIGNATURE_SEPARATOR = '+';
const DUPLICATE_BINDING_PREFIX = 'Duplicate jedit key binding';

export const JEDIT_SETTINGS_TOGGLE_KEY = KEY_F2;
export const JEDIT_SETTINGS_TOGGLE_LABEL = KEY_F2;
export const JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY = KEY_F3;
export const JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL = KEY_F3;
export const JEDIT_SCENE_PICKER_TOGGLE_KEY = KEY_L;
export const JEDIT_SCENE_PICKER_TOGGLE_LABEL = formatJeditKeyLabel({
  key: JEDIT_SCENE_PICKER_TOGGLE_KEY,
  ctrl: true,
});
export const JEDIT_THEME_TOGGLE_KEY = KEY_T;
export const JEDIT_THEME_TOGGLE_LABEL = formatJeditKeyLabel({
  key: JEDIT_THEME_TOGGLE_KEY,
  ctrl: true,
});

export const JEDIT_KEY_BINDINGS = ensureUniqueJeditKeyBindings([
  {
    action: JEDIT_KEY_ACTION.OpenSettings,
    key: JEDIT_SETTINGS_TOGGLE_KEY,
    label: JEDIT_SETTINGS_TOGGLE_LABEL,
  },
  {
    action: JEDIT_KEY_ACTION.ToggleMarkdownPreview,
    key: JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY,
    label: JEDIT_MARKDOWN_PREVIEW_TOGGLE_LABEL,
  },
  {
    action: JEDIT_KEY_ACTION.ToggleTheme,
    key: JEDIT_THEME_TOGGLE_KEY,
    label: JEDIT_THEME_TOGGLE_LABEL,
    ctrl: true,
  },
  {
    action: JEDIT_KEY_ACTION.OpenScenePicker,
    key: JEDIT_SCENE_PICKER_TOGGLE_KEY,
    label: JEDIT_SCENE_PICKER_TOGGLE_LABEL,
    ctrl: true,
  },
] as const);

export function ensureUniqueJeditKeyBindings<const Bindings extends readonly JeditKeyBinding[]>(
  bindings: Bindings,
): Bindings {
  const seen = new Map<string, JeditKeyBinding>();
  for (const binding of bindings) {
    const signature = keyBindingSignature(binding);
    const previous = seen.get(signature);
    if (previous != null && previous.action !== binding.action) {
      throw new DuplicateKeyBindingError(`${DUPLICATE_BINDING_PREFIX}: ${signature} is used by "${previous.label}" and "${binding.label}"`);
    }
    seen.set(signature, binding);
  }
  return bindings;
}

export function formatJeditKeyLabel(binding: JeditKeyChord): string {
  return keyBindingSignature(binding);
}

function keyBindingSignature(binding: JeditKeyChord): string {
  const parts: string[] = [];
  if (binding.ctrl === true) {
    parts.push(MODIFIER_CTRL);
  }
  if (binding.alt === true) {
    parts.push(MODIFIER_ALT);
  }
  if (binding.shift === true) {
    parts.push(MODIFIER_SHIFT);
  }
  parts.push(binding.key);
  return parts.join(KEY_SIGNATURE_SEPARATOR);
}
