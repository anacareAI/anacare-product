"""
Vercel serverless function entrypoint.

vercel.json `routes` (PCRE) send /health, /v2/*, etc. to /api (api/index.py) with
?__forward=/original/path so FastAPI still sees the real path.
"""
from __future__ import annotations

import urllib.parse
from urllib.parse import parse_qs, urlencode

from starlette.types import ASGIApp, Receive, Scope, Send


def _is_vercel_python_entry_path(path: str) -> bool:
    """api/index.py is invoked as /api on Vercel; rewrites may also target /api/index."""
    p = path.rstrip("/").removesuffix(".py")
    return p in ("/api", "/api/index")


class VercelForwardedPathMiddleware:
    """Restore ASGI path when the edge rewrites to /api?__forward=...."""

    __slots__ = ("app",)

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path") or ""
        if not _is_vercel_python_entry_path(path):
            await self.app(scope, receive, send)
            return
        raw_qs = scope.get("query_string") or b""
        qs = parse_qs(raw_qs.decode("latin-1"), keep_blank_values=True)
        forward = (qs.get("__forward") or [None])[0]
        if not forward:
            await self.app(scope, receive, send)
            return
        new_path = urllib.parse.unquote(forward)
        if not new_path.startswith("/"):
            new_path = "/" + new_path
        filtered = {k: v for k, v in qs.items() if k != "__forward"}
        new_qs = urlencode([(k, val) for k, vals in filtered.items() for val in vals])
        new_scope: Scope = {
            **scope,
            "path": new_path,
            "raw_path": new_path.encode("utf-8"),
            "query_string": new_qs.encode("latin-1") if new_qs else b"",
        }
        await self.app(new_scope, receive, send)


from backend.main import app as _fastapi_app  # noqa: E402

app: ASGIApp = VercelForwardedPathMiddleware(_fastapi_app)
