import json
import urllib.error

import pytest

import check_links
from bank import DATA_DIR, load_concepts, load_mistake_types

CONCEPTS = load_concepts()
MISTAKES = load_mistake_types()
VIDEO = "https://www.youtube.com/watch?v=JP7ITIXGpHk"


def resource(**overrides):
    base = {"title": "Loops", "url": VIDEO, "concepts": ["loops"], "mistake_type": "loop_logic", "start_seconds": 0}
    return base | overrides


def errors_for(*resources):
    return check_links.check_metadata(list(resources), CONCEPTS, MISTAKES)


def test_curated_resources_are_valid():
    resources = json.loads((DATA_DIR / "resources.json").read_text())
    assert errors_for(*resources) == []
    assert len(resources) >= 30
    assert {r["mistake_type"] for r in resources} >= MISTAKES


def test_offline_main_passes(capsys):
    assert check_links.main(["--offline"]) == 0
    assert "metadata for" in capsys.readouterr().out


@pytest.mark.parametrize(
    "bad, message",
    [
        (resource(url="http://example.com"), "must use https"),
        (resource(url=VIDEO + "&t=30"), "watch?v=<id>"),
        (resource(url="https://youtu.be/JP7ITIXGpHk"), "watch?v=<id>"),
        (resource(concepts=["monads"]), "known concept slugs"),
        (resource(concepts=[]), "known concept slugs"),
        (resource(mistake_type="typo"), "unknown mistake_type"),
        (resource(start_seconds=-1), "non-negative integer"),
        (resource(start_seconds=1.5), "non-negative integer"),
        ({"title": "x", "url": VIDEO}, "exactly the keys"),
    ],
)
def test_bad_metadata_is_rejected(bad, message):
    assert any(message in error for error in errors_for(bad))


def test_null_mistake_type_is_allowed():
    assert errors_for(resource(mistake_type=None)) == []


def test_duplicate_url_and_start_is_rejected():
    assert any("repeats" in error for error in errors_for(resource(), resource(title="Again")))
    assert errors_for(resource(), resource(start_seconds=60)) == []


def fetcher(*statuses):
    calls = []

    def fetch(url):
        calls.append(url)
        status = statuses[len(calls) - 1]
        if isinstance(status, Exception):
            raise status
        return status

    return fetch, calls


def test_youtube_uses_oembed():
    fetch, calls = fetcher(200)
    assert check_links.check_url(VIDEO, fetch, sleep=lambda _: None) is None
    assert calls[0].startswith(check_links.OEMBED)


@pytest.mark.parametrize("status, reason", [(401, "private"), (403, "private"), (404, "removed"), (400, "removed")])
def test_unavailable_youtube_videos_fail(status, reason):
    fetch, _ = fetcher(status)
    assert reason in check_links.check_url(VIDEO, fetch, sleep=lambda _: None)


def test_dead_page_fails():
    fetch, calls = fetcher(404)
    assert check_links.check_url("https://example.com/gone", fetch, sleep=lambda _: None) == "HTTP 404"
    assert calls == ["https://example.com/gone"]


def test_transient_errors_are_retried():
    fetch, calls = fetcher(503, urllib.error.URLError("reset"), 200)
    assert check_links.check_url(VIDEO, fetch, sleep=lambda _: None) is None
    assert len(calls) == 3


def test_persistent_failures_are_reported():
    fetch, calls = fetcher(429, 429, 429)
    assert check_links.check_url(VIDEO, fetch, sleep=lambda _: None) == "HTTP 429"
    assert len(calls) == check_links.ATTEMPTS
    fetch, _ = fetcher(*[urllib.error.URLError("no route")] * 3)
    assert "request failed" in check_links.check_url(VIDEO, fetch, sleep=lambda _: None)
