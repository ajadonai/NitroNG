CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_deleted_name_trgm_idx"
  ON "users" USING GIN ("deletedName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_deleted_email_trgm_idx"
  ON "users" USING GIN ("deletedEmail" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "orders_order_id_trgm_idx"
  ON "orders" USING GIN ("orderId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "orders_api_order_id_trgm_idx"
  ON "orders" USING GIN ("apiOrderId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "orders_batch_id_trgm_idx"
  ON "orders" USING GIN ("batchId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "orders_link_trgm_idx"
  ON "orders" USING GIN ("link" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "orders_parent_order_id_trgm_idx"
  ON "orders" USING GIN ("parentOrderId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "drip_dispatches_api_order_id_trgm_idx"
  ON "drip_dispatches" USING GIN ("apiOrderId" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "transactions_reference_trgm_idx"
  ON "transactions" USING GIN ("reference" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "transactions_note_trgm_idx"
  ON "transactions" USING GIN ("note" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "activity_log_admin_name_trgm_idx"
  ON "activity_log" USING GIN ("adminName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "activity_log_action_trgm_idx"
  ON "activity_log" USING GIN ("action" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "blog_posts_title_trgm_idx"
  ON "blog_posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "blog_posts_excerpt_trgm_idx"
  ON "blog_posts" USING GIN ("excerpt" gin_trgm_ops);
