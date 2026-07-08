import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma.js";

/**
 * Granular RBAC middleware — checks if the current user has a grant
 * for the given (resource, action) via any of their roles.
 * super_admin bypasses all checks.
 */
export function requirePermission(resource: string, action: "view" | "edit" | "delete" | "export" | "admin") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roles = await prisma.userRole.findMany({
      where: { userId: req.userId },
      select: { role: true },
    });
    if (roles.find((r) => r.role === "super_admin")) return next();
    if (roles.length === 0) return res.status(403).json({ error: "Forbidden" });

    const grant = await prisma.rolePermission.findFirst({
      where: {
        role: { in: roles.map((r) => r.role) },
        resource,
        action,
      },
    });
    if (!grant) return res.status(403).json({ error: `Sem permissão: ${resource}.${action}` });
    next();
  };
}

/** Resolve all grants for the current user (aggregated from all roles). */
export async function resolveUserPermissions(userId: string) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  if (roles.length === 0) return { roles: [], grants: [] as { resource: string; action: string }[], super: false };
  const superAdmin = !!roles.find((r) => r.role === "super_admin");
  const grants = await prisma.rolePermission.findMany({
    where: { role: { in: roles.map((r) => r.role) } },
    select: { resource: true, action: true },
  });
  // de-duplicate
  const seen = new Set<string>();
  const unique: { resource: string; action: string }[] = [];
  for (const g of grants) {
    const k = `${g.resource}::${g.action}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push({ resource: g.resource, action: g.action });
  }
  return { roles: roles.map((r) => r.role), grants: unique, super: superAdmin };
}