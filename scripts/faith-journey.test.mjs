import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function migrationHarness() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_initial.sql','0002_chat_conversations.sql','0003_calendar.sql','0004_reminder_repeat.sql']) {
    database.exec(readFileSync(new URL(`../src-tauri/migrations/${file}`, import.meta.url),'utf8'));
  }
  database.prepare("INSERT INTO notes(title,content) VALUES(?,?)").run('Existing note','Keep this exactly');
  database.prepare("INSERT INTO events(title,starts_at) VALUES(?,?)").run('Existing gathering','2030-06-10T09:00:00.000Z');
  database.exec(readFileSync(new URL('../src-tauri/migrations/0005_faith_journey.sql',import.meta.url),'utf8'));
  const params = values => Object.fromEntries(values.map((value,index)=>[`$${index+1}`,value]));
  const db = {
    select: async(sql,values=[])=>database.prepare(sql).all(params(values)),
    execute: async(sql,values=[])=>{const result=database.prepare(sql).run(params(values));return {rowsAffected:Number(result.changes),lastInsertId:Number(result.lastInsertRowid)}}
  };
  const exports={};
  const source=ts.transpileModule(readFileSync(new URL('../src/lib/faithJourney.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(source,{exports,Date,JSON,Error,Intl,require(id){if(id==='./db')return {getDatabase:async()=>db};if(id==='./calendarTime')return {dateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};if(id==='./bibleReferences')return {BIBLE_BOOK_NAMES:'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|')};throw Error(`Unexpected import: ${id}`)}});
  return {database,faith:exports};
}

test('additive migration preserves existing notes and calendar events',()=>{
  const {database}=migrationHarness();
  assert.equal(database.prepare('SELECT title FROM notes').get().title,'Existing note');
  assert.equal(database.prepare('SELECT content FROM notes').get().content,'Keep this exactly');
  assert.equal(database.prepare('SELECT title FROM events').get().title,'Existing gathering');
  assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='faith_goals'").get().name,'faith_goals');
  database.close();
});

test('reflection accepts partial answers and supports edit, reopen, and delete',async()=>{
  const {database,faith}=migrationHarness();
  const ref={book:43,chapter:3,verse:16,endVerse:16,translation:'ASV',label:'John 3:16'};
  const id=await faith.saveReflection(ref,{says:'',learn:'God loves the world.',apply:''});
  let saved=await faith.getReflection(id);
  assert.equal(saved.answer_says,'');assert.equal(saved.answer_learn,'God loves the world.');
  await faith.saveReflection(ref,{says:'A partial answer.',learn:'',apply:''},id);
  saved=await faith.getReflection(id);assert.equal(saved.answer_says,'A partial answer.');
  assert.equal((await faith.listReflections()).length,1);
  await faith.deleteReflection(id);assert.equal((await faith.getReflection(id)),null);
  await assert.rejects(()=>faith.saveReflection({...ref,book:67},{says:'',learn:'',apply:''}),/verified ASV reference/);
  await assert.rejects(()=>faith.saveReflection(ref,{says:'x'.repeat(10001),learn:'',apply:''}),/characters/);
  database.close();
});

test('goals support editing, pause, archive, check-in history, and safe deletion',async()=>{
  const {database,faith}=migrationHarness();
  const reflectionId=await faith.saveReflection({book:19,chapter:46,verse:10,endVerse:10,translation:'ASV',label:'Psalms 46:10'},{says:'',learn:'',apply:''});
  const id=await faith.saveGoal({title:'Read for five minutes',description:'Before breakfast',frequency:'weekdays',weekdays:[1,3,5],preferred_time:'08:15',reminder_enabled:1});
  await faith.saveGoal({title:'Read a little longer',description:'',frequency:'daily',weekdays:[],preferred_time:null,reminder_enabled:0},id);
  assert.equal((await faith.listGoals())[0].title,'Read a little longer');
  await faith.setGoalStatus(id,'paused');assert.equal((await faith.listGoals())[0].status,'paused');
  await faith.setGoalStatus(id,'active');
  await faith.addCheckin(id,reflectionId,'A quiet start.');
  const checkins=await faith.listCheckins(id);assert.equal(checkins.length,1);assert.equal(checkins[0].reflection_label,'Psalms 46:10');
  assert.equal(await faith.countCheckinsThisWeek(id),1);
  await faith.deleteReflection(reflectionId);assert.equal((await faith.listCheckins(id))[0].reflection_id,null);
  await faith.setGoalStatus(id,'archived');assert.equal((await faith.listGoals()).length,0);assert.equal((await faith.listGoals(true))[0].status,'archived');
  await faith.deleteGoal(id);assert.equal((await faith.listCheckins(id)).length,0);
  await assert.rejects(()=>faith.saveGoal({title:'',description:'',frequency:'daily',weekdays:[],preferred_time:null,reminder_enabled:0}),/goal title/);
  await assert.rejects(()=>faith.saveGoal({title:'Prayer',description:'',frequency:'daily',weekdays:[],preferred_time:null,reminder_enabled:1}),/preferred time/);
  database.close();
});

test('reminders are opt-in, local-time based, and delivered once per local day',async()=>{
  const {database,faith}=migrationHarness();
  await faith.saveGoal({title:'Prayer',description:'',frequency:'daily',weekdays:[],preferred_time:'08:10',reminder_enabled:1});
  await faith.saveGoal({title:'Read',description:'',frequency:'daily',weekdays:[],preferred_time:'08:10',reminder_enabled:0});
  const dueDate=new Date(2030,5,10,8,9,45);
  assert.equal((await faith.dueFaithReminders(dueDate)).length,0);
  dueDate.setMinutes(10);
  assert.deepEqual(Array.from(await faith.dueFaithReminders(dueDate),goal=>goal.title),['Prayer']);
  assert.equal((await faith.dueFaithReminders(dueDate)).length,0);
  dueDate.setDate(dueDate.getDate()+1);
  assert.equal((await faith.dueFaithReminders(dueDate)).length,1);
  database.close();
});

test('reminder wall-clock scheduling follows DST and suppresses repeated fall-back minutes',async()=>{
  const previousTz=process.env.TZ;process.env.TZ='America/New_York';
  try{
    const {database,faith}=migrationHarness();
    await faith.saveGoal({title:'Morning reflection',description:'',frequency:'daily',weekdays:[],preferred_time:'03:00',reminder_enabled:1});
    assert.equal((await faith.dueFaithReminders(new Date('2026-03-08T06:59:00Z'))).length,0);
    assert.equal((await faith.dueFaithReminders(new Date('2026-03-08T07:00:00Z'))).length,1);
    await faith.saveGoal({title:'Prayer',description:'',frequency:'daily',weekdays:[],preferred_time:'01:30',reminder_enabled:1});
    assert.equal((await faith.dueFaithReminders(new Date('2026-11-01T05:30:00Z'))).length,1);
    assert.equal((await faith.dueFaithReminders(new Date('2026-11-01T06:30:00Z'))).length,0);
    database.close();
  }finally{if(previousTz===undefined)delete process.env.TZ;else process.env.TZ=previousTz}
});

test('ASV passage retrieval returns exact installed text and validates complete ranges',async()=>{
  const exports={};const selected=[];let omitLast=false;let installed=true;
  const verses=[{number:16,text:'For God so loved the world, that he gave his only begotten Son,'},{number:17,text:'For God sent not the Son into the world to judge the world;'}];
  const source=ts.transpileModule(readFileSync(new URL('../src/lib/scripture.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(source,{exports,Date,Error,Number,Promise,require(id){if(id==='@tauri-apps/api/core')return {invoke:async()=>({versions:[{id:'asv',installed}]})};if(id==='@tauri-apps/api/path')return {appDataDir:async()=>'/local',join:async(...parts)=>parts.join('/')};if(id==='./accessDatabase')return {__esModule:true,default:{load:async path=>{selected.push(path);return {select:async(_sql,args)=>{const rows=verses.filter(row=>row.number>=args[2]&&row.number<=args[3]);return omitLast?rows.slice(0,-1):rows}}}}};if(id==='./bibleReferences')return {BIBLE_BOOK_NAMES:Array.from({length:66},(_,i)=>i===42?'John':`Book ${i+1}`)};throw Error(`Unexpected import: ${id}`)}});
  installed=false;await assert.rejects(()=>exports.loadScripture({book:43,chapter:3,verse:16}),/not downloaded/);
  installed=true;
  const exact=await exports.loadScripture({book:43,chapter:3,verse:16,endVerse:17});
  assert.equal(exact.reference.label,'John 3:16–17');assert.equal(exact.verses[0].text,verses[0].text);assert.deepEqual(selected,['sqlite:/local/bibles/asv.sqlite']);
  omitLast=true;await assert.rejects(()=>exports.loadScripture({book:43,chapter:3,verse:16,endVerse:17}),/could not be verified/);
  await assert.rejects(()=>exports.loadScripture({book:43,chapter:3,verse:16,endVerse:50}),/up to 30 verses/);
  await assert.rejects(()=>exports.loadScripture({book:67,chapter:1,verse:1}),/valid passage/);
});

test('faith data layer keeps private answers local and separate from notes',()=>{
  const source=readFileSync(new URL('../src/lib/faithJourney.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/sendChat|fetch\(|invoke\(/);
  assert.match(source,/scripture_reflections/);assert.match(source,/faith_checkins/);
});

test('community suggestions prefill the existing private calendar editor',()=>{
  const faith=readFileSync(new URL('../src/pages/faith/FaithJourneyWindow.tsx',import.meta.url),'utf8');
  const calendar=readFileSync(new URL('../src/pages/notes/ChurchCalendarWindow.tsx',import.meta.url),'utf8');
  assert.match(faith,/near:\/\/calendar-prefill/);assert.match(faith,/near\.calendar\.prefill/);
  assert.match(calendar,/near:\/\/calendar-prefill/);assert.match(calendar,/saveEvent\(/);
  assert.doesNotMatch(faith,/fetch\(|sendChat\(|\bemail\b|\bmessage\(/i);
});
