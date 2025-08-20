"""
Сервис для интеграции с DataCode интерпретатором
"""

import asyncio
import subprocess
import tempfile
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

class DataCodeService:
    """Сервис для работы с DataCode интерпретатором"""
    
    def __init__(self, datacode_path: Optional[str] = None):
        """
        Инициализация сервиса
        
        Args:
            datacode_path: Путь к исполняемому файлу DataCode
        """
        self.datacode_path = datacode_path or self._find_datacode_executable()
        
    def _find_datacode_executable(self) -> str:
        """Поиск исполняемого файла DataCode"""
        # Проверяем стандартные пути
        possible_paths = [
            "backend/DataCode/target/release/datacode",
            "backend/DataCode/target/debug/datacode",
            "datacode",
            "./datacode"
        ]
        
        for path in possible_paths:
            if Path(path).exists():
                return path
                
        # Если не найден, возвращаем cargo run
        return "cargo run --manifest-path backend/DataCode/Cargo.toml"
    
    async def execute_script(
        self,
        script: str,
        input_file: Optional[str] = None,
        output_format: str = "json"
    ) -> Dict[str, Any]:
        """
        Выполнение скрипта DataCode
        
        Args:
            script: Скрипт DataCode для выполнения
            input_file: Путь к входному файлу (опционально)
            output_format: Формат выходных данных (json, csv, table)
            
        Returns:
            Результат выполнения скрипта
        """
        try:
            # Создаем временный файл для скрипта
            with tempfile.NamedTemporaryFile(mode='w', suffix='.dc', delete=False) as script_file:
                script_file.write(script)
                script_path = script_file.name
            
            # Подготавливаем команду
            cmd = self._prepare_command(script_path, input_file, output_format)
            
            # Выполняем команду
            result = await self._run_command(cmd)
            
            # Очищаем временный файл
            Path(script_path).unlink(missing_ok=True)
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing DataCode script: {e}")
            raise
    
    def _prepare_command(
        self,
        script_path: str,
        input_file: Optional[str],
        output_format: str
    ) -> List[str]:
        """Подготовка команды для выполнения"""
        if self.datacode_path.startswith("cargo"):
            # Для cargo run
            cmd = self.datacode_path.split() + [script_path]
        else:
            # Для исполняемого файла
            cmd = [self.datacode_path, script_path]
        
        # Добавляем параметры
        if input_file:
            cmd.extend(["--input", input_file])
        
        cmd.extend(["--output-format", output_format])
        
        return cmd
    
    async def _run_command(self, cmd: List[str]) -> Dict[str, Any]:
        """Выполнение команды"""
        try:
            # Запускаем процесс
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Ждем завершения
            stdout, stderr = await process.communicate()
            
            # Проверяем результат
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                logger.error(f"DataCode execution failed: {error_msg}")
                raise Exception(f"DataCode execution failed: {error_msg}")
            
            # Парсим результат
            output = stdout.decode('utf-8', errors='ignore')
            return self._parse_output(output)
            
        except Exception as e:
            logger.error(f"Error running DataCode command: {e}")
            raise
    
    def _parse_output(self, output: str) -> Dict[str, Any]:
        """Парсинг вывода DataCode"""
        try:
            # Пытаемся найти JSON в выводе
            lines = output.strip().split('\n')
            
            # Ищем строку с результатом
            for line in reversed(lines):
                if line.strip().startswith('{') and line.strip().endswith('}'):
                    try:
                        return json.loads(line)
                    except json.JSONDecodeError:
                        continue
            
            # Если JSON не найден, возвращаем весь вывод
            return {
                "output": output,
                "lines": lines,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error parsing DataCode output: {e}")
            return {
                "raw_output": output,
                "error": "Failed to parse output",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def validate_script(self, script: str) -> Dict[str, Any]:
        """
        Валидация скрипта DataCode
        
        Args:
            script: Скрипт для валидации
            
        Returns:
            Результат валидации
        """
        try:
            # Создаем временный файл
            with tempfile.NamedTemporaryFile(mode='w', suffix='.dc', delete=False) as script_file:
                script_file.write(script)
                script_path = script_file.name
            
            # Команда для валидации (только синтаксис)
            cmd = self._prepare_command(script_path, None, "json")
            cmd.append("--validate-only")
            
            # Выполняем валидацию
            result = await self._run_command(cmd)
            
            # Очищаем временный файл
            Path(script_path).unlink(missing_ok=True)
            
            return {
                "valid": True,
                "result": result
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def get_available_functions(self) -> List[Dict[str, Any]]:
        """
        Получение списка доступных функций DataCode
        
        Returns:
            Список функций с описанием
        """
        try:
            # Создаем скрипт для получения функций
            script = """
# Скрипт для получения списка функций
global function list_functions() do
    local functions = []
    
    # Базовые функции
    push(functions, {"name": "print", "type": "builtin", "description": "Вывод в консоль"})
    push(functions, {"name": "now", "type": "builtin", "description": "Текущее время"})
    
    # Математические функции
    push(functions, {"name": "abs", "type": "math", "description": "Абсолютное значение"})
    push(functions, {"name": "sqrt", "type": "math", "description": "Квадратный корень"})
    push(functions, {"name": "pow", "type": "math", "description": "Возведение в степень"})
    push(functions, {"name": "min", "type": "math", "description": "Минимальное значение"})
    push(functions, {"name": "max", "type": "math", "description": "Максимальное значение"})
    push(functions, {"name": "round", "type": "math", "description": "Округление"})
    
    # Строковые функции
    push(functions, {"name": "length", "type": "string", "description": "Длина строки"})
    push(functions, {"name": "upper", "type": "string", "description": "Верхний регистр"})
    push(functions, {"name": "lower", "type": "string", "description": "Нижний регистр"})
    push(functions, {"name": "trim", "type": "string", "description": "Удаление пробелов"})
    push(functions, {"name": "split", "type": "string", "description": "Разделение строки"})
    push(functions, {"name": "join", "type": "string", "description": "Объединение строк"})
    push(functions, {"name": "contains", "type": "string", "description": "Проверка содержимого"})
    
    # Массивы
    push(functions, {"name": "push", "type": "array", "description": "Добавление элемента"})
    push(functions, {"name": "pop", "type": "array", "description": "Удаление элемента"})
    push(functions, {"name": "unique", "type": "array", "description": "Уникальные элементы"})
    push(functions, {"name": "reverse", "type": "array", "description": "Обратный порядок"})
    push(functions, {"name": "sort", "type": "array", "description": "Сортировка"})
    push(functions, {"name": "sum", "type": "array", "description": "Сумма элементов"})
    push(functions, {"name": "average", "type": "array", "description": "Среднее значение"})
    push(functions, {"name": "count", "type": "array", "description": "Количество элементов"})
    
    # Файловые функции
    push(functions, {"name": "getcwd", "type": "file", "description": "Текущая директория"})
    push(functions, {"name": "path", "type": "file", "description": "Работа с путями"})
    push(functions, {"name": "read_file", "type": "file", "description": "Чтение файла"})
    
    # Табличные функции
    push(functions, {"name": "table", "type": "table", "description": "Создание таблицы"})
    push(functions, {"name": "show_table", "type": "table", "description": "Отображение таблицы"})
    push(functions, {"name": "table_info", "type": "table", "description": "Информация о таблице"})
    push(functions, {"name": "table_head", "type": "table", "description": "Первые строки"})
    push(functions, {"name": "table_tail", "type": "table", "description": "Последние строки"})
    push(functions, {"name": "table_select", "type": "table", "description": "Выборка данных"})
    push(functions, {"name": "table_sort", "type": "table", "description": "Сортировка таблицы"})
    
    return functions
endfunction

# Выполняем функцию
global result = list_functions()
print(result)
"""
            
            result = await self.execute_script(script)
            return result.get("functions", [])
            
        except Exception as e:
            logger.error(f"Error getting available functions: {e}")
            return []
    
    async def process_csv_file(
        self,
        file_path: str,
        script: str,
        output_format: str = "json"
    ) -> Dict[str, Any]:
        """
        Обработка CSV файла через DataCode
        
        Args:
            file_path: Путь к CSV файлу
            script: Скрипт DataCode для обработки
            output_format: Формат выходных данных
            
        Returns:
            Результат обработки
        """
        try:
            # Создаем скрипт для обработки CSV
            csv_script = f"""
# Загружаем CSV файл
global data = read_file("{file_path}")

# Создаем таблицу из CSV
global table_data = table(data)

# Выполняем пользовательский скрипт
{script}

# Возвращаем результат
print(table_data)
"""
            
            result = await self.execute_script(csv_script, output_format=output_format)
            
            return {
                "file_processed": file_path,
                "script_executed": script,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error processing CSV file: {e}")
            raise

# Создаем глобальный экземпляр сервиса
datacode_service = DataCodeService()
