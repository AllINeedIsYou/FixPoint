-- Временное решение до Alembic. Применять после 001_clients_and_check.sql.
-- Вход клиентов (логин, пароль, сессии), устройство и код заявки.
-- Запуск (одной транзакцией, при любой ошибке ничего не применится):
--   psql "postgresql://user:password@localhost:5432/dbname" -v ON_ERROR_STOP=1 -1 -f migrations/002_client_accounts_and_codes.sql
-- Повторный запуск ничего не ломает.


-- аккаунт клиента: логин и пароль необязательные (клиента может создать оператор без аккаунта)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS login VARCHAR(40) UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'clients' AND column_name = 'created_at') THEN
        -- у уже существующих клиентов дата создания = момент миграции
        ALTER TABLE clients ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
        ALTER TABLE clients ALTER COLUMN created_at DROP DEFAULT;
    END IF;
END $$;


-- сессии входа клиентов
CREATE TABLE IF NOT EXISTS "ClientSessions" (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);


-- устройство в заявке: у старых заявок его не было
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'device') THEN
        ALTER TABLE applications ADD COLUMN device TEXT NOT NULL DEFAULT 'не указано';
        ALTER TABLE applications ALTER COLUMN device DROP DEFAULT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'device_model') THEN
        ALTER TABLE applications ADD COLUMN device_model TEXT NOT NULL DEFAULT 'не указано';
        ALTER TABLE applications ALTER COLUMN device_model DROP DEFAULT;
    END IF;
END $$;


-- код заявки для клиента: старым заявкам генерируем уникальный код тем же алфавитом, что и приложение (A-Z, 0-9)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS code VARCHAR(8);
DO $$
DECLARE
    app_id INTEGER;
    new_code VARCHAR(8);
BEGIN
    FOR app_id IN SELECT id FROM applications WHERE code IS NULL LOOP
        LOOP
            SELECT string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1 + floor(random() * 36)::int, 1), '')
              INTO new_code FROM generate_series(1, 8);
            EXIT WHEN NOT EXISTS (SELECT 1 FROM applications WHERE code = new_code);
        END LOOP;
        UPDATE applications SET code = new_code WHERE id = app_id;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'applications'::regclass AND contype = 'u'
                     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                                         WHERE attrelid = 'applications'::regclass AND attname = 'code')]) THEN
        ALTER TABLE applications ADD CONSTRAINT applications_code_key UNIQUE (code);
    END IF;
END $$;
ALTER TABLE applications ALTER COLUMN code SET NOT NULL;
