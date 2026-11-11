-- Starter catalog based on Bangko Sentral ng Pilipinas bank listings.
-- Keep existing catalog entries, their active state, and all group assignments.
INSERT INTO "Bank" ("name", "key", "updatedAt")
SELECT name, lower(name), CURRENT_TIMESTAMP
FROM (VALUES
  ('BDO Unibank'),
  ('BPI'),
  ('Metrobank'),
  ('LandBank'),
  ('Chinabank'),
  ('RCBC'),
  ('Security Bank'),
  ('PNB'),
  ('UnionBank'),
  ('EastWest Bank'),
  ('CIMB Bank Philippines'),
  ('GoTyme Bank'),
  ('Maya Bank'),
  ('MariBank Philippines'),
  ('Overseas Filipino Bank'),
  ('Tonik Digital Bank'),
  ('UnionDigital Bank'),
  ('UNObank')
) AS catalog(name)
ON CONFLICT ("key") DO NOTHING;
