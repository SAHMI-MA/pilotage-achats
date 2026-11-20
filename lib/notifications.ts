import {type Project,followupWaiting,pendingOffers,activeSuppliers,followupReason,offerReminderDay,participationReminderDay,noParticipationResponse,formatDateTime} from "./project";
export type ProjectNotification={id:string;projectId:string;rfx:string;projectTitle:string;kind:"followup"|"offer"|"technical"|"participation"|"action";target:string;message:string;dueAt:string;followupId?:string;};
export function projectNotifications(p:Project):ProjectNotification[]{
 if(p.stage==="closed")return [];
 const list:ProjectNotification[]=[];
 const add=(kind:ProjectNotification["kind"],target:string,message:string,dueAt:string,key:string,followupId?:string)=>list.push({id:`${p.id}:${kind}:${key}:${dueAt}`,projectId:p.id,rfx:p.rfx,projectTitle:p.title,kind,target,message,dueAt,followupId});
 const waiting=p.followups.filter(f=>followupWaiting(p,f));
 for(const f of waiting.filter(f=>f.reminderEnabled!==false))add("followup",f.targetName,f.status==="scheduled"?`${followupReason[f.reason]} : relance planifiée.`:`${followupReason[f.reason]} : ${f.response==="pas de réponse"?"pas de réponse":"retour attendu"} après la relance du ${formatDateTime(f.sentAt)}.`,f.dueAt,f.id,f.id);
 if(p.stage==="ao"){
  if(p.offerReminderEnabled!==false&&offerReminderDay(p))for(const s of pendingOffers(p))if(!waiting.some(f=>f.supplierId===s.id&&f.reason==="offer"))add("offer",s.name,`Relancer pour la soumission de l’offre${p.deadline?` avant le ${p.deadline.split("-").reverse().join("/")}`:""}.`,offerReminderDay(p)+"T09:00:00.000Z",s.id);
  if(p.participationReminderEnabled!==false&&participationReminderDay(p))for(const s of activeSuppliers(p).filter(noParticipationResponse))if(!waiting.some(f=>f.supplierId===s.id&&f.reason==="participation"))add("participation",s.name,"Demander la confirmation de participation.",participationReminderDay(p)+"T09:00:00.000Z",s.id);
 }
 if(p.technicalReminderEnabled!==false&&p.technicalDue&&!p.technicalReceived&&!waiting.some(f=>f.reason==="technical"))add("technical",p.prescriber||"Prescripteur à renseigner","Relancer le prescripteur pour le retour d’analyse technique.",p.technicalDue+"T09:00:00.000Z","technical");
 if(p.actionReminderEnabled!==false&&p.nextAction&&p.actionDue)add("action",p.owner||"Suivi du projet",p.nextAction,p.actionDue+"T09:00:00.000Z","action");
 return list.sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}
export const allNotifications=(projects:Project[])=>projects.flatMap(projectNotifications).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
