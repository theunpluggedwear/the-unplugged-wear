# 0009 — Admin auth and permission boundaries

Status: Accepted

## Context

Admin screens and actions handle staff-only operations. Optimistic route checks are useful for UX but cannot be trusted as authorization.

## Decision

Every protected page calls `session.requireStaff`, every guarded action declares its permission, and the DAL repeats the permission check. Cookies and sessions are per-app; cross-app identities are never trusted.

## Consequences

- Route-level guards can redirect early without being the only security boundary.
- Support, warehouse and admin roles can be restricted independently.
- Revalidating a stale session happens through the admin refresh route.
