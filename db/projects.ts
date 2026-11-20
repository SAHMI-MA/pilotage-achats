import {getDb} from "@/db";
import {seedProjects} from "@/lib/seed";
import {normalizeProject,type Project,type Editable,segmentCatalogue} from "@/lib/project";
export type Row={id:string;payload:string;revision:number;updated_at:string};
export const decode=(r:Row):Project=>normalizeProject({...JSON.parse(r.payload),id:r.id,revision:r.revision,updatedAt:r.updated_at});
export async function listProjects(){const db=getDb();await db.batch(seedProjects.map(p=>db.prepare("INSERT OR IGNORE INTO projects (id,payload,revision,updated_at) VALUES (?,?,?,?)").bind(p.id,JSON.stringify(p),p.revision,p.updatedAt)));const {results}=await db.prepare("SELECT id,payload,revision,updated_at FROM projects ORDER BY id").all<Row>();return results.map(decode);}
export async function prepareEditable(p:Editable){const known=segmentCatalogue(await listProjects());const segment=p.segment.trim().toUpperCase();return {...p,segment,segmentTitle:known[segment]||p.segmentTitle,notes:p.projectNotes.map((n,i)=>`Note ${i+1} : ${n.text}`).join("\n\n")};}
