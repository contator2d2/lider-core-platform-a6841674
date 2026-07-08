// Data & Scale — bulk import (CSV) and CSV exports.
// Import supports dry-run: valida linhas e retorna erros sem persistir.

import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles } from "../auth.js";
import { parseCsv, toCsv } from "../lib/csv.js";

export const dataRouter = Router();
dataRouter.use(requireAuth, requireRoles("super_admin", "neo_admin"));

// Accept larger CSV bodies for these routes
dataRouter.use((req, _res, next) => { req.setTimeout?.(60_000); next(); });

type ImportRow = { row: number; ok: boolean; message?: string; created?: boolean; updated?: boolean };
type ImportResult = { total: number; ok: number; failed: number; created: number; updated: number; rows: ImportRow[] };

// ============================================================
// IMPORT — Organizations
// Colunas: name, slug, cnpj, plan, status, city, state, phone, email
// ============================================================
const orgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/i),
  cnpj: z.string().optional(),
  plan: z.enum(["essencial", "profissional", "enterprise"]).optional(),
  status: z.enum(["trial", "active", "suspended", "canceled"]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
});

dataRouter.post("/import/organizations", async (req, res) => {
  const { csv, dryRun } = req.body as { csv?: string; dryRun?: boolean };
  if (!csv) return res.status(400).json({ error: "csv obrigatório" });
  const rows = parseCsv(csv);
  const out: ImportResult = { total: rows.length, ok: 0, failed: 0, created: 0, updated: 0, rows: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = orgSchema.safeParse(raw);
    if (!parsed.success) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }
    if (dryRun) { out.ok++; out.rows.push({ row: i + 2, ok: true }); continue; }
    try {
      const data = parsed.data;
      const existing = await prisma.organization.findUnique({ where: { slug: data.slug } });
      if (existing) {
        await prisma.organization.update({ where: { id: existing.id }, data });
        out.updated++;
        out.rows.push({ row: i + 2, ok: true, updated: true });
      } else {
        await prisma.organization.create({ data });
        out.created++;
        out.rows.push({ row: i + 2, ok: true, created: true });
      }
      out.ok++;
    } catch (err) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: (err as Error).message });
    }
  }
  res.json(out);
});

// ============================================================
// IMPORT — Hierarchy (branches/areas/teams em CSV plano)
// Colunas: organization_slug, branch_code, branch_name, area_name, team_name
// ============================================================
const hierSchema = z.object({
  organization_slug: z.string().min(1),
  branch_code: z.string().optional(),
  branch_name: z.string().optional(),
  area_name: z.string().optional(),
  team_name: z.string().optional(),
});

dataRouter.post("/import/hierarchy", async (req, res) => {
  const { csv, dryRun } = req.body as { csv?: string; dryRun?: boolean };
  if (!csv) return res.status(400).json({ error: "csv obrigatório" });
  const rows = parseCsv(csv);
  const out: ImportResult = { total: rows.length, ok: 0, failed: 0, created: 0, updated: 0, rows: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = hierSchema.safeParse(raw);
    if (!parsed.success) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }
    const d = parsed.data;
    const org = await prisma.organization.findUnique({ where: { slug: d.organization_slug } });
    if (!org) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: `organização ${d.organization_slug} não encontrada` });
      continue;
    }
    if (dryRun) { out.ok++; out.rows.push({ row: i + 2, ok: true }); continue; }
    try {
      let branchId: string | null = null;
      if (d.branch_code || d.branch_name) {
        const code = d.branch_code ?? null;
        const name = d.branch_name ?? d.branch_code ?? "Filial";
        const existing = code
          ? await prisma.branch.findFirst({ where: { organizationId: org.id, code } })
          : await prisma.branch.findFirst({ where: { organizationId: org.id, name } });
        const branch = existing
          ? await prisma.branch.update({ where: { id: existing.id }, data: { name } })
          : await prisma.branch.create({ data: { organizationId: org.id, code, name } });
        branchId = branch.id;
      }
      let areaId: string | null = null;
      if (d.area_name) {
        const existing = await prisma.area.findFirst({
          where: { organizationId: org.id, branchId, name: d.area_name },
        });
        const area = existing
          ? await prisma.area.update({ where: { id: existing.id }, data: { name: d.area_name } })
          : await prisma.area.create({ data: { organizationId: org.id, branchId, name: d.area_name } });
        areaId = area.id;
      }
      if (d.team_name && areaId) {
        const existing = await prisma.team.findFirst({
          where: { organizationId: org.id, areaId, name: d.team_name },
        });
        if (!existing) {
          await prisma.team.create({ data: { organizationId: org.id, areaId, name: d.team_name } });
        }
      }
      out.ok++;
      out.created++;
      out.rows.push({ row: i + 2, ok: true, created: true });
    } catch (err) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: (err as Error).message });
    }
  }
  res.json(out);
});

// ============================================================
// IMPORT — Users (com membership opcional)
// Colunas: email, full_name, password, role, organization_slug, branch_code, area_name, team_name, phone, whatsapp, cpf, job_title
// ============================================================
const userSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["super_admin", "neo_admin", "franchise_owner", "hr_admin", "leader", "collaborator"]).optional(),
  organization_slug: z.string().optional(),
  branch_code: z.string().optional(),
  area_name: z.string().optional(),
  team_name: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  job_title: z.string().optional(),
});

dataRouter.post("/import/users", async (req, res) => {
  const { csv, dryRun, defaultPassword } = req.body as { csv?: string; dryRun?: boolean; defaultPassword?: string };
  if (!csv) return res.status(400).json({ error: "csv obrigatório" });
  const rows = parseCsv(csv);
  const out: ImportResult = { total: rows.length, ok: 0, failed: 0, created: 0, updated: 0, rows: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = userSchema.safeParse(raw);
    if (!parsed.success) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: JSON.stringify(parsed.error.flatten().fieldErrors) });
      continue;
    }
    if (dryRun) { out.ok++; out.rows.push({ row: i + 2, ok: true }); continue; }
    try {
      const d = parsed.data;
      const email = d.email.toLowerCase().trim();
      const password = d.password || defaultPassword || Math.random().toString(36).slice(2, 12);
      const hash = await bcrypt.hash(password, 10);

      let user = await prisma.user.findUnique({ where: { email } });
      let created = false;
      if (!user) {
        user = await prisma.user.create({
          data: { email, passwordHash: hash, profile: { create: { fullName: d.full_name ?? email } } },
        });
        created = true;
      }
      // Profile update
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {
          fullName: d.full_name ?? undefined,
          phone: d.phone,
          whatsapp: d.whatsapp,
          cpf: d.cpf,
          jobTitle: d.job_title,
        },
        create: {
          id: user.id,
          fullName: d.full_name ?? email,
          phone: d.phone,
          whatsapp: d.whatsapp,
          cpf: d.cpf,
          jobTitle: d.job_title,
        },
      });
      if (d.role) {
        await prisma.userRole.upsert({
          where: { userId_role: { userId: user.id, role: d.role } },
          update: {},
          create: { userId: user.id, role: d.role },
        });
      }
      if (d.organization_slug) {
        const org = await prisma.organization.findUnique({ where: { slug: d.organization_slug } });
        if (org) {
          let branchId: string | null = null;
          let areaId: string | null = null;
          let teamId: string | null = null;
          if (d.branch_code) {
            const b = await prisma.branch.findFirst({ where: { organizationId: org.id, code: d.branch_code } });
            branchId = b?.id ?? null;
          }
          if (d.area_name) {
            const a = await prisma.area.findFirst({ where: { organizationId: org.id, name: d.area_name } });
            areaId = a?.id ?? null;
          }
          if (d.team_name && areaId) {
            const t = await prisma.team.findFirst({ where: { organizationId: org.id, areaId, name: d.team_name } });
            teamId = t?.id ?? null;
          }
          await prisma.membership.upsert({
            where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
            update: { branchId, areaId, teamId, role: d.role ?? undefined },
            create: {
              userId: user.id,
              organizationId: org.id,
              role: d.role ?? "collaborator",
              branchId,
              areaId,
              teamId,
            },
          });
        }
      }
      out.ok++;
      if (created) out.created++;
      else out.updated++;
      out.rows.push({ row: i + 2, ok: true, created, updated: !created });
    } catch (err) {
      out.failed++;
      out.rows.push({ row: i + 2, ok: false, message: (err as Error).message });
    }
  }
  res.json(out);
});

// ============================================================
// EXPORTS
// ============================================================
function sendCsv(res: import("express").Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
}

dataRouter.get("/export/organizations", async (_req, res) => {
  const rows = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  const csv = toCsv(
    rows.map((o) => ({
      name: o.name, slug: o.slug, cnpj: o.cnpj, plan: o.plan, status: o.status,
      city: o.city, state: o.state, phone: o.phone, email: o.email,
      employee_count: o.employeeCount, license_count: o.licenseCount, created_at: o.createdAt.toISOString(),
    })),
  );
  sendCsv(res, "organizations.csv", csv);
});

dataRouter.get("/export/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { profile: true, roles: true, memberships: { include: { organization: { select: { slug: true } } } } },
    orderBy: { email: "asc" },
  });
  const csv = toCsv(
    users.map((u) => ({
      email: u.email,
      full_name: u.profile?.fullName ?? "",
      phone: u.profile?.phone ?? "",
      whatsapp: u.profile?.whatsapp ?? "",
      cpf: u.profile?.cpf ?? "",
      job_title: u.profile?.jobTitle ?? "",
      roles: u.roles.map((r) => r.role).join("|"),
      organizations: u.memberships.map((m) => m.organization.slug).join("|"),
      created_at: u.createdAt.toISOString(),
    })),
  );
  sendCsv(res, "users.csv", csv);
});

dataRouter.get("/export/hierarchy", async (_req, res) => {
  const teams = await prisma.team.findMany({
    include: {
      area: { include: { branch: true } },
      organization: { select: { slug: true } },
    },
    orderBy: [{ organizationId: "asc" }, { areaId: "asc" }, { name: "asc" }],
  });
  const csv = toCsv(
    teams.map((t) => ({
      organization_slug: t.organization.slug,
      branch_code: t.area.branch?.code ?? "",
      branch_name: t.area.branch?.name ?? "",
      area_name: t.area.name,
      team_name: t.name,
    })),
    ["organization_slug", "branch_code", "branch_name", "area_name", "team_name"],
  );
  sendCsv(res, "hierarchy.csv", csv);
});

dataRouter.get("/export/invoices", async (_req, res) => {
  const rows = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscription: { include: { plan: { select: { name: true } } } } },
  });
  const csv = toCsv(
    rows.map((i) => ({
      id: i.id,
      status: i.status,
      amount_brl: (i.amountCents / 100).toFixed(2),
      currency: i.currency,
      plan: i.subscription?.plan?.name ?? "",
      due_date: i.dueDate?.toISOString() ?? "",
      paid_at: i.paidAt?.toISOString() ?? "",
      created_at: i.createdAt.toISOString(),
    })),
  );
  sendCsv(res, "invoices.csv", csv);
});

dataRouter.get("/export/audit", async (req, res) => {
  const take = Math.min(Number(req.query.take) || 5000, 50000);
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take });
  const csv = toCsv(
    rows.map((r) => ({
      created_at: r.createdAt.toISOString(),
      actor_user_id: r.actorUserId ?? "",
      action: r.action,
      target_type: r.targetType ?? "",
      target_id: r.targetId ?? "",
      metadata: r.metadata ? JSON.stringify(r.metadata) : "",
    })),
  );
  sendCsv(res, "audit.csv", csv);
});

// ============================================================
// SAMPLES — modelos prontos para o usuário baixar
// ============================================================
const SAMPLES: Record<string, string> = {
  organizations:
    "name,slug,cnpj,plan,status,city,state,phone,email\n" +
    "Igreja Exemplo,igreja-exemplo,00.000.000/0001-00,essencial,trial,São Paulo,SP,11999999999,contato@exemplo.com\n",
  hierarchy:
    "organization_slug,branch_code,branch_name,area_name,team_name\n" +
    "igreja-exemplo,MATRIZ,Matriz,Louvor,Vocal\n" +
    "igreja-exemplo,MATRIZ,Matriz,Louvor,Banda\n" +
    "igreja-exemplo,MATRIZ,Matriz,Ministério Infantil,Berçário\n",
  users:
    "email,full_name,password,role,organization_slug,branch_code,area_name,team_name,phone,whatsapp,cpf,job_title\n" +
    "pastor@exemplo.com,Pastor Exemplo,,leader,igreja-exemplo,MATRIZ,Louvor,Vocal,,5511999999999,,Pastor\n",
};

dataRouter.get("/sample/:entity", (req, res) => {
  const s = SAMPLES[req.params.entity];
  if (!s) return res.status(404).json({ error: "amostra não encontrada" });
  sendCsv(res, `${req.params.entity}-sample.csv`, s);
});