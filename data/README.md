# Data

`taxonomy.json` defines the current mistake types. Use each entry's stable `id`
in resource metadata and classifier labels. Increment `version` when changing
the taxonomy so labels can be traced to the version used.

`concepts.json` lists the concept slugs seeded by the first migration. A test
keeps the two in sync.

## Problems

Each problem in `problems/<slug>/` was written for this project and has four
files:

| File | Contents |
| --- | --- |
| `problem.json` | `slug`, `title`, `prompt` (Markdown), `entry_point`, 1–3 `concepts`, `public_tests`, `hidden_tests`, and `wrong_solution` |
| `starter.py` | The code a learner starts from |
| `reference.py` | A correct solution |
| `wrong.py` | A plausible buggy solution with the mistake described in `wrong_solution` |

A test is `{"label": ..., "args": [...], "expected": ...}`: the entry point is
called with `args` as positional arguments, and its return value must equal
`expected` as JSON. Problems need at least 3 public and 2 hidden tests.
`wrong_solution` is `{"mistake_type": <taxonomy id>, "explanation": ...}`, so
each wrong solution is also a labeled example for the classifier.

## Resources

`resources.json` is a list of `{"title", "url", "concepts", "mistake_type",
"start_seconds"}`. `start_seconds` is where the relevant part of a video
begins. `mistake_type` is `null` for resources that teach a concept without
targeting one mistake.

Run `scripts/validate_problems.py` and `scripts/check_links.py` after changing
any of these files.
