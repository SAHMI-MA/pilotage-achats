import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {createRequire} from "node:module";
import {mkdir,readFile,readdir} from "node:fs/promises";
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve("wrangler/package.json"))("esbuild");
const output=".sites-runtime/workbook-tests";
await mkdir(output,{recursive:true});
const mock={name:"test-platform",setup(b){
 b.onResolve({filter:/^@\/db$/},()=>({path:"db",namespace:"test"}));
 b.onResolve({filter:/^@\/app\/chatgpt-auth$/},()=>({path:"auth",namespace:"test"}));
 b.onLoad({filter:/.*/,namespace:"test"},({path})=>({contents:path==="db"?"export const getDb=()=>globalThis.workbookTestDb":"export const getChatGPTUser=async()=>globalThis.workbookTestUser",loader:"js"}));
}};
await build({stdin:{contents:'export * from "./db/imports/tableau-2026-11-05"; export * from "./lib/project"; export * from "./lib/seed";',resolveDir:process.cwd()},outfile:`${output}/logic.mjs`,bundle:true,platform:"node",format:"esm",plugins:[mock]});
await build({entryPoints:["app/api/projects/route.ts"],outfile:`${output}/api.mjs`,bundle:true,platform:"node",format:"esm",plugins:[mock]});
const {ensureWorkbookImported,planWorkbookImport,seedProjects,blankProject,newSupplier,recordFollowup}=await import(`../${output}/logic.mjs`);
const api=await import(`../${output}/api.mjs`);
const snapshot=JSON.parse(await readFile("db/imports/tableau-2026-11-05.json","utf8"));
const migrations=await Promise.all((await readdir("drizzle")).filter(n=>/^\d+.*\.sql$/.test(n)).sort().map(n=>readFile(`drizzle/${n}`,"utf8")));
const owner={userId:"platform-site-owner-id",email:snapshot.ownerEmail,displayName:"Propriétaire",fullName:null};
const at="2026-10-27T10:00:00.000Z";
function fixture(){
 const sql=new DatabaseSync(":memory:");for(const migration of migrations)sql.exec(migration);
 const save=p=>sql.prepare("INSERT OR REPLACE INTO projects (id,payload,revision,updated_at) VALUES (?,?,?,?)").run(p.id,JSON.stringify(p),p.revision,p.updatedAt);
 const rows=()=>sql.prepare("SELECT id,payload,revision,updated_at FROM projects ORDER BY id").all().map(r=>({...r}));
 const get=id=>JSON.parse(sql.prepare("SELECT payload FROM projects WHERE id=?").get(id).payload);
 const seeds=structuredClone(seedProjects);
 const first=seeds.find(p=>p.id==="rfx-71001");
 Object.assign(first,{revision:28,updatedAt:at,finalAmount:111111,technicalReceived:true,technicalDue:"2026-11-20",offerReminderEnabled:false,participationReminderEnabled:false,technicalReminderEnabled:false,actionReminderEnabled:false,offerReminderDate:"2026-12-03",participationReminderDate:"2026-12-02",nextAction:"Mon action existante",actionDue:"2026-12-01"});
 first.projectNotes=[{id:"note-existing",text:"Note saisie dans l’application"}];first.notes=first.projectNotes[0].text;
 Object.assign(first.suppliers[0],{active:false,contact:"Contact conservé",offerReceived:true,offers:[99999,null,null],points:[{id:"point-existing",at,text:"Point immuable"}]});
 first.suppliers[1].name="Prestataire Démo 65";
 first.suppliers.push({...newSupplier("Prestataire hors fichier"),id:"supplier-preserved"});
 first.followups=recordFollowup(first,{targetType:"supplier",supplierId:first.suppliers[0].id,targetName:first.suppliers[0].name,reason:"other",sentAt:at,note:"Relance indépendante",reminderEnabled:false});
 const water=seeds.find(p=>p.id==="rfx-71003");water.revision=22;water.suppliers[0].name="Prestataire Démo 64";
 seeds.find(p=>p.id==="rfx-71002").revision=25;seeds.find(p=>p.id==="site-demo-04").revision=8;
 for(const p of seeds)save(p);
 save({...blankProject(),id:"unrelated-1",rfx:"",title:"installation bornes",company:"societe-demo",budget:50000,finalAmount:60000,revision:1,updatedAt:at,history:[]});
 save({...blankProject(),id:"unrelated-2",rfx:"151515",title:"Exemple de projet",revision:4,updatedAt:at,history:[{id:"comment",at,author:"User",text:"À conserver",kind:"comment"}]});
 const wrap=(query,args=[])=>({bind(...values){return wrap(query,values)},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}},async first(){return sql.prepare(query).get(...args)??null},async all(){return {results:sql.prepare(query).all(...args)}}});
 const db={beforeBatch:null,failIndex:null,prepare:wrap,async batch(statements){
  const hook=db.beforeBatch;db.beforeBatch=null;if(hook)hook();
  sql.exec("BEGIN");try{const out=[];for(const [index,statement] of statements.entries()){if(index===db.failIndex)throw new Error("Injected database failure");out.push(await statement.run());}sql.exec("COMMIT");return out;}
  catch(error){sql.exec("ROLLBACK");throw error;}
 }};
 return {sql,db,save,rows,get};
}

let f=fixture();const before=f.rows();
assert.equal(await ensureWorkbookImported(f.db,null),null);
assert.equal(await ensureWorkbookImported(f.db,{...owner,email:"another@example.test"}),null);
assert.equal(await ensureWorkbookImported(f.db,{...owner,userId:""}),null);
assert.deepEqual(f.rows(),before);
globalThis.workbookTestDb=f.db;globalThis.workbookTestUser=null;
assert.equal((await api.GET()).status,401);
assert.equal(f.sql.prepare("SELECT count(*) n FROM project_imports").get().n,0);
globalThis.workbookTestUser=owner;
const response=await api.GET();assert.equal(response.status,200);
const {projects,workbookImport:summary}=await response.json();
assert.equal(projects.length,19);
assert.deepEqual([summary.imported,summary.created,summary.updated,summary.preserved,summary.total],[17,13,4,2,19]);
assert.equal(summary.warnings.length,3);assert.equal(summary.ignoredFormulaZeros,15);
assert.equal(summary.projects.reduce((n,p)=>n+(f.get(p.id).budget??0),0),2704617);
for(const row of before.filter(r=>r.id.startsWith("unrelated")))assert.deepEqual(f.rows().find(r=>r.id===row.id),row);
for(const row of before.filter(r=>!r.id.startsWith("unrelated"))){
 const previous=JSON.parse(row.payload),current=f.get(row.id);
 assert.equal(current.revision,previous.revision+1);
 assert.deepEqual(current.history.slice(0,previous.history.length),previous.history);
 assert.deepEqual(current.followups,previous.followups);
 for(const s of previous.suppliers){const next=current.suppliers.find(n=>n.id===s.id);assert.ok(next);assert.equal(next.active,s.active);assert.equal(next.contact,s.contact);assert.equal(next.offerReceived,s.offerReceived);assert.deepEqual(next.points,s.points);assert.deepEqual(next.offers,s.offers);}
 for(const key of ["offerReminderEnabled","participationReminderEnabled","technicalReminderEnabled","actionReminderEnabled","offerReminderDate","participationReminderDate","technicalDue","technicalReceived","nextAction","actionDue","closedDate"])assert.deepEqual(current[key],previous[key]);
 for(const note of previous.projectNotes)assert.ok(current.projectNotes.some(n=>n.id===note.id&&n.text===note.text));
}
assert.equal(f.get("rfx-71001").finalAmount,111111);
assert.equal(f.get("rfx-71001").suppliers.length,6);
assert.equal(f.get("rfx-71003").suppliers.length,3);
assert.equal(f.get("site-demo-04").rfx,"071004");
for(const imported of snapshot.projects){
 const result=summary.projects.find(p=>p.row===imported.row),saved=f.get(result.id);
 assert.equal(saved.stage,imported.fields.stage);
 if(imported.note)assert.ok(saved.projectNotes.some(n=>n.text===imported.note));
}
const closed=f.get(summary.projects.find(p=>p.row===9).id);
assert.equal(closed.finalAmount,76550);assert.equal(closed.stage,"closed");assert.equal(closed.awarded,"");assert.equal(closed.closedDate,"");
const missingFinal=f.get(summary.projects.find(p=>p.row===11).id);assert.equal(missingFinal.finalAmount,null);
assert.equal(missingFinal.cpsDate,"2028-09-24");
const record=f.sql.prepare("SELECT * FROM project_imports").get();
assert.deepEqual(JSON.parse(record.backup_payload),before);assert.equal(record.source_hash,snapshot.sourceHash);
// Reopening must never overwrite changes made after the import.
const after=JSON.stringify(f.rows());assert.deepEqual(await ensureWorkbookImported(f.db,owner),summary);assert.equal(JSON.stringify(f.rows()),after);
const edited=f.get("rfx-71001");edited.title="Modifié après import";edited.revision++;f.save(edited);
await ensureWorkbookImported(f.db,owner);assert.equal(f.get(edited.id).title,edited.title);
assert.equal(f.sql.prepare("SELECT count(*) n FROM project_imports").get().n,1);
console.log("Import fictif : 17 lignes, 13 créations, 4 mises à jour, 2 projets préservés, sauvegarde intégrale et réouverture idempotente.");

// Concurrent edit AND creation: abort the stale plan and merge fresh data.
f=fixture();f.db.beforeBatch=()=>{
 const p=f.get("rfx-71003");p.projectNotes.push({id:"concurrent-note",text:"Ajout pendant l’import"});p.revision++;f.save(p);
 f.save({...blankProject(),id:"concurrent-project",title:"Créé pendant l’import",revision:1,updatedAt:at,history:[]});
};
const raced=await ensureWorkbookImported(f.db,owner);
assert.equal(raced.total,20);assert.equal(raced.preserved,3);
assert.ok(f.get("rfx-71003").projectNotes.some(n=>n.id==="concurrent-note"));
assert.equal(f.get("rfx-71003").revision,24);
assert.equal(JSON.parse(f.sql.prepare("SELECT backup_payload FROM project_imports").get().backup_payload).length,7);

// Two callers racing for the same checkpoint: second returns the first result.
f=fixture();const both=await Promise.all([ensureWorkbookImported(f.db,owner),ensureWorkbookImported(f.db,owner)]);
assert.deepEqual(both[0],both[1]);assert.equal(f.rows().length,19);
assert.equal(f.get("rfx-71001").revision,29);

// Mid-batch write failure rolls back projects, backup, and checkpoint together.
f=fixture();const pristine=f.rows();f.db.failIndex=4;
await assert.rejects(()=>ensureWorkbookImported(f.db,owner),/Injected database failure/);
assert.deepEqual(f.rows(),pristine);assert.equal(f.sql.prepare("SELECT count(*) n FROM project_imports").get().n,0);
f.db.failIndex=null;await ensureWorkbookImported(f.db,owner);assert.equal(f.rows().length,19);

// Duplicate project identities must block rather than overwrite either record.
f=fixture();const duplicate={...f.get("rfx-71001"),id:"duplicate-rfx",rfx:"071001"};f.save(duplicate);
assert.throws(()=>planWorkbookImport(f.rows(),"Test"),/plusieurs projets/);
assert.equal(f.sql.prepare("SELECT count(*) n FROM project_imports").get().n,0);
console.log("Accès propriétaire, identité RFX/fournisseur, écritures simultanées et retour arrière transactionnel vérifiés.");
