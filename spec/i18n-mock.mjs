export function createI18nMock(overrides = {}) {
  const hints = {
    j_k_move: 'j/k move',
    j_k_scroll: 'j/k scroll',
    ctrl_s_save: 'ctrl+s save',
    ctrl_t_theme: 'ctrl+t theme',
    ctrl_l_scene_picker: 'ctrl+l scene picker',
    ctrl_b_files: 'ctrl+b files',
    ctrl_g_graft: 'ctrl+g graft',
    ctrl_h_history: 'ctrl+h history',
    ctrl_b_close: 'ctrl+b close',
    ctrl_g_close: 'ctrl+g close',
    ctrl_h_close: 'ctrl+h close',
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
  const commands = {
    'footer.command.details.edit': 'Open a file',
    'footer.command.details.write': 'Write the current file',
    'footer.command.details.quit': 'Quit jedit',
    'footer.command.details.wq': 'Write and quit',
    'footer.command.hints.tab_accept': 'tab accept',
    'footer.command.hints.enter_run': 'enter run',
    'footer.command.hints.esc_cancel': 'esc cancel',
  };
  return {
    locale: 'en',
    localeLabel: 'English',
    direction: 'ltr',
    locales: [{
      locale: 'en',
      label: 'English',
      direction: 'ltr',
    }],
    t: (path, values) => {
      if (path === 'footer.context.history_count') {
        return `Echo evidence: ${values?.count ?? 0}`;
      }
      if (path === 'history.title') return 'Echo History';
      if (path === 'history.empty') return 'No Echo evidence yet';
      if (path === 'history.header') {
        return '#   tick  kind        status       evidence       summary';
      }
      const parts = path.split('.');
      const id = parts[parts.length - 1];
      if (commands[path] != null) return commands[path];
      if (hints[id] != null) return hints[id];
      return id.replace(/_/g, ' ');
    },
    setLocale: () => {},
    withLocale: () => createI18nMock(overrides),
    ...overrides,
  };
}
