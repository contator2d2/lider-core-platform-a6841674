import { prisma } from "../prisma.js";

export type AuditAction = "create" | "update" | "delete" | "restore" | "publish" | "archive";

export async function recordAudit(params: {
  entity: string;
  entityId: string;
  action: AuditAction;
  actorId?: string | null;
  diff?: unknown;
  note?: string | null;
}): Promise<void> {
  try {
    await prisma.auditEntry.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        actorId: params.actorId ?? null,
        diff: (params.diff ?? null) as never,
        note: params.note ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", params.entity, params.entityId, err);
  }
}

/** Shallow diff: returns { before, after } for changed keys only. */
export function shallowDiff<T extends Record<string, unknown>>(before: T | null, after: T): {
  before: Partial<T>;
  after: Partial<T>;
} {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  for (const k of keys) {
    const bv = before ? (before as Record<string, unknown>)[k] : undefined;
    const av = (after as Record<string, unknown>)[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      (b as Record<string, unknown>)[k] = bv;
      (a as Record<string, unknown>)[k] = av;
    }
  }
  return { before: b, after: a };
}