
export type TranslationSchema = {
  readonly footer: {
    readonly mode: {
      readonly browse: string;
      readonly insert: string;
      readonly normal: string;
      readonly preview: string;
      readonly settings: string;
      readonly files: string;
      readonly graft: string;
    };
    readonly hints: {
      readonly j_k_move: string;
      readonly enter_change: string;
      readonly esc_close: string;
      readonly j_k_scroll: string;
      readonly text_input: string;
      readonly esc_normal: string;
      readonly ctrl_s_save: string;
      readonly tab_focus: string;
      readonly tab_indent: string;
      readonly scene_picker: string;
    };
  };
};

export const en: TranslationSchema = {
  footer: {
    mode: {
      browse: 'browse',
      insert: 'insert',
      normal: 'normal',
      preview: 'preview',
      settings: 'settings',
      files: 'files',
      graft: 'graft',
    },
    hints: {
      j_k_move: 'j/k move',
      enter_change: 'enter change',
      esc_close: 'esc close',
      j_k_scroll: 'j/k scroll',
      text_input: 'text input',
      esc_normal: 'esc normal',
      ctrl_s_save: 'ctrl+s save',
      tab_focus: 'tab focus',
      tab_indent: 'tab indent',
      scene_picker: 'scene picker',
    },
  },
};

export const me: TranslationSchema = {
  footer: {
    mode: {
      browse: 'esworb',
      insert: 'tresni',
      normal: 'lamron',
      preview: 'weiverp',
      settings: 'sgnittes',
      files: 'selif',
      graft: 'tfarg',
    },
    hints: {
      j_k_move: 'evom k/j',
      enter_change: 'egnahc retne',
      esc_close: 'esolc cse',
      j_k_scroll: 'llorcs k/j',
      text_input: 'tupni txet',
      esc_normal: 'lamron cse',
      ctrl_s_save: 'evas s+lrtc',
      tab_focus: 'sucof bat',
      tab_indent: 'tnedni bat',
      scene_picker: 'rekcip enecs',
    },
  },
};

export type Locale = 'en' | 'me';

export const catalogs: Record<Locale, TranslationSchema> = {
  en,
  me
};
