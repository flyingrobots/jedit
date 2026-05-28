export function createI18nMock() {
  const hints = {
    j_k_move: 'j/k move',
    j_k_scroll: 'j/k scroll',
    ctrl_s_save: 'ctrl+s save',
    ctrl_t_theme: 'ctrl+t theme',
    ctrl_l_scene_picker: 'ctrl+l scene picker',
    ctrl_b_files: 'ctrl+b files',
    ctrl_g_graft: 'ctrl+g graft',
    ctrl_b_close: 'ctrl+b close',
    ctrl_g_close: 'ctrl+g close',
    f2_close: 'f2 close',
    f3_source: 'f3 source',
    f3_preview: 'f3 preview',
    ce_word_end: 'ce word-end',
    c_end: 'c$ end',
    de_word_end: 'de word-end',
    d_end: 'd$ end',
    ye_word_end: 'ye word-end',
    y_end: 'y$ end',
  };
  return {
    locale: 'en',
    direction: 'ltr',
    t: (path) => {
      const parts = path.split('.');
      const id = parts[parts.length - 1];
      if (hints[id] != null) return hints[id];
      return id.replace(/_/g, ' ');
    },
    setLocale: () => {}
  };
}
