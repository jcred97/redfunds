-- Prisma creates this table before deploy, but it can be absent during shadow replay.
ALTER TABLE IF EXISTS "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
