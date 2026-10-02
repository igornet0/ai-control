#!/usr/bin/env python3
"""
Script to run Alembic migrations with proper environment setup.
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Run Alembic migration command."""
    # Get the project root directory
    project_root = Path(__file__).parent.parent.parent.resolve()
    migrations_dir = project_root / "src" / "infrastructure" / "database" / "migrations"
    env_file = project_root / "deployment" / "docker" / ".env"
    
    # Check if .env file exists
    if not env_file.exists():
        print("❌ Error: .env file not found!")
        print("Please run: make setup-env")
        sys.exit(1)
    
    # Load environment variables
    env_vars = {}
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Set environment variables
    os.environ.update(env_vars)
    
    # Set PYTHONPATH
    os.environ['PYTHONPATH'] = str(project_root)
    
    # Change to migrations directory
    os.chdir(migrations_dir)
    
    # Debug: print environment
    print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Project root: {project_root}")
    print(f"SECRET_KEY: {os.environ.get('SECRET_KEY', 'NOT SET')}")
    print(f"JWT_SECRET_KEY: {os.environ.get('JWT_SECRET_KEY', 'NOT SET')}")
    
    # Run alembic command
    cmd = sys.argv[1:] if len(sys.argv) > 1 else ['upgrade', 'head']
    subprocess.run(['alembic'] + cmd, check=True, env=os.environ.copy())

if __name__ == "__main__":
    main()
