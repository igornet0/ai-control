"""
DataCode service for integration with DataCode interpreter.
Migrated from backend/services/datacode_service.py with improvements.
"""

import asyncio
import subprocess
import tempfile
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)


class DataCodeService:
    """Service for working with DataCode interpreter."""
    
    def __init__(self, datacode_path: Optional[str] = None):
        """
        Initialize DataCode service.
        
        Args:
            datacode_path: Path to DataCode executable
        """
        self.datacode_path = datacode_path or self._find_datacode_executable()
        
    def _find_datacode_executable(self) -> str:
        """Find DataCode executable."""
        # Check standard paths
        possible_paths = [
            "backend/DataCode/target/release/datacode",
            "backend/DataCode/target/debug/datacode",
            "datacode",
            "./datacode"
        ]
        
        for path in possible_paths:
            if Path(path).exists():
                logger.info(f"Found DataCode executable at: {path}")
                return path
                
        # If not found, return cargo run command
        logger.warning("DataCode executable not found, using cargo run")
        return "cargo run --manifest-path backend/DataCode/Cargo.toml"
    
    async def execute_script(
        self,
        script: str,
        input_file: Optional[str] = None,
        output_format: str = "json"
    ) -> Dict[str, Any]:
        """
        Execute DataCode script.
        
        Args:
            script: DataCode script to execute
            input_file: Path to input file (optional)
            output_format: Output data format (json, csv, table)
            
        Returns:
            Script execution result
            
        Raises:
            Exception: If script execution fails
        """
        try:
            logger.info("Executing DataCode script", extra={
                "script_length": len(script),
                "input_file": input_file,
                "output_format": output_format,
            })
            
            # Create temporary file for script
            with tempfile.NamedTemporaryFile(mode='w', suffix='.dc', delete=False) as script_file:
                script_file.write(script)
                script_path = script_file.name
            
            # Prepare command
            cmd = self._prepare_command(script_path, input_file, output_format)
            
            # Execute command
            result = await self._run_command(cmd)
            
            # Clean up temporary file
            Path(script_path).unlink(missing_ok=True)
            
            logger.info("DataCode script executed successfully")
            return result
            
        except Exception as e:
            logger.error("Error executing DataCode script", extra={
                "error": str(e),
                "script_length": len(script),
            })
            raise
    
    def _prepare_command(
        self,
        script_path: str,
        input_file: Optional[str],
        output_format: str
    ) -> List[str]:
        """Prepare command for execution."""
        if self.datacode_path.startswith("cargo"):
            # For cargo run
            cmd = self.datacode_path.split() + [script_path]
        else:
            # For executable file
            cmd = [self.datacode_path, script_path]
        
        # Add parameters
        if input_file:
            cmd.extend(["--input", input_file])
        
        cmd.extend(["--output-format", output_format])
        
        return cmd
    
    async def _run_command(self, cmd: List[str]) -> Dict[str, Any]:
        """Execute command."""
        try:
            logger.debug("Running DataCode command", extra={"command": " ".join(cmd)})
            
            # Start process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait for completion
            stdout, stderr = await process.communicate()
            
            # Check result
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                logger.error("DataCode execution failed", extra={
                    "return_code": process.returncode,
                    "error": error_msg,
                })
                raise Exception(f"DataCode execution failed: {error_msg}")
            
            # Parse result
            output = stdout.decode('utf-8', errors='ignore')
            return self._parse_output(output)
            
        except Exception as e:
            logger.error("Error running DataCode command", extra={
                "error": str(e),
                "command": " ".join(cmd),
            })
            raise
    
    def _parse_output(self, output: str) -> Dict[str, Any]:
        """Parse DataCode output."""
        try:
            # Try to find JSON in output
            lines = output.strip().split('\n')
            
            # Look for result line
            for line in reversed(lines):
                if line.strip().startswith('{') and line.strip().endswith('}'):
                    try:
                        return json.loads(line)
                    except json.JSONDecodeError:
                        continue
            
            # If JSON not found, return entire output
            return {
                "output": output,
                "lines": lines,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Error parsing DataCode output", extra={
                "error": str(e),
                "output_length": len(output),
            })
            return {
                "raw_output": output,
                "error": "Failed to parse output",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def validate_script(self, script: str) -> Dict[str, Any]:
        """
        Validate DataCode script.
        
        Args:
            script: Script to validate
            
        Returns:
            Validation result
        """
        try:
            logger.info("Validating DataCode script", extra={
                "script_length": len(script),
            })
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.dc', delete=False) as script_file:
                script_file.write(script)
                script_path = script_file.name
            
            # Command for validation (syntax only)
            cmd = self._prepare_command(script_path, None, "json")
            cmd.append("--validate-only")
            
            # Execute validation
            result = await self._run_command(cmd)
            
            # Clean up temporary file
            Path(script_path).unlink(missing_ok=True)
            
            logger.info("DataCode script validation completed")
            return {
                "valid": True,
                "result": result
            }
            
        except Exception as e:
            logger.warning("DataCode script validation failed", extra={
                "error": str(e),
                "script_length": len(script),
            })
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def get_available_functions(self) -> List[Dict[str, Any]]:
        """
        Get list of available DataCode functions.
        
        Returns:
            List of functions with descriptions
        """
        try:
            logger.info("Getting available DataCode functions")
            
            # Create script to get functions
            script = """
# Script to get function list
global function list_functions() do
    local functions = []
    
    # Basic functions
    push(functions, {"name": "print", "type": "builtin", "description": "Console output"})
    push(functions, {"name": "now", "type": "builtin", "description": "Current time"})
    
    # Mathematical functions
    push(functions, {"name": "abs", "type": "math", "description": "Absolute value"})
    push(functions, {"name": "sqrt", "type": "math", "description": "Square root"})
    push(functions, {"name": "pow", "type": "math", "description": "Power"})
    push(functions, {"name": "min", "type": "math", "description": "Minimum value"})
    push(functions, {"name": "max", "type": "math", "description": "Maximum value"})
    push(functions, {"name": "round", "type": "math", "description": "Rounding"})
    
    # String functions
    push(functions, {"name": "length", "type": "string", "description": "String length"})
    push(functions, {"name": "upper", "type": "string", "description": "Uppercase"})
    push(functions, {"name": "lower", "type": "string", "description": "Lowercase"})
    push(functions, {"name": "trim", "type": "string", "description": "Trim spaces"})
    push(functions, {"name": "split", "type": "string", "description": "Split string"})
    push(functions, {"name": "join", "type": "string", "description": "Join strings"})
    push(functions, {"name": "contains", "type": "string", "description": "Check content"})
    
    # Array functions
    push(functions, {"name": "push", "type": "array", "description": "Add element"})
    push(functions, {"name": "pop", "type": "array", "description": "Remove element"})
    push(functions, {"name": "unique", "type": "array", "description": "Unique elements"})
    push(functions, {"name": "reverse", "type": "array", "description": "Reverse order"})
    push(functions, {"name": "sort", "type": "array", "description": "Sort"})
    push(functions, {"name": "sum", "type": "array", "description": "Sum elements"})
    push(functions, {"name": "average", "type": "array", "description": "Average value"})
    push(functions, {"name": "count", "type": "array", "description": "Count elements"})
    
    # File functions
    push(functions, {"name": "getcwd", "type": "file", "description": "Current directory"})
    push(functions, {"name": "path", "type": "file", "description": "Path operations"})
    push(functions, {"name": "read_file", "type": "file", "description": "Read file"})
    
    # Table functions
    push(functions, {"name": "table", "type": "table", "description": "Create table"})
    push(functions, {"name": "show_table", "type": "table", "description": "Display table"})
    push(functions, {"name": "table_info", "type": "table", "description": "Table info"})
    push(functions, {"name": "table_head", "type": "table", "description": "First rows"})
    push(functions, {"name": "table_tail", "type": "table", "description": "Last rows"})
    push(functions, {"name": "table_select", "type": "table", "description": "Select data"})
    push(functions, {"name": "table_sort", "type": "table", "description": "Sort table"})
    
    return functions
endfunction

# Execute function
global result = list_functions()
print(result)
"""
            
            result = await self.execute_script(script)
            functions = result.get("functions", [])
            
            logger.info("Retrieved available DataCode functions", extra={
                "function_count": len(functions),
            })
            
            return functions
            
        except Exception as e:
            logger.error("Error getting available functions", extra={
                "error": str(e),
            })
            return []
    
    async def process_csv_file(
        self,
        file_path: str,
        script: str,
        output_format: str = "json"
    ) -> Dict[str, Any]:
        """
        Process CSV file through DataCode.
        
        Args:
            file_path: Path to CSV file
            script: DataCode script for processing
            output_format: Output data format
            
        Returns:
            Processing result
            
        Raises:
            Exception: If processing fails
        """
        try:
            logger.info("Processing CSV file with DataCode", extra={
                "file_path": file_path,
                "script_length": len(script),
                "output_format": output_format,
            })
            
            # Create script for CSV processing
            csv_script = f"""
# Load CSV file
global data = read_file("{file_path}")

# Create table from CSV
global table_data = table(data)

# Execute user script
{script}

# Return result
print(table_data)
"""
            
            result = await self.execute_script(csv_script, output_format=output_format)
            
            logger.info("CSV file processed successfully", extra={
                "file_path": file_path,
            })
            
            return {
                "file_processed": file_path,
                "script_executed": script,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Error processing CSV file", extra={
                "error": str(e),
                "file_path": file_path,
            })
            raise


# Global service instance
datacode_service = DataCodeService()
