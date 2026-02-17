import type { Actor } from "../types/index.js";

/**
 * Role-based access control (RBAC).
 */

export type Role = "admin" | "manager" | "developer" | "viewer";

export type Permission =
  | "config:read"
  | "config:write"
  | "audit:read"
  | "audit:write"
  | "skills:read"
  | "skills:write"
  | "integrations:use"
  | "deploy:run"
  | "approvals:decide";

export const PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set([
    "config:read",
    "config:write",
    "audit:read",
    "audit:write",
    "skills:read",
    "skills:write",
    "integrations:use",
    "deploy:run",
    "approvals:decide",
  ]),
  manager: new Set([
    "config:read",
    "audit:read",
    "skills:read",
    "integrations:use",
    "deploy:run",
    "approvals:decide",
  ]),
  developer: new Set([
    "config:read",
    "audit:read",
    "skills:read",
    "skills:write",
    "integrations:use",
  ]),
  viewer: new Set(["config:read", "skills:read"]),
};

export function normalizeRoles(roles: string[] | undefined): Role[] {
  const set = new Set<Role>();
  for (const r of roles ?? []) {
    const rr = r.toLowerCase() as Role;
    if (rr in PERMISSIONS) set.add(rr);
  }
  return [...set];
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  const roles = normalizeRoles(actor.roles);
  if (roles.length === 0) return false;
  return roles.some((r) => PERMISSIONS[r].has(permission));
}

/**
 * Assert permission or throw.
 */
export function assertPermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor, permission)) {
    const who = actor.displayName || actor.email || actor.id;
    throw new Error(`[RBAC] Permission denied: ${who} lacks ${permission}`);
  }
}
