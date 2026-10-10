"""Shared test fixtures."""

import pytest


@pytest.fixture(autouse=True)
def no_control_tables(monkeypatch, tmp_path):
    """Keep scrape_runs, scraper_state and scraper_commands offline."""
    from instinct.tools import scraper_control

    monkeypatch.setattr(scraper_control, "LOCK_PATH", tmp_path / "scraper.lock")
    monkeypatch.setattr(scraper_control, "get_state", lambda: {})
    monkeypatch.setattr(scraper_control, "start_run", lambda: None)
    monkeypatch.setattr(scraper_control, "finish_run", lambda run_id, **kw: None)
    monkeypatch.setattr(scraper_control, "interrupt_reason", lambda: None)
