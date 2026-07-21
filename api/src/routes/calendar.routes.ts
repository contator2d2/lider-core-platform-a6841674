import { Router } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Fase 4 · Google Calendar sync via iCal feed (item 18).
 * - Rota pública `/api/public/calendar/:orgId/:token.ics` serve iCal.
 * - Rota autenticada retorna/gera o token do calendário para copiar a URL.
 */
export const calendarPublicRouter = Router();
export const calendarRouter = Router();
calendarRouter.use(requireAuth);

function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function toIcsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ---------- Autenticado: gerar/consultar token ----------
calendarRouter.get("/:orgId/calendar/feed", async (req, res) => {
  const orgId = req.params.orgId;
  const m = await prisma.membership.findFirst({ where: { userId: req.userId!, organizationId: orgId } });
  const isSuper = await prisma.userRole.findFirst({ where: { userId: req.userId!, role: { in: ["super_admin", "neo_admin"] } } });
  if (!m && !isSuper) return res.status(403).json({ error: "Forbidden" });

  let org = await prisma.organization.findUnique({ where: { id: orgId }, select: { calendarToken: true } });
  if (!org?.calendarToken) {
    const token = randomBytes(24).toString("base64url");
    org = await prisma.organization.update({
      where: { id: orgId },
      data: { calendarToken: token },
      select: { calendarToken: true },
    });
  }
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    token: org.calendarToken,
    url: `${base}/api/public/calendar/${orgId}/${org.calendarToken}.ics`,
    webcal: `webcal://${req.get("host")}/api/public/calendar/${orgId}/${org.calendarToken}.ics`,
  });
});

calendarRouter.post("/:orgId/calendar/feed/rotate", async (req, res) => {
  const orgId = req.params.orgId;
  const m = await prisma.membership.findFirst({ where: { userId: req.userId!, organizationId: orgId } });
  const isSuper = await prisma.userRole.findFirst({ where: { userId: req.userId!, role: { in: ["super_admin", "neo_admin"] } } });
  if (!m && !isSuper) return res.status(403).json({ error: "Forbidden" });

  const token = randomBytes(24).toString("base64url");
  await prisma.organization.update({ where: { id: orgId }, data: { calendarToken: token } });
  res.json({ token });
});

// ---------- Público: .ics ----------
calendarPublicRouter.get("/calendar/:orgId/:token.ics", async (req, res) => {
  const { orgId, token } = req.params;
  const org = await prisma.organization.findFirst({
    where: { id: orgId, calendarToken: token },
    select: { id: true, name: true },
  });
  if (!org) return res.status(404).send("Not found");

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400_000);
  const to = new Date(now.getTime() + 180 * 86400_000);

  const [occurrences, delegations, oneOnOnes] = await Promise.all([
    prisma.ritualOccurrence.findMany({
      where: { ritual: { organizationId: orgId }, scheduledAt: { gte: from, lte: to } },
      include: { ritual: { select: { name: true, type: true } } },
    }),
    prisma.delegation.findMany({
      where: { organizationId: orgId, dueAt: { gte: from, lte: to }, status: { in: ["open", "in_progress"] } },
      select: { id: true, title: true, description: true, dueAt: true },
    }),
    prisma.oneOnOne.findMany({
      where: { organizationId: orgId, scheduledAt: { gte: from, lte: to } },
      select: { id: true, scheduledAt: true, durationMin: true, subjectUserId: true, summary: true },
    }),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LiderCore//Sync//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape("LíderCore · " + org.name)}`,
  ];

  const push = (uid: string, start: Date, minutes: number, title: string, desc?: string) => {
    const end = new Date(start.getTime() + minutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@lidercore`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      desc ? `DESCRIPTION:${icsEscape(desc)}` : "",
      "END:VEVENT",
    );
  };

  for (const o of occurrences) push(o.id, o.scheduledAt, 30, `[Ritual] ${o.ritual?.name ?? ""}`, o.notes ?? undefined);
  for (const d of delegations) if (d.dueAt) push(d.id, d.dueAt, 15, `[Delegação] ${d.title}`, d.description ?? undefined);
  for (const oo of oneOnOnes) push(oo.id, oo.scheduledAt, oo.durationMin ?? 30, `[1:1]`, oo.summary ?? undefined);

  lines.push("END:VCALENDAR");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(lines.filter(Boolean).join("\r\n"));
});