import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { importDist, mockRuntime } from './workspace-helpers.mjs';
async function setup(overrides={}) {
 const {createWorkspaceRuntime}=await importDist('app','workspace','runtime.js');
 const {availableJeditThemes}=await importDist('ui','jedit-themes.js');
 const {BijouI18nAdapter}=await importDist('adapters','bijou-i18n-adapter.js');
 const deps=mockRuntime();deps.initialModel.jeditTheme=availableJeditThemes()[0];deps.initialModel.i18n=new BijouI18nAdapter();
 const runtime=createWorkspaceRuntime(deps);
 return {runtime,model:{...runtime.init()[0],startupIntroComplete:true,...overrides}};
}
test('All layouts use bold filled mode, muted ordinary footer text and normal emphasis',async()=>{
 const {JEDIT_SOURCE_TOKEN}=await importDist('ui','jedit-theme.js');
 for(const footerLayout of ['focused','per-pane','compact']) {
  const {runtime,model}=await setup({footerLayout,fileDrawerOpen:true,fileDrawerProgress:1,focusPane:'files',entries:[]});
  const surface=runtime.view(model);const y=model.rows-(footerLayout==='compact'?1:2);const mode=surface.get(0,y);
  assert.ok(mode.modifiers?.includes('bold'));assert.equal(mode.bg,model.jeditTheme.cursor.normal.bg);
  assert.equal(mode.fg,model.jeditTheme.surface.workspace.bg);
  assert.equal(surface.get(16,y).fg,model.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Comment).fg);
 }
});
test('Filepaths setting changes displayed paths, persists and preserves native identities',async()=>{
 const {settingsRows}=await importDist('app','workspace','settings.js');
 const {workspaceFooterPresentation}=await importDist('ui','workspace-footer-presentation.js');
 const {model,runtime}=await setup({gitRoot:'/repo',filepathStyle:'git-root',cwd:'/repo/src'});
 assert.equal(workspaceFooterPresentation(model).focused.identity,'src');
 const index=settingsRows(model).findIndex(row=>row.id==='filepaths');assert.ok(index>=0);
 const next=runtime.update({type:'key',key:'right'},{...model,settingsOpen:true,settingsFocusIndex:index})[0];
 assert.equal(next.filepathStyle,'absolute');assert.equal(next.cwd,model.cwd);assert.equal(next.textAuthority,model.textAuthority);
 assert.equal(workspaceFooterPresentation({...next,settingsOpen:false}).focused.identity,'/repo/src');
 const outside={...model,cwd:'/other/src'};assert.equal(workspaceFooterPresentation(outside).focused.identity,'/other/src');
 assert.equal(workspaceFooterPresentation({...model,gitRoot:undefined}).focused.identity,'/repo/src');
});
test('Filepath preference survives restart independently of layout with raw JSON preserved',async()=>{
 const {createFooterPreferences}=await importDist('adapters','footer-preferences.js');
 const path=join(mkdtempSync(join(tmpdir(),'jim-paths-')),'.jimrc');
 const original='{"footerLayout":"compact","counter":9007199254740993123,"leader":" "}\n';writeFileSync(path,original);
 const port=createFooterPreferences(path);assert.equal(port.loadFilepaths(),'git-root');assert.deepEqual(port.saveFilepaths('absolute'),{ok:true});
 assert.equal(createFooterPreferences(path).loadFilepaths(),'absolute');assert.equal(port.load(),'compact');
 assert.ok(readFileSync(path,'utf8').includes('9007199254740993123'));
 writeFileSync(path,'{bad');assert.equal(port.saveFilepaths('git-root').ok,false);assert.equal(readFileSync(path,'utf8'),'{bad');
});
test('Git root discovery resolves nested checkout and linked worktree roots and has no-repo fallback',async()=>{
 const {discoverGitRoot}=await importDist('adapters','footer-filepaths.js');
 const root=mkdtempSync(join(tmpdir(),'jim-git-root-'));execFileSync('git',['init',root],{stdio:'ignore'});
 const {mkdirSync,realpathSync}=await import('node:fs');mkdirSync(join(root,'src'));assert.equal(discoverGitRoot(join(root,'src')),realpathSync(root));
 execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture'],{stdio:'ignore'});
 const worktree=join(mkdtempSync(join(tmpdir(),'jim-linked-root-')),'checkout');
 execFileSync('git',['-C',root,'worktree','add','-b','witness',worktree],{stdio:'ignore'});
 mkdirSync(join(worktree,'nested'));assert.equal(discoverGitRoot(join(worktree,'nested')),realpathSync(worktree));
 assert.equal(discoverGitRoot(tmpdir()),undefined);
});
test('Explorer opens a temporary footer filter, retains a header indicator, and clears without changing text authority',async()=>{
 const {runtime,model}=await setup({columns:100,rows:24,fileDrawerOpen:true,fileDrawerProgress:1,focusPane:'files',
  entries:[{kind:'file',name:'alpha.ts',path:'/repo/alpha.ts'},{kind:'file',name:'beta.ts',path:'/repo/beta.ts'}]});
 const text=surface=>Array.from({length:surface.height},(_,y)=>Array.from({length:surface.width},(_,x)=>surface.get(x,y).char).join('')).join('\n');
 let next=runtime.update({type:'key',key:'/'},model)[0];next=runtime.update({type:'key',key:'a'},next)[0];
 const active=text(runtime.view(next)).split('\n');assert.match(active[22],/\/a/);assert.doesNotMatch(active[3],/Search:/);
 next=runtime.update({type:'key',key:'escape'},next)[0];assert.equal(next.fileSearchEditing,false);assert.equal(next.fileSearch.input,'a');
 assert.match(text(runtime.view(next)).split('\n')[3],/filter: a/i);
 next=runtime.update({type:'key',key:'/'},next)[0];next=runtime.update({type:'key',key:'u',ctrl:true},next)[0];next=runtime.update({type:'key',key:'enter'},next)[0];
 assert.equal(next.fileSearch.input,'');assert.equal(next.textAuthority,model.textAuthority);
 const {workspaceFooterRows}=await importDist('app','workspace','viewport.js');
 next=runtime.update({type:'key',key:'/'},{...next,footerVisible:false})[0];assert.equal(workspaceFooterRows(next),1);
 assert.match(text(runtime.view(next)).split('\n').at(-1),/\//);
 next=runtime.update({type:'key',key:'escape'},next)[0];assert.equal(workspaceFooterRows(next),0);
});
test('Mode badges meet contrast in every built-in theme and nonzero counts use normal foreground',async()=>{
 const {availableJeditThemes,oppositeJeditTheme}=await importDist('ui','jedit-themes.js');
 const {contrastRatio}=await importDist('ui','theme-contrast.js');
 const {runtime,model}=await setup({editor:{path:'/repo/main.ts',lines:['x'],mode:'normal',cursorRow:0,cursorCol:0,scrollRow:0,scrollCol:0,dirty:true,readOnly:false}});
 for(const theme of availableJeditThemes().flatMap(t=>[t,oppositeJeditTheme(t)])) {
  const surface=runtime.view({...model,jeditTheme:theme});const mode=surface.get(0,model.rows-2);
  assert.ok(contrastRatio(mode.fgRGB,mode.bgRGB)>=4.45,theme.name);
  const row=Array.from({length:model.columns},(_,x)=>surface.get(x,model.rows-1).char).join('');const count=row.indexOf('1 modified');
  assert.ok(count>=0);assert.equal(surface.get(count,model.rows-1).fg,theme.surface.footer.fg);
  assert.notEqual(surface.get(count,model.rows-1).fg,surface.get(0,model.rows-1).fg);
 }
});
test('Footer clicks place the filter caret using display cells and skip the global status area',async()=>{
 const {runtime,model}=await setup({columns:60,rows:16,footerLayout:'compact',fileDrawerOpen:true,fileDrawerProgress:1,focusPane:'files',fileSearchEditing:true,
 fileSearch:{input:'界x',cursorIndex:2}});
 const next=runtime.update({type:'mouse',action:'press',button:'left',col:3,row:15},model)[0];assert.equal(next.fileSearch.cursorIndex,1);
 const global=runtime.update({type:'mouse',action:'press',button:'left',col:59,row:15},next)[0];assert.equal(global.fileSearch.cursorIndex,1);
});

test('Rejected filepath saves retain the previous choice and show an error',async()=>{
 const {workspaceSettingsHandlers}=await importDist('app','workspace','settings.js');
 const {model}=await setup();const handlers=workspaceSettingsHandlers({footerPreferences:{saveFilepaths:()=>({ok:false})},
 nowMs:()=>100,createNotificationTickCmd:()=>()=>undefined});
 const [next,commands]=handlers.cycleFilepaths(model);assert.equal(next.filepathStyle,model.filepathStyle);
 assert.match(JSON.stringify(next.notifications),/Could not save/);assert.ok(commands.length>0);
});
