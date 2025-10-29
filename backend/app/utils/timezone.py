from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import settings


def _resolve_timezone() -> ZoneInfo:
    tz_name = (getattr(settings, "LOCAL_TIMEZONE", "") or "").strip()
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except ZoneInfoNotFoundError:
            pass

    fallback = datetime.now().astimezone().tzinfo
    if isinstance(fallback, ZoneInfo):
        return fallback

    return ZoneInfo("UTC")


def current_local_day_bounds(
    reference: Optional[datetime] = None,
) -> Tuple[datetime, datetime, datetime]:
    """Return now, the local midnight for the day, and the next midnight."""

    tz = _resolve_timezone()
    now = (reference.astimezone(tz) if reference else datetime.now(tz=tz)).astimezone(tz)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    return now, start_of_day, end_of_day


def midnight_today(reference: Optional[datetime] = None) -> datetime:
    """Return the start of the current local day."""

    _, start_of_day, _ = current_local_day_bounds(reference)
    return start_of_day