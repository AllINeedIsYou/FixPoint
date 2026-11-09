-- Один владелец и пять бессрочных ключей к его аккаунту. После миграций 001–004.
-- Применять в одной транзакции; повторный запуск не меняет ключи или данные.
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_owner ON access_codes (role) WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS owner_access_codes (
    slot INTEGER PRIMARY KEY CONSTRAINT ck_owner_code_slot CHECK (slot BETWEEN 1 AND 5),
    owner_id INTEGER NOT NULL REFERENCES access_codes(id),
    code_hash VARCHAR(64) NOT NULL UNIQUE
);

-- Владелец создаётся один раз локальной командой из backend:
-- python -m src.auth.owner
-- Сырые коды выводятся только в момент создания. В SQL и Git их нет.
