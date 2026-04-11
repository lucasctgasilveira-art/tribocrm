-- Add a real foreign-key constraint on tasks.created_by so Prisma's
-- new createdByUser relation can be eagerly loaded with type safety
-- AND the database prevents orphan rows going forward.
--
-- Every existing tasks.created_by value comes from either
-- req.user.userId (the manual createTask path — a real users.id)
-- or lead.responsibleId (the automation path — also a real users.id,
-- since leads.responsible_id already has its own FK to users.id).
-- So no backfill is required; the constraint can be added immediately.
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_created_by_fkey"
  FOREIGN KEY ("created_by")
  REFERENCES "users"("id")
  ON DELETE NO ACTION
  ON UPDATE CASCADE;

-- ManagerialTask.createdBy is intentionally NOT constrained here.
-- The createManagerialTask controller writes req.user.userId into
-- this column, and for SUPER_ADMIN that id comes from the separate
-- admin_users table — it never exists in the users table. Adding a
-- real FK would instantly break every managerial task creation done
-- by the Super Admin instance.
--
-- The Prisma schema still declares the relation so the client can
-- `include: { createdByUser }`. At query time Prisma does a plain
-- id equality join: regular-tenant rows resolve a user, super-admin
-- rows come back as null. No data integrity harm because regular
-- tenants can only write ids from their own users table anyway, and
-- Super Admin rows are understood to be system-owned.
--
-- DO NOT promote this to a real FK without first introducing a
-- system-user row in the platform tenant that createManagerialTask
-- can fall back to when req.user.userId is an AdminUser id. That
-- refactor lives outside the scope of this migration.
