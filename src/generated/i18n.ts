export type TranslationSchema = {
  readonly "footer": {
    readonly "mode": {
      readonly "browse": string;
      readonly "insert": string;
      readonly "normal": string;
      readonly "preview": string;
      readonly "settings": string;
      readonly "files": string;
      readonly "graft": string;
      readonly "history": string;
    };
    readonly "context": {
      readonly "settings": string;
      readonly "graft_empty": string;
      readonly "history_empty": string;
    };
    readonly "hints": {
      readonly "j_k_move": string;
      readonly "enter_change": string;
      readonly "f2_close": string;
      readonly "esc_close": string;
      readonly "j_k_scroll": string;
      readonly "f3_source": string;
      readonly "f3_preview": string;
      readonly "text_input": string;
      readonly "esc_normal": string;
      readonly "ctrl_s_save": string;
      readonly "ctrl_t_theme": string;
      readonly "tab_focus": string;
      readonly "tab_indent": string;
      readonly "ctrl_l_scene_picker": string;
      readonly "scene_picker": string;
      readonly "ctrl_b_files": string;
      readonly "ctrl_g_graft": string;
      readonly "ctrl_h_history": string;
      readonly "enter_open": string;
      readonly "backspace_up": string;
      readonly "ctrl_b_close": string;
      readonly "enter_jump": string;
      readonly "r_refresh": string;
      readonly "ctrl_g_close": string;
      readonly "ctrl_h_close": string;
      readonly "i_insert": string;
      readonly "o_open_line": string;
      readonly "cc_line": string;
      readonly "cw_word": string;
      readonly "ce_word_end": string;
      readonly "c0_start": string;
      readonly "c_end": string;
      readonly "dd_line": string;
      readonly "dw_word": string;
      readonly "de_word_end": string;
      readonly "d0_start": string;
      readonly "d_end": string;
      readonly "yy_line": string;
      readonly "yw_word": string;
      readonly "ye_word_end": string;
      readonly "y0_start": string;
      readonly "y_end": string;
      readonly "gg_top": string;
      readonly "esc_cancel": string;
    };
  };
};

export type LocaleDirection = 'ltr' | 'rtl';

export interface LocaleMetadata {
  readonly label: string;
  readonly direction: LocaleDirection;
}

export const en: TranslationSchema = {"footer":{"mode":{"browse":"browse","insert":"insert","normal":"normal","preview":"preview","settings":"settings","files":"files","graft":"graft","history":"history"},"context":{"settings":"settings","graft_empty":"open a file to inspect it","history_empty":"no Echo evidence yet"},"hints":{"j_k_move":"j/k move","enter_change":"enter change","f2_close":"f2 close","esc_close":"esc close","j_k_scroll":"j/k scroll","f3_source":"f3 source","f3_preview":"f3 preview","text_input":"text input","esc_normal":"esc normal","ctrl_s_save":"ctrl+s save","ctrl_t_theme":"ctrl+t theme","tab_focus":"tab focus","tab_indent":"tab indent","ctrl_l_scene_picker":"ctrl+l scene picker","scene_picker":"scene picker","ctrl_b_files":"ctrl+b files","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h history","enter_open":"enter open","backspace_up":"backspace up","ctrl_b_close":"ctrl+b close","enter_jump":"enter jump","r_refresh":"r refresh","ctrl_g_close":"ctrl+g close","ctrl_h_close":"ctrl+h close","i_insert":"i insert","o_open_line":"o open line","cc_line":"cc line","cw_word":"cw word","ce_word_end":"ce word-end","c0_start":"c0 start","c_end":"c$ end","dd_line":"dd line","dw_word":"dw word","de_word_end":"de word-end","d0_start":"d0 start","d_end":"d$ end","yy_line":"yy line","yw_word":"yw word","ye_word_end":"ye word-end","y0_start":"y0 start","y_end":"y$ end","gg_top":"gg top","esc_cancel":"esc cancel"}}};

export const fr: TranslationSchema = {"footer":{"mode":{"browse":"parcourir","insert":"insertion","normal":"normal","preview":"aperçu","settings":"paramètres","files":"fichiers","graft":"graft","history":"historique"},"context":{"settings":"paramètres","graft_empty":"ouvrez un fichier pour l'inspecter","history_empty":"pas encore de preuve Echo"},"hints":{"j_k_move":"j/k déplacer","enter_change":"enter changer","f2_close":"f2 fermer","esc_close":"esc fermer","j_k_scroll":"j/k défiler","f3_source":"f3 source","f3_preview":"f3 aperçu","text_input":"saisie texte","esc_normal":"esc normal","ctrl_s_save":"ctrl+s enregistrer","ctrl_t_theme":"ctrl+t thème","tab_focus":"tab focus","tab_indent":"tab retrait","ctrl_l_scene_picker":"ctrl+l scène","scene_picker":"sélecteur de scène","ctrl_b_files":"ctrl+b fichiers","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h historique","enter_open":"enter ouvrir","backspace_up":"backspace haut","ctrl_b_close":"ctrl+b fermer","enter_jump":"enter aller","r_refresh":"r actualiser","ctrl_g_close":"ctrl+g fermer","ctrl_h_close":"ctrl+h fermer","i_insert":"i insérer","o_open_line":"o ouvrir ligne","cc_line":"cc ligne","cw_word":"cw mot","ce_word_end":"ce fin mot","c0_start":"c0 début","c_end":"c$ fin","dd_line":"dd ligne","dw_word":"dw mot","de_word_end":"de fin mot","d0_start":"d0 début","d_end":"d$ fin","yy_line":"yy ligne","yw_word":"yw mot","ye_word_end":"ye fin mot","y0_start":"y0 début","y_end":"y$ fin","gg_top":"gg haut","esc_cancel":"esc annuler"}}};

export const it: TranslationSchema = {"footer":{"mode":{"browse":"sfoglia","insert":"inserisci","normal":"normale","preview":"anteprima","settings":"impostazioni","files":"file","graft":"graft","history":"cronologia"},"context":{"settings":"impostazioni","graft_empty":"apri un file per ispezionarlo","history_empty":"nessuna prova Echo ancora"},"hints":{"j_k_move":"j/k muovi","enter_change":"enter cambia","f2_close":"f2 chiudi","esc_close":"esc chiudi","j_k_scroll":"j/k scorri","f3_source":"f3 sorgente","f3_preview":"f3 anteprima","text_input":"testo","esc_normal":"esc normale","ctrl_s_save":"ctrl+s salva","ctrl_t_theme":"ctrl+t tema","tab_focus":"tab focus","tab_indent":"tab rientra","ctrl_l_scene_picker":"ctrl+l scena","scene_picker":"selettore scena","ctrl_b_files":"ctrl+b file","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h cronologia","enter_open":"enter apri","backspace_up":"backspace su","ctrl_b_close":"ctrl+b chiudi","enter_jump":"enter vai","r_refresh":"r aggiorna","ctrl_g_close":"ctrl+g chiudi","ctrl_h_close":"ctrl+h chiudi","i_insert":"i inserisci","o_open_line":"o apri riga","cc_line":"cc riga","cw_word":"cw parola","ce_word_end":"ce fine parola","c0_start":"c0 inizio","c_end":"c$ fine","dd_line":"dd riga","dw_word":"dw parola","de_word_end":"de fine parola","d0_start":"d0 inizio","d_end":"d$ fine","yy_line":"yy riga","yw_word":"yw parola","ye_word_end":"ye fine parola","y0_start":"y0 inizio","y_end":"y$ fine","gg_top":"gg cima","esc_cancel":"esc annulla"}}};

export const de: TranslationSchema = {"footer":{"mode":{"browse":"durchsuchen","insert":"einfügen","normal":"normal","preview":"vorschau","settings":"einstellungen","files":"dateien","graft":"graft","history":"verlauf"},"context":{"settings":"einstellungen","graft_empty":"datei öffnen zum prüfen","history_empty":"noch keine Echo-Nachweise"},"hints":{"j_k_move":"j/k bewegen","enter_change":"enter ändern","f2_close":"f2 schließen","esc_close":"esc schließen","j_k_scroll":"j/k scrollen","f3_source":"f3 quelltext","f3_preview":"f3 vorschau","text_input":"texteingabe","esc_normal":"esc normal","ctrl_s_save":"ctrl+s speichern","ctrl_t_theme":"ctrl+t theme","tab_focus":"tab fokus","tab_indent":"tab einrücken","ctrl_l_scene_picker":"ctrl+l szene","scene_picker":"szenenauswahl","ctrl_b_files":"ctrl+b dateien","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h verlauf","enter_open":"enter öffnen","backspace_up":"backspace hoch","ctrl_b_close":"ctrl+b schließen","enter_jump":"enter springen","r_refresh":"r aktualisieren","ctrl_g_close":"ctrl+g schließen","ctrl_h_close":"ctrl+h schließen","i_insert":"i einfügen","o_open_line":"o zeile öffnen","cc_line":"cc zeile","cw_word":"cw wort","ce_word_end":"ce wortende","c0_start":"c0 anfang","c_end":"c$ ende","dd_line":"dd zeile","dw_word":"dw wort","de_word_end":"de wortende","d0_start":"d0 anfang","d_end":"d$ ende","yy_line":"yy zeile","yw_word":"yw wort","ye_word_end":"ye wortende","y0_start":"y0 anfang","y_end":"y$ ende","gg_top":"gg oben","esc_cancel":"esc abbrechen"}}};

export const es: TranslationSchema = {"footer":{"mode":{"browse":"explorar","insert":"insertar","normal":"normal","preview":"vista previa","settings":"ajustes","files":"archivos","graft":"graft","history":"historial"},"context":{"settings":"ajustes","graft_empty":"abre un archivo para inspeccionarlo","history_empty":"sin evidencia Echo todavía"},"hints":{"j_k_move":"j/k mover","enter_change":"enter cambiar","f2_close":"f2 cerrar","esc_close":"esc cerrar","j_k_scroll":"j/k desplazar","f3_source":"f3 fuente","f3_preview":"f3 vista previa","text_input":"texto","esc_normal":"esc normal","ctrl_s_save":"ctrl+s guardar","ctrl_t_theme":"ctrl+t tema","tab_focus":"tab foco","tab_indent":"tab sangría","ctrl_l_scene_picker":"ctrl+l escena","scene_picker":"selector de escena","ctrl_b_files":"ctrl+b archivos","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h historial","enter_open":"enter abrir","backspace_up":"backspace arriba","ctrl_b_close":"ctrl+b cerrar","enter_jump":"enter saltar","r_refresh":"r actualizar","ctrl_g_close":"ctrl+g cerrar","ctrl_h_close":"ctrl+h cerrar","i_insert":"i insertar","o_open_line":"o abrir línea","cc_line":"cc línea","cw_word":"cw palabra","ce_word_end":"ce fin palabra","c0_start":"c0 inicio","c_end":"c$ fin","dd_line":"dd línea","dw_word":"dw palabra","de_word_end":"de fin palabra","d0_start":"d0 inicio","d_end":"d$ fin","yy_line":"yy línea","yw_word":"yw palabra","ye_word_end":"ye fin palabra","y0_start":"y0 inicio","y_end":"y$ fin","gg_top":"gg arriba","esc_cancel":"esc cancelar"}}};

export const ko: TranslationSchema = {"footer":{"mode":{"browse":"탐색","insert":"삽입","normal":"일반","preview":"미리보기","settings":"설정","files":"파일","graft":"Graft","history":"기록"},"context":{"settings":"설정","graft_empty":"검사할 파일을 여세요","history_empty":"아직 Echo 증거 없음"},"hints":{"j_k_move":"j/k 이동","enter_change":"enter 변경","f2_close":"f2 닫기","esc_close":"esc 닫기","j_k_scroll":"j/k 스크롤","f3_source":"f3 소스","f3_preview":"f3 미리보기","text_input":"텍스트 입력","esc_normal":"esc 일반","ctrl_s_save":"ctrl+s 저장","ctrl_t_theme":"ctrl+t 테마","tab_focus":"tab 포커스","tab_indent":"tab 들여쓰기","ctrl_l_scene_picker":"ctrl+l 장면","scene_picker":"장면 선택","ctrl_b_files":"ctrl+b 파일","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h 기록","enter_open":"enter 열기","backspace_up":"backspace 위로","ctrl_b_close":"ctrl+b 닫기","enter_jump":"enter 이동","r_refresh":"r 새로고침","ctrl_g_close":"ctrl+g 닫기","ctrl_h_close":"ctrl+h 닫기","i_insert":"i 삽입","o_open_line":"o 줄 열기","cc_line":"cc 줄","cw_word":"cw 단어","ce_word_end":"ce 단어 끝","c0_start":"c0 시작","c_end":"c$ 끝","dd_line":"dd 줄","dw_word":"dw 단어","de_word_end":"de 단어 끝","d0_start":"d0 시작","d_end":"d$ 끝","yy_line":"yy 줄","yw_word":"yw 단어","ye_word_end":"ye 단어 끝","y0_start":"y0 시작","y_end":"y$ 끝","gg_top":"gg 맨 위","esc_cancel":"esc 취소"}}};

export const ja: TranslationSchema = {"footer":{"mode":{"browse":"参照","insert":"挿入","normal":"通常","preview":"プレビュー","settings":"設定","files":"ファイル","graft":"Graft","history":"履歴"},"context":{"settings":"設定","graft_empty":"検査するファイルを開く","history_empty":"Echo 証拠はまだありません"},"hints":{"j_k_move":"j/k 移動","enter_change":"enter 変更","f2_close":"f2 閉じる","esc_close":"esc 閉じる","j_k_scroll":"j/k スクロール","f3_source":"f3 ソース","f3_preview":"f3 プレビュー","text_input":"テキスト入力","esc_normal":"esc 通常","ctrl_s_save":"ctrl+s 保存","ctrl_t_theme":"ctrl+t テーマ","tab_focus":"tab フォーカス","tab_indent":"tab インデント","ctrl_l_scene_picker":"ctrl+l シーン","scene_picker":"シーン選択","ctrl_b_files":"ctrl+b ファイル","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h 履歴","enter_open":"enter 開く","backspace_up":"backspace 上へ","ctrl_b_close":"ctrl+b 閉じる","enter_jump":"enter 移動","r_refresh":"r 更新","ctrl_g_close":"ctrl+g 閉じる","ctrl_h_close":"ctrl+h 閉じる","i_insert":"i 挿入","o_open_line":"o 行を開く","cc_line":"cc 行","cw_word":"cw 単語","ce_word_end":"ce 単語末","c0_start":"c0 先頭","c_end":"c$ 末尾","dd_line":"dd 行","dw_word":"dw 単語","de_word_end":"de 単語末","d0_start":"d0 先頭","d_end":"d$ 末尾","yy_line":"yy 行","yw_word":"yw 単語","ye_word_end":"ye 単語末","y0_start":"y0 先頭","y_end":"y$ 末尾","gg_top":"gg 先頭","esc_cancel":"esc 取消"}}};

export const zhHans: TranslationSchema = {"footer":{"mode":{"browse":"浏览","insert":"插入","normal":"普通","preview":"预览","settings":"设置","files":"文件","graft":"Graft","history":"历史"},"context":{"settings":"设置","graft_empty":"打开文件以检查","history_empty":"还没有 Echo 证据"},"hints":{"j_k_move":"j/k 移动","enter_change":"enter 更改","f2_close":"f2 关闭","esc_close":"esc 关闭","j_k_scroll":"j/k 滚动","f3_source":"f3 源码","f3_preview":"f3 预览","text_input":"文本输入","esc_normal":"esc 普通","ctrl_s_save":"ctrl+s 保存","ctrl_t_theme":"ctrl+t 主题","tab_focus":"tab 焦点","tab_indent":"tab 缩进","ctrl_l_scene_picker":"ctrl+l 场景","scene_picker":"场景选择","ctrl_b_files":"ctrl+b 文件","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h 历史","enter_open":"enter 打开","backspace_up":"backspace 上一级","ctrl_b_close":"ctrl+b 关闭","enter_jump":"enter 跳转","r_refresh":"r 刷新","ctrl_g_close":"ctrl+g 关闭","ctrl_h_close":"ctrl+h 关闭","i_insert":"i 插入","o_open_line":"o 打开行","cc_line":"cc 行","cw_word":"cw 词","ce_word_end":"ce 词尾","c0_start":"c0 开头","c_end":"c$ 结尾","dd_line":"dd 行","dw_word":"dw 词","de_word_end":"de 词尾","d0_start":"d0 开头","d_end":"d$ 结尾","yy_line":"yy 行","yw_word":"yw 词","ye_word_end":"ye 词尾","y0_start":"y0 开头","y_end":"y$ 结尾","gg_top":"gg 顶部","esc_cancel":"esc 取消"}}};

export const ptBR: TranslationSchema = {"footer":{"mode":{"browse":"navegar","insert":"inserir","normal":"normal","preview":"prévia","settings":"configurações","files":"arquivos","graft":"graft","history":"histórico"},"context":{"settings":"configurações","graft_empty":"abra um arquivo para inspecionar","history_empty":"nenhuma evidência Echo ainda"},"hints":{"j_k_move":"j/k mover","enter_change":"enter alterar","f2_close":"f2 fechar","esc_close":"esc fechar","j_k_scroll":"j/k rolar","f3_source":"f3 código","f3_preview":"f3 prévia","text_input":"entrada de texto","esc_normal":"esc normal","ctrl_s_save":"ctrl+s salvar","ctrl_t_theme":"ctrl+t tema","tab_focus":"tab foco","tab_indent":"tab recuo","ctrl_l_scene_picker":"ctrl+l cena","scene_picker":"seletor de cena","ctrl_b_files":"ctrl+b arquivos","ctrl_g_graft":"ctrl+g graft","ctrl_h_history":"ctrl+h histórico","enter_open":"enter abrir","backspace_up":"backspace subir","ctrl_b_close":"ctrl+b fechar","enter_jump":"enter ir","r_refresh":"r atualizar","ctrl_g_close":"ctrl+g fechar","ctrl_h_close":"ctrl+h fechar","i_insert":"i inserir","o_open_line":"o abrir linha","cc_line":"cc linha","cw_word":"cw palavra","ce_word_end":"ce fim palavra","c0_start":"c0 início","c_end":"c$ fim","dd_line":"dd linha","dw_word":"dw palavra","de_word_end":"de fim palavra","d0_start":"d0 início","d_end":"d$ fim","yy_line":"yy linha","yw_word":"yw palavra","ye_word_end":"ye fim palavra","y0_start":"y0 início","y_end":"y$ fim","gg_top":"gg topo","esc_cancel":"esc cancelar"}}};

export const me: TranslationSchema = {"footer":{"mode":{"browse":"esworb","insert":"tresni","normal":"lamron","preview":"weiverp","settings":"sgnittes","files":"selif","graft":"tfarg","history":"yrotsih"},"context":{"settings":"sgnittes","graft_empty":"ti tcepsni ot elif a nepo","history_empty":"tey ecnedive ohcE on"},"hints":{"j_k_move":"evom k/j","enter_change":"egnahc retne","f2_close":"esolc 2f","esc_close":"esolc cse","j_k_scroll":"llorcs k/j","f3_source":"ecruos 3f","f3_preview":"weiverp 3f","text_input":"tupni txet","esc_normal":"lamron cse","ctrl_s_save":"evas s+lrtc","ctrl_t_theme":"emeht t+lrtc","tab_focus":"sucof bat","tab_indent":"tnedni bat","ctrl_l_scene_picker":"rekcip enecs l+lrtc","scene_picker":"rekcip enecs","ctrl_b_files":"selif b+lrtc","ctrl_g_graft":"tfarg g+lrtc","ctrl_h_history":"yrotsih h+lrtc","enter_open":"nepo retne","backspace_up":"pu ecapskcab","ctrl_b_close":"esolc b+lrtc","enter_jump":"pmuj retne","r_refresh":"hserfer r","ctrl_g_close":"esolc g+lrtc","ctrl_h_close":"esolc h+lrtc","i_insert":"tresni i","o_open_line":"enil nepo o","cc_line":"enil cc","cw_word":"drow wc","ce_word_end":"dne-drow ec","c0_start":"trats 0c","c_end":"dne $c","dd_line":"enil dd","dw_word":"drow wd","de_word_end":"dne-drow ed","d0_start":"trats 0d","d_end":"dne $d","yy_line":"enil yy","yw_word":"drow wy","ye_word_end":"dne-drow ey","y0_start":"trats 0y","y_end":"dne $y","gg_top":"pot gg","esc_cancel":"lecnac cse"}}};

export const locales = ["en", "fr", "it", "de", "es", "ko", "ja", "zh-Hans", "pt-BR", "me"] as const;

export type Locale = typeof locales[number];

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { label: "English", direction: "ltr" },
  fr: { label: "Français", direction: "ltr" },
  it: { label: "Italiano", direction: "ltr" },
  de: { label: "Deutsch", direction: "ltr" },
  es: { label: "Español", direction: "ltr" },
  ko: { label: "한국어", direction: "ltr" },
  ja: { label: "日本語", direction: "ltr" },
  "zh-Hans": { label: "简体中文", direction: "ltr" },
  "pt-BR": { label: "Português (Brasil)", direction: "ltr" },
  me: { label: "Mirror English", direction: "rtl" },
};

export const catalogs: Record<Locale, TranslationSchema> = {
  en: en,
  fr: fr,
  it: it,
  de: de,
  es: es,
  ko: ko,
  ja: ja,
  "zh-Hans": zhHans,
  "pt-BR": ptBR,
  me: me,
};
