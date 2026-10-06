"""Event parser: structured-output request, unwrapping, duration defaults."""

import json
from types import SimpleNamespace

import pytest

from instinct.scripts import eval_event_parser
from instinct.tools import ai_validation
from instinct.tools.ai_validation import (
    EVENT_RESPONSE_FORMAT,
    EventParser,
    post_date_in_campus_tz,
    resolve_duration,
)


class FakeCompletions:
    """Records each request and replays the queued replies (or raises them)."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.requests = []

    def create(self, **kwargs):
        self.requests.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        message = SimpleNamespace(content=reply, refusal=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeDB:
    def __init__(self, posted="2026-10-03T02:30:00", caption="Meeting Friday 6-8pm"):
        self.post = (posted, caption)
        self.inserted = []
        self.updated = []

    def get_post_date_and_caption(self, post_id):
        return self.post

    def insert_event(self, data):
        self.inserted.append(data)

    def update_post_by_id(self, post_id, data):
        self.updated.append((post_id, data))


def make_parser(replies, db=None):
    parser = EventParser.__new__(EventParser)
    completions = FakeCompletions(replies)
    parser.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    parser.db = db or FakeDB()
    return parser, completions


EVENT = {
    "Name": "General Meeting",
    "Date": "2026-10-03T18:00:00",
    "Details": "DBH 1100",
    "Duration": {"days": 0, "hours": 2, "minutes": 0},
}


def test_parse_post_sends_strict_schema_and_unwraps_events(monkeypatch):
    monkeypatch.setenv("OPENAI_EVENT_MODEL", "test-model")
    parser, completions = make_parser([json.dumps({"events": [EVENT]})])

    assert parser.parse_post("post-1") == [EVENT]

    request = completions.requests[0]
    assert request["model"] == "test-model"
    assert request["response_format"] == EVENT_RESPONSE_FORMAT
    assert request["response_format"]["type"] == "json_schema"
    assert request["response_format"]["json_schema"]["strict"] is True
    system, user = request["messages"]
    assert system["role"] == "system" and "Duration" in system["content"]
    # posts.posted is UTC: 02:30 UTC on Oct 3 is Friday evening Oct 2 in LA.
    assert user["content"] == (
        "Post date: Friday, 2026-10-02 19:30 (America/Los_Angeles)\n\n"
        "Caption:\nMeeting Friday 6-8pm"
    )


def test_parse_post_returns_empty_list_for_non_events():
    parser, _ = make_parser([json.dumps({"events": []})])
    assert parser.parse_post("post-1") == []


def test_parse_post_retries_api_errors(monkeypatch):
    monkeypatch.setattr(ai_validation.time, "sleep", lambda s: None)
    parser, completions = make_parser(
        [RuntimeError("rate limited"), json.dumps({"events": [EVENT]})]
    )
    assert parser.parse_post("post-1") == [EVENT]
    assert len(completions.requests) == 2


def test_parse_post_gives_up_after_three_bad_replies(monkeypatch):
    monkeypatch.setattr(ai_validation.time, "sleep", lambda s: None)
    parser, completions = make_parser(["not json", "[]", '{"other": []}'])
    assert parser.parse_post("post-1") == []
    assert len(completions.requests) == 3


def test_parse_post_without_client_does_not_call_out():
    parser, _ = make_parser([])
    parser.client = None
    assert parser.parse_post("post-1") == []


def test_schema_meets_strict_mode_rules():
    """Strict mode: every object lists all its properties as required and
    forbids extra ones."""

    def walk(node):
        if node.get("type") == "object":
            assert node["additionalProperties"] is False
            assert sorted(node["required"]) == sorted(node["properties"])
            for child in node["properties"].values():
                walk(child)
        if node.get("type") == "array":
            walk(node["items"])

    schema = EVENT_RESPONSE_FORMAT["json_schema"]["schema"]
    walk(schema)
    item = schema["properties"]["events"]["items"]
    assert sorted(item["properties"]) == ["Date", "Details", "Duration", "Name"]


@pytest.mark.parametrize(
    "posted, expected",
    [
        ("2026-10-03T02:30:00", "Friday, 2026-10-02 19:30 (America/Los_Angeles)"),
        ("2026-10-03T02:30:00Z", "Friday, 2026-10-02 19:30 (America/Los_Angeles)"),
        (
            "2026-12-01T20:00:00+00:00",
            "Tuesday, 2026-12-01 12:00 (America/Los_Angeles)",
        ),
        ("not a date", "not a date"),
    ],
)
def test_post_date_is_shown_in_los_angeles_time(posted, expected):
    assert post_date_in_campus_tz(posted) == expected


@pytest.mark.parametrize(
    "event, expected",
    [
        # "6-8pm": the model's computed range is kept.
        (
            {
                "Date": "2026-10-09T18:00:00",
                "Duration": {"days": 0, "hours": 2, "minutes": 0},
            },
            {"days": 0, "hours": 2, "minutes": 0},
        ),
        # "7pm-1am" crosses midnight.
        (
            {
                "Date": "2026-10-09T19:00:00",
                "Duration": {"days": 0, "hours": 6, "minutes": 0},
            },
            {"days": 0, "hours": 6, "minutes": 0},
        ),
        # Multi-day "Fri 6pm - Sun 2pm".
        (
            {
                "Date": "2026-10-09T18:00:00",
                "Duration": {"days": 1, "hours": 20, "minutes": 0},
            },
            {"days": 1, "hours": 20, "minutes": 0},
        ),
        # Start time only, zero duration: one hour.
        (
            {
                "Date": "2026-10-09T19:00:00",
                "Duration": {"days": 0, "hours": 0, "minutes": 0},
            },
            {"days": 0, "hours": 1, "minutes": 0},
        ),
        # No time at all: all-day, one day.
        (
            {
                "Date": "2026-10-09T00:00:00",
                "Duration": {"days": 0, "hours": 0, "minutes": 0},
            },
            {"days": 1, "hours": 0, "minutes": 0},
        ),
        ({"Date": "2026-10-09"}, {"days": 1, "hours": 0, "minutes": 0}),
        # Multi-day all-day "Oct 9-11" is kept.
        (
            {
                "Date": "2026-10-09T00:00:00",
                "Duration": {"days": 3, "hours": 0, "minutes": 0},
            },
            {"days": 3, "hours": 0, "minutes": 0},
        ),
        # Older free-form replies: missing keys, strings, the legacy wrapper.
        ({"Date": "2026-10-09T19:00:00"}, {"days": 0, "hours": 1, "minutes": 0}),
        (
            {
                "Date": "2026-10-09T19:00:00",
                "Duration": {"hours": "two", "minutes": "30"},
            },
            {"days": 0, "hours": 2, "minutes": 30},
        ),
        (
            {
                "Date": "2026-10-09T19:00:00",
                "Duration": {"estimated duration": {"hours": 3}},
            },
            {"days": 0, "hours": 3, "minutes": 0},
        ),
        (
            {"Date": "2026-10-09T19:00:00", "Duration": "2 hours"},
            {"days": 0, "hours": 1, "minutes": 0},
        ),
    ],
)
def test_resolve_duration(event, expected):
    assert resolve_duration(event) == expected


@pytest.mark.parametrize(
    "date, duration, interval",
    [
        ("2026-10-09T18:00:00", {"days": 0, "hours": 2, "minutes": 0}, "2 hours"),
        ("2026-10-09T19:00:00", {"days": 0, "hours": 0, "minutes": 0}, "1 hours"),
        ("2026-10-09T00:00:00", {"days": 0, "hours": 0, "minutes": 0}, "1 days"),
        (
            "2026-10-09T18:30:00",
            {"days": 1, "hours": 20, "minutes": 30},
            "1 days 20 hours 30 minutes",
        ),
    ],
)
def test_stored_interval(monkeypatch, date, duration, interval):
    db = FakeDB()
    parser, _ = make_parser([], db=db)
    monkeypatch.setattr(parser, "find_similar_event", lambda *a: None, raising=False)
    event = {"Name": "X", "Date": date, "Details": "", "Duration": duration}

    parser.store_parsed_info([event], "post-1", "club-1")

    assert db.inserted[0]["duration"] == interval
    assert db.inserted[0]["date"] == date
    assert db.inserted[0]["parsed"] == event
    assert db.updated == [("post-1", {"parsed": True})]


def test_eval_script_dry_run(capsys):
    assert eval_event_parser.main(["--dry-run", "--diffs", "1"]) == 0
    out = capsys.readouterr().out
    assert "DRY RUN" in out
    assert "old:" in out and "new:" in out
    assert "zero_duration" in out and "timed_zero_duration" in out


def test_eval_summary_counts():
    results = [
        {
            "events": [
                {
                    "Date": "2026-10-09T18:00:00",
                    "Duration": {"days": 0, "hours": 0, "minutes": 0},
                },
                {
                    "Date": "2026-10-09T00:00:00",
                    "Duration": {"days": 1, "hours": 0, "minutes": 0},
                },
            ],
            "error": None,
        },
        {"events": None, "error": "bad output: nope"},
        {"events": [], "error": None},
    ]
    summary = eval_event_parser.summarize(results)
    assert summary["posts"] == 3
    assert summary["posts_with_events"] == 1
    assert summary["events"] == 2
    assert summary["zero_duration"] == "50.0%"
    assert summary["timed_zero_duration"] == "50.0%"
    assert summary["midnight"] == "50.0%"
    assert summary["all_day_midnight_whole_days"] == "50.0%"
    assert summary["bad_output"] == 1
