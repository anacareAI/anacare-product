"""
Canonical provider identity helpers used by search responses.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha1
from typing import Optional


_SUFFIX_PATTERN = re.compile(
    r"\b(hospital|medical center|health system|healthcare|clinic|center|campus|inc|llc)\b",
    flags=re.IGNORECASE,
)


def normalize_provider_name(name: str) -> str:
    n = (name or "").strip().lower()
    n = re.sub(r"[^\w\s-]", " ", n)
    n = _SUFFIX_PATTERN.sub(" ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def canonical_provider_id(
    *,
    ccn: Optional[str],
    npi: Optional[str] = None,
    name: str,
    city: str = "",
    state: str = "",
) -> str:
    if ccn:
        return f"ccn:{ccn}"
    if npi:
        return f"npi:{npi}"
    base = f"{normalize_provider_name(name)}|{(city or '').lower()}|{(state or '').lower()}"
    digest = sha1(base.encode("utf-8")).hexdigest()[:14]
    return f"name:{digest}"


@dataclass(frozen=True)
class ProviderProvenance:
    source_kind: str
    source_ref: str
    parser_version: str = "v1"
    confidence: float = 0.8

    def to_dict(self) -> dict[str, object]:
        return {
            "source_kind": self.source_kind,
            "source_ref": self.source_ref,
            "parser_version": self.parser_version,
            "confidence": round(float(self.confidence), 2),
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }
