-- Dual-access admin users can optionally be linked to a specific
-- tenant. When present, the auth middleware rewrites req.user.tenantId
-- to this value on every non-/admin request so the admin experiences
-- the gestor-side instance as if they were a regular tenant user.
-- Raw UUID column, no FK — mirrors the decision on
-- managerial_tasks.created_by where a real FK would block
-- SUPER_ADMIN-flavored data.
ALTER TABLE "admin_users" ADD COLUMN "linked_tenant_id" UUID;
