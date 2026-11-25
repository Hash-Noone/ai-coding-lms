"""Check the curated resources in data/resources.json.

Validates each resource's metadata, then confirms every URL is live. YouTube
links are checked through the oEmbed endpoint, which rejects private and
removed videos; other links must answer with a non-error HTTP status.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bank import DATA_DIR, load_concepts, load_mistake_types

RESOURCE_KEYS = {"title", "url", "concepts", "mistake_type", "start_seconds"}
YOUTUBE = re.compile(r"^https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})$")
OEMBED = "https://www.youtube.com/oembed?format=json&url="
USER_AGENT = "Mozilla/5.0 (compatible; ai-coding-lms-link-check)"
RETRY_STATUSES = {429, 500, 502, 503, 504}
ATTEMPTS = 3


def check_metadata(resources, concepts: set[str], mistake_types: set[str]) -> list[str]:
    if not isinstance(resources, list) or not resources:
        return ["resources.json must be a non-empty list"]
    errors = []
    seen = set()
    for position, resource in enumerate(resources):
        where = f"resource {position}"
        if not isinstance(resource, dict) or set(resource) != RESOURCE_KEYS:
            errors.append(f"{where} must have exactly the keys {sorted(RESOURCE_KEYS)}")
            continue
        where = f"resource {position} ({resource['title']!r})"
        url = resource["url"]
        if not isinstance(resource["title"], str) or not resource["title"].strip():
            errors.append(f"{where} needs a title")
        if not isinstance(url, str) or not url.startswith("https://"):
            errors.append(f"{where} url must use https")
        elif "youtube.com" in url or "youtu.be" in url:
            if not YOUTUBE.match(url):
                errors.append(f"{where} must use https://www.youtube.com/watch?v=<id> with no other parameters")
        tags = resource["concepts"]
        if not isinstance(tags, list) or not tags or len(set(tags)) != len(tags) or not set(tags) <= concepts:
            errors.append(f"{where} concepts must be a non-empty list of known concept slugs")
        if resource["mistake_type"] is not None and resource["mistake_type"] not in mistake_types:
            errors.append(f"{where} has unknown mistake_type {resource['mistake_type']!r}")
        start = resource["start_seconds"]
        if not isinstance(start, int) or isinstance(start, bool) or start < 0:
            errors.append(f"{where} start_seconds must be a non-negative integer")
        key = (url, start)
        if key in seen:
            errors.append(f"{where} repeats another resource's url and start_seconds")
        seen.add(key)
    return errors


def fetch_status(url: str) -> int:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def check_url(url: str, fetch=fetch_status, sleep=time.sleep) -> str | None:
    """Return None when the link is live, otherwise the reason it is not."""
    youtube = YOUTUBE.match(url)
    target = OEMBED + urllib.parse.quote(url, safe="") if youtube else url
    status = None
    for attempt in range(ATTEMPTS):
        try:
            status = fetch(target)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            status, reason = None, f"request failed: {error}"
        if status is not None and status not in RETRY_STATUSES:
            break
        if attempt < ATTEMPTS - 1:
            sleep(2 ** attempt)
    if status is None:
        return reason
    if status < 400:
        return None
    if youtube and status in (401, 403):
        return f"video is private or cannot be embedded (HTTP {status})"
    if youtube and status in (400, 404):
        return f"video was removed or does not exist (HTTP {status})"
    return f"HTTP {status}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--offline", action="store_true", help="check metadata only")
    args = parser.parse_args(argv)

    resources = json.loads((args.data_dir / "resources.json").read_text())
    errors = check_metadata(resources, load_concepts(args.data_dir), load_mistake_types(args.data_dir))
    for error in errors:
        print(f"FAIL {error}")
    if errors:
        return 1
    print(f"ok   metadata for {len(resources)} resources")
    if args.offline:
        return 0

    urls = sorted({resource["url"] for resource in resources})
    with ThreadPoolExecutor(max_workers=8) as pool:
        problems = dict(zip(urls, pool.map(check_url, urls)))
    dead = {url: reason for url, reason in problems.items() if reason}
    for url, reason in sorted(dead.items()):
        print(f"FAIL {url}: {reason}")
    print(f"{len(urls) - len(dead)} of {len(urls)} links live")
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())
