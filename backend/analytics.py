"""Server-side analytics emitter for WorkSoy.

Sends events to PostHog when POSTHOG_API_KEY is set; logs and no-ops
otherwise. Wired in fire-and-forget style — failures never bubble up to
the caller, so analytics outages can never break the surrounding business
action.

Public API:
    await track(distinct_id, event, properties=None)
    is_analytics_enabled() -> bool
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

log = logging.getLogger("worksoy.analytics")

POSTHOG_API_KEY = os.environ.get("POSTHOG_API_KEY", "").strip()
POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")


def is_analytics_enabled() -> bool:
    return bool(POSTHOG_API_KEY)


async def track(
    distinct_id: str,
    event: str,
    properties: Optional[dict] = None,
) -> None:
    if not is_analytics_enabled():
        log.debug("[analytics-disabled] event=%s id=%s", event, distinct_id)
        return
    payload = {
        "api_key": POSTHOG_API_KEY,
        "event": event,
        "distinct_id": distinct_id,
        "properties": properties or {},
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.post(f"{POSTHOG_HOST}/capture/", json=payload)
        if r.status_code >= 300:
            log.warning(
                "posthog rejected event=%s status=%s body=%s",
                event, r.status_code, r.text[:200],
            )
    except Exception as e:  # noqa: BLE001
        log.warning("posthog send failed event=%s err=%s", event, e)
