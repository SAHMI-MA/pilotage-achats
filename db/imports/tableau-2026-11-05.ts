import type {Database} from "@/db";
// Server-only, owner-authorized import of the attached workbook. Never import
// this module into a client component or expose the before-import backup.
import snapshot from "./tableau-2026-11-05.json";
import type {ChatGPTUser} from "@/app/chatgpt-auth";
import {decode,type Row} from "@/db/projects";
import {blankProject,describeChanges,editableSchema,newSupplier,type Project,type Supplier} from "@/lib/project";

const key=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const rfxKey=(value:string)=>key(value).replace(/^0+(?=\d)/,"");
const legacyIds:Record<string,string>={"71001":"rfx-71001","71002":"rfx-71002","71003":"rfx-71003","71004":"site-demo-04"};
const supplierAliases=[
 ["Prestataire Démo 10","Prestataire Démo 64"],
 ["Prestataire Démo 65","Prestataire Démo 02"],
].map(group=>group.map(key));
const supplierKey=(name:string)=>supplierAliases.find(group=>group.includes(key(name)))?.[0]??key(name);
const identity=(p:{company?:string;site?:string;title?:string})=>[p.company,p.site,p.title].map(v=>key(v??"")).join("|");

export type WorkbookImportSummary={
 status:"applied";id:string;sourceName:string;sourceHash:string;appliedAt:string;
 imported:number;created:number;updated:number;unchanged:number;preserved:number;total:number;
 warnings:typeof snapshot.warnings;ignoredFormulaZeros:number;
 projects:{row:number;id:string;rfx:string;revision:number;action:"created"|"updated"|"unchanged"}[];
};

export function planWorkbookImport(rows:Row[],author:string,now=new Date().toISOString()){
 const existing=rows.map(decode),used=new Set<string>();
 const writes:{before:Row|null;after:Project}[]=[];
 const details:WorkbookImportSummary["projects"]=[];
 for(const entry of snapshot.projects){
  const fields=entry.fields;
  const rfx=rfxKey("rfx" in fields?fields.rfx??"":"");
  const legacyId=legacyIds[rfx];
  const matches=existing.filter(p=>(rfx&&rfxKey(p.rfx)===rfx)||(legacyId&&p.id===legacyId)||
   ((!rfx||!p.rfx)&&identity(p)===identity(fields)));
  if(matches.length>1)throw new Error(`Import ambigu à la ligne ${entry.row} : plusieurs projets correspondent.`);
  const before=matches[0]??null;
  if(before&&(used.has(before.id)||(legacyId===before.id&&before.rfx&&rfxKey(before.rfx)!==rfx)))
   throw new Error(`Import ambigu à la ligne ${entry.row} : identité du projet modifiée.`);
  if(before)used.add(before.id);
  const id=before?.id??`import-demo202611150001-row-${entry.row}`;
  if(!before&&existing.some(p=>p.id===id))throw new Error("Identifiant d’import déjà utilisé.");
  const next={...structuredClone(before??blankProject()),...fields};
  // Keep all existing dates/toggles for reminders. Workbook dates only
  // initialize new projects; recorded followups remain byte-for-byte intact.
  if(!before)Object.assign(next,entry.initialReminderDates);
  const usedSuppliers=new Set<string>();
  for(const [index,imported] of entry.suppliers.entries()){
   const exact=next.suppliers.filter(s=>key(s.name)===key(imported.name));
   const candidates=exact.length?exact:next.suppliers.filter(s=>supplierKey(s.name)===supplierKey(imported.name));
   if(candidates.length>1)throw new Error(`Fournisseur ambigu à la ligne ${entry.row} : ${imported.name}.`);
   let supplier=candidates[0];
   if(supplier&&usedSuppliers.has(supplier.id))throw new Error(`Fournisseur répété à la ligne ${entry.row}.`);
   if(!supplier){
    supplier={...newSupplier(imported.name),id:`xlsx-demo2026-row-${entry.row}-supplier-${index+1}`};
    next.suppliers.push(supplier);
   }
   usedSuppliers.add(supplier.id);
   supplier.name=imported.name;
   if("status" in imported&&imported.status)supplier.status=imported.status as Supplier["status"];
   imported.offers.forEach((offer,i)=>{if(offer!==null)supplier.offers[i]=offer;});
   // No inferred responses, award, closure date, or sent followups from prose.
  }
  if(entry.note&&!next.projectNotes.some(n=>n.text.trim()===entry.note.trim()))
   next.projectNotes.push({id:`xlsx-demo2026-row-${entry.row}-note`,text:entry.note});
  next.notes=next.projectNotes.map((n,i)=>`Note ${i+1} : ${n.text}`).join("\n\n");
  const validated=editableSchema.parse(next);
  const changes=before?describeChanges(before,validated):[];
  const changed=!before||Object.keys(validated).some(k=>JSON.stringify(before[k as keyof Project])!==JSON.stringify(validated[k as keyof typeof validated]));
  const after:Project={...next,...validated,id,revision:(before?.revision??0)+(changed?1:0),updatedAt:changed?now:before!.updatedAt,
   history:[...(before?.history??[]),...(changed?[{id:`xlsx-demo2026-row-${entry.row}`,at:now,author,kind:"import" as const,
    text:`Import du fichier « ${snapshot.sourceName} », feuille ${snapshot.sheet}, ligne ${entry.row}.\n${before?changes.join("\n"):"Projet ajouté depuis le tableau Excel."}`}]:[])]};
  if(changed)writes.push({before:before?rows.find(row=>row.id===id)!:null,after});
  details.push({row:entry.row,id,rfx:after.rfx,revision:after.revision,action:before?(changed?"updated":"unchanged"):"created"});
 }
 const count=(action:string)=>details.filter(p=>p.action===action).length;
 const summary:WorkbookImportSummary={status:"applied",id:snapshot.id,sourceName:snapshot.sourceName,sourceHash:snapshot.sourceHash,appliedAt:now,
  imported:details.length,created:count("created"),updated:count("updated"),unchanged:count("unchanged"),preserved:existing.length-used.size,
  total:existing.length+count("created"),warnings:snapshot.warnings,ignoredFormulaZeros:snapshot.ignoredFormulaZeros,projects:details};
 return {writes,summary};
}

async function completed(db:Database):Promise<WorkbookImportSummary|null>{
 const row=await db.prepare("SELECT source_hash,summary FROM project_imports WHERE id = ?").bind(snapshot.id).first<{source_hash:string;summary:string}>();
 if(!row)return null;
 if(row.source_hash!==snapshot.sourceHash)throw new Error("La source de cet import a changé.");
 return JSON.parse(row.summary) as WorkbookImportSummary;
}

export async function ensureWorkbookImported(db:Database,user:ChatGPTUser|null):Promise<WorkbookImportSummary|null>{
 // Caller obtains this identity from the platform, never the request body.
 if(!user?.userId||user.email.trim().toLowerCase()!==snapshot.ownerEmail)return null;
 const done=await completed(db);if(done)return done;
 for(let attempt=0;attempt<3;attempt++){
  const {results:rows}=await db.prepare("SELECT id,payload,revision,updated_at FROM projects ORDER BY id").all<Row>();
  const {writes,summary}=planWorkbookImport(rows,user.displayName);
  const backup=JSON.stringify(rows);
  // D1 batch is transactional. A unique checkpoint and a CHECK constraint
  // prevent partial imports and detect *any* intervening edit/create/delete.
  const guard=db.prepare(`INSERT INTO project_imports
   (id,source_hash,applied_at,summary,backup_payload,snapshot_verified)
   SELECT ?,?,?,?,?, CASE WHEN
    (SELECT count(*) FROM projects) = (SELECT count(*) FROM json_each(?))
    AND NOT EXISTS (
     SELECT 1 FROM json_each(?) expected LEFT JOIN projects current
      ON current.id = json_extract(expected.value,'$.id')
     WHERE current.id IS NULL OR current.revision != json_extract(expected.value,'$.revision')
      OR current.payload != json_extract(expected.value,'$.payload')
      OR current.updated_at != json_extract(expected.value,'$.updated_at')
    ) THEN 1 ELSE 0 END`).bind(snapshot.id,snapshot.sourceHash,summary.appliedAt,JSON.stringify(summary),backup,backup,backup);
  const statements=writes.map(({before,after})=>before?
   db.prepare("UPDATE projects SET payload=?,revision=?,updated_at=? WHERE id=? AND revision=?")
    .bind(JSON.stringify(after),after.revision,after.updatedAt,after.id,before.revision):
   db.prepare("INSERT INTO projects (id,payload,revision,updated_at) VALUES (?,?,?,?)")
    .bind(after.id,JSON.stringify(after),after.revision,after.updatedAt));
  try{await db.batch([guard,...statements]);return summary;}
  catch(error){
   const raced=await completed(db);if(raced)return raced;
   const message=error instanceof Error?error.message:"";
   if(!message.includes("project_import_snapshot_verified")||attempt===2)throw error;
  }
 }
 throw new Error("Import impossible après modification simultanée.");
}
