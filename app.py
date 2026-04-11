"""
Vercel FastAPI entrypoint (see https://vercel.com/docs/frameworks/backend/fastapi).

Re-exports the real app from backend/main.py.
"""
from backend.main import app

__all__ = ["app"]
