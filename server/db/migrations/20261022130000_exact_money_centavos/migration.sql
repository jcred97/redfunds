-- Application amounts are positive integer centavos (maximum PHP 21,474,836.47).
-- Legacy Float values are converted through numeric, rounded to the nearest
-- centavo with half-centavo ties rounded up. Stop on unsupported values.
-- Apply together with the application release: older code expects "amount".
BEGIN;

LOCK TABLE "Expense" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Expense"
    WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "amount" <= 0
       OR round("amount"::numeric * 100) NOT BETWEEN 1 AND 2147483647
  ) THEN
    RAISE EXCEPTION 'Expense amounts cannot be converted safely to positive integer centavos; review existing records before migrating';
  END IF;
END $$;

ALTER TABLE "Expense" ADD COLUMN "amountCentavos" INTEGER;

UPDATE "Expense"
SET "amountCentavos" = round("amount"::numeric * 100)::integer;

ALTER TABLE "Expense" ALTER COLUMN "amountCentavos" SET NOT NULL;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amountCentavos_positive"
  CHECK ("amountCentavos" > 0);
ALTER TABLE "Expense" DROP COLUMN "amount";

COMMIT;
