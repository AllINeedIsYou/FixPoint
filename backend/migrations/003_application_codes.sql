-- Запускать одной транзакцией: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/003_application_codes.sql
-- Существующие заявки сохраняются и получают уникальные коды. Повторный запуск безопасен.
LOCK TABLE applications IN ACCESS EXCLUSIVE MODE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS code VARCHAR(8);

DO $$
DECLARE
    application_id INTEGER;
    new_code VARCHAR(8);
BEGIN
    FOR application_id IN SELECT id FROM applications WHERE code IS NULL LOOP
        LOOP
            new_code := upper(substr(md5(random()::text || clock_timestamp()::text || application_id::text), 1, 8));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM applications WHERE code = new_code);
        END LOOP;
        UPDATE applications SET code = new_code WHERE id = application_id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ix_applications_code_unique ON applications (code);
ALTER TABLE applications ALTER COLUMN code SET NOT NULL;
