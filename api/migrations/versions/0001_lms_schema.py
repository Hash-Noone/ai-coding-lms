"""Create the LMS schema and seed the concept catalog."""

from alembic import op

revision = "0001_lms_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE public.users (
            id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE FUNCTION public.create_lms_user() RETURNS trigger
            LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
        AS $$
        BEGIN
            INSERT INTO public.users (id) VALUES (NEW.id);
            RETURN NEW;
        END;
        $$;

        REVOKE ALL ON FUNCTION public.create_lms_user() FROM PUBLIC;

        CREATE TRIGGER create_lms_user
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.create_lms_user();

        INSERT INTO public.users (id) SELECT id FROM auth.users;

        CREATE TABLE public.concepts (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            slug text NOT NULL UNIQUE,
            name text NOT NULL
        );

        INSERT INTO public.concepts (slug, name) VALUES
            ('variables', 'Variables and assignment'),
            ('types', 'Types and conversions'),
            ('operators', 'Operators and expressions'),
            ('conditionals', 'Conditionals'),
            ('loops', 'Loops'),
            ('strings', 'Strings'),
            ('lists', 'Lists'),
            ('dictionaries', 'Dictionaries'),
            ('sets', 'Sets'),
            ('functions', 'Functions'),
            ('indexing', 'Indexing and slicing'),
            ('exceptions', 'Exceptions');

        CREATE TABLE public.problems (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            slug text NOT NULL UNIQUE,
            title text NOT NULL,
            prompt text NOT NULL,
            starter_code text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE public.problem_concepts (
            problem_id bigint REFERENCES public.problems (id) ON DELETE CASCADE,
            concept_id bigint REFERENCES public.concepts (id) ON DELETE CASCADE,
            PRIMARY KEY (problem_id, concept_id)
        );

        CREATE TABLE public.test_cases (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            problem_id bigint NOT NULL REFERENCES public.problems (id) ON DELETE CASCADE,
            position integer NOT NULL CHECK (position >= 0),
            input jsonb NOT NULL,
            expected_output jsonb NOT NULL,
            is_hidden boolean NOT NULL,
            UNIQUE (problem_id, position)
        );

        CREATE TABLE public.attempts (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
            problem_id bigint NOT NULL REFERENCES public.problems (id),
            code text NOT NULL,
            test_results jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (id, user_id)
        );

        CREATE TABLE public.mastery (
            user_id uuid REFERENCES public.users (id) ON DELETE CASCADE,
            concept_id bigint REFERENCES public.concepts (id) ON DELETE CASCADE,
            score numeric NOT NULL CHECK (score BETWEEN 0 AND 1),
            updated_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, concept_id)
        );

        CREATE TABLE public.questions (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
            attempt_id bigint,
            body text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            FOREIGN KEY (attempt_id, user_id)
                REFERENCES public.attempts (id, user_id) ON DELETE SET NULL (attempt_id)
        );

        CREATE TABLE public.resources (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            title text NOT NULL,
            url text NOT NULL,
            mistake_type text,
            start_seconds integer NOT NULL DEFAULT 0 CHECK (start_seconds >= 0)
        );

        CREATE TABLE public.resource_concepts (
            resource_id bigint REFERENCES public.resources (id) ON DELETE CASCADE,
            concept_id bigint REFERENCES public.concepts (id) ON DELETE CASCADE,
            PRIMARY KEY (resource_id, concept_id)
        );

        CREATE TABLE public.resource_clicks (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            resource_id bigint NOT NULL REFERENCES public.resources (id),
            user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX problem_concepts_concept_idx ON public.problem_concepts (concept_id);
        CREATE INDEX attempts_user_idx ON public.attempts (user_id);
        CREATE INDEX attempts_problem_idx ON public.attempts (problem_id);
        CREATE INDEX questions_user_idx ON public.questions (user_id);
        CREATE INDEX questions_attempt_idx ON public.questions (attempt_id);
        CREATE INDEX mastery_concept_idx ON public.mastery (concept_id);
        CREATE INDEX resource_concepts_concept_idx ON public.resource_concepts (concept_id);
        CREATE INDEX resource_clicks_user_idx ON public.resource_clicks (user_id);
        CREATE INDEX resource_clicks_resource_idx ON public.resource_clicks (resource_id);

        ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.problem_concepts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.mastery ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.resource_concepts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.resource_clicks ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER create_lms_user ON auth.users;
        DROP FUNCTION public.create_lms_user();
        DROP TABLE public.resource_clicks, public.resource_concepts, public.resources,
            public.questions, public.mastery, public.attempts, public.test_cases,
            public.problem_concepts, public.problems, public.concepts, public.users;
    """)
