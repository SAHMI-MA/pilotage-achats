import { z } from "zod";
export const stages = [
 {id:"ao",label:"AO lancé/En attente des offres",short:"Attente des offres",color:"#2563eb",bg:"#eaf1ff"},
 {id:"analysis",label:"Analyse technique en cours",short:"Analyse technique",color:"#7c3aed",bg:"#f2eafe"},
 {id:"negotiation",label:"Négociation",short:"Négociation",color:"#b7790b",bg:"#fff5dc"},
 {id:"contract",label:"Contrat en cours de signature",short:"Signature contrat",color:"#be457b",bg:"#fcecf3"},
 {id:"pr",label:"PR en cours",short:"PR en cours",color:"#0891b2",bg:"#e6f7fb"},
 {id:"bc",label:"BC en signature",short:"BC en signature",color:"#4f46e5",bg:"#eeeeff"},
 {id:"closed",label:"BC signé/Clôturé",short:"Clôturé",color:"#16805b",bg:"#e7f5ee"},
 {id:"standby",label:"Standby",short:"Standby",color:"#64748b",bg:"#eef1f5"},
] as const;
export const participation = ["participe","ne participe pas","pas de retour","pas de réponse"] as const;
const str = z.string().max(2000);
export const dateSchema = z.string().refine(v => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v),"Date invalide");
const amount = z.number().finite().min(0).max(1e12).nullable();
export const supplierPointSchema=z.object({id:z.string().min(1).max(100),at:z.string().datetime(),text:z.string().trim().min(1).max(10000)});
export const supplierSchema = z.object({id:z.string().min(1).max(100),name:str.trim().min(1),contact:str,status:z.enum(participation),note:z.string().max(10000),points:z.array(supplierPointSchema).max(5000).default([]),active:z.boolean(),offerReceived:z.boolean().default(false),offers:z.tuple([amount,amount,amount])});
export const noteSchema = z.object({id:z.string().min(1).max(100),text:z.string().max(20000)});
export const followupResponses=["en attente","pas de réponse","participe","ne participe pas","retour reçu"] as const;
export const followupSchema = z.object({id:z.string().min(1).max(100),targetType:z.enum(["supplier","prescriber"]),supplierId:z.string().max(100).default(""),targetName:str.trim().min(1,"Indiquez le destinataire de la relance."),reason:z.enum(["offer","participation","technical","other"]),sentAt:z.string().datetime(),dueAt:z.string().datetime(),status:z.enum(["scheduled","waiting","received","superseded","cancelled"]),note:z.string().max(10000).default(""),receivedAt:z.string().default(""),response:z.enum(followupResponses).default("en attente"),reminderEnabled:z.boolean().default(true),independent:z.boolean().default(false)});
export type ProjectNote = z.infer<typeof noteSchema>;
export type Followup = z.infer<typeof followupSchema>;
export const knownSegments:Record<string,string>={NA24:"VRD",NA25:"Gros œuvre",NA28:"Électricité, courants forts / courants faibles"};
export const editableSchema = z.object({
 rfx:str,company:str,site:str,prescriber:str,title:str.trim().min(1,"L’intitulé du projet est obligatoire."),
 cpsDate:dateSchema,aoDate:dateSchema,deadline:dateSchema,segment:str,segmentTitle:str,
 stage:z.enum(["ao","analysis","negotiation","contract","pr","bc","closed","standby"]),
 suppliers:z.array(supplierSchema).max(1000),budget:amount,finalAmount:amount,awarded:str,pr:str,bc:str,
 nextAction:str,actionDue:dateSchema,owner:str,notes:z.string().max(500000),
 projectNotes:z.array(noteSchema).max(2000).default([]),followups:z.array(followupSchema).max(5000).default([]),technicalDue:dateSchema.default(""),technicalReceived:z.boolean().default(false),
 offerReminderEnabled:z.boolean().default(true),participationReminderEnabled:z.boolean().default(true),technicalReminderEnabled:z.boolean().default(true),actionReminderEnabled:z.boolean().default(true),offerReminderDate:dateSchema.default(""),participationReminderDate:dateSchema.default(""),closedDate:dateSchema.default(""),
}).superRefine((p,ctx)=>{
 if(new Set(p.suppliers.map(s=>s.id)).size!==p.suppliers.length)ctx.addIssue({code:"custom",message:"Identifiants fournisseurs dupliqués.",path:["suppliers"]});
 for(const s of p.suppliers)if(new Set(s.points.map(n=>n.id)).size!==s.points.length)ctx.addIssue({code:"custom",message:"Identifiants des points de suivi dupliqués."});
 for(const f of p.followups){if(f.status!=="scheduled"&&f.dueAt<f.sentAt)ctx.addIssue({code:"custom",message:"Le rappel doit suivre la date de relance."});if(f.targetType==="supplier"&&!p.suppliers.some(s=>s.id===f.supplierId))ctx.addIssue({code:"custom",message:"Fournisseur de la relance introuvable."});if(f.status!=="scheduled"&&Date.parse(f.sentAt)>Date.now()+300000)ctx.addIssue({code:"custom",message:"Pour une date future, choisissez Planifier une relance."});}
 for(const list of [p.projectNotes,p.followups])if(new Set(list.map(x=>x.id)).size!==list.length)ctx.addIssue({code:"custom",message:"Identifiants de suivi dupliqués."});
});
export type Editable = z.infer<typeof editableSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type Event = {id:string;at:string;author:string;text:string;kind:"comment"|"change"|"import";supplier?:string};
export type Project = Editable & {id:string;revision:number;updatedAt:string;history:Event[]};
export const blankProject = (): Editable => ({rfx:"",company:"",site:"",prescriber:"",title:"",cpsDate:"",aoDate:"",deadline:"",segment:"",segmentTitle:"",stage:"ao",suppliers:[],budget:null,finalAmount:null,awarded:"",pr:"",bc:"",nextAction:"",actionDue:"",owner:"",notes:"",projectNotes:[],followups:[],technicalDue:"",technicalReceived:false,offerReminderEnabled:true,participationReminderEnabled:true,technicalReminderEnabled:true,actionReminderEnabled:true,offerReminderDate:"",participationReminderDate:"",closedDate:""});
export const newSupplier = (name:string): Supplier => ({id:crypto.randomUUID(),name,contact:"",status:"pas de retour",note:"",points:[],active:true,offerReceived:false,offers:[null,null,null]});
export const todayISO = () => new Date().toISOString().slice(0,10);
export function shiftDate(iso:string,days:number){if(!iso)return "";const d=new Date(iso+"T12:00:00Z");if(Number.isNaN(d.getTime()))return "";d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export const formatDate = (iso:string) => iso ? new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(iso.slice(0,10)+"T12:00:00Z")) : "Non renseignée";
export const money = (n:number|null) => n===null?"—":new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n);
export const latestOffer = (s:Supplier) => [...s.offers].reverse().find(v=>v!==null) ?? null;
export const hasOffer=(s:Supplier)=>s.offerReceived||latestOffer(s)!==null;
export const activeSuppliers = (p:Editable) => p.suppliers.filter(s=>s.active);
export const pendingOffers = (p:Editable) => activeSuppliers(p).filter(s=>s.status!=="ne participe pas" && !hasOffer(s));
export function average(p:Editable){const a=activeSuppliers(p).filter(s=>s.status!=="ne participe pas").map(latestOffer).filter((n):n is number=>n!==null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
export const gain = (p:Editable) => p.budget!==null && p.budget>0 && p.finalAmount!==null ? (p.budget-p.finalAmount)/p.budget*100:null;
export const offerReminderDay=(p:Editable)=>p.offerReminderDate||shiftDate(p.deadline,-3);
export const participationReminderDay=(p:Editable)=>p.participationReminderDate||shiftDate(p.aoDate,2);
export const noParticipationResponse=(s:Supplier)=>s.status==="pas de retour"||s.status==="pas de réponse";
export const isReminder = (p:Editable,today=todayISO()) => p.stage==="ao" && p.offerReminderEnabled!==false && !!offerReminderDay(p) && today>=offerReminderDay(p) && pendingOffers(p).some(s=>!(p.followups||[]).some(f=>f.supplierId===s.id&&f.reason==="offer"&&followupWaiting(p,f)));
export const isActionDue = (p:Editable,today=todayISO()) => p.stage!=="closed" && p.actionReminderEnabled!==false && !!p.nextAction && !!p.actionDue && p.actionDue<=today;
export const isConfirmationDue = (p:Editable,today=todayISO()) => p.stage==="ao" && p.participationReminderEnabled!==false && !!participationReminderDay(p) && today>=participationReminderDay(p) && activeSuppliers(p).filter(noParticipationResponse).some(s=>!(p.followups||[]).some(f=>f.supplierId===s.id&&f.reason==="participation"&&followupWaiting(p,f)));
export const followupWaiting=(p:Editable,f:Followup)=>{
 if(p.stage==="closed"||!["waiting","scheduled"].includes(f.status))return false;
 if(f.targetType==="supplier"){const s=p.suppliers.find(s=>s.id===f.supplierId);if(!s?.active)return false;if(!f.independent){if(s.status==="ne participe pas")return false;if(f.reason==="offer"&&hasOffer(s))return false;if(f.reason==="participation"&&!noParticipationResponse(s))return false;}}
 if(!f.independent&&f.reason==="technical"&&p.technicalReceived)return false;return true;
};
export const needsAttention = (p:Editable,today=todayISO()) => isReminder(p,today)||isActionDue(p,today)||isConfirmationDue(p,today)||(p.stage!=="closed"&&p.technicalReminderEnabled!==false&&!!p.technicalDue&&!p.technicalReceived&&p.technicalDue<=today&&!(p.followups||[]).some(f=>f.reason==="technical"&&followupWaiting(p,f)))||(p.followups||[]).some(f=>f.reminderEnabled!==false&&followupWaiting(p,f)&&f.dueAt<=new Date().toISOString());
export function normalizeProject(raw:Project):Project{
 const projectNotes=raw.projectNotes??(raw.notes?[{id:"legacy-note",text:raw.notes}]:[]);
 const fields=editableSchema.parse({...raw,projectNotes});
 const segment=fields.segment.trim().toUpperCase();
 return {...raw,...fields,segment,segmentTitle:knownSegments[segment]||fields.segmentTitle};
}
export function segmentCatalogue(projects:Editable[]){const result={...knownSegments};for(const p of projects){const code=p.segment.trim().toUpperCase();if(code&&p.segmentTitle&&!result[code])result[code]=p.segmentTitle;}return result;}
export const formatDateTime=(value:string)=>new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value))+" UTC";
export const followupReason:Record<Followup["reason"],string>={offer:"Soumission de l’offre",participation:"Confirmation de participation",technical:"Retour d’analyse technique",other:"Autre retour attendu"};
export function recordFollowup(p:Editable,entry:Pick<Followup,"targetType"|"supplierId"|"targetName"|"reason"|"sentAt"|"note"> & Partial<Pick<Followup,"dueAt"|"status"|"response"|"reminderEnabled">>):Followup[]{const fresh:Followup={...entry,id:crypto.randomUUID(),dueAt:entry.dueAt||new Date(Date.parse(entry.sentAt)+86400000).toISOString(),status:entry.status||"waiting",response:entry.response||"en attente",reminderEnabled:entry.reminderEnabled??true,independent:true,receivedAt:entry.status==="received"?new Date().toISOString():""};return [...p.followups,fresh];}
export function describeChanges(before:Editable,after:Editable):string[]{
 const result:string[]=[];
 if(before.stage!==after.stage)result.push(`Étape : ${stages.find(s=>s.id===before.stage)?.label} → ${stages.find(s=>s.id===after.stage)?.label}.`);
 for(const s of after.suppliers){const old=before.suppliers.find(o=>o.id===s.id);if(!old)result.push(`Fournisseur ajouté : ${s.name}.`);else {
  if(old.active&&!s.active)result.push(`Fournisseur archivé : ${old.name}. Son suivi et ses offres sont conservés.`);
  if(!old.active&&s.active)result.push(`Fournisseur réactivé : ${s.name}.`);
  if(old.name!==s.name)result.push(`Nom du fournisseur : ${old.name} → ${s.name}.`);
  if(old.status!==s.status)result.push(`${s.name} : ${old.status} → ${s.status}.`);
  s.offers.forEach((n,i)=>{if(old.offers[i]!==n)result.push(`${s.name} · Offre V${i+1} : ${money(old.offers[i])} → ${money(n)}.`)});
  if(old.offerReceived!==s.offerReceived)result.push(`${s.name} · Offre ${s.offerReceived?"reçue":"en attente"}.`);
  if(old.note!==s.note)result.push(`${s.name} · Note de suivi : ${s.note || "note effacée"}`);
  for(const point of s.points){if(!old.points.some(n=>n.id===point.id))result.push(`${s.name} · Point de suivi du ${formatDateTime(point.at)} : ${point.text}`);}
  if(old.contact!==s.contact)result.push(`${s.name} · Contact : ${old.contact || "—"} → ${s.contact || "—"}`);
 }}
 const labels:Record<string,string>={rfx:"RFX",company:"Société",site:"Site",prescriber:"Prescripteur",title:"Projet",cpsDate:"Réception CPS",aoDate:"Envoi AO",deadline:"Date limite",segment:"Segment",segmentTitle:"Intitulé segment",budget:"Budget",finalAmount:"Montant final",awarded:"Fournisseur adjugé",pr:"N° PR",bc:"N° BC",nextAction:"Prochaine action",actionDue:"Échéance d’action",owner:"Responsable",technicalDue:"Date de retour technique",technicalReceived:"Retour technique reçu"};
 for(const key of Object.keys(labels) as (keyof Editable)[]){if(before[key]!==after[key])result.push(`${labels[key]} : ${String(before[key] ?? "—")||"—"} → ${String(after[key] ?? "—")||"—"}`)}
 for(const [i,n] of after.projectNotes.entries()){const old=before.projectNotes.find(x=>x.id===n.id);if(!old)result.push(`Note ${i+1} ajoutée : ${n.text}`);else if(old.text!==n.text)result.push(`Note ${i+1} : ${old.text||"—"} → ${n.text||"—"}`);}
 const trackingLabels={offerReminderEnabled:"Rappel soumission",participationReminderEnabled:"Rappel participation",technicalReminderEnabled:"Rappel retour technique",actionReminderEnabled:"Notification d’action",offerReminderDate:"Date de relance soumission",participationReminderDate:"Date de relance participation",closedDate:"Date de clôture"};
 for(const key of Object.keys(trackingLabels) as (keyof typeof trackingLabels)[]){if(before[key]!==after[key]){const display=(value:unknown)=>typeof value==="boolean"?(value?"activé":"désactivé"):String(value||"automatique");result.push(`${trackingLabels[key]} : ${display(before[key])} → ${display(after[key])}.`);}}
 for(const f of after.followups){const old=before.followups.find(x=>x.id===f.id);if(!old)result.push(`${f.status==="scheduled"?"Relance planifiée":"Relance enregistrée"} : ${f.targetName} · ${followupReason[f.reason]} · ${formatDateTime(f.sentAt)}. ${f.reminderEnabled?`Rappel : ${formatDateTime(f.dueAt)}.`:"Sans notification."}`);else if(JSON.stringify(old)!==JSON.stringify(f))result.push(`${f.targetName} · ${followupReason[f.reason]} : ${f.response}, ${f.status==="cancelled"?"annulée":f.reminderEnabled?`rappel ${formatDateTime(f.dueAt)}`:"notification désactivée"}.`);}
 return result;
}
