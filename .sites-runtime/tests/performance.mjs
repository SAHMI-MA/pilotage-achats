// lib/project.ts
import { z } from "zod";
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
var latestOffer = (s) => [...s.offers].reverse().find((v) => v !== null) ?? null;
var hasOffer = (s) => s.offerReceived || latestOffer(s) !== null;
var activeSuppliers = (p) => p.suppliers.filter((s) => s.active);
var noParticipationResponse = (s) => s.status === "pas de retour" || s.status === "pas de r\xE9ponse";

// lib/performance.ts
function performance(projects) {
  const suppliers = projects.flatMap(activeSuppliers), eligible = suppliers.filter((s) => s.status !== "ne participe pas"), priced = projects.filter((p) => p.budget !== null && p.budget > 0 && p.finalAmount !== null);
  const budget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0), comparableBudget = priced.reduce((sum, p) => sum + p.budget, 0), finalAmount = priced.reduce((sum, p) => sum + p.finalAmount, 0);
  const closed = projects.filter((p) => p.stage === "closed"), cycles = closed.filter((p) => p.aoDate && p.closedDate && p.closedDate >= p.aoDate).map((p) => (Date.parse(p.closedDate) - Date.parse(p.aoDate)) / 864e5);
  return { total: projects.length, active: projects.filter((p) => p.stage !== "closed" && p.stage !== "standby").length, closed: closed.length, standby: projects.filter((p) => p.stage === "standby").length, suppliers: suppliers.length, participating: suppliers.filter((s) => s.status === "participe").length, noReply: suppliers.filter(noParticipationResponse).length, refused: suppliers.filter((s) => s.status === "ne participe pas").length, received: eligible.filter(hasOffer).length, eligible: eligible.length, budget, comparableBudget, finalAmount, savings: comparableBudget - finalAmount, savingsRate: comparableBudget ? (comparableBudget - finalAmount) / comparableBudget * 100 : null, priced: priced.length, averageCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null, cycleCount: cycles.length };
}
export {
  performance
};
