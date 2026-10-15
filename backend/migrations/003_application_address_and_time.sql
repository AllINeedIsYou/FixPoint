-- Временное решение до Alembic. Применять после 002_client_accounts_and_codes.sql.
-- Адрес клиента и время создания заявки.
-- Запуск (одной транзакцией, при любой ошибке ничего не применится):
--   psql "postgresql://user:password@localhost:5432/dbname" -v ON_ERROR_STOP=1 -1 -f migrations/003_application_address_and_time.sql
-- Повторный запуск ничего не ломает.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'address') THEN
        -- у старых заявок адреса не было
        ALTER TABLE applications ADD COLUMN address TEXT NOT NULL DEFAULT 'не указан';
        ALTER TABLE applications ALTER COLUMN address DROP DEFAULT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'created_at') THEN
        -- настоящее время создания старых заявок нигде не сохранилось, ставим момент миграции
        ALTER TABLE applications ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
        ALTER TABLE applications ALTER COLUMN created_at DROP DEFAULT;
    END IF;
END $$;
