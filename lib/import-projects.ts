import {blankProject,newSupplier,stages,participation,segmentCatalogue,type Editable,type Project,type Supplier,editableSchema} from "./project";
export const normalizeHeader=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export const importFields:{key:string;label:string;aliases:string[]}[]=[
 {key:"rfx",label:"RFX Digibuy",aliases:["rfx","rfxdigibuy","numerorfx"]},
 {key:"company",label:"Société",aliases:["societe","entreprise"]},{key:"site",label:"Site",aliases:["site"]},
 {key:"prescriber",label:"Nom du prescripteur",aliases:["prescripteur","nomduprescripteur"]},
 {key:"title",label:"Intitulé du projet",aliases:["intituleduprojet","projet","intituleprojet","nomduprojet"]},
 {key:"cpsDate",label:"Date reçu CPS",aliases:["daterecucps","datereceptioncps","datedereceptionducps"]},
 {key:"aoDate",label:"Date envoi AO",aliases:["dateenvoiao","dateenvoieao","datedenvoidelao"]},
 {key:"deadline",label:"Date limite de réponse",aliases:["datelimitedereponse","datelimitereponse","datelimite","datesoumission"]},
 {key:"segment",label:"Segment",aliases:["segment","codesegment"]},{key:"segmentTitle",label:"Intitulé du segment",aliases:["intituledus egment".replace(" ",""),"intituled u segment".replaceAll(" ",""),"intitulesegment"]},
 {key:"stage",label:"État",aliases:["etat","etatduprojet","statut"]},{key:"notes",label:"Notes / commentaires",aliases:["commentaires","commentaire","notes","notesduprojet"]},
 {key:"awarded",label:"Fournisseur adjugé",aliases:["fournisseuradjuge","fournisseurretenu"]},{key:"budget",label:"Budget (€)",aliases:["budget","budgete","budgeteur"]},
 {key:"finalAmount",label:"Montant final (€)",aliases:["montantfinal","montantfinale","montantfinaleur"]},
 {key:"pr",label:"N° de PR",aliases:["ndepr","npr","numeropr"]},{key:"bc",label:"N° du BC",aliases:["ndubc","nbc","numerobc"]},
 {key:"nextAction",label:"Prochaine action",aliases:["prochaineaction","action"]},{key:"actionDue",label:"Échéance action",aliases:["echeanceaction","echeance","afairepourle"]},{key:"owner",label:"Responsable",aliases:["responsable","responsabledusuivi"]},
 {key:"technicalDue",label:"Date retour technique",aliases:["dateretourtechnique","dateattendueduret ourtechnique".replace(" ",""),"echeanceretourtechnique"]},
 {key:"closedDate",label:"Date de clôture",aliases:["datedecloture","datecloture"]},
 {key:"offerReminderDate",label:"Date relance soumission",aliases:["relancesoumission","daterelancesoumission"]},
 ...Array.from({length:5},(_,i)=>[
  {key:`supplier${i+1}`,label:`Fournisseur ${i+1}`,aliases:[`fournisseur${i+1}`,`prestataire${i+1}`,`f${i+1}`]},
  {key:`status${i+1}`,label:`Retour participation ${i+1}`,aliases:[`retourparticipation${i+1}`,`retourparticpation${i+1}`,`participation${i+1}`,`retour${i+1}`]},
  {key:`contact${i+1}`,label:`Contact F${i+1}`,aliases:[`contactf${i+1}`,`contactfournisseur${i+1}`]},
  {key:`point${i+1}`,label:`Points de suivi F${i+1}`,aliases:[`pointsdesuivif${i+1}`,`dernierpointdesuivif${i+1}`]},
  ...Array.from({length:3},(_,v)=>({key:`offer${i+1}v${v+1}`,label:`Offre F${i+1} Version ${v+1}`,aliases:[`offref${i+1}version${v+1}`,`offref${i+1}v${v+1}`,`offref${i+1}version${v+1}e`, `offref${i+1}v${v+1}e`, `f${i+1}v${v+1}`]}))
 ]).flat()
];
export function suggestMapping(headers:unknown[]){return headers.map(h=>{
 const text=normalizeHeader(h),known=importFields.find(f=>f.aliases.includes(text));if(known)return known.key;
 let m=text.match(/^(?:fournisseur|prestataire|f)(\d+)$/);if(m&&Number(m[1])<=1000)return `supplier${Number(m[1])}`;
 m=text.match(/^(?:retourparticipation|retourparticpation|participation|retour)(\d+)$/);if(m&&Number(m[1])<=1000)return `status${Number(m[1])}`;
 m=text.match(/^contact(?:fournisseur|f)(\d+)$/);if(m&&Number(m[1])<=1000)return `contact${Number(m[1])}`;
 m=text.match(/^(?:pointsdesuivi|dernierpointdesuivi)f(\d+)$/);if(m&&Number(m[1])<=1000)return `point${Number(m[1])}`;
 m=text.match(/^(?:offre)?f(\d+)(?:version|v)([123])(?:e|eur)?$/);if(m&&Number(m[1])<=1000)return `offer${Number(m[1])}v${m[2]}`;
 return "";
 })}
export function mappingOptions(headers:unknown[]){const result=importFields.map(f=>({value:f.key,label:f.label}));suggestMapping(headers).forEach((key,i)=>{if(key&&!result.some(f=>f.value===key))result.push({value:key,label:String(headers[i])})});return result;}
export function findHeader(rows:unknown[][]){let best=0,score=0;rows.slice(0,60).forEach((r,i)=>{const m=suggestMapping(r);const n=m.filter(Boolean).length+(m.includes("title")?10:0)+(m.includes("rfx")?4:0);if(n>score){score=n;best=i}});return best;}
export function parseCSV(text:string){
 text=text.replace(/^\uFEFF/,"");const first=text.split(/\r?\n/).slice(0,5).join("\n");const delimiter=[";","\t",","].sort((a,b)=>first.split(b).length-first.split(a).length)[0];const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
 if(quoted)throw Error("Une cellule CSV contient des guillemets non fermés.");row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function importDate(value:unknown):string{
 if(value instanceof Date){if(Number.isNaN(value.getTime()))throw Error("Date invalide");return value.toISOString().slice(0,10)}
 if(typeof value==="number")return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
 const s=String(value).trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(!m)throw Error(`Date non reconnue « ${s} » ; utilisez JJ/MM/AAAA.`);return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}
export function importAmount(value:unknown):number{
 if(typeof value==="number"){if(!Number.isFinite(value)||value<0)throw Error("Montant invalide");return value}
 let s=String(value).replace(/EUR/gi,"").replace(/[\s\u00a0\u202f€]/g,"");
 if(s.includes(",")&&s.includes(".")){if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replaceAll(".","").replace(",",".");else s=s.replaceAll(",","")}
 else if(s.includes(","))s=/^\d{1,3}(,\d{3})+$/.test(s)?s.replaceAll(",",""):s.replace(",",".");
 if(!/^\d+(\.\d+)?$/.test(s))throw Error(`Montant non reconnu « ${value} ».`);return Number(s);
}
const statusAliases:Record<string,Supplier["status"]>={participe:"participe",oui:"participe",confirmationok:"participe",confirme:"participe",neparticipepas:"ne participe pas",non:"ne participe pas",refuse:"ne participe pas",pasderetour:"pas de retour",pasdereponse:"pas de réponse",enattente:"pas de retour"};
function importStage(v:unknown){const s=normalizeHeader(v);const m=stages.find(x=>[x.id,x.label,x.short].some(y=>normalizeHeader(y)===s));if(m)return m.id;if(s.includes("aolance")||s.includes("attentedesoffres"))return "ao";if(s.includes("bcsigne")||s==="cloture")return "closed";throw Error(`État non reconnu « ${v} ».`)}
export type ImportPreview={row:number;project:Editable;existing?:Project;errors:string[];mode:"new"|"update"};
export function previewImport(rows:unknown[][],mapping:string[],projects:Project[],headerRow:number):ImportPreview[]{
 const catalogue=segmentCatalogue(projects);const seen=new Set<string>();const output:ImportPreview[]=[];
 rows.slice(headerRow+1).forEach((row,index)=>{
  const values:Record<string,unknown>={};mapping.forEach((key,i)=>{if(key&&row[i]!==null&&row[i]!==undefined&&String(row[i]).trim()!=="")values[key]=row[i]});
  if(!Object.keys(values).length)return;const errors:string[]=[];const rfx=String(values.rfx??"").trim(),title=String(values.title??"").trim();
  if(!rfx&&!title)return;
  const identity=rfx?`rfx:${rfx}`:[values.company,values.site,title].map(normalizeHeader).join("|");if(seen.has(identity))errors.push("Projet présent plusieurs fois dans le fichier.");seen.add(identity);
  const matches=projects.filter(p=>rfx?p.rfx===rfx:normalizeHeader(p.title)===normalizeHeader(title)&&normalizeHeader(p.site)===normalizeHeader(values.site)&&normalizeHeader(p.company)===normalizeHeader(values.company));
  if(matches.length>1)errors.push("Plusieurs projets existants correspondent à ce RFX. Corrigez le doublon avant import.");const existing=matches[0];const draft:Editable=existing?structuredClone(existing):blankProject();
  const attempt=(label:string,fn:()=>void)=>{try{fn()}catch(e){errors.push(`${label} : ${(e as Error).message}`)}};
  const texts=["rfx","company","site","prescriber","title","segment","segmentTitle","awarded","pr","bc","nextAction","owner"] as const;
  for(const k of texts)if(values[k]!==undefined)draft[k]=String(values[k]).trim();
  for(const k of ["cpsDate","aoDate","deadline","actionDue","technicalDue","closedDate","offerReminderDate"] as const)if(values[k]!==undefined){if(k==="offerReminderDate"&&normalizeHeader(values[k])==="desactivee")draft.offerReminderEnabled=false;else attempt(k,()=>{draft[k]=importDate(values[k])});}
  for(const k of ["budget","finalAmount"] as const)if(values[k]!==undefined)attempt(k,()=>{draft[k]=importAmount(values[k])});
  if(values.stage!==undefined)attempt("État",()=>{draft.stage=importStage(values.stage)});
  if(values.notes!==undefined){const text=String(values.notes).trim();if(!draft.projectNotes.some(n=>n.text===text)&&draft.notes!==text){for(const part of text.split(/(?:^|\n\n)Note \d+ : /).filter(Boolean)){if(!draft.projectNotes.some(n=>n.text===part))draft.projectNotes.push({id:crypto.randomUUID(),text:part});}}}
  draft.segment=draft.segment.trim().toUpperCase();if(catalogue[draft.segment])draft.segmentTitle=catalogue[draft.segment];else if(draft.segment&&draft.segmentTitle)catalogue[draft.segment]=draft.segmentTitle;
  const indices=[...new Set(Object.keys(values).flatMap(k=>{const m=k.match(/^(?:supplier|status|contact|point|offer)(\d+)/);return m?[Number(m[1])]:[]}))].sort((a,b)=>a-b);
  for(const i of indices){
   const name=String(values[`supplier${i}`]??"").trim();if(!name){if(Object.keys(values).some(k=>k===`status${i}`||k.startsWith(`offer${i}v`)))errors.push(`F${i} : nom du fournisseur manquant.`);continue;}
   let s=draft.suppliers.find(s=>s.active&&normalizeHeader(s.name)===normalizeHeader(name));if(!s){s=newSupplier(name);draft.suppliers.push(s)}
   if(values[`status${i}`]!==undefined){const v=statusAliases[normalizeHeader(values[`status${i}`])];if(!v)errors.push(`F${i} : retour de participation non reconnu.`);else s.status=v;}
   if(values[`contact${i}`]!==undefined)s.contact=String(values[`contact${i}`]);
   if(values[`point${i}`]!==undefined){const text=String(values[`point${i}`]).trim();const combined=[s.note,...s.points.map(n=>`${n.at} : ${n.text}`)].filter(Boolean).join("\n\n");if(text&&text!==combined&&text!==s.note&&!s.points.some(n=>n.text===text))s.points.push({id:crypto.randomUUID(),at:new Date().toISOString(),text});}
   for(let v=1;v<=3;v++)if(values[`offer${i}v${v}`]!==undefined)attempt(`F${i} V${v}`,()=>{s!.offers[v-1]=importAmount(values[`offer${i}v${v}`])});
  }
  const parsed=editableSchema.safeParse(draft);if(!parsed.success)errors.push(...parsed.error.issues.map(i=>i.message));
  output.push({row:headerRow+index+2,project:draft,existing,errors:[...new Set(errors)],mode:existing?"update":"new"});
 });return output;
}
