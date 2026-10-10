-- Доводит БД до текущих моделей без потери данных: склад, брони инженера и мастера,
-- результат диагностики, этап проверки ремонта, таблица клиентов.
-- Запуск (одной транзакцией, при любой ошибке ничего не применится):
--   psql "postgresql://user:password@localhost:5432/dbname" -v ON_ERROR_STOP=1 -1 -f migrations/001_clients_and_check.sql
-- Повторный запуск ничего не ломает: каждый шаг проверяет, сделан ли он уже.


-- склад запчастей
CREATE TABLE IF NOT EXISTS stock_parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL
);
-- упадет, если на складе есть дубли - их надо слить руками
CREATE UNIQUE INDEX IF NOT EXISTS ix_stock_parts_name_lower ON stock_parts (lower(name));
ALTER TABLE parts ADD COLUMN IF NOT EXISTS stock_part_id INTEGER REFERENCES stock_parts(id);


-- брони: старое assignee_id стало assignee_repairer_id, добавилась бронь инженера
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'assignee_id') THEN
        ALTER TABLE applications RENAME COLUMN assignee_id TO assignee_repairer_id;
        -- раньше мастер мог взять заявку до диагностики, теперь нельзя: такая бронь заблокировала бы заявку
        UPDATE applications SET assignee_repairer_id = NULL WHERE status_info < 1;
    END IF;
END $$;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assignee_repairer_id INTEGER REFERENCES access_codes(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assignee_engineer_id INTEGER REFERENCES access_codes(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS diagnostic_result VARCHAR;


-- этап проверки ремонта. сдвиг этапов делается ровно один раз - вместе с добавлением check_result
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'check_result') THEN
        ALTER TABLE applications ADD COLUMN check_result TEXT;
        -- проверка встала между ремонтом и выдачей: "выдано" было 3, стало 4
        UPDATE applications SET status_info = 4 WHERE status_info = 3;
        -- тексты статусов по этапу и броням (заодно исправляет старые тексты с опечатками)
        UPDATE applications SET status = CASE
            WHEN status_info = 0 AND assignee_engineer_id IS NULL THEN 'Заявка создана. Ожидание диагностики'
            WHEN status_info = 0 THEN 'Заявка взята в диагностику. Ожидается выполнение...'
            WHEN status_info = 1 AND assignee_repairer_id IS NULL THEN 'Диагностика завершена. Ожидание выполнения работы...'
            WHEN status_info = 1 THEN 'Заявка взята в работу. Ожидается выполнение...'
            WHEN status_info = 2 THEN 'Работы завершены. Ожидание проверки'
            WHEN status_info = 4 THEN 'Устройство выдано клиенту. Заявка закрыта'
            ELSE status
        END;
    END IF;
END $$;


-- клиенты: переносим ФИО, телефон и email из заявок, один клиент на телефон.
-- если у одного телефона в разных заявках разные ФИО/email, остаются данные из последней заявки
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    "FIO" VARCHAR(255) NOT NULL,
    number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL
);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'applications' AND column_name = 'number') THEN
        INSERT INTO clients ("FIO", number, email)
            SELECT DISTINCT ON (number) "FIO", number, email FROM applications ORDER BY number, id DESC
            ON CONFLICT (number) DO NOTHING;
        ALTER TABLE applications ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
        UPDATE applications a SET client_id = c.id FROM clients c WHERE c.number = a.number;
        ALTER TABLE applications ALTER COLUMN client_id SET NOT NULL;
        ALTER TABLE applications DROP COLUMN "FIO", DROP COLUMN number, DROP COLUMN email;
    END IF;
END $$;
