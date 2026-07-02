import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const orgsRouter = Router();

orgsRouter.use(requireAuth);

orgsRouter.get("/", async (req, res) => {
  const isSuper = await prisma.userRole.findFirst({
    where: { userId: req.userId!, role: "super_admin" },
  });
  const orgs = isSuper
    ? await prisma.organization.findMany({ orderBy: { createdAt: "desc" } })
    : await prisma.organization.findMany({
        where: { memberships: { some: { userId: req.userId! } } },
        orderBy: { createdAt: "desc" },
      });
  res.json(orgs);
});

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  cnpj: z.string().optional(),
});

orgsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const org = await prisma.organization.create({
    data: {
      ...parsed.data,
      memberships: { create: { userId: req.userId!, role: "leader" } },
    },
  });
  res.status(201).json(org);
});