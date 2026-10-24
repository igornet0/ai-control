#!/bin/sh
# Создаёт БД платформы и восстанавливает их из дампов dev-окружения (seed/dumps/*.dump).
# Нет дампа — БД создаётся пустой (сервисы сами накатят миграции).
set -eu
for db in ai_control_dev ai_control_api_dev aicontrol_ai_dev mail_message_dev; do
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE \"$db\"" || true
  if [ -f "/seed/$db.dump" ]; then
    echo "restore $db"
    pg_restore -U postgres -d "$db" --no-owner --no-privileges --jobs=1 "/seed/$db.dump" || \
      echo "WARN: pg_restore $db finished with errors"
  fi
done
