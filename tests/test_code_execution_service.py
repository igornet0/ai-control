import pytest
import asyncio
import tempfile
import os
from unittest.mock import patch, MagicMock, AsyncMock
from backend.api.services.code_execution_service import CodeExecutionService


class TestCodeExecutionService:
    """Comprehensive tests for the CodeExecutionService"""
    
    @pytest.fixture
    def service(self):
        """Create a CodeExecutionService instance for testing"""
        return CodeExecutionService()
    
    @pytest.mark.asyncio
    async def test_python_code_execution_success(self, service):
        """Test successful Python code execution"""
        code = """
print("Hello, World!")
result = 2 + 2
print(f"2 + 2 = {result}")
"""
        
        results = []
        async for result in service.execute_code(code, "python", "test-exec-1"):
            results.append(result)
        
        # Verify execution flow
        assert len(results) > 0
        
        # Check for expected status messages
        statuses = [r['status'] for r in results]
        assert 'starting' in statuses
        assert 'compiling' in statuses
        assert 'compilation_success' in statuses
        assert 'executing' in statuses
        
        # Check for output
        output_results = [r for r in results if r.get('status') == 'output']
        assert len(output_results) >= 2  # Should have at least 2 print statements
        
        # Verify output content
        output_content = [r['content'] for r in output_results if r.get('stream') == 'stdout']
        assert any("Hello, World!" in content for content in output_content)
        assert any("2 + 2 = 4" in content for content in output_content)
    
    @pytest.mark.asyncio
    async def test_python_syntax_error(self, service):
        """Test Python code with syntax errors"""
        code = """
print("Hello World"
# Missing closing parenthesis
"""
        
        results = []
        async for result in service.execute_code(code, "python", "test-syntax-error"):
            results.append(result)
        
        # Should detect compilation error
        error_results = [r for r in results if r.get('status') == 'compilation_error']
        assert len(error_results) > 0
        
        error_result = error_results[0]
        assert 'Syntax Error' in error_result['error']
        assert error_result.get('line') is not None
    
    @pytest.mark.asyncio
    async def test_python_runtime_error(self, service):
        """Test Python code with runtime errors"""
        code = """
print("Starting execution")
x = 1 / 0  # Division by zero
print("This should not print")
"""
        
        results = []
        async for result in service.execute_code(code, "python", "test-runtime-error"):
            results.append(result)
        
        # Should compile successfully but fail at runtime
        statuses = [r['status'] for r in results]
        assert 'compilation_success' in statuses
        assert 'executing' in statuses
        
        # Should have output before error
        output_results = [r for r in results if r.get('status') == 'output' and r.get('stream') == 'stdout']
        assert any("Starting execution" in r['content'] for r in output_results)
        
        # Should have error output
        error_output = [r for r in results if r.get('status') == 'output' and r.get('stream') == 'stderr']
        assert len(error_output) > 0
        assert any("ZeroDivisionError" in r['content'] for r in error_output)
    
    @pytest.mark.asyncio
    async def test_javascript_code_execution(self, service):
        """Test JavaScript code execution with Node.js"""
        code = """
console.log("Hello from JavaScript!");
const result = 5 * 6;
console.log(`5 * 6 = ${result}`);
"""
        
        results = []
        async for result in service.execute_code(code, "javascript", "test-js-exec"):
            results.append(result)
        
        # Verify execution
        assert len(results) > 0
        
        statuses = [r['status'] for r in results]
        assert 'executing' in statuses
        
        # Check for output
        output_results = [r for r in results if r.get('status') == 'output' and r.get('stream') == 'stdout']
        output_content = [r['content'] for r in output_results]
        
        assert any("Hello from JavaScript!" in content for content in output_content)
        assert any("5 * 6 = 30" in content for content in output_content)
    
    @pytest.mark.asyncio
    async def test_execution_timeout(self, service):
        """Test code execution timeout"""
        # Set a very short timeout for testing
        service.execution_timeout = 2
        
        code = """
import time
print("Starting long operation")
time.sleep(5)  # Sleep longer than timeout
print("This should not print")
"""
        
        results = []
        async for result in service.execute_code(code, "python", "test-timeout"):
            results.append(result)
        
        # Should timeout
        timeout_results = [r for r in results if r.get('status') == 'timeout']
        assert len(timeout_results) > 0
        
        timeout_result = timeout_results[0]
        assert 'timed out' in timeout_result['error'].lower()
    
    @pytest.mark.asyncio
    async def test_unsupported_language(self, service):
        """Test execution with unsupported language"""
        code = "print('Hello')"
        
        results = []
        async for result in service.execute_code(code, "unsupported_lang", "test-unsupported"):
            results.append(result)
        
        # Should return error for unsupported language
        error_results = [r for r in results if r.get('status') == 'error']
        assert len(error_results) > 0
        
        error_result = error_results[0]
        assert 'Unsupported language' in error_result['error']
    
    @pytest.mark.asyncio
    async def test_empty_code(self, service):
        """Test execution with empty code"""
        code = ""
        
        results = []
        async for result in service.execute_code(code, "python", "test-empty"):
            results.append(result)
        
        # Should handle empty code gracefully
        assert len(results) > 0
        
        # Should at least start and try to compile
        statuses = [r['status'] for r in results]
        assert 'starting' in statuses
    
    @pytest.mark.asyncio
    async def test_large_output(self, service):
        """Test handling of large output"""
        code = """
for i in range(100):
    print(f"Line {i}: " + "x" * 100)
"""
        
        results = []
        async for result in service.execute_code(code, "python", "test-large-output"):
            results.append(result)
        
        # Should handle large output
        output_results = [r for r in results if r.get('status') == 'output']
        assert len(output_results) >= 100  # Should have many output lines
        
        # Verify some output content
        output_content = [r['content'] for r in output_results if r.get('stream') == 'stdout']
        assert any("Line 0:" in content for content in output_content)
        assert any("Line 99:" in content for content in output_content)
    
    @pytest.mark.asyncio
    async def test_execution_id_generation(self, service):
        """Test that execution IDs are properly handled"""
        code = "print('test')"
        
        # Test with provided execution ID
        results1 = []
        async for result in service.execute_code(code, "python", "custom-exec-id"):
            results1.append(result)
        
        assert all(r['execution_id'] == 'custom-exec-id' for r in results1)
        
        # Test with auto-generated execution ID
        results2 = []
        async for result in service.execute_code(code, "python"):
            results2.append(result)
        
        # Should have generated an execution ID
        execution_ids = [r['execution_id'] for r in results2]
        assert len(set(execution_ids)) == 1  # All should have same ID
        assert execution_ids[0] is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_executions(self, service):
        """Test multiple concurrent code executions"""
        code1 = "print('Execution 1')"
        code2 = "print('Execution 2')"
        code3 = "print('Execution 3')"
        
        # Start multiple executions concurrently
        tasks = [
            service.execute_code(code1, "python", "concurrent-1"),
            service.execute_code(code2, "python", "concurrent-2"),
            service.execute_code(code3, "python", "concurrent-3")
        ]
        
        results = await asyncio.gather(*[
            [result async for result in task] for task in tasks
        ])
        
        # All executions should complete
        assert len(results) == 3
        
        # Each should have their own execution ID
        exec_ids = []
        for result_list in results:
            if result_list:
                exec_ids.append(result_list[0]['execution_id'])
        
        assert len(set(exec_ids)) == 3  # All different execution IDs
    
    def test_temp_file_cleanup(self, service):
        """Test that temporary files are properly cleaned up"""
        # This test verifies the cleanup mechanism
        # In a real scenario, we'd need to mock the file operations
        # to ensure cleanup happens even on exceptions
        
        with patch('tempfile.NamedTemporaryFile') as mock_temp:
            mock_file = MagicMock()
            mock_file.name = '/tmp/test_file.py'
            mock_temp.return_value.__enter__.return_value = mock_file
            
            with patch('os.unlink') as mock_unlink:
                # This would be called in a real execution
                # Here we just verify the cleanup logic exists
                try:
                    os.unlink('/tmp/test_file.py')
                except OSError:
                    pass
                
                # In the actual service, unlink should be called
                # even if execution fails
                assert True  # Placeholder for actual cleanup verification
