// lib/export-projects.ts
import Excel from "exceljs";

// lib/project.ts
import { z } from "zod";
var stages = [
  { id: "ao", label: "AO lanc\xE9/En attente des offres", short: "Attente des offres", color: "#2563eb", bg: "#eaf1ff" },
  { id: "analysis", label: "Analyse technique en cours", short: "Analyse technique", color: "#7c3aed", bg: "#f2eafe" },
  { id: "negotiation", label: "N\xE9gociation", short: "N\xE9gociation", color: "#b7790b", bg: "#fff5dc" },
  { id: "contract", label: "Contrat en cours de signature", short: "Signature contrat", color: "#be457b", bg: "#fcecf3" },
  { id: "pr", label: "PR en cours", short: "PR en cours", color: "#0891b2", bg: "#e6f7fb" },
  { id: "bc", label: "BC en signature", short: "BC en signature", color: "#4f46e5", bg: "#eeeeff" },
  { id: "closed", label: "BC sign\xE9/Cl\xF4tur\xE9", short: "Cl\xF4tur\xE9", color: "#16805b", bg: "#e7f5ee" },
  { id: "standby", label: "Standby", short: "Standby", color: "#64748b", bg: "#eef1f5" }
];
var participation = ["participe", "ne participe pas", "pas de retour", "pas de r\xE9ponse"];
var str = z.string().max(2e3);
var dateSchema = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Date invalide");
var amount = z.number().finite().min(0).max(1e12).nullable();
var supplierPointSchema = z.object({ id: z.string().min(1).max(100), at: z.string().datetime(), text: z.string().trim().min(1).max(1e4) });
var supplierSchema = z.object({ id: z.string().min(1).max(100), name: str.trim().min(1), contact: str, status: z.enum(participation), note: z.string().max(1e4), points: z.array(supplierPointSchema).max(5e3).default([]), active: z.boolean(), offerReceived: z.boolean().default(false), offers: z.tuple([amount, amount, amount]) });
var noteSchema = z.object({ id: z.string().min(1).max(100), text: z.string().max(2e4) });
var followupResponses = ["en attente", "pas de r\xE9ponse", "participe", "ne participe pas", "retour re\xE7u"];
var followupSchema = z.object({ id: z.string().min(1).max(100), targetType: z.enum(["supplier", "prescriber"]), supplierId: z.string().max(100).default(""), targetName: str.trim().min(1, "Indiquez le destinataire de la relance."), reason: z.enum(["offer", "participation", "technical", "other"]), sentAt: z.string().datetime(), dueAt: z.string().datetime(), status: z.enum(["scheduled", "waiting", "received", "superseded", "cancelled"]), note: z.string().max(1e4).default(""), receivedAt: z.string().default(""), response: z.enum(followupResponses).default("en attente"), reminderEnabled: z.boolean().default(true), independent: z.boolean().default(false) });
var editableSchema = z.object({
  rfx: str,
  company: str,
  site: str,
  prescriber: str,
  title: str.trim().min(1, "L\u2019intitul\xE9 du projet est obligatoire."),
  cpsDate: dateSchema,
  aoDate: dateSchema,
  deadline: dateSchema,
  segment: str,
  segmentTitle: str,
  stage: z.enum(["ao", "analysis", "negotiation", "contract", "pr", "bc", "closed", "standby"]),
  suppliers: z.array(supplierSchema).max(1e3),
  budget: amount,
  finalAmount: amount,
  awarded: str,
  pr: str,
  bc: str,
  nextAction: str,
  actionDue: dateSchema,
  owner: str,
  notes: z.string().max(5e5),
  projectNotes: z.array(noteSchema).max(2e3).default([]),
  followups: z.array(followupSchema).max(5e3).default([]),
  technicalDue: dateSchema.default(""),
  technicalReceived: z.boolean().default(false),
  offerReminderEnabled: z.boolean().default(true),
  participationReminderEnabled: z.boolean().default(true),
  technicalReminderEnabled: z.boolean().default(true),
  actionReminderEnabled: z.boolean().default(true),
  offerReminderDate: dateSchema.default(""),
  participationReminderDate: dateSchema.default(""),
  closedDate: dateSchema.default("")
}).superRefine((p, ctx) => {
  if (new Set(p.suppliers.map((s) => s.id)).size !== p.suppliers.length) ctx.addIssue({ code: "custom", message: "Identifiants fournisseurs dupliqu\xE9s.", path: ["suppliers"] });
  for (const s of p.suppliers) if (new Set(s.points.map((n) => n.id)).size !== s.points.length) ctx.addIssue({ code: "custom", message: "Identifiants des points de suivi dupliqu\xE9s." });
  for (const f of p.followups) {
    if (f.status !== "scheduled" && f.dueAt < f.sentAt) ctx.addIssue({ code: "custom", message: "Le rappel doit suivre la date de relance." });
    if (f.targetType === "supplier" && !p.suppliers.some((s) => s.id === f.supplierId)) ctx.addIssue({ code: "custom", message: "Fournisseur de la relance introuvable." });
    if (f.status !== "scheduled" && Date.parse(f.sentAt) > Date.now() + 3e5) ctx.addIssue({ code: "custom", message: "Pour une date future, choisissez Planifier une relance." });
  }
  for (const list of [p.projectNotes, p.followups]) if (new Set(list.map((x) => x.id)).size !== list.length) ctx.addIssue({ code: "custom", message: "Identifiants de suivi dupliqu\xE9s." });
});
var todayISO = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
function shiftDate(iso, days) {
  if (!iso) return "";
  const d = /* @__PURE__ */ new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
var latestOffer = (s) => [...s.offers].reverse().find((v) => v !== null) ?? null;
var hasOffer = (s) => s.offerReceived || latestOffer(s) !== null;
var activeSuppliers = (p) => p.suppliers.filter((s) => s.active);
var pendingOffers = (p) => activeSuppliers(p).filter((s) => s.status !== "ne participe pas" && !hasOffer(s));
function average(p) {
  const a = activeSuppliers(p).filter((s) => s.status !== "ne participe pas").map(latestOffer).filter((n) => n !== null);
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}
var gain = (p) => p.budget !== null && p.budget > 0 && p.finalAmount !== null ? (p.budget - p.finalAmount) / p.budget * 100 : null;
var offerReminderDay = (p) => p.offerReminderDate || shiftDate(p.deadline, -3);
var noParticipationResponse = (s) => s.status === "pas de retour" || s.status === "pas de r\xE9ponse";
var followupReason = { offer: "Soumission de l\u2019offre", participation: "Confirmation de participation", technical: "Retour d\u2019analyse technique", other: "Autre retour attendu" };

// lib/performance.ts
function performance(projects) {
  const suppliers = projects.flatMap(activeSuppliers), eligible = suppliers.filter((s) => s.status !== "ne participe pas"), priced = projects.filter((p) => p.budget !== null && p.budget > 0 && p.finalAmount !== null);
  const budget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0), comparableBudget = priced.reduce((sum, p) => sum + p.budget, 0), finalAmount = priced.reduce((sum, p) => sum + p.finalAmount, 0);
  const closed = projects.filter((p) => p.stage === "closed"), cycles = closed.filter((p) => p.aoDate && p.closedDate && p.closedDate >= p.aoDate).map((p) => (Date.parse(p.closedDate) - Date.parse(p.aoDate)) / 864e5);
  return { total: projects.length, active: projects.filter((p) => p.stage !== "closed" && p.stage !== "standby").length, closed: closed.length, standby: projects.filter((p) => p.stage === "standby").length, suppliers: suppliers.length, participating: suppliers.filter((s) => s.status === "participe").length, noReply: suppliers.filter(noParticipationResponse).length, refused: suppliers.filter((s) => s.status === "ne participe pas").length, received: eligible.filter(hasOffer).length, eligible: eligible.length, budget, comparableBudget, finalAmount, savings: comparableBudget - finalAmount, savingsRate: comparableBudget ? (comparableBudget - finalAmount) / comparableBudget * 100 : null, priced: priced.length, averageCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null, cycleCount: cycles.length };
}

// lib/export-projects.ts
function exportColumns(projects) {
  const supplierCount = Math.max(5, ...projects.map((p) => activeSuppliers(p).length));
  const basic = [{ key: "rfx", header: "RFX Digibuy", width: 17 }, { key: "company", header: "Soci\xE9t\xE9", width: 30 }, { key: "site", header: "Site", width: 20 }, { key: "prescriber", header: "Nom du prescripteur", width: 28 }, { key: "title", header: "Intitul\xE9 du projet", width: 55 }, { key: "cpsDate", header: "Date re\xE7u CPS", width: 18 }, { key: "aoDate", header: "Date envoi AO", width: 18 }, { key: "confirmation", header: "Date confirmation participation", width: 20 }, { key: "deadline", header: "Date limite de r\xE9ponse", width: 20 }, { key: "segment", header: "Segment", width: 12 }, { key: "segmentTitle", header: "Intitul\xE9 du segment", width: 38 }];
  for (let i = 1; i <= supplierCount; i++) basic.push({ key: `supplier${i}`, header: `Fournisseur ${i}`, width: 28 }, { key: `status${i}`, header: `Retour participation ${i}`, width: 23 });
  basic.push({ key: "reminder", header: "Relance soumission", width: 20 }, { key: "stage", header: "\xC9tat", width: 30 }, { key: "notes", header: "Commentaires", width: 60 });
  for (let v = 1; v <= 3; v++) for (let i = 1; i <= supplierCount; i++) basic.push({ key: `offer${i}v${v}`, header: `Offre F${i} Version ${v} (\u20AC)`, width: 21 });
  basic.push({ key: "awarded", header: "Fournisseur adjug\xE9", width: 30 }, { key: "budget", header: "Budget (\u20AC)", width: 20 }, { key: "average", header: "Moyenne des offres (\u20AC)", width: 21 }, { key: "finalAmount", header: "Montant final (\u20AC)", width: 20 }, { key: "gain", header: "Gain / budget (%)", width: 20 }, { key: "pr", header: "N\xB0 de PR", width: 18 }, { key: "bc", header: "N\xB0 du BC", width: 18 }, { key: "nextAction", header: "Prochaine action", width: 40 }, { key: "actionDue", header: "\xC9ch\xE9ance action", width: 20 }, { key: "owner", header: "Responsable", width: 23 }, { key: "technicalDue", header: "Date retour technique", width: 20 }, { key: "closedDate", header: "Date de cl\xF4ture", width: 20 });
  for (let i = 1; i <= supplierCount; i++) basic.push({ key: `contact${i}`, header: `Contact F${i}`, width: 28 }, { key: `point${i}`, header: `Points de suivi F${i}`, width: 50 });
  return basic;
}
function exportValue(p, key) {
  const s = activeSuppliers(p);
  let m = key.match(/^(supplier|status|contact|point)(\d+)$/);
  if (m) {
    const supplier = s[Number(m[2]) - 1];
    if (!supplier) return null;
    return m[1] === "supplier" ? supplier.name : m[1] === "status" ? supplier.status : m[1] === "contact" ? supplier.contact : [supplier.note, ...supplier.points.map((n) => `${n.at} : ${n.text}`)].filter(Boolean).join("\n\n");
  }
  m = key.match(/^offer(\d+)v([123])$/);
  if (m) return s[Number(m[1]) - 1]?.offers[Number(m[2]) - 1] ?? null;
  if (key === "confirmation") return shiftDate(p.aoDate, 2);
  if (key === "reminder") return p.offerReminderEnabled ? offerReminderDay(p) : "D\xE9sactiv\xE9e";
  if (key === "stage") return stages.find((s2) => s2.id === p.stage).label;
  if (key === "notes") return p.projectNotes.map((n, i) => `Note ${i + 1} : ${n.text}`).join("\n\n");
  if (key === "average") return average(p);
  if (key === "gain") return gain(p);
  const value = p[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
}
function styleSheet(ws, columns) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.views = [{ state: "frozen", xSplit: Math.min(2, columns.length), ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: columns.length } };
  ws.getRow(1).height = 42;
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203C64" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.height = 75;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 11, color: { argb: "FF253B56" } };
      cell.alignment = { wrapText: true, vertical: "top" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: n % 2 ? "FFF2F6FC" : "FFFFFFFF" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD8E2EF" } } };
    });
  });
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
async function createExportWorkbook(projects) {
  const wb = new Excel.Workbook();
  wb.creator = "Pilotage achats";
  wb.created = /* @__PURE__ */ new Date();
  const columns = exportColumns(projects), ws = wb.addWorksheet("Suivi projets");
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const p of projects) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, exportValue(p, c.key)])));
  styleSheet(ws, columns);
  const col = (key) => columns.findIndex((c) => c.key === key) + 1;
  const letter = (key) => ws.getColumn(col(key)).letter;
  const serial = (date) => date ? (Date.parse(date + "T12:00:00Z") - Date.UTC(1899, 11, 30)) / 864e5 : 0;
  projects.forEach((p, i) => {
    const row = ws.getRow(i + 2);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      if (c.key.startsWith("offer") || ["budget", "finalAmount", "average"].includes(c.key)) cell.numFmt = '#,##0.00 "\u20AC"';
      if (c.key === "gain") cell.numFmt = '0.00" %"';
      if (["cpsDate", "aoDate", "deadline", "confirmation", "reminder", "actionDue", "technicalDue", "closedDate"].includes(c.key) && /^\d{4}-\d{2}-\d{2}$/.test(String(cell.value || ""))) {
        cell.value = /* @__PURE__ */ new Date(String(cell.value) + "T12:00:00Z");
        cell.numFmt = "dd/mm/yyyy";
      }
    });
    const r = i + 2, ao = letter("aoDate") + r, budget = letter("budget") + r, final = letter("finalAmount") + r;
    row.getCell(col("confirmation")).value = { formula: `IF(ISNUMBER(${ao}),${ao}+2,"")`, result: p.aoDate ? serial(shiftDate(p.aoDate, 2)) : "" };
    row.getCell(col("confirmation")).numFmt = "dd/mm/yyyy";
    row.getCell(col("gain")).value = { formula: `IF(AND(ISNUMBER(${budget}),${budget}>0,ISNUMBER(${final})),100*(${budget}-${final})/${budget},"")`, result: gain(p) ?? "" };
    const latest = activeSuppliers(p).map((_, si) => {
      const status = letter(`status${si + 1}`) + r;
      const offers = [1, 2, 3].map((v) => letter(`offer${si + 1}v${v}`) + r);
      return { value: `IF(${status}="ne participe pas",0,IF(ISNUMBER(${offers[2]}),${offers[2]},IF(ISNUMBER(${offers[1]}),${offers[1]},IF(ISNUMBER(${offers[0]}),${offers[0]},0))))`, count: `IF(AND(${status}<>"ne participe pas",COUNT(${offers.join(",")})>0),1,0)` };
    });
    if (latest.length && latest.map((x) => x.value + x.count).join("").length < 7800) row.getCell(col("average")).value = { formula: `IFERROR((${latest.map((x) => x.value).join("+")})/(${latest.map((x) => x.count).join("+")}),"")`, result: average(p) ?? "" };
    if (p.offerReminderEnabled && !p.offerReminderDate) {
      const deadline = letter("deadline") + r;
      row.getCell(col("reminder")).value = { formula: `IF(ISNUMBER(${deadline}),${deadline}-3,"")`, result: p.deadline ? serial(shiftDate(p.deadline, -3)) : "" };
      row.getCell(col("reminder")).numFmt = "dd/mm/yyyy";
    }
    const stage = stages.find((s) => s.id === p.stage);
    row.getCell(col("stage")).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + stage.bg.slice(1) } };
    row.getCell(col("stage")).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF" + stage.color.slice(1) } };
    activeSuppliers(p).forEach((s, index) => {
      const cell = row.getCell(col(`status${index + 1}`));
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.status === "participe" ? "FFE7F5EE" : s.status === "ne participe pas" ? "FFFDEBEB" : "FFFFF5DC" } };
    });
  });
  const reminderColumn = ws.getColumn(col("reminder")).letter, stageColumn = ws.getColumn(col("stage")).letter;
  projects.forEach((p, i) => {
    if (p.offerReminderEnabled && pendingOffers(p).length) {
      const r = i + 2;
      ws.addConditionalFormatting({ ref: `${reminderColumn}${r}`, rules: [{ type: "expression", priority: i + 1, formulae: [`AND(ISNUMBER(${reminderColumn}${r}),${reminderColumn}${r}<=TODAY(),${stageColumn}${r}="AO lanc\xE9/En attente des offres")`], style: { font: { color: { argb: "FFB42318" }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE4E2" } } } }] });
    }
  });
  const add = (name, heads, rows) => {
    const sheet = wb.addWorksheet(name);
    sheet.addRow(heads);
    rows.forEach((r) => sheet.addRow(r));
    styleSheet(sheet, heads.map((h, i) => ({ key: String(i), header: h, width: i < 2 ? 20 : 38 })));
  };
  add("Notes projet", ["RFX Digibuy", "Projet", "Note", "Texte"], projects.flatMap((p) => p.projectNotes.map((n, i) => [p.rfx, p.title, i + 1, n.text])));
  add("Points de suivi", ["RFX Digibuy", "Projet", "Fournisseur", "\xC9tat du fournisseur", "Date UTC", "Point de suivi"], projects.flatMap((p) => p.suppliers.flatMap((s) => [...s.note ? [[p.rfx, p.title, s.name, s.active ? "Actif" : "Archiv\xE9", "", s.note]] : [], ...s.points.map((n) => [p.rfx, p.title, s.name, s.active ? "Actif" : "Archiv\xE9", n.at, n.text])])));
  add("Relances", ["RFX Digibuy", "Projet", "Destinataire", "Objet", "Relance UTC", "Rappel UTC", "Statut", "Retour", "Notification", "Note"], projects.flatMap((p) => p.followups.map((f) => [p.rfx, p.title, f.targetName, followupReason[f.reason], f.sentAt, f.dueAt, f.status === "scheduled" ? "Planifi\xE9e" : f.status === "waiting" ? "En attente" : f.status === "received" ? "Retour re\xE7u" : f.status === "cancelled" ? "Annul\xE9e" : "Ancienne relance", f.response, f.reminderEnabled ? "Oui" : "Non", f.note])));
  const k = performance(projects);
  add("Indicateurs", ["Indicateur", "Valeur", "P\xE9rim\xE8tre"], [["Projets suivis", k.total, "Projets export\xE9s"], ["Projets cl\xF4tur\xE9s", k.closed, "Projets export\xE9s"], ["Fournisseurs actifs", k.suppliers, "Hors archiv\xE9s"], ["Participations confirm\xE9es", k.participating, "Fournisseurs actifs"], ["Offres re\xE7ues", k.received, `${k.eligible} fournisseurs hors refus`], ["Gain (\u20AC)", k.priced ? k.savings : null, `${k.priced} projets avec budget et montant final`], ["Gain (%)", k.savingsRate, "Gain / budget comparable"], ["D\xE9lai moyen AO-cl\xF4ture (jours)", k.averageCycle, `${k.cycleCount} projets avec les deux dates`]]);
  return wb;
}
async function downloadProjects(projects) {
  const wb = await createExportWorkbook(projects);
  const data = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Pilotage_achats_${todayISO()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
export {
  createExportWorkbook,
  downloadProjects,
  exportColumns,
  exportValue
};
