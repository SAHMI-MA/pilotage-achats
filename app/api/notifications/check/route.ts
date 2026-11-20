import {getChatGPTUser} from "@/app/chatgpt-auth";
import {getDb} from "@/db";
import {listProjects} from "@/db/projects";
import {allNotifications} from "@/lib/notifications";
export const dynamic="force-dynamic";
// Owner-private Site only. Sites dispatch enforces visitor or service authentication.
// This endpoint only acknowledges reminders; it cannot send messages or edit projects.
export async function POST(req:Request){
 try{
  if(!await getChatGPTUser())return Response.json({error:"Non autorisé"},{status:401});
  const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return Response.json({error:"Origine refusée."},{status:403});
  const input=await req.json() as {dryRun?:boolean};if(typeof input.dryRun!=="boolean")return Response.json({error:"dryRun requis."},{status:400});
  const now=new Date().toISOString();const notifications=allNotifications(await listProjects()).filter(n=>n.dueAt<=now);const db=getDb();
  const {results}=await db.prepare("SELECT id FROM notification_deliveries").all<{id:string}>();const delivered=new Set(results.map(r=>r.id));const pending=notifications.filter(n=>!delivered.has(n.id));
  if(input.dryRun)return Response.json({checkedAt:now,notifications:pending,dryRun:true},{headers:{"Cache-Control":"no-store"}});
  if(!pending.length)return Response.json({checkedAt:now,notifications:[]},{headers:{"Cache-Control":"no-store"}});
  const updates=await db.batch(pending.map(n=>db.prepare("INSERT OR IGNORE INTO notification_deliveries (id,delivered_at) VALUES (?,?)").bind(n.id,now)));
  return Response.json({checkedAt:now,notifications:pending.filter((_,i)=>updates[i].meta.changes===1)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("notifications.check",e);return Response.json({error:"Impossible de vérifier les rappels."},{status:503})}
}
