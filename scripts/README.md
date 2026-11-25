# Scripts

Checks for the problem bank and curated resources in `data/`. They use only the
Python 3.12 standard library; the tests need `pytest`.

```sh
cd scripts
python -m pip install 'pytest>=8,<10' 'ruff>=0.11,<1'
python validate_problems.py            # whole bank, with concept and mistake-type coverage
python validate_problems.py two-sum-indices fizzbuzz-value   # selected problems only
python check_links.py                  # resource metadata, then every link live
python check_links.py --offline        # metadata only
ruff check . && python -m pytest
```

CI runs all of these on every push.

## validate_problems.py

For each problem it checks the metadata against `data/concepts.json` and
`data/taxonomy.json`, parses the three Python files, and runs them against every
public and hidden test in a separate interpreter with a 2-second limit per test.
A problem fails when:

- `reference.py` fails any test,
- `wrong.py` or the untouched `starter.py` passes every test,
- a `syntax` wrong solution parses, or any other file does not,
- `starter.py` or `wrong.py` defines the entry point with different parameters than `reference.py`,
- test labels or argument lists repeat.

The full run also fails if any concept or mistake type has no problem.

## check_links.py

Resources need HTTPS URLs, known concepts, a known `mistake_type` (or `null` for
general resources), and a non-negative integer `start_seconds`. YouTube links
must be `https://www.youtube.com/watch?v=<id>`; the start time is kept in
`start_seconds`, not in the URL. Videos are checked through YouTube's oEmbed
endpoint, which returns 401 or 403 for private or non-embeddable videos and 404
for removed ones. Other URLs must answer with a status below 400. Rate limits,
server errors and network failures are retried twice before a link is reported.
