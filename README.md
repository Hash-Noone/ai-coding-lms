# AI Coding LMS

AI Coding LMS is a planned learning platform for practicing Python in the browser. When a learner fails a test, the app will explain the likely mistake, offer a curated resource, and recommend practice problems for the concept they struggled with.

**Status:** The course catalog, lesson workspace, browser-local progress dashboard, problem bank, browser runner, Supabase sign-in, attempt storage, and static checks are implemented. AI feedback is not.

## Getting started

Prerequisites: Node.js 24 with npm and Python 3.12 with pip. Clone the repository:

```sh
git clone https://github.com/Hash-Noone/ai-coding-lms.git
cd ai-coding-lms
```

### Web app

From the repository root:

```sh
cd web
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). From `web/`, run `npm run lint`, `npm test`, and `npm run build` to run the same checks as CI.

Open **Python Foundations**, choose **Start course**, and select **Run public tests** in the lesson workspace. No sign-in is needed. The first lesson is **Celsius to Fahrenheit**: use `return round(celsius * 9 / 5 + 32, 1)` inside its starter function for a passing solution. The first run downloads Pyodide from jsDelivr, so it needs internet access. To try recovery, run `while True: pass`, then restore your solution and run again.

The four courses organize all 52 exercises by primary concept. Use the lesson outline or **Next lesson** to move through a course; a lesson completes only when all its public tests pass. **My learning** lists started courses and resumes at the first incomplete lesson. **My progress** summarizes course completion. **Resource library** searches and filters the 40 curated videos, preserving their chapter timestamps. Course and lesson hash URLs can be bookmarked.

Enrollment, completed lessons, and code drafts persist in this browser's local storage only, including when signed out. Signing in does not sync this course progress across devices. Existing solved lessons remain recognized. Completion is a practice milestone, not a certificate or a trusted assessment.

To save attempts locally, start the API below, set `VITE_API_URL=http://localhost:8000` in `web/.env` alongside the Supabase settings, and restart Vite. Sign in with Supabase and run the public tests. The app sends `problem_slug`, `code`, and `test_results` with the Supabase bearer token and displays **Attempt saved.** and any static findings when the API responds. A run that ends without test results is saved with an empty results list. Signed-out learners and learners without an API configured can still run public tests without saving.

### API

In a separate terminal, from the repository root:

```sh
cd api
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m uvicorn app.main:app --reload
```

Check [http://localhost:8000/health](http://localhost:8000/health). From `api/` with the environment active, run `ruff check .` and `python -m pytest`.

The authenticated routes are `GET /problems`, `GET /problems/{id}` (where `id` is the bank slug), and `POST /attempts`. The catalog reads the checked-in `data/problems` directory and exposes only public tests. On the first saved run for a slug, the API adds the corresponding problem to Postgres if needed. The API verifies the session with Supabase, saves the browser-reported results, and returns the attempt ID, test results and findings from Python's AST parser and Ruff. It never executes the submitted Python or calls an LLM, and the browser's results are not a trusted grade.

### Local configuration

CI does not require a hosted Supabase project. It runs the migration test on a local PostgreSQL service and mocks the auth client in web tests.

Each teammate should set `GEMINI_API_KEY` in their own `api/.env` when working on AI feedback. This scaffold does not call Gemini. Never commit `.env` or include these values in the web app; the deployed API will use a separate server-side key.

### Supabase project setup

1. Create a Supabase project. In Authentication, enable the Email provider and allow new users to sign up. For email confirmation, set the Site URL to the deployed web app URL (or `http://localhost:5173` for local-only testing) and configure SMTP for the pilot.
2. Copy `api/.env.example` to `api/.env`. Set `SUPABASE_URL` to the project URL and `SUPABASE_PUBLISHABLE_KEY` to its publishable key. Set `DATABASE_URL` to the database URI from **Connect**, with the database password filled in. Use the direct connection or session pooler URI and add `sslmode=require` if it is not already specified. With the virtual environment active, run `python -m app.check_db` and `alembic upgrade head` from `api/`.
3. Copy `web/.env.example` to `web/.env` and set `VITE_SUPABASE_URL` to the project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to the publishable key (the legacy `anon` key also works). Set the same vars before building the deployed frontend. Never use the service-role key, secret key, or database URI in the frontend.

The migration creates a matching LMS user for each Supabase Auth user, including existing accounts. The browser talks directly to Supabase for authentication, but only the API connects to LMS tables.

### Test migrations on local Postgres

Use an empty PostgreSQL 16+ test database rather than a Supabase or production database. From `api/`, with the virtual environment active:

```sh
TEST_DATABASE_URL=postgresql://postgres:lms_test@127.0.0.1:5432/lms_test python -m pytest
```

The test uses a minimal `auth.users` stub and rolls back its changes. To build the LMS schema and seed data on a fresh, empty plain Postgres database in one command, run from `api/`:

```sh
DATABASE_URL=postgresql://postgres:lms_test@127.0.0.1:5432/lms_test alembic -x local_auth_stub=true upgrade head
```

The stub is for local database testing only; it does not provide sign-in. On Supabase, use `alembic upgrade head` without the stub flag. To undo all LMS migrations in a disposable database, run `alembic downgrade base` (this deletes LMS data, but leaves Auth users intact).

## Planned architecture

| Component | Plan |
| --- | --- |
| Web app | React or Next.js with Monaco Editor. Pyodide runs learner code and public tests in a Web Worker. The page shows a loading state on first download and replaces the worker on timeout so an infinite loop cannot freeze the page. |
| API | FastAPI serves problems, records attempts, and returns structured findings from Python's `ast` parser and a linter such as Ruff. The LLM gateway runs only on the API. |
| Data and sign-in | Supabase Postgres with Alembic migrations. Supabase Auth provides email/password accounts. |
| AI feedback | A provider chain such as Gemini followed by Groq, with a per-user daily cap and a cache keyed by a hash of the problem, code with whitespace and comments stripped, and error signature. Pydantic validates the feedback; low-confidence results fall back to a generic hint. |
| CI and hosting | GitHub Actions runs lint and tests on every push. Planned hosting options are Vercel or Netlify for the frontend and Render, Railway, or Fly for the API. |

Each developer uses their own Gemini key in a local, uncommitted `.env` file. The deployed API uses a paid Gemini key set as a server-side host environment variable. The browser never calls the LLM provider directly.

### Repository layout

```text
web/                 Frontend and browser runner
api/                 FastAPI service
scripts/             Problem validation and resource link checks
data/                Taxonomy, concepts, problem bank, and resources
```

## Build roadmap

1. **Set up the monorepo and accounts.** Scaffold the web and API apps, provision Postgres, configure local keys, and set up GitHub Actions. This step is done when teammates can run both apps, connect to the database, and see CI pass.
2. **Create the schema and add sign-in.** Add migrations for users, concepts, problems, public and hidden test cases, attempts, per-user and per-concept mastery, questions, resources, and resource clicks. Seed about 12 flat concept tags and version the mistake taxonomy. A fresh database should rebuild with one command, and users should be able to sign up and sign in.
3. **Build the problem bank and curate resources.** Start in week one and land 15 validated problems early, then grow the bank to 40–60 problems and curate about 30 resources with titles, URLs, concept tags, mistake types, and start times in seconds. Use problems the project owns or has rights to. CI checks that every reference solution passes and each deliberately wrong solution fails; a link checker flags dead or private videos. Collect buggy submissions for classifier evaluation.
4. **Build the problem view and browser runner.** Show the problem alongside the editor, report each public test result, and submit code and results to the API. Verify that a learner can solve a real problem and that an infinite loop times out without freezing the page.
5. **Build the API and static checks.** Add `GET /problems`, `GET /problems/{id}`, and `POST /attempts` for signed-in users. Save attempts and return test results and structured static findings without calling an LLM. Add endpoint and static-check unit tests to CI.
6. **Add the LLM gateway and mistake classifier.** Validate responses with `mistake_type`, `concepts`, `explanation`, `hint`, and `confidence`. Evaluate on at least 150 labeled buggy submissions, with at least 10 per mistake type. Aim for at least 80% mistake-type accuracy overall, check that no category falls far below that target, and show a generic hint when confidence is low.
7. **Add mastery, recommendations, and a help ladder.** Update a 0–1 mastery score per learner and concept after each attempt, with decay over time. Test mastery and decay in CI. Use `GET /practice` to serve problems for the weakest concepts and show mastery on a progress page. Match resources by mistake type and concept, and let the LLM choose only among the returned resource IDs. Offer help in stages: nudge, explanation, resource, and worked solution.
8. **Test, deploy, and pilot.** Add an end-to-end test covering sign-in, submission, feedback, resources, and practice. Deploy the web app and API with their environment variables configured, seed the production database, and pilot with 5–10 learners. Tell learners that their code is stored and sent to an AI provider, and log resource clicks and low-confidence classifications.

Problem and resource curation starts on day one. Once the schema is in place, the runner, API, and classifier work can proceed in parallel. Classifier labeling starts once the first 15 problems are available.

## Planned pilot demo

The basic version is finished when a new learner can complete this flow:

1. Sign in and open a Python problem.
2. Run a submission that fails a public test.
3. Get an explanation that identifies the mistake and see one curated resource.
4. Open a practice set focused on the weak concept.

## Known pilot limits

- The pilot trusts browser-reported test results, so learners can fake a pass and inflate their mastery scores. After the pilot, the plan is to run hidden tests in a server-side sandbox such as Judge0 and count only those results toward mastery.
- Resource matching uses a database query rather than vector search. The plan leaves out pgvector until there is a need for it.
