
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
    readonly context: {
      readonly settings: string;
      readonly graft_empty: string;
    };
    readonly hints: {
      readonly j_k_move: string;
      readonly enter_change: string;
      readonly f2_close: string;
      readonly esc_close: string;
      readonly j_k_scroll: string;
      readonly f3_source: string;
      readonly f3_preview: string;
      readonly text_input: string;
      readonly esc_normal: string;
      readonly ctrl_s_save: string;
      readonly ctrl_t_theme: string;
      readonly tab_focus: string;
      readonly tab_indent: string;
      readonly ctrl_l_scene_picker: string;
      readonly scene_picker: string;
      readonly ctrl_b_files: string;
      readonly ctrl_g_graft: string;
      readonly enter_open: string;
      readonly backspace_up: string;
      readonly ctrl_b_close: string;
      readonly enter_jump: string;
      readonly r_refresh: string;
      readonly ctrl_g_close: string;
      readonly i_insert: string;
      readonly o_open_line: string;
      readonly cc_line: string;
      readonly cw_word: string;
      readonly ce_word_end: string;
      readonly c0_start: string;
      readonly c_end: string;
      readonly dd_line: string;
      readonly dw_word: string;
      readonly de_word_end: string;
      readonly d0_start: string;
      readonly d_end: string;
      readonly yy_line: string;
      readonly yw_word: string;
      readonly ye_word_end: string;
      readonly y0_start: string;
      readonly y_end: string;
      readonly gg_top: string;
      readonly esc_cancel: string;
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
    context: {
      settings: 'settings',
      graft_empty: 'open a file to inspect it',
    },
    hints: {
      j_k_move: 'j/k move',
      enter_change: 'enter change',
      f2_close: 'f2 close',
      esc_close: 'esc close',
      j_k_scroll: 'j/k scroll',
      f3_source: 'f3 source',
      f3_preview: 'f3 preview',
      text_input: 'text input',
      esc_normal: 'esc normal',
      ctrl_s_save: 'ctrl+s save',
      ctrl_t_theme: 'ctrl+t theme',
      tab_focus: 'tab focus',
      tab_indent: 'tab indent',
      ctrl_l_scene_picker: 'ctrl+l scene picker',
      scene_picker: 'scene picker',
      ctrl_b_files: 'ctrl+b files',
      ctrl_g_graft: 'ctrl+g graft',
      enter_open: 'enter open',
      backspace_up: 'backspace up',
      ctrl_b_close: 'ctrl+b close',
      enter_jump: 'enter jump',
      r_refresh: 'r refresh',
      ctrl_g_close: 'ctrl+g close',
      i_insert: 'i insert',
      o_open_line: 'o open line',
      cc_line: 'cc line',
      cw_word: 'cw word',
      ce_word_end: 'ce word-end',
      c0_start: 'c0 start',
      c_end: 'c$ end',
      dd_line: 'dd line',
      dw_word: 'dw word',
      de_word_end: 'de word-end',
      d0_start: 'd0 start',
      d_end: 'd$ end',
      yy_line: 'yy line',
      yw_word: 'yw word',
      ye_word_end: 'ye word-end',
      y0_start: 'y0 start',
      y_end: 'y$ end',
      gg_top: 'gg top',
      esc_cancel: 'esc cancel',
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
    context: {
      settings: 'sgnittes',
      graft_empty: 'ti tcepsni ot elif a nepo',
    },
    hints: {
      j_k_move: 'evom k/j',
      enter_change: 'egnahc retne',
      f2_close: 'esolc 2f',
      esc_close: 'esolc cse',
      j_k_scroll: 'llorcs k/j',
      f3_source: 'ecruos 3f',
      f3_preview: 'weiverp 3f',
      text_input: 'tupni txet',
      esc_normal: 'lamron cse',
      ctrl_s_save: 'evas s+lrtc',
      ctrl_t_theme: 'emeht t+lrtc',
      tab_focus: 'sucof bat',
      tab_indent: 'tnedni bat',
      ctrl_l_scene_picker: 'rekcip enecs l+lrtc',
      scene_picker: 'rekcip enecs',
      ctrl_b_files: 'selif b+lrtc',
      ctrl_g_graft: 'tfarg g+lrtc',
      enter_open: 'nepo retne',
      backspace_up: 'pu ecapskcab',
      ctrl_b_close: 'esolc b+lrtc',
      enter_jump: 'pmuj retne',
      r_refresh: 'hserfer r',
      ctrl_g_close: 'esolc g+lrtc',
      i_insert: 'tresni i',
      o_open_line: 'enil nepo o',
      cc_line: 'enil cc',
      cw_word: 'drow wc',
      ce_word_end: 'dne-drow ec',
      c0_start: 'trats 0c',
      c_end: 'dne $c',
      dd_line: 'enil dd',
      dw_word: 'drow wd',
      de_word_end: 'dne-drow ed',
      d0_start: 'trats 0d',
      d_end: 'dne $d',
      yy_line: 'enil yy',
      yw_word: 'drow wy',
      ye_word_end: 'dne-drow ey',
      y0_start: 'trats 0y',
      y_end: 'dne $y',
      gg_top: 'pot gg',
      esc_cancel: 'lecnac cse',
    },
  },
};

export type Locale = 'en' | 'me';

export const catalogs: Record<Locale, TranslationSchema> = {
  en,
  me
};
