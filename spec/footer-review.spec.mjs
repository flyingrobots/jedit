import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, symlinkSync, lstatSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importDist, mockRuntime } from './workspace-helpers.mjs';
async function setup(overrides={}) {
 const {createWorkspaceRuntime}=await importDist('app','workspace','runtime.js');
 const {BijouI18nAdapter}=await importDist('adapters','bijou-i18n-adapter.js');
 const {availableJeditThemes}=await importDist('ui','jedit-themes.js');
 const deps=mockRuntime();deps.initialModel.i18n=new BijouI18nAdapter();deps.initialModel.jeditTheme=availableJeditThemes()[0];
 const runtime=createWorkspaceRuntime(deps);return {runtime,model:{...runtime.init()[0],...overrides}};
}
const line=(surface,y)=>Array.from({length:surface.width},(_,x)=>surface.get(x,y).char).join('');
test('RTL footer layouts align local identity logically and preserve literal paths',async()=>{
 const {runtime,model}=await setup({columns:100,rows:24});
 for(const footerLayout of ['focused','per-pane','compact']) {
  const rtl={...model,footerLayout,i18n:model.i18n.withLocale('ar')};const surface=runtime.view(rtl);
  const row=rtl.rows-(footerLayout==='compact'?1:2);const badge=Array.from({length:100},(_,x)=>x).find(x=>surface.get(x,row).bg===model.jeditTheme.cursor.normal.bg);
  assert.ok(badge>40,`${footerLayout}: badge ${badge}`);
  assert.ok(line(surface,row).trimEnd().endsWith('/repo'));
  if(footerLayout!=='compact')assert.ok(line(surface,23).trimEnd().endsWith('/repo'));
 }
});
test('Shrinking the source viewport keeps its bottom cursor visible and refreshes highlighting',async()=>{
 const editor={path:'/repo/main.ts',lines:Array.from({length:50},()=> 'line'),mode:'normal',dirty:false,readOnly:false,cursorRow:10,cursorCol:0,scrollRow:0,scrollCol:0};
 const {runtime,model}=await setup({columns:100,rows:16,footerLayout:'compact',editor,settingsOpen:true,settingsFocusIndex:4});
 const [next,commands]=runtime.update({type:'key',key:'right'},model);
 const {editorViewport}=await importDist('app','workspace','viewport.js');
 assert.ok(next.editor.cursorRow-next.editor.scrollRow<editorViewport(next).height);assert.equal(next.sourceHighlightLoading,true);assert.ok(commands.length>0);
});
test('A dangling jimrc link is preserved and an existing writer lock refuses a save',async()=>{
 const {createFooterPreferences}=await importDist('adapters','footer-preferences.js');
 const root=mkdtempSync(join(tmpdir(),'jim-prefs-review-'));const path=join(root,'.jimrc');symlinkSync(join(root,'missing'),path);
 assert.equal(createFooterPreferences(path).save('compact').ok,false);assert.ok(lstatSync(path).isSymbolicLink());
 unlinkSync(path);writeFileSync(path,'{"leader":" "}');writeFileSync(`${path}.lock`,'held');
 assert.equal(createFooterPreferences(path).save('compact').ok,false);assert.equal(readFileSync(path,'utf8'),'{"leader":" "}');
 unlinkSync(`${path}.lock`);assert.equal(createFooterPreferences(path).save('compact').ok,true);
});
test('Filename clipping never keeps part of a grapheme cluster',async()=>{
 const {clipFooterIdentity}=await importDist('ui','footer-layout-view.js');
 assert.equal(clipFooterIdentity('ABe\u0301Z',2),'…Z');assert.equal(clipFooterIdentity('AB👩‍💻Z',3),'…Z');
});
