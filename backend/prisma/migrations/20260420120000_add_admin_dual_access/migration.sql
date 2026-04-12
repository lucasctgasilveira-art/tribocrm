-- Dual-access flag on admin_users. When true, the admin login shows
-- a "Como deseja entrar?" selector between the Super Admin panel and
-- a gestor-side experience. Toggled by PATCH /admin/users/:id/dual-
-- access; see backend/src/routes/admin.routes.ts.
ALTER TABLE "admin_users" ADD COLUMN "is_dual_access" BOOLEAN NOT NULL DEFAULT false;
