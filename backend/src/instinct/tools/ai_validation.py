import os
import dotenv
from openai import OpenAI
import json
from typing import List, Dict, Optional
import time

from instinct.tools.logger import logger
from instinct.db.queries import SupabaseQueries
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# LOAD-BEARING, DO NOT CHANGE: every vector currently stored in Supabase was
# produced by this model. Swapping it silently invalidates the whole hybrid
# search index and requires a full re-embed via scripts/populate_embeds.py.
EMBEDDING_MODEL = "text-embedding-3-small"

# Event parsing provider. Meta Model API is OpenAI-compatible (Chat
# Completions, strict json_schema structured output), so both providers use
# the OpenAI SDK; only the key, base URL and model differ. EVENT_PROVIDER
# picks one; each provider's model can be overridden by its own variable, so
# an OpenAI model name left in .env is never sent to Meta.
#
# muse-spark-1.2-contributor is Meta's training-eligible tier: much cheaper,
# and Meta may train on the prompts and replies. Captions are public posts.
EVENT_PROVIDERS = {
    "meta": {
        "key_env": "META_API_KEY",
        "base_url_env": "META_BASE_URL",
        "base_url": "https://api.meta.ai/v1",
        "model_env": "META_EVENT_MODEL",
        "model": "muse-spark-1.2-contributor",
    },
    "openai": {
        "key_env": "OPENAI_API_KEY",
        "base_url_env": None,
        "base_url": None,  # the SDK default
        "model_env": "OPENAI_EVENT_MODEL",
        "model": "gpt-6-luna",
    },
}
DEFAULT_EVENT_PROVIDER = "meta"
DEFAULT_EVENT_MODEL = EVENT_PROVIDERS[DEFAULT_EVENT_PROVIDER]["model"]


def get_event_provider() -> Dict[str, Optional[str]]:
    """The event-parsing provider's settings, from EVENT_PROVIDER."""
    name = os.getenv("EVENT_PROVIDER", DEFAULT_EVENT_PROVIDER).strip().lower()
    if name not in EVENT_PROVIDERS:
        raise ValueError(
            f"EVENT_PROVIDER={name!r}; expected one of {', '.join(EVENT_PROVIDERS)}"
        )
    return {"name": name, **EVENT_PROVIDERS[name]}


def get_event_model() -> str:
    """Model used for caption -> event JSON extraction."""
    provider = get_event_provider()
    return os.getenv(provider["model_env"]) or provider["model"]


def get_event_api_key() -> Optional[str]:
    provider = get_event_provider()
    if provider["name"] == "openai":
        return get_openai_api_key()
    return os.getenv(provider["key_env"])


def make_event_client(**options) -> Optional[OpenAI]:
    """OpenAI SDK client for event parsing, or None without an API key."""
    provider = get_event_provider()
    key = get_event_api_key()
    if not key:
        return None
    base_url = (
        os.getenv(provider["base_url_env"]) if provider["base_url_env"] else None
    ) or provider["base_url"]
    if base_url:
        options["base_url"] = base_url
    return OpenAI(api_key=key, **options)


# Captions, event times and events.date are all America/Los_Angeles wall-clock
# time; posts.posted is UTC (Instagram's <time datetime="...Z">, stored naive).
CAMPUS_TZ = ZoneInfo("America/Los_Angeles")

# Unknown duration is not zero. An event with only a start time gets an hour;
# an event with no time at all is all-day: Date at 00:00 plus whole days.
DEFAULT_TIMED_DURATION = {"days": 0, "hours": 1, "minutes": 0}
ALL_DAY_DURATION = {"days": 1, "hours": 0, "minutes": 0}

EVENT_SYSTEM_PROMPT = """\
You extract club events from an Instagram post caption for a UC Irvine campus \
events calendar. Reply with {"events": [...]}, one entry per event, each with \
Name, Date, Details and Duration.

Which events
- Include each specific, upcoming happening people can attend or join: \
meetings, workshops, socials, info sessions, competitions, performances, \
tabling, trips.
- If the post announces no such event (a recap, congratulations, member \
spotlight, merch, general promotion), reply {"events": []}.
- An event that runs over several consecutive days is one entry. A series \
that lists separate dates (e.g. "Mondays Oct 6, 13 and 20") is one entry per \
listed date.
- Leave out an event whose date cannot be worked out from the caption and the \
post date. Never invent a date.

Date: the start, as "YYYY-MM-DDTHH:MM:SS" with no offset and no "Z"
- All times are America/Los_Angeles local time. Write the time exactly as the \
caption says it; do not convert time zones.
- Resolve relative dates ("tomorrow", "this Friday", "next Wednesday") from \
the post date in the message, which is already in Los Angeles time. "This \
Friday" is the first Friday on or after the post date; "next Friday" is the \
Friday of the following week.
- Captions rarely give a year. Use the post date's year, unless that puts the \
event more than two months before the post date; then use the following year \
(a December post about "Jan 10" means January of the next year).
- If no time is given, use T00:00:00 and treat the event as all-day (see \
Duration).

Duration: {"days", "hours", "minutes"}, whole non-negative numbers, the time \
from start to end. Never all zero.
- A time range gives the duration: "6-8pm" is 2 hours; "6:30-8pm" is 1 hour \
30 minutes; "7pm-1am" crosses midnight and is 6 hours; "5pm-12am" is 7 hours.
- A multi-day range with times: "Fri 6pm - Sun 2pm" starts Friday at 18:00 \
and lasts 1 day 20 hours.
- Only a start time ("at 7pm"): 1 hour.
- No time at all (all-day): Date at T00:00:00 and the number of calendar days \
the event covers, e.g. 1 day for "Saturday", 3 days for "Oct 3-5".

Name: the event's title as the club calls it, short.
Details: one or two sentences with the useful facts from the caption \
(location, cost, food, sign-up or RSVP info), or "" if there are none.
"""

# Structured outputs: the API guarantees replies match this schema. Strict mode
# needs an object at the top level, so the event list sits under "events".
EVENT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "club_events",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["events"],
            "properties": {
                "events": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["Name", "Date", "Details", "Duration"],
                        "properties": {
                            "Name": {"type": "string"},
                            "Date": {
                                "type": "string",
                                "description": "Start, YYYY-MM-DDTHH:MM:SS, "
                                "America/Los_Angeles local time",
                            },
                            "Details": {"type": "string"},
                            "Duration": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["days", "hours", "minutes"],
                                "properties": {
                                    "days": {"type": "integer"},
                                    "hours": {"type": "integer"},
                                    "minutes": {"type": "integer"},
                                },
                            },
                        },
                    },
                }
            },
        },
    },
}


class EventParseError(ValueError):
    """The model replied, but not with a usable event list."""


def post_date_in_campus_tz(posted) -> str:
    """posts.posted (UTC, usually naive) as Los Angeles local time with weekday."""
    try:
        moment = (
            posted
            if isinstance(posted, datetime)
            else datetime.fromisoformat(str(posted).replace("Z", "+00:00"))
        )
    except ValueError:
        return str(posted)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    local = moment.astimezone(CAMPUS_TZ)
    return local.strftime("%A, %Y-%m-%d %H:%M") + " (America/Los_Angeles)"


def build_event_messages(caption: str, posted) -> List[Dict]:
    return [
        {"role": "system", "content": EVENT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Post date: {post_date_in_campus_tz(posted)}\n\n"
            f"Caption:\n{caption}",
        },
    ]


def extract_events(client, caption: str, posted, model: Optional[str] = None):
    """One structured-output request; the event list, or an exception."""
    completion = client.chat.completions.create(
        model=model or get_event_model(),
        messages=build_event_messages(caption, posted),
        response_format=EVENT_RESPONSE_FORMAT,
        # No temperature: some models (e.g. gpt-6-luna) only accept the default.
    )
    message = completion.choices[0].message
    if getattr(message, "refusal", None):
        raise EventParseError(f"model refused: {message.refusal}")
    try:
        events = json.loads(message.content)["events"]
    except (TypeError, KeyError, json.JSONDecodeError) as e:
        raise EventParseError(f"reply does not match the schema: {e}") from e
    if not isinstance(events, list) or not all(isinstance(e, dict) for e in events):
        raise EventParseError("events is not a list of objects")
    return events


def safe_int(value, default=0):
    """Convert value safely to integer, handling numeric strings and simple words like 'one'."""
    word_to_number = {
        "zero": 0,
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
    }

    try:
        return int(value)
    except ValueError, TypeError:
        if isinstance(value, str):
            value_clean = value.strip().lower()
            if value_clean in word_to_number:
                return word_to_number[value_clean]
        return default


def starts_at_midnight(date_str) -> bool:
    try:
        moment = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
    except ValueError:
        return False
    return (moment.hour, moment.minute, moment.second) == (0, 0, 0)


def resolve_duration(event: Dict) -> Dict[str, int]:
    """The event's duration, with the defaults for a missing or zero one.

    Zero means the caption gave no end: a timed event gets an hour, and an
    event at 00:00 (no time given) is all-day, one day.
    """
    raw = event.get("Duration")
    if isinstance(raw, dict) and "estimated duration" in raw:
        raw = raw["estimated duration"]
    if not isinstance(raw, dict):
        raw = {}
    parts = {k: max(0, safe_int(raw.get(k, 0))) for k in ("days", "hours", "minutes")}
    if any(parts.values()):
        return parts
    if starts_at_midnight(event.get("Date")):
        return dict(ALL_DAY_DURATION)
    return dict(DEFAULT_TIMED_DURATION)


OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
LEGACY_OPENAI_API_KEY_ENV = "OPENAI"
_warned_about_legacy_openai = False


def get_openai_api_key() -> Optional[str]:
    """OpenAI API key.

    Prefers OPENAI_API_KEY. The old OPENAI name is still accepted, with a warning,
    so that a deployment whose secrets have not been renamed yet keeps working;
    drop that fallback once every environment is updated (#30).
    """
    key = os.getenv(OPENAI_API_KEY_ENV)
    if key:
        return key

    legacy = os.getenv(LEGACY_OPENAI_API_KEY_ENV)
    if legacy:
        global _warned_about_legacy_openai
        if not _warned_about_legacy_openai:
            _warned_about_legacy_openai = True
            logger.warning(
                f"{LEGACY_OPENAI_API_KEY_ENV} is deprecated; rename it to {OPENAI_API_KEY_ENV}."
            )
        return legacy

    return None


def get_embedding(text: str) -> list:
    """Get embedding from OpenAI API."""
    key = get_openai_api_key()
    if not text or text.strip() == "" or not key:
        return None

    client = OpenAI(api_key=key)
    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
        return response.data[0].embedding
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return None


class EventParser:
    def __init__(self):
        # Load environment variables (for OpenAI API key)
        dotenv.load_dotenv()
        self.client = make_event_client()

        self.db = SupabaseQueries()

        # Configure similarity thresholds
        self.name_similarity_threshold = 0.6  # Lower than original 0.7
        self.time_window_hours = 24  # Hours to consider for time proximity

    def parse_post(self, post_id: "uuid") -> Optional[List[Dict]]:  # noqa: F821
        """
        Extract the events in a post's caption with the OpenAI API.

        Args:
            post_id (uuid): ID of the post to parse.

        Returns:
            The events (Name, Date, Details, Duration); [] when the post has
            none; None when parsing failed, so the post can be retried.
        """
        MAX_RETRIES = 3
        RETRY_DELAY = 2  # seconds

        if not self.client:
            provider = get_event_provider()
            logger.error(
                f"Event parser client not initialized ({provider['key_env']} unset)"
            )
            return None
        try:
            post_date, post_text = self.db.get_post_date_and_caption(post_id)
        except Exception as e:
            logger.error(f"Error loading post data: {e}")
            return None

        # Structured outputs fix the reply's shape, so a retry is mostly for
        # API errors (rate limits, timeouts); a refusal is retried the same way.
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(f"Parsing attempt {attempt + 1}...")
                events = extract_events(self.client, post_text, post_date)
                logger.info(f"Successful parse: {len(events)} event(s).")
                return events
            except Exception as e:
                logger.error(f"Error during API call: {e}")
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)

        logger.error("Failed to parse post after multiple attempts.")
        return None

    def get_embedding(self, text: str) -> List[float]:
        """
        Get embeddings for text using OpenAI's embeddings API.
        This enables semantic similarity matching. Always OpenAI, whatever
        the parsing provider: the stored vectors are text-embedding-3-small.
        None (no semantic score) without an OpenAI key.
        """
        return get_embedding(text)

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        """
        if not a or not b:
            return 0.0

        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = sum(x * x for x in a) ** 0.5
        magnitude_b = sum(x * x for x in b) ** 0.5

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)

    def parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Try multiple date formats to parse a date string.
        """
        formats = [
            "%Y-%m-%dT%H:%M:%S",  # ISO format with T
            "%Y-%m-%d %H:%M:%S",  # Standard format with space
            "%Y-%m-%d",  # Just date
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # If we get here, try ISO format with potential timezone info
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except ValueError:
            logger.error(f"Failed to parse date: {date_str}")
            return None

    def find_similar_event(
        self, name: str, date_str: str, club_id: str
    ) -> Optional[Dict]:
        """
        Find similar events using multiple methods:
        1. String similarity for event names
        2. Date/time proximity
        3. Semantic similarity using embeddings (if available)

        Args:
            name (str): Event name to match
            date_str (str): Event date string
            club_id (str): Club ID to filter events

        Returns:
            dict or None: Most similar existing event data if found, None otherwise
        """
        # Parse the input date
        event_date = self.parse_date(date_str)
        if not event_date:
            return None

        # Calculate date range for filtering
        date_start = event_date - timedelta(hours=self.time_window_hours / 2)
        date_end = event_date + timedelta(hours=self.time_window_hours / 2)

        # Format dates for database query
        date_start_str = date_start.isoformat()
        date_end_str = date_end.isoformat()

        # Get events for this club within the date range
        try:
            response = (
                self.db.supabase.table("events")
                .select("id, name, date, details")
                .eq("club_id", club_id)
                .gte("date", date_start_str)
                .lte("date", date_end_str)
                .execute()
            )

            events = response.data
            if not events:
                logger.info(f"No events found for club {club_id} in date range")
                return None

            logger.info(f"Found {len(events)} potential matches within time window")
        except Exception as e:
            logger.error(f"Error querying events: {e}")
            return None

        # Get embedding for our target event name
        try:
            target_embedding = self.get_embedding(name)
        except:
            target_embedding = None
            logger.warning("Could not get embedding for semantic matching")

        # Track best matches
        best_match = None
        best_score = 0.0

        for event in events:
            event_name = event.get("name", "")

            # Calculate string similarity score (0-1)
            string_sim = SequenceMatcher(None, name.lower(), event_name.lower()).ratio()

            # Calculate time proximity score (0-1)
            event_datetime = self.parse_date(event.get("date", ""))
            if event_datetime:
                time_diff = abs(
                    (event_datetime - event_date).total_seconds() / 3600
                )  # hours
                time_sim = max(
                    0, 1 - (time_diff / self.time_window_hours)
                )  # Scale to 0-1
            else:
                time_sim = 0.0

            # Calculate semantic similarity if embeddings available (0-1)
            semantic_sim = 0.0
            if target_embedding:
                try:
                    event_embedding = self.get_embedding(event_name)
                    if event_embedding:
                        semantic_sim = self.cosine_similarity(
                            target_embedding, event_embedding
                        )
                except:
                    semantic_sim = 0.0

            # Compute combined score:
            # 50% string similarity, 30% semantic similarity, 20% time proximity
            combined_score = (
                (0.5 * string_sim) + (0.3 * semantic_sim) + (0.2 * time_sim)
            )

            logger.info(
                f"Event '{event_name}': string_sim={string_sim:.2f}, semantic_sim={semantic_sim:.2f}, time_sim={time_sim:.2f}, combined={combined_score:.2f}"
            )

            if combined_score > best_score:
                best_score = combined_score
                best_match = event

        # Apply threshold to combined score
        if best_score >= self.name_similarity_threshold:
            logger.info(
                f"Found similar event: '{best_match['name']}' with score {best_score:.2f}"
            )
            return best_match
        else:
            logger.info(f"No similar event found. Best score was {best_score:.2f}")
            return None

    def parse_all_posts(self, username):
        try:
            logger.info("fetching posts to parse...")
            posts_to_parse = self.db.posts_to_parse(username)
            logger.info(f"successfully fetched {len(posts_to_parse)} posts to parse!")

            for post_id in posts_to_parse:
                # Make sure post_id is a string, not a dict
                if isinstance(post_id, dict) and "id" in post_id:
                    post_id = post_id["id"]

                logger.info(f"parsing post ID: {post_id}...")

                if self.db.check_if_post_is_parsed(post_id):
                    logger.info(f"post {post_id} already parsed, skipping...")
                    continue

                parsed_info = self.parse_post(post_id)
                if parsed_info is None:
                    # Leave posts.parsed false so the next run tries again.
                    logger.error(f"parsing post {post_id} failed; will retry next run")
                    continue
                logger.info("successfully parsed and storing...")

                club_id = self.db.get_club_by_instagram_handle(username)
                self.store_parsed_info(parsed_info, post_id, club_id)
                logger.info("successfully stored.")
        except Exception as e:
            logger.error(f"Unexpected Error: {e}")
            logger.error(f"Error type: {type(e)}")
            import traceback

            logger.error(traceback.format_exc())

    def store_parsed_info(self, parsed_info, post_id, club_id):
        """
        Store parsed information from a post, avoiding duplicate events using enhanced matching.
        """
        if parsed_info is None:
            # A failed parse is not "no events": keep the post unparsed.
            logger.error(f"No parse result for post {post_id}; leaving it unparsed")
            return
        if not parsed_info:
            # Mark post as parsed even if no events were extracted
            self.db.update_post_by_id(post_id, {"parsed": True})
            logger.info(f"No events found in post {post_id}, marking as parsed")
            return

        for event in parsed_info:
            existing_event = self.find_similar_event(
                event["Name"], event["Date"], club_id
            )

            if existing_event:
                # Event already exists, just update the post as parsed
                self.db.update_post_by_id(post_id, {"parsed": True})
                logger.info(
                    f"Similar event '{existing_event['name']}' found, linking post to it."
                )

                # Optionally, you could update the existing event with any new information
                # if you want to merge the data
            else:
                # Create a new event
                # A missing or zero duration gets the 1 hour / all-day default.
                duration_dict = resolve_duration(event)

                event_data = {
                    "club_id": club_id,
                    "post_id": post_id,
                    "name": event["Name"],
                    "date": event["Date"],
                    "details": event.get("Details", ""),
                    "duration": self.dict_to_interval(duration_dict),
                    "parsed": event,
                }

                # Insert the event
                self.db.insert_event(event_data)

                # Update the post as parsed
                self.db.update_post_by_id(post_id, {"parsed": True})

                logger.info(f"Inserted new event: {event['Name']}")

    def safe_int(self, value, default=0):
        return safe_int(value, default)

    def dict_to_interval(self, duration_dict: dict) -> str:
        """Convert duration dictionary to a PostgreSQL interval string safely."""
        days = safe_int(duration_dict.get("days", 0))
        hours = safe_int(duration_dict.get("hours", 0))
        minutes = safe_int(duration_dict.get("minutes", 0))

        parts = []
        if days:
            parts.append(f"{days} days")
        if hours:
            parts.append(f"{hours} hours")
        if minutes:
            parts.append(f"{minutes} minutes")

        return " ".join(parts) or "0 minutes"
