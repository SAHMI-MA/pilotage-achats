import Excel from "exceljs";
import {type Project,type Editable,activeSuppliers,shiftDate,stages,average,gain,offerReminderDay,participationReminderDay,followupReason,todayISO,pendingOffers} from "./project";
import {performance} from "./performance";
export type ExportColumn={key:string;header:string;width:number};
export function exportColumns(projects:Editable[]):ExportColumn[]{
 const supplierCount=Math.max(5,...projects.map(p=>activeSuppliers(p).length));
 const basic:ExportColumn[]=[{key:"rfx",header:"RFX Digibuy",width:17},{key:"company",header:"Société",width:30},{key:"site",header:"Site",width:20},{key:"prescriber",header:"Nom du prescripteur",width:28},{key:"title",header:"Intitulé du projet",width:55},{key:"cpsDate",header:"Date reçu CPS",width:18},{key:"aoDate",header:"Date envoi AO",width:18},{key:"confirmation",header:"Date confirmation participation",width:20},{key:"deadline",header:"Date limite de réponse",width:20},{key:"segment",header:"Segment",width:12},{key:"segmentTitle",header:"Intitulé du segment",width:38}];
 for(let i=1;i<=supplierCount;i++)basic.push({key:`supplier${i}`,header:`Fournisseur ${i}`,width:28},{key:`status${i}`,header:`Retour participation ${i}`,width:23});
 basic.push({key:"reminder",header:"Relance soumission",width:20},{key:"stage",header:"État",width:30},{key:"notes",header:"Commentaires",width:60});
 for(let v=1;v<=3;v++)for(let i=1;i<=supplierCount;i++)basic.push({key:`offer${i}v${v}`,header:`Offre F${i} Version ${v} (€)`,width:21});
 basic.push({key:"awarded",header:"Fournisseur adjugé",width:30},{key:"budget",header:"Budget (€)",width:20},{key:"average",header:"Moyenne des offres (€)",width:21},{key:"finalAmount",header:"Montant final (€)",width:20},{key:"gain",header:"Gain / budget (%)",width:20},{key:"pr",header:"N° de PR",width:18},{key:"bc",header:"N° du BC",width:18},{key:"nextAction",header:"Prochaine action",width:40},{key:"actionDue",header:"Échéance action",width:20},{key:"owner",header:"Responsable",width:23},{key:"technicalDue",header:"Date retour technique",width:20},{key:"closedDate",header:"Date de clôture",width:20});
 for(let i=1;i<=supplierCount;i++)basic.push({key:`contact${i}`,header:`Contact F${i}`,width:28},{key:`point${i}`,header:`Points de suivi F${i}`,width:50});
 return basic;
}
export function exportValue(p:Project,key:string):string|number|null{
 const s=activeSuppliers(p);let m=key.match(/^(supplier|status|contact|point)(\d+)$/);
 if(m){const supplier=s[Number(m[2])-1];if(!supplier)return null;return m[1]==="supplier"?supplier.name:m[1]==="status"?supplier.status:m[1]==="contact"?supplier.contact:[supplier.note,...supplier.points.map(n=>`${n.at} : ${n.text}`)].filter(Boolean).join("\n\n");}
 m=key.match(/^offer(\d+)v([123])$/);if(m)return s[Number(m[1])-1]?.offers[Number(m[2])-1]??null;
 if(key==="confirmation")return shiftDate(p.aoDate,2);if(key==="reminder")return p.offerReminderEnabled?offerReminderDay(p):"Désactivée";if(key==="stage")return stages.find(s=>s.id===p.stage)!.label;
 if(key==="notes")return p.projectNotes.map((n,i)=>`Note ${i+1} : ${n.text}`).join("\n\n");if(key==="average")return average(p);if(key==="gain")return gain(p);
 const value=p[key as keyof Project];return typeof value==="string"||typeof value==="number"?value:null;
}
function styleSheet(ws:Excel.Worksheet,columns:ExportColumn[]){
 ws.columns=columns.map(c=>({header:c.header,key:c.key,width:c.width}));ws.views=[{state:"frozen",xSplit:Math.min(2,columns.length),ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:columns.length}};
 ws.getRow(1).height=42;ws.getRow(1).eachCell(cell=>{cell.font={name:"Arial",size:11,bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF203C64"}};cell.alignment={wrapText:true,vertical:"middle"};});
 ws.eachRow((row,n)=>{if(n===1)return;row.height=75;row.eachCell({includeEmpty:true},cell=>{cell.font={name:"Arial",size:11,color:{argb:"FF253B56"}};cell.alignment={wrapText:true,vertical:"top"};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:n%2?"FFF2F6FC":"FFFFFFFF"}};cell.border={bottom:{style:"hair",color:{argb:"FFD8E2EF"}}};});});
 ws.pageSetup={orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
}
export async function createExportWorkbook(projects:Project[]){
 const wb=new Excel.Workbook();wb.creator="Pilotage achats";wb.created=new Date();const columns=exportColumns(projects),ws=wb.addWorksheet("Suivi projets");
 ws.columns=columns.map(c=>({header:c.header,key:c.key,width:c.width}));for(const p of projects)ws.addRow(Object.fromEntries(columns.map(c=>[c.key,exportValue(p,c.key)])));styleSheet(ws,columns);
 const col=(key:string)=>columns.findIndex(c=>c.key===key)+1;
 const letter=(key:string)=>ws.getColumn(col(key)).letter;
 const serial=(date:string)=>date?(Date.parse(date+"T12:00:00Z")-Date.UTC(1899,11,30))/86400000:0;
 projects.forEach((p,i)=>{const row=ws.getRow(i+2);columns.forEach((c,ci)=>{const cell=row.getCell(ci+1);if(c.key.startsWith("offer")||["budget","finalAmount","average"].includes(c.key))cell.numFmt='#,##0.00 "€"';if(c.key==="gain")cell.numFmt='0.00" %"';if(["cpsDate","aoDate","deadline","confirmation","reminder","actionDue","technicalDue","closedDate"].includes(c.key)&&/^\d{4}-\d{2}-\d{2}$/.test(String(cell.value||""))){cell.value=new Date(String(cell.value)+"T12:00:00Z");cell.numFmt="dd/mm/yyyy";}});
 const r=i+2,ao=letter("aoDate")+r,budget=letter("budget")+r,final=letter("finalAmount")+r;
 row.getCell(col("confirmation")).value={formula:`IF(ISNUMBER(${ao}),${ao}+2,"")`,result:p.aoDate?serial(shiftDate(p.aoDate,2)):""};row.getCell(col("confirmation")).numFmt="dd/mm/yyyy";
 row.getCell(col("gain")).value={formula:`IF(AND(ISNUMBER(${budget}),${budget}>0,ISNUMBER(${final})),100*(${budget}-${final})/${budget},"")`,result:gain(p)??""};
 const latest=activeSuppliers(p).map((_,si)=>{const status=letter(`status${si+1}`)+r;const offers=[1,2,3].map(v=>letter(`offer${si+1}v${v}`)+r);return {value:`IF(${status}="ne participe pas",0,IF(ISNUMBER(${offers[2]}),${offers[2]},IF(ISNUMBER(${offers[1]}),${offers[1]},IF(ISNUMBER(${offers[0]}),${offers[0]},0))))`,count:`IF(AND(${status}<>"ne participe pas",COUNT(${offers.join(",")})>0),1,0)`}});
 if(latest.length&&latest.map(x=>x.value+x.count).join("").length<7800)row.getCell(col("average")).value={formula:`IFERROR((${latest.map(x=>x.value).join("+")})/(${latest.map(x=>x.count).join("+")}),"")`,result:average(p)??""};
 if(p.offerReminderEnabled&&!p.offerReminderDate){const deadline=letter("deadline")+r;row.getCell(col("reminder")).value={formula:`IF(ISNUMBER(${deadline}),${deadline}-3,"")`,result:p.deadline?serial(shiftDate(p.deadline,-3)):""};row.getCell(col("reminder")).numFmt="dd/mm/yyyy";}
 const stage=stages.find(s=>s.id===p.stage)!;row.getCell(col("stage")).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF"+stage.bg.slice(1)}};row.getCell(col("stage")).font={name:"Arial",size:11,bold:true,color:{argb:"FF"+stage.color.slice(1)}};
 activeSuppliers(p).forEach((s,index)=>{const cell=row.getCell(col(`status${index+1}`));cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:s.status==="participe"?"FFE7F5EE":s.status==="ne participe pas"?"FFFDEBEB":"FFFFF5DC"}};});
 });
 // Conditional colour follows the exported dates even after the file is opened later.
 const reminderColumn=ws.getColumn(col("reminder")).letter,stageColumn=ws.getColumn(col("stage")).letter;
 projects.forEach((p,i)=>{if(p.offerReminderEnabled&&pendingOffers(p).length){const r=i+2;ws.addConditionalFormatting({ref:`${reminderColumn}${r}`,rules:[{type:"expression",priority:i+1,formulae:[`AND(ISNUMBER(${reminderColumn}${r}),${reminderColumn}${r}<=TODAY(),${stageColumn}${r}="AO lancé/En attente des offres")`],style:{font:{color:{argb:"FFB42318"},bold:true},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFFEE4E2"}}}}]})}});

 const add=(name:string,heads:string[],rows:unknown[][])=>{const sheet=wb.addWorksheet(name);sheet.addRow(heads);rows.forEach(r=>sheet.addRow(r));styleSheet(sheet,heads.map((h,i)=>({key:String(i),header:h,width:i<2?20:38})));};
 add("Notes projet",["RFX Digibuy","Projet","Note","Texte"],projects.flatMap(p=>p.projectNotes.map((n,i)=>[p.rfx,p.title,i+1,n.text])));
 add("Points de suivi",["RFX Digibuy","Projet","Fournisseur","État du fournisseur","Date UTC","Point de suivi"],projects.flatMap(p=>p.suppliers.flatMap(s=>[...(s.note?[[p.rfx,p.title,s.name,s.active?"Actif":"Archivé","",s.note]]:[]),...s.points.map(n=>[p.rfx,p.title,s.name,s.active?"Actif":"Archivé",n.at,n.text])])));
 add("Relances",["RFX Digibuy","Projet","Destinataire","Objet","Relance UTC","Rappel UTC","Statut","Retour","Notification","Note"],projects.flatMap(p=>p.followups.map(f=>[p.rfx,p.title,f.targetName,followupReason[f.reason],f.sentAt,f.dueAt,f.status==="scheduled"?"Planifiée":f.status==="waiting"?"En attente":f.status==="received"?"Retour reçu":f.status==="cancelled"?"Annulée":"Ancienne relance",f.response,f.reminderEnabled?"Oui":"Non",f.note])));
 const k=performance(projects);add("Indicateurs",["Indicateur","Valeur","Périmètre"],[["Projets suivis",k.total,"Projets exportés"],["Projets clôturés",k.closed,"Projets exportés"],["Fournisseurs actifs",k.suppliers,"Hors archivés"],["Participations confirmées",k.participating,"Fournisseurs actifs"],["Offres reçues",k.received,`${k.eligible} fournisseurs hors refus`],["Gain (€)",k.priced?k.savings:null,`${k.priced} projets avec budget et montant final`],["Gain (%)",k.savingsRate,"Gain / budget comparable"],["Délai moyen AO-clôture (jours)",k.averageCycle,`${k.cycleCount} projets avec les deux dates`]]);
 return wb;
}
export async function downloadProjects(projects:Project[]){const wb=await createExportWorkbook(projects);const data=await wb.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));const a=document.createElement("a");a.href=url;a.download=`Pilotage_achats_${todayISO()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
