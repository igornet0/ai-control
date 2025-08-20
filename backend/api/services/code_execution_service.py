import asyncio
import subprocess
import tempfile
import os
import json
import logging
from typing import Dict, Any, AsyncGenerator, Optional
from pathlib import Path
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

class CodeExecutionService:
    """Service for executing code safely and capturing output"""
    
    def __init__(self):
        self.execution_timeout = 30  # seconds
        self.max_output_size = 1024 * 1024  # 1MB
        
    async def execute_code(
        self, 
        code: str, 
        language: str = "python",
        execution_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute code and yield real-time output
        
        Args:
            code: The code to execute
            language: Programming language (python, javascript, etc.)
            execution_id: Unique identifier for this execution
            
        Yields:
            Dict containing execution status, output, errors, etc.
        """
        if not execution_id:
            execution_id = str(uuid.uuid4())
            
        logger.info(f"Starting code execution {execution_id} for language: {language}")
        
        # Send initial status
        yield {
            "execution_id": execution_id,
            "status": "starting",
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Starting {language} code execution..."
        }
        
        try:
            if language.lower() == "python":
                async for result in self._execute_python_code(code, execution_id):
                    yield result
            elif language.lower() in ["javascript", "js", "node"]:
                async for result in self._execute_javascript_code(code, execution_id):
                    yield result
            else:
                yield {
                    "execution_id": execution_id,
                    "status": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Unsupported language: {language}"
                }
                
        except Exception as e:
            logger.error(f"Code execution {execution_id} failed: {str(e)}")
            yield {
                "execution_id": execution_id,
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
    
    async def _execute_python_code(
        self, 
        code: str, 
        execution_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute Python code safely"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
            
        try:
            yield {
                "execution_id": execution_id,
                "status": "compiling",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Compiling Python code..."
            }
            
            # First, check syntax by compiling
            try:
                compile(code, temp_file, 'exec')
                yield {
                    "execution_id": execution_id,
                    "status": "compilation_success",
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": "Python code compiled successfully"
                }
            except SyntaxError as e:
                yield {
                    "execution_id": execution_id,
                    "status": "compilation_error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Syntax Error: {str(e)}",
                    "line": getattr(e, 'lineno', None),
                    "column": getattr(e, 'offset', None)
                }
                return
            
            # Execute the code
            yield {
                "execution_id": execution_id,
                "status": "executing",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Executing Python code..."
            }
            
            # Run with subprocess for safety
            process = await asyncio.create_subprocess_exec(
                'python3', temp_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tempfile.gettempdir()
            )
            
            # Read output in real-time
            async def read_stream(stream, stream_name):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    try:
                        decoded_line = line.decode('utf-8').rstrip()
                        yield {
                            "execution_id": execution_id,
                            "status": "output",
                            "timestamp": datetime.utcnow().isoformat(),
                            "stream": stream_name,
                            "content": decoded_line
                        }
                    except UnicodeDecodeError:
                        yield {
                            "execution_id": execution_id,
                            "status": "output",
                            "timestamp": datetime.utcnow().isoformat(),
                            "stream": stream_name,
                            "content": f"[Binary output: {len(line)} bytes]"
                        }
            
            # Read both stdout and stderr concurrently
            tasks = [
                asyncio.create_task(self._collect_stream_output(read_stream(process.stdout, "stdout"))),
                asyncio.create_task(self._collect_stream_output(read_stream(process.stderr, "stderr")))
            ]
            
            # Wait for process completion with timeout
            try:
                return_code = await asyncio.wait_for(process.wait(), timeout=self.execution_timeout)
                
                # Collect all output
                for task in tasks:
                    async for output in await task:
                        yield output
                        
                # Send completion status
                yield {
                    "execution_id": execution_id,
                    "status": "completed" if return_code == 0 else "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "return_code": return_code,
                    "message": f"Execution completed with return code {return_code}"
                }
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                yield {
                    "execution_id": execution_id,
                    "status": "timeout",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Execution timed out after {self.execution_timeout} seconds"
                }
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file)
            except OSError:
                pass
    
    async def _execute_javascript_code(
        self, 
        code: str, 
        execution_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute JavaScript code using Node.js"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(code)
            temp_file = f.name
            
        try:
            yield {
                "execution_id": execution_id,
                "status": "executing",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Executing JavaScript code with Node.js..."
            }
            
            # Run with Node.js
            process = await asyncio.create_subprocess_exec(
                'node', temp_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tempfile.gettempdir()
            )
            
            # Similar output handling as Python
            async def read_stream(stream, stream_name):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    try:
                        decoded_line = line.decode('utf-8').rstrip()
                        yield {
                            "execution_id": execution_id,
                            "status": "output",
                            "timestamp": datetime.utcnow().isoformat(),
                            "stream": stream_name,
                            "content": decoded_line
                        }
                    except UnicodeDecodeError:
                        yield {
                            "execution_id": execution_id,
                            "status": "output",
                            "timestamp": datetime.utcnow().isoformat(),
                            "stream": stream_name,
                            "content": f"[Binary output: {len(line)} bytes]"
                        }
            
            # Read both stdout and stderr concurrently
            tasks = [
                asyncio.create_task(self._collect_stream_output(read_stream(process.stdout, "stdout"))),
                asyncio.create_task(self._collect_stream_output(read_stream(process.stderr, "stderr")))
            ]
            
            # Wait for process completion with timeout
            try:
                return_code = await asyncio.wait_for(process.wait(), timeout=self.execution_timeout)
                
                # Collect all output
                for task in tasks:
                    async for output in await task:
                        yield output
                        
                # Send completion status
                yield {
                    "execution_id": execution_id,
                    "status": "completed" if return_code == 0 else "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "return_code": return_code,
                    "message": f"Execution completed with return code {return_code}"
                }
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                yield {
                    "execution_id": execution_id,
                    "status": "timeout",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Execution timed out after {self.execution_timeout} seconds"
                }
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file)
            except OSError:
                pass
    
    async def _collect_stream_output(self, stream_generator) -> list:
        """Collect output from a stream generator"""
        output = []
        async for item in stream_generator:
            output.append(item)
        return output

# Create singleton instance
code_execution_service = CodeExecutionService()
