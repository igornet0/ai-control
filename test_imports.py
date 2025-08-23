#!/usr/bin/env python3

print("Testing imports...")
try:
    from backend.api.create_app import create_app
    app = create_app()
    print("✅ All imports fixed!")
except Exception as e:
    print(f"❌ Import error: {e}")
    import traceback
    traceback.print_exc()
