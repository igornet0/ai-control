#!/usr/bin/env bash

PORTS=(
  3000
  8000
  8002
  8003
  8899
  8787
  9009
  9010
  8790
  8791
  8792
  8989
  8793
)

echo "Searching processes..."

for PORT in "${PORTS[@]}"; do
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null)

    if [ -n "$PIDS" ]; then
        echo "Port $PORT -> PIDs: $PIDS"

        # Нормальное завершение
        kill $PIDS 2>/dev/null
    else
        echo "Port $PORT -> free"
    fi
done

echo
echo "Waiting for processes to terminate..."
sleep 2

# Принудительно убиваем оставшиеся процессы
for PORT in "${PORTS[@]}"; do
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null)

    if [ -n "$PIDS" ]; then
        echo "Force killing port $PORT -> PIDs: $PIDS"
        kill -9 $PIDS 2>/dev/null
    fi
done

echo
echo "Done."
