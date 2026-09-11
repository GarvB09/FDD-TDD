"""
Simple in-memory rate limiter for the Groq-backed generation endpoints.

Groq's free tier has a hard daily token quota, and it's easy to burn
through it by clicking "Generate" repeatedly while testing or demoing.
This is deliberately not a per-user/distributed limiter (there's one
server process here, no auth, no concurrent users to account for) --
it's a single global cooldown enforcing a minimum gap between generation
calls, so a few accidental extra clicks can't drain a day's quota in
seconds.
"""

import os
import time
import threading
from fastapi import HTTPException

MIN_INTERVAL_SECONDS = int(os.environ.get("GENERATE_COOLDOWN_SECONDS", "60"))

_lock = threading.Lock()
_last_call_time = 0.0


def check_rate_limit():
    """Raise HTTP 429 if a generation call was made too recently."""
    global _last_call_time
    with _lock:
        now = time.time()
        elapsed = now - _last_call_time
        if elapsed < MIN_INTERVAL_SECONDS:
            wait = round(MIN_INTERVAL_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Please wait {wait}s before generating another TDD. "
                    f"This cooldown protects your Groq daily token quota."
                ),
            )
        _last_call_time = now
