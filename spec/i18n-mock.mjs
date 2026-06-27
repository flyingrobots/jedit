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
    'footer.command.details.ttd': 'Observe a causal tick without moving canonical head',
    'footer.command.details.strand': 'Create, switch, or list copy-on-write strands',
    'footer.command.details.braid': 'View, preview, or admit braid candidates',
    'footer.command.details.why': 'Explain the last meaningful command',
    'footer.command.hints.tab_accept': 'tab accept',
    'footer.command.hints.enter_run': 'enter run',
    'footer.command.hints.esc_cancel': 'esc cancel',
  };
  const settings = {
    'settings.sections.appearance': 'Appearance',
    'settings.sections.editor': 'Editor',
    'settings.sections.runtime': 'Runtime',
    'settings.rows.theme.label': 'Theme',
    'settings.rows.theme.description': 'Switch between installed data-driven themes.',
    'settings.rows.theme_mode.label': 'Light/dark',
    'settings.rows.theme_mode.description': 'Switch the current theme to its light or dark companion.',
    'settings.rows.footer.label': 'Footer',
    'settings.rows.footer.description': 'Show mode, focus, and command hints at the bottom edge.',
    'settings.rows.markdown_preview.label': 'Markdown preview',
    'settings.rows.markdown_preview.description': 'Switch the active Markdown buffer between source and preview.',
    'settings.rows.diagnostics.label': 'Diagnostics',
    'settings.rows.diagnostics.description': 'Inspect Graft, parser, and Colorful runtime wiring.',
    'settings.values.on': 'On',
    'settings.values.off': 'Off',
    'settings.values.theme_mode_dark': 'Dark',
    'settings.values.theme_mode_light': 'Light',
    'settings.values.source': 'Source',
    'settings.values.preview': 'Preview',
    'settings.values.current': 'Current',
    'settings.values.open': 'Open',
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
      if (path === 'worldline.title') return 'Worldlines';
      if (path === 'worldline.empty') return 'No worldlines yet';
      if (path === 'worldline.header') {
        return 'kind      name           basis          head  delta     conflict';
      }
      const parts = path.split('.');
      const id = parts[parts.length - 1];
      if (commands[path] != null) return commands[path];
      if (settings[path] != null) return settings[path];
      if (hints[id] != null) return hints[id];
      return id.replace(/_/g, ' ');
    },
    setLocale: () => {},
    withLocale: () => createI18nMock(overrides),
    ...overrides,
  };
}
