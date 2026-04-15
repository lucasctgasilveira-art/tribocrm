-- Optional post-submission behavior for capture forms. If
-- success_redirect_url is set, the embed widget navigates the visitor
-- there after a successful submit; otherwise it renders
-- success_message (or a hardcoded default) inline.
ALTER TABLE "capture_forms" ADD COLUMN "success_redirect_url" VARCHAR(500);
ALTER TABLE "capture_forms" ADD COLUMN "success_message" VARCHAR(300);
