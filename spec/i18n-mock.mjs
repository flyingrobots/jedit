export function createI18nMock() {
  return {
    locale: 'en',
    direction: 'ltr',
    t: (path) => {
      const parts = path.split('.');
      const id = parts[parts.length - 1];
      if (id === 'j_k_move') return 'j/k move';
      if (id === 'j_k_scroll') return 'j/k scroll';
      if (id === 'ctrl_s_save') return 'ctrl+s save';
      return id.replace(/_/g, ' ');
    },
    setLocale: () => {}
  };
}
