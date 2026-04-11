"""
Network evidence model and status derivation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class NetworkEvidence:
    plan_id: Optional[str]
    has_plan_rate: bool
    has_any_rate: bool
    has_oon_allowed_amount: bool = False
    verification_source: str = "hospital"


def derive_network_status(ev: NetworkEvidence) -> str:
    if not ev.plan_id:
        return "unknown"
    if ev.has_plan_rate:
        return "in_network"
    if ev.has_oon_allowed_amount:
        return "out_of_network"
    if ev.has_any_rate:
        # Plan selected but only market-level fallback rates are available.
        # Treat as likely out-of-network to avoid understating exposure.
        return "out_of_network"
    return "unknown"


def derive_price_confidence(ev: NetworkEvidence) -> str:
    if ev.has_plan_rate:
        return "high"
    if ev.has_any_rate:
        return "medium"
    return "low"
