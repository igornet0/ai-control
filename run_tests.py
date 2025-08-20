#!/usr/bin/env python3
"""
Comprehensive test runner for the AI Control code execution system.

This script runs all tests with proper categorization and reporting.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description=""):
    """Run a command and return the result"""
    print(f"\n{'='*60}")
    print(f"Running: {description or ' '.join(cmd)}")
    print(f"{'='*60}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.stdout:
        print("STDOUT:")
        print(result.stdout)
    
    if result.stderr:
        print("STDERR:")
        print(result.stderr)
    
    print(f"Return code: {result.returncode}")
    return result


def install_test_dependencies():
    """Install test dependencies"""
    print("Installing test dependencies...")
    
    # Install pytest and related packages
    test_deps = [
        "pytest>=7.0.0",
        "pytest-asyncio>=0.21.0",
        "pytest-cov>=4.0.0",
        "pytest-mock>=3.10.0",
        "httpx>=0.24.0",  # For FastAPI testing
        "websockets>=11.0.0",  # For WebSocket testing
        "pyyaml>=6.0.0",  # For docker-compose validation
    ]
    
    for dep in test_deps:
        result = run_command([sys.executable, "-m", "pip", "install", dep], 
                           f"Installing {dep}")
        if result.returncode != 0:
            print(f"Failed to install {dep}")
            return False
    
    return True


def run_unit_tests():
    """Run unit tests"""
    cmd = [
        sys.executable, "-m", "pytest", 
        "tests/test_code_execution_service.py",
        "tests/test_rabbitmq_consumer.py",
        "tests/test_websocket.py",
        "tests/test_api_endpoints.py",
        "-m", "not integration and not docker",
        "--tb=short"
    ]
    
    result = run_command(cmd, "Unit Tests")
    return result.returncode == 0


def run_integration_tests():
    """Run integration tests"""
    cmd = [
        sys.executable, "-m", "pytest", 
        "tests/test_integration.py::TestEndToEndIntegration",
        "-m", "integration and not docker",
        "--tb=short"
    ]
    
    result = run_command(cmd, "Integration Tests")
    return result.returncode == 0


def run_docker_tests():
    """Run Docker-related tests"""
    cmd = [
        sys.executable, "-m", "pytest", 
        "tests/test_integration.py::TestDockerDeployment",
        "-m", "docker",
        "--tb=short"
    ]
    
    result = run_command(cmd, "Docker Tests")
    return result.returncode == 0


def run_all_tests():
    """Run all tests with coverage"""
    cmd = [
        sys.executable, "-m", "pytest", 
        "tests/",
        "--cov=backend",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov",
        "--tb=short",
        "-v"
    ]
    
    result = run_command(cmd, "All Tests with Coverage")
    return result.returncode == 0


def validate_docker_setup():
    """Validate Docker setup"""
    print("\nValidating Docker setup...")
    
    # Check if Docker is available
    docker_result = run_command(["docker", "--version"], "Docker Version Check")
    if docker_result.returncode != 0:
        print("❌ Docker is not available")
        return False
    
    # Check if docker-compose is available
    compose_result = run_command(["docker-compose", "--version"], "Docker Compose Version Check")
    if compose_result.returncode != 0:
        print("❌ Docker Compose is not available")
        return False
    
    # Validate docker-compose.yml
    compose_config_result = run_command(["docker-compose", "config"], "Docker Compose Config Validation")
    if compose_config_result.returncode != 0:
        print("❌ docker-compose.yml validation failed")
        return False
    
    print("✅ Docker setup is valid")
    return True


def test_docker_builds():
    """Test Docker image builds"""
    print("\nTesting Docker builds...")
    
    # Test backend build
    backend_build = run_command([
        "docker", "build", 
        "-f", "Dockerfile.backend", 
        "-t", "ai-control-backend-test", 
        "."
    ], "Backend Docker Build")
    
    if backend_build.returncode != 0:
        print("❌ Backend Docker build failed")
        return False
    
    # Test frontend build
    frontend_build = run_command([
        "docker", "build", 
        "-f", "front-ai-control/Dockerfile", 
        "-t", "ai-control-frontend-test", 
        "front-ai-control/"
    ], "Frontend Docker Build")
    
    if frontend_build.returncode != 0:
        print("❌ Frontend Docker build failed")
        return False
    
    # Cleanup test images
    run_command(["docker", "rmi", "ai-control-backend-test"], "Cleanup Backend Test Image")
    run_command(["docker", "rmi", "ai-control-frontend-test"], "Cleanup Frontend Test Image")
    
    print("✅ Docker builds successful")
    return True


def generate_test_report():
    """Generate comprehensive test report"""
    print("\n" + "="*80)
    print("COMPREHENSIVE TEST REPORT")
    print("="*80)
    
    # Check if coverage report exists
    if os.path.exists("htmlcov/index.html"):
        print("📊 Coverage report generated: htmlcov/index.html")
    
    # List test files
    test_files = list(Path("tests").glob("test_*.py"))
    print(f"\n📁 Test files found: {len(test_files)}")
    for test_file in test_files:
        print(f"   - {test_file}")
    
    # Check for test artifacts
    artifacts = []
    if os.path.exists("htmlcov"):
        artifacts.append("HTML coverage report (htmlcov/)")
    if os.path.exists("coverage.xml"):
        artifacts.append("XML coverage report (coverage.xml)")
    if os.path.exists(".coverage"):
        artifacts.append("Coverage data (.coverage)")
    
    if artifacts:
        print(f"\n📋 Test artifacts generated:")
        for artifact in artifacts:
            print(f"   - {artifact}")


def main():
    """Main test runner function"""
    parser = argparse.ArgumentParser(description="AI Control System Test Runner")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--docker", action="store_true", help="Run Docker tests only")
    parser.add_argument("--build-test", action="store_true", help="Test Docker builds")
    parser.add_argument("--install-deps", action="store_true", help="Install test dependencies")
    parser.add_argument("--validate-docker", action="store_true", help="Validate Docker setup")
    parser.add_argument("--validate-system", action="store_true", help="Validate system integration")
    parser.add_argument("--all", action="store_true", help="Run all tests (default)")

    args = parser.parse_args()
    
    # Default to running all tests if no specific option is provided
    if not any([args.unit, args.integration, args.docker, args.build_test,
                args.install_deps, args.validate_docker, args.validate_system]):
        args.all = True
    
    success = True
    
    print("🚀 AI Control System Test Runner")
    print("="*50)

    # Validate system integration if requested
    if args.validate_system or args.all:
        if not validate_system_integration():
            print("❌ System validation failed - stopping execution")
            return 1

    # Install dependencies if requested
    if args.install_deps or args.all:
        if not install_test_dependencies():
            print("❌ Failed to install test dependencies")
            return 1
    
    # Validate Docker setup if requested
    if args.validate_docker or args.docker or args.build_test or args.all:
        if not validate_docker_setup():
            print("⚠️  Docker validation failed - skipping Docker tests")
            args.docker = False
            args.build_test = False
    
    # Run specific test categories
    if args.unit or args.all:
        print("\n🧪 Running Unit Tests...")
        if not run_unit_tests():
            print("❌ Unit tests failed")
            success = False
        else:
            print("✅ Unit tests passed")
    
    if args.integration or args.all:
        print("\n🔗 Running Integration Tests...")
        if not run_integration_tests():
            print("❌ Integration tests failed")
            success = False
        else:
            print("✅ Integration tests passed")
    
    if args.docker or args.all:
        print("\n🐳 Running Docker Tests...")
        if not run_docker_tests():
            print("❌ Docker tests failed")
            success = False
        else:
            print("✅ Docker tests passed")
    
    if args.build_test or args.all:
        print("\n🏗️  Testing Docker Builds...")
        if not test_docker_builds():
            print("❌ Docker build tests failed")
            success = False
        else:
            print("✅ Docker build tests passed")
    
    # Run all tests with coverage if --all is specified
    if args.all:
        print("\n📊 Running All Tests with Coverage...")
        if not run_all_tests():
            print("❌ Some tests failed")
            success = False
        else:
            print("✅ All tests passed")
    
    # Generate report
    generate_test_report()
    
    # Final result
    print("\n" + "="*80)
    if success:
        print("🎉 ALL TESTS PASSED! The code execution system is ready for deployment.")
    else:
        print("❌ SOME TESTS FAILED! Please review the output above.")
    print("="*80)
    
    return 0 if success else 1


def validate_system_integration():
    """Validate the complete system integration"""
    print("\n🔍 Validating System Integration...")

    validation_results = []

    # Check if all required files exist
    required_files = [
        "backend/api/services/code_execution_service.py",
        "backend/api/services/rabbitmq_consumer.py",
        "backend/api/routers/code_execution.py",
        "backend/api/routers/websocket.py",
        "front-ai-control/src/services/codeExecutionService.js",
        "front-ai-control/src/pages/dashboard/DataCodeEditor.jsx",
        "docker-compose.yml",
        "Dockerfile.backend",
        "front-ai-control/Dockerfile"
    ]

    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)

    if missing_files:
        print(f"❌ Missing required files: {missing_files}")
        validation_results.append(False)
    else:
        print("✅ All required files present")
        validation_results.append(True)

    # Check Python imports
    try:
        sys.path.insert(0, os.getcwd())
        from backend.api.services.code_execution_service import CodeExecutionService
        from backend.api.services.rabbitmq_consumer import CodeExecutionConsumer
        from backend.api.routers.code_execution import router as code_router
        from backend.api.routers.websocket import router as ws_router
        print("✅ Python imports successful")
        validation_results.append(True)
    except ImportError as e:
        print(f"❌ Python import failed: {e}")
        validation_results.append(False)

    # Check frontend package.json
    frontend_package_path = "front-ai-control/package.json"
    if os.path.exists(frontend_package_path):
        try:
            import json
            with open(frontend_package_path, 'r') as f:
                package_data = json.load(f)

            required_deps = ['axios', 'react', 'react-dom']
            missing_deps = [dep for dep in required_deps if dep not in package_data.get('dependencies', {})]

            if missing_deps:
                print(f"❌ Missing frontend dependencies: {missing_deps}")
                validation_results.append(False)
            else:
                print("✅ Frontend dependencies check passed")
                validation_results.append(True)
        except Exception as e:
            print(f"❌ Frontend package.json validation failed: {e}")
            validation_results.append(False)
    else:
        print("❌ Frontend package.json not found")
        validation_results.append(False)

    # Overall validation result
    all_passed = all(validation_results)
    if all_passed:
        print("🎉 System integration validation PASSED")
    else:
        print("❌ System integration validation FAILED")

    return all_passed


if __name__ == "__main__":
    sys.exit(main())
