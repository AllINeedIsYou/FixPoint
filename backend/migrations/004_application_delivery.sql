-- Источник заявки и удобное время встречи с курьером. После миграций 001–003.
-- Запускать одной транзакцией: psql ... -v ON_ERROR_STOP=1 -1 -f migrations/004_application_delivery.sql
-- Повторный запуск безопасен. Старые заявки и их этапы не изменяются.
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS courier_visit_at TIMESTAMP WITH TIME ZONE;

-- Источник старых заявок не сохранялся: не выдаём догадку за онлайн/офлайн.
-- Новые заявки всегда получают online/offline в соответствующем API.
-- status_info: -3 создана онлайн, -2 курьер выехал, -1 посылка у курьера;
-- 0 и выше сохраняют прежние значения. Прибытие в центр переводит на этап 0.
