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
var knownSegments = { NA24: "VRD", NA25: "Gros \u0153uvre", NA28: "\xC9lectricit\xE9, courants forts / courants faibles" };
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
var blankProject = () => ({ rfx: "", company: "", site: "", prescriber: "", title: "", cpsDate: "", aoDate: "", deadline: "", segment: "", segmentTitle: "", stage: "ao", suppliers: [], budget: null, finalAmount: null, awarded: "", pr: "", bc: "", nextAction: "", actionDue: "", owner: "", notes: "", projectNotes: [], followups: [], technicalDue: "", technicalReceived: false, offerReminderEnabled: true, participationReminderEnabled: true, technicalReminderEnabled: true, actionReminderEnabled: true, offerReminderDate: "", participationReminderDate: "", closedDate: "" });
var newSupplier = (name) => ({ id: crypto.randomUUID(), name, contact: "", status: "pas de retour", note: "", points: [], active: true, offerReceived: false, offers: [null, null, null] });
function segmentCatalogue(projects) {
  const result = { ...knownSegments };
  for (const p of projects) {
    const code = p.segment.trim().toUpperCase();
    if (code && p.segmentTitle && !result[code]) result[code] = p.segmentTitle;
  }
  return result;
}

// lib/import-projects.ts
var normalizeHeader = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
var importFields = [
  { key: "rfx", label: "RFX Digibuy", aliases: ["rfx", "rfxdigibuy", "numerorfx"] },
  { key: "company", label: "Soci\xE9t\xE9", aliases: ["societe", "entreprise"] },
  { key: "site", label: "Site", aliases: ["site"] },
  { key: "prescriber", label: "Nom du prescripteur", aliases: ["prescripteur", "nomduprescripteur"] },
  { key: "title", label: "Intitul\xE9 du projet", aliases: ["intituleduprojet", "projet", "intituleprojet", "nomduprojet"] },
  { key: "cpsDate", label: "Date re\xE7u CPS", aliases: ["daterecucps", "datereceptioncps", "datedereceptionducps"] },
  { key: "aoDate", label: "Date envoi AO", aliases: ["dateenvoiao", "dateenvoieao", "datedenvoidelao"] },
  { key: "deadline", label: "Date limite de r\xE9ponse", aliases: ["datelimitedereponse", "datelimitereponse", "datelimite", "datesoumission"] },
  { key: "segment", label: "Segment", aliases: ["segment", "codesegment"] },
  { key: "segmentTitle", label: "Intitul\xE9 du segment", aliases: ["intituledus egment".replace(" ", ""), "intituled u segment".replaceAll(" ", ""), "intitulesegment"] },
  { key: "stage", label: "\xC9tat", aliases: ["etat", "etatduprojet", "statut"] },
  { key: "notes", label: "Notes / commentaires", aliases: ["commentaires", "commentaire", "notes", "notesduprojet"] },
  { key: "awarded", label: "Fournisseur adjug\xE9", aliases: ["fournisseuradjuge", "fournisseurretenu"] },
  { key: "budget", label: "Budget (\u20AC)", aliases: ["budget", "budgete", "budgeteur"] },
  { key: "finalAmount", label: "Montant final (\u20AC)", aliases: ["montantfinal", "montantfinale", "montantfinaleur"] },
  { key: "pr", label: "N\xB0 de PR", aliases: ["ndepr", "npr", "numeropr"] },
  { key: "bc", label: "N\xB0 du BC", aliases: ["ndubc", "nbc", "numerobc"] },
  { key: "nextAction", label: "Prochaine action", aliases: ["prochaineaction", "action"] },
  { key: "actionDue", label: "\xC9ch\xE9ance action", aliases: ["echeanceaction", "echeance", "afairepourle"] },
  { key: "owner", label: "Responsable", aliases: ["responsable", "responsabledusuivi"] },
  { key: "technicalDue", label: "Date retour technique", aliases: ["dateretourtechnique", "dateattendueduret ourtechnique".replace(" ", ""), "echeanceretourtechnique"] },
  { key: "closedDate", label: "Date de cl\xF4ture", aliases: ["datedecloture", "datecloture"] },
  { key: "offerReminderDate", label: "Date relance soumission", aliases: ["relancesoumission", "daterelancesoumission"] },
  ...Array.from({ length: 5 }, (_, i) => [
    { key: `supplier${i + 1}`, label: `Fournisseur ${i + 1}`, aliases: [`fournisseur${i + 1}`, `prestataire${i + 1}`, `f${i + 1}`] },
    { key: `status${i + 1}`, label: `Retour participation ${i + 1}`, aliases: [`retourparticipation${i + 1}`, `retourparticpation${i + 1}`, `participation${i + 1}`, `retour${i + 1}`] },
    { key: `contact${i + 1}`, label: `Contact F${i + 1}`, aliases: [`contactf${i + 1}`, `contactfournisseur${i + 1}`] },
    { key: `point${i + 1}`, label: `Points de suivi F${i + 1}`, aliases: [`pointsdesuivif${i + 1}`, `dernierpointdesuivif${i + 1}`] },
    ...Array.from({ length: 3 }, (_2, v) => ({ key: `offer${i + 1}v${v + 1}`, label: `Offre F${i + 1} Version ${v + 1}`, aliases: [`offref${i + 1}version${v + 1}`, `offref${i + 1}v${v + 1}`, `offref${i + 1}version${v + 1}e`, `offref${i + 1}v${v + 1}e`, `f${i + 1}v${v + 1}`] }))
  ]).flat()
];
function suggestMapping(headers) {
  return headers.map((h) => {
    const text = normalizeHeader(h), known = importFields.find((f) => f.aliases.includes(text));
    if (known) return known.key;
    let m = text.match(/^(?:fournisseur|prestataire|f)(\d+)$/);
    if (m && Number(m[1]) <= 1e3) return `supplier${Number(m[1])}`;
    m = text.match(/^(?:retourparticipation|retourparticpation|participation|retour)(\d+)$/);
    if (m && Number(m[1]) <= 1e3) return `status${Number(m[1])}`;
    m = text.match(/^contact(?:fournisseur|f)(\d+)$/);
    if (m && Number(m[1]) <= 1e3) return `contact${Number(m[1])}`;
    m = text.match(/^(?:pointsdesuivi|dernierpointdesuivi)f(\d+)$/);
    if (m && Number(m[1]) <= 1e3) return `point${Number(m[1])}`;
    m = text.match(/^(?:offre)?f(\d+)(?:version|v)([123])(?:e|eur)?$/);
    if (m && Number(m[1]) <= 1e3) return `offer${Number(m[1])}v${m[2]}`;
    return "";
  });
}
function mappingOptions(headers) {
  const result = importFields.map((f) => ({ value: f.key, label: f.label }));
  suggestMapping(headers).forEach((key, i) => {
    if (key && !result.some((f) => f.value === key)) result.push({ value: key, label: String(headers[i]) });
  });
  return result;
}
function findHeader(rows) {
  let best = 0, score = 0;
  rows.slice(0, 60).forEach((r, i) => {
    const m = suggestMapping(r);
    const n = m.filter(Boolean).length + (m.includes("title") ? 10 : 0) + (m.includes("rfx") ? 4 : 0);
    if (n > score) {
      score = n;
      best = i;
    }
  });
  return best;
}
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/).slice(0, 5).join("\n");
  const delimiter = [";", "	", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Une cellule CSV contient des guillemets non ferm\xE9s.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function importDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw Error("Date invalide");
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30) + value * 864e5).toISOString().slice(0, 10);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) throw Error(`Date non reconnue \xAB ${s} \xBB ; utilisez JJ/MM/AAAA.`);
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function importAmount(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw Error("Montant invalide");
    return value;
  }
  let s = String(value).replace(/EUR/gi, "").replace(/[\s\u00a0\u202f€]/g, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replaceAll(".", "").replace(",", ".");
    else s = s.replaceAll(",", "");
  } else if (s.includes(",")) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replaceAll(",", "") : s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) throw Error(`Montant non reconnu \xAB ${value} \xBB.`);
  return Number(s);
}
var statusAliases = { participe: "participe", oui: "participe", confirmationok: "participe", confirme: "participe", neparticipepas: "ne participe pas", non: "ne participe pas", refuse: "ne participe pas", pasderetour: "pas de retour", pasdereponse: "pas de r\xE9ponse", enattente: "pas de retour" };
function importStage(v) {
  const s = normalizeHeader(v);
  const m = stages.find((x) => [x.id, x.label, x.short].some((y) => normalizeHeader(y) === s));
  if (m) return m.id;
  if (s.includes("aolance") || s.includes("attentedesoffres")) return "ao";
  if (s.includes("bcsigne") || s === "cloture") return "closed";
  throw Error(`\xC9tat non reconnu \xAB ${v} \xBB.`);
}
function previewImport(rows, mapping, projects, headerRow) {
  const catalogue = segmentCatalogue(projects);
  const seen = /* @__PURE__ */ new Set();
  const output = [];
  rows.slice(headerRow + 1).forEach((row, index) => {
    const values = {};
    mapping.forEach((key, i) => {
      if (key && row[i] !== null && row[i] !== void 0 && String(row[i]).trim() !== "") values[key] = row[i];
    });
    if (!Object.keys(values).length) return;
    const errors = [];
    const rfx = String(values.rfx ?? "").trim(), title = String(values.title ?? "").trim();
    if (!rfx && !title) return;
    const identity = rfx ? `rfx:${rfx}` : [values.company, values.site, title].map(normalizeHeader).join("|");
    if (seen.has(identity)) errors.push("Projet pr\xE9sent plusieurs fois dans le fichier.");
    seen.add(identity);
    const matches = projects.filter((p) => rfx ? p.rfx === rfx : normalizeHeader(p.title) === normalizeHeader(title) && normalizeHeader(p.site) === normalizeHeader(values.site) && normalizeHeader(p.company) === normalizeHeader(values.company));
    if (matches.length > 1) errors.push("Plusieurs projets existants correspondent \xE0 ce RFX. Corrigez le doublon avant import.");
    const existing = matches[0];
    const draft = existing ? structuredClone(existing) : blankProject();
    const attempt = (label, fn) => {
      try {
        fn();
      } catch (e) {
        errors.push(`${label} : ${e.message}`);
      }
    };
    const texts = ["rfx", "company", "site", "prescriber", "title", "segment", "segmentTitle", "awarded", "pr", "bc", "nextAction", "owner"];
    for (const k of texts) if (values[k] !== void 0) draft[k] = String(values[k]).trim();
    for (const k of ["cpsDate", "aoDate", "deadline", "actionDue", "technicalDue", "closedDate", "offerReminderDate"]) if (values[k] !== void 0) {
      if (k === "offerReminderDate" && normalizeHeader(values[k]) === "desactivee") draft.offerReminderEnabled = false;
      else attempt(k, () => {
        draft[k] = importDate(values[k]);
      });
    }
    for (const k of ["budget", "finalAmount"]) if (values[k] !== void 0) attempt(k, () => {
      draft[k] = importAmount(values[k]);
    });
    if (values.stage !== void 0) attempt("\xC9tat", () => {
      draft.stage = importStage(values.stage);
    });
    if (values.notes !== void 0) {
      const text = String(values.notes).trim();
      if (!draft.projectNotes.some((n) => n.text === text) && draft.notes !== text) {
        for (const part of text.split(/(?:^|\n\n)Note \d+ : /).filter(Boolean)) {
          if (!draft.projectNotes.some((n) => n.text === part)) draft.projectNotes.push({ id: crypto.randomUUID(), text: part });
        }
      }
    }
    draft.segment = draft.segment.trim().toUpperCase();
    if (catalogue[draft.segment]) draft.segmentTitle = catalogue[draft.segment];
    else if (draft.segment && draft.segmentTitle) catalogue[draft.segment] = draft.segmentTitle;
    const indices = [...new Set(Object.keys(values).flatMap((k) => {
      const m = k.match(/^(?:supplier|status|contact|point|offer)(\d+)/);
      return m ? [Number(m[1])] : [];
    }))].sort((a, b) => a - b);
    for (const i of indices) {
      const name = String(values[`supplier${i}`] ?? "").trim();
      if (!name) {
        if (Object.keys(values).some((k) => k === `status${i}` || k.startsWith(`offer${i}v`))) errors.push(`F${i} : nom du fournisseur manquant.`);
        continue;
      }
      let s = draft.suppliers.find((s2) => s2.active && normalizeHeader(s2.name) === normalizeHeader(name));
      if (!s) {
        s = newSupplier(name);
        draft.suppliers.push(s);
      }
      if (values[`status${i}`] !== void 0) {
        const v = statusAliases[normalizeHeader(values[`status${i}`])];
        if (!v) errors.push(`F${i} : retour de participation non reconnu.`);
        else s.status = v;
      }
      if (values[`contact${i}`] !== void 0) s.contact = String(values[`contact${i}`]);
      if (values[`point${i}`] !== void 0) {
        const text = String(values[`point${i}`]).trim();
        const combined = [s.note, ...s.points.map((n) => `${n.at} : ${n.text}`)].filter(Boolean).join("\n\n");
        if (text && text !== combined && text !== s.note && !s.points.some((n) => n.text === text)) s.points.push({ id: crypto.randomUUID(), at: (/* @__PURE__ */ new Date()).toISOString(), text });
      }
      for (let v = 1; v <= 3; v++) if (values[`offer${i}v${v}`] !== void 0) attempt(`F${i} V${v}`, () => {
        s.offers[v - 1] = importAmount(values[`offer${i}v${v}`]);
      });
    }
    const parsed = editableSchema.safeParse(draft);
    if (!parsed.success) errors.push(...parsed.error.issues.map((i) => i.message));
    output.push({ row: headerRow + index + 2, project: draft, existing, errors: [...new Set(errors)], mode: existing ? "update" : "new" });
  });
  return output;
}
export {
  findHeader,
  importAmount,
  importDate,
  importFields,
  mappingOptions,
  normalizeHeader,
  parseCSV,
  previewImport,
  suggestMapping
};
