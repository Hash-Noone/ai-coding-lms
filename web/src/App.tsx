import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { concepts, problems, resources } from "virtual:problem-bank";
import { supabase } from "./supabase";
import { Auth } from "./Auth";
import { ProblemView, resourceUrl } from "./ProblemView";
import { CourseArt } from "./CourseArt";
import { Icon } from "./Icon";
import { courses, courseLessons, courseProgress, nextLesson, type Course } from "./courses";
import { ENROLLED_STORAGE_KEY, SOLVED_STORAGE_KEY, loadEnrolled, loadSolved, saveStoredList } from "./learningState";
import "./practice.css";
import "./courses.css";

const navItems = [
  { slug: "explore", label: "Explore courses", icon: "grid" },
  { slug: "learning", label: "My learning", icon: "book" },
  { slug: "progress", label: "My progress", icon: "chart" },
  { slug: "resources", label: "Resource library", icon: "play" },
] as const;

function readRoute() {
  return typeof window === "undefined" ? "explore" : window.location.hash.slice(1) || "explore";
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  return <progress aria-label="Course completion" max={total || 1} value={completed} />;
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All courses");
  const [conceptFilter, setConceptFilter] = useState("all");
  const [solved, setSolved] = useState<string[]>(loadSolved);
  const [enrolled, setEnrolled] = useState<string[]>(loadEnrolled);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === ENROLLED_STORAGE_KEY || event.key === null) setEnrolled(loadEnrolled());
      if (event.key === SOLVED_STORAGE_KEY || event.key === null) setSolved(loadSolved());
    };
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  const conceptNames = useMemo(() => Object.fromEntries(concepts.map((concept) => [concept.slug, concept.name])), []);
  const [, courseSlug, lessonSlug] = route.split("/");
  const selectedCourse = route.startsWith("course/") ? courses.find((course) => course.slug === courseSlug) : undefined;
  const lessons = selectedCourse ? courseLessons(selectedCourse) : [];
  const selectedProblem = lessons.find((lesson) => lesson.slug === lessonSlug);
  useEffect(() => {
    if (!selectedCourse || !selectedProblem) return;
    setEnrolled((previous) => {
      const next = [...new Set([...loadEnrolled(), ...previous, selectedCourse.slug])];
      saveStoredList(ENROLLED_STORAGE_KEY, next);
      return next;
    });
  }, [selectedCourse, selectedProblem]);
  const activeNav = selectedCourse ? "learning" : route;
  const myCourses = courses.filter((course) => enrolled.includes(course.slug) || courseProgress(course, solved).completed > 0);
  const featured = myCourses.find((course) => courseProgress(course, solved).percent < 100)
    ?? courses.find((course) => courseProgress(course, solved).percent < 100)
    ?? courses[0];
  const featuredProgress = courseProgress(featured, solved);
  const query = search.trim().toLowerCase();
  const filteredCourses = (route === "learning" ? myCourses : courses).filter((course) =>
    (level === "All courses" || course.level === level)
    && `${course.title} ${course.description} ${course.concepts.map((slug) => conceptNames[slug]).join(" ")}`.toLowerCase().includes(query),
  );
  const filteredResources = resources.filter((resource) =>
    (conceptFilter === "all" || resource.concepts.includes(conceptFilter))
    && `${resource.title} ${resource.concepts.map((slug) => conceptNames[slug]).join(" ")}`.toLowerCase().includes(query),
  );

  function navigate(next: string) {
    setRoute(next);
    setSearch("");
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function enroll(course: Course) {
    setEnrolled((previous) => {
      const next = [...new Set([...loadEnrolled(), ...previous, course.slug])];
      saveStoredList(ENROLLED_STORAGE_KEY, next);
      return next;
    });
  }
  function openLesson(course: Course, slug: string) {
    enroll(course);
    navigate(`course/${course.slug}/${slug}`);
  }
  function startCourse(course: Course) {
    openLesson(course, nextLesson(course, solved).slug);
  }
  function markSolved(slug: string) {
    setSolved((previous) => {
      const next = [...new Set([...loadSolved(), ...previous, slug])];
      saveStoredList(SOLVED_STORAGE_KEY, next);
      return next;
    });
  }
  function courseCard(course: Course) {
    const progress = courseProgress(course, solved);
    const started = enrolled.includes(course.slug) || progress.completed > 0;
    return <article className="course-card" key={course.slug}>
      <button className={`course-cover ${course.theme}`} aria-label={`View ${course.title}`} onClick={() => navigate(`course/${course.slug}`)}>
        <span className="cover-label">AI CODING LMS <span> / </span> PYTHON SERIES</span><CourseArt variant={courses.indexOf(course)} /><span className="cover-number">0{courses.indexOf(course) + 1}</span>
      </button>
      <div className="course-card-body"><div className="course-meta"><span><span className={`level-dots ${course.level.toLowerCase()}`} />{course.level}</span><span>{progress.total} lessons</span></div>
        <h3><button className="title-button" onClick={() => navigate(`course/${course.slug}`)}>{course.title}</button></h3><p>{course.subtitle}</p>
        {started ? <div className="card-progress"><ProgressBar {...progress} /><span>{progress.completed} of {progress.total} lessons complete</span></div> : <div className="course-features"><Icon name="code" size={15} /> Hands-on practice <span>·</span> Free to learn</div>}
        <div className="course-card-bottom"><span className="python-label">Python <span>3</span></span><button className="text-button" onClick={() => started ? startCourse(course) : navigate(`course/${course.slug}`)}>{progress.percent === 100 ? "Review course" : started ? "Continue learning" : "Explore course"}<Icon name="arrow" size={17} /></button></div>
      </div>
    </article>;
  }

  const pageLabel = selectedCourse ? selectedCourse.title : navItems.find((item) => item.slug === route)?.label ?? (route === "account" ? "Your account" : "Explore courses");
  const catalog = route === "explore" || route === "learning";
  const validRoute = catalog || selectedCourse || route === "resources" || route === "progress" || route === "account";

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#explore" onClick={(event) => { event.preventDefault(); navigate("explore"); }} aria-label="AI Coding LMS home"><span className="brand-icon"><Icon name="code" size={23} /></span><span>coding<span className="brand-light">lms</span><small>LEARN. BUILD. BECOME.</small></span></a>
      <span className="nav-eyebrow">WORKSPACE</span>
      <nav aria-label="Primary">{navItems.map((item) => <button key={item.slug} className={`sidebar-link ${activeNav === item.slug ? "active" : ""}`} aria-current={activeNav === item.slug ? "page" : undefined} onClick={() => navigate(item.slug)}><Icon name={item.icon} />{item.label}{item.slug === "learning" && myCourses.length > 0 && <span className="nav-count">{myCourses.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="leaf-badge"><Icon name="leaf" /></span><strong>A little practice.<br />A lot of possibility.</strong><p>Big things start with one line of code.</p><button className="text-button" onClick={() => startCourse(featured)}>Find your next step <Icon name="arrow" size={16} /></button></div><span className="beta-label"><span /> YOUR SPACE TO GROW <span className="beta-word">BETA</span></span></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <Icon name="chevron" size={13} /><span>{pageLabel}</span></div><button className="account-button" aria-label="Your account" onClick={() => navigate("account")}><span className="account-avatar"><Icon name="user" size={18} /></span><span>{session ? "My account" : "Sign in"}</span><Icon name="chevron" size={13} /></button></header>
      <main id="main-content" tabIndex={-1}>
        {catalog && <>
          <div className="page-heading"><div><span className="eyebrow">YOUR LEARNING JOURNEY</span><h1>{route === "learning" ? "Make room for your next chapter." : "Small steps. Real skills."}</h1><p>{route === "learning" ? "Pick up where you left off. Your next breakthrough is waiting." : "Build your confidence in Python, one hands-on lesson at a time."}</p></div><span className="heading-detail"><span className="status-dot" /> LEARN AT YOUR OWN PACE</span></div>
          <div className="welcome-grid"><section className="learning-hero mint"><div className="hero-copy"><span className="hero-kicker">{myCourses.length ? "KEEP YOUR MOMENTUM" : "A GOOD PLACE TO BEGIN"}</span><h2>{myCourses.length ? featured.title : <>Your future starts<br />with <em>hello, world.</em></>}</h2><p>{myCourses.length ? `${featuredProgress.completed} of ${featuredProgress.total} lessons complete. Every line is a step forward.` : "No experience? No problem. Meet Python and discover what you can create."}</p><button className="btn-primary" onClick={() => startCourse(featured)}>{myCourses.length ? "Continue learning" : "Start learning for free"}<Icon name="arrow" size={18} /></button><span className="hero-footnote">{featured.level} friendly <span>·</span> Learn by doing</span></div><CourseArt hero variant={courses.indexOf(featured)} /></section>
            <aside className="journey-card"><span className="eyebrow">THE WAY WE LEARN</span><h2>Less watching.<br />More <em>doing.</em></h2><ol><li><span>01</span><div><strong>Learn a concept</strong><p>Start small. Build a foundation.</p></div></li><li><span>02</span><div><strong>Make it work</strong><p>Write real Python in your browser.</p></div></li><li><span>03</span><div><strong>See your progress</strong><p>Get instant feedback. Keep growing.</p></div></li></ol><div className="journey-footer"><Icon name="code" size={17} /> No setup. Just you and your ideas.</div></aside></div>
          <section aria-labelledby="courses-heading"><div className="section-heading"><div><h2 id="courses-heading">{route === "learning" ? "Your courses" : "Find your next possibility"}<span className="count-label">{route === "learning" ? myCourses.length : courses.length} courses</span></h2><p>{route === "learning" ? "Progress is saved in this browser." : "A thoughtful path from your first line to your next challenge."}</p></div></div>
            <div className="catalog-controls"><div className="filter-bar" role="group" aria-label="Filter courses by level">{["All courses", "Beginner", "Intermediate"].map((value) => <button key={value} aria-pressed={level === value} className={`filter-pill ${level === value ? "active" : ""}`} onClick={() => setLevel(value)}>{value}</button>)}</div><label className="catalog-search"><Icon name="search" size={17} /><span className="sr-only">Search courses</span><input type="search" placeholder="Find a course…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
            {filteredCourses.length ? <div className="course-grid">{filteredCourses.map(courseCard)}</div> : <div className="empty-state"><Icon name="book" size={32} /><h3>{route === "learning" && !myCourses.length ? "Your journey is a blank page." : "No courses found."}</h3><p>{route === "learning" && !myCourses.length ? "Start a course and it will be waiting for you here." : "Try another search or choose a different level."}</p><button className="btn-secondary" onClick={() => { setLevel("All courses"); setSearch(""); if (route === "learning") navigate("explore"); }}>Explore all courses</button></div>}
          </section><div className="bottom-note"><Icon name="leaf" size={19} /><p>You don’t have to know it all. You just have to start.</p><span>HAPPY LEARNING</span></div>
        </>}

        {selectedCourse && !selectedProblem && <>
          <button className="back-link" onClick={() => navigate("explore")}>← All courses</button>
          <section className={`course-detail-hero ${selectedCourse.theme}`}><div><span className="eyebrow">THE PYTHON SERIES / COURSE 0{courses.indexOf(selectedCourse) + 1}</span><h1>{selectedCourse.title}</h1><p>{selectedCourse.description}</p><div className="detail-meta"><span>{selectedCourse.level}</span><span>{lessons.length} hands-on lessons</span><span>Self-paced · Free</span></div><button className="btn-primary" onClick={() => startCourse(selectedCourse)}>{courseProgress(selectedCourse, solved).percent === 100 ? "Review course" : myCourses.includes(selectedCourse) ? "Continue learning" : "Start course"}<Icon name="arrow" size={18} /></button></div><CourseArt hero variant={courses.indexOf(selectedCourse)} /></section>
          <div className="course-detail-grid"><section className="curriculum"><div className="section-heading"><h2>Your course roadmap</h2><span className="muted-line">{lessons.length} lessons</span></div><p className="muted-line">Each lesson is a coding challenge. Pass its public tests to complete it.</p>{selectedCourse.concepts.map((slug) => {
            const group = lessons.filter((lesson) => lesson.concepts[0] === slug);
            return group.length > 0 && <div className="module" key={slug}><h3>{conceptNames[slug]}<span>{group.length} lessons</span></h3>{group.map((lesson) => <button className="lesson-row" key={lesson.slug} onClick={() => openLesson(selectedCourse, lesson.slug)}><span className={`lesson-status ${solved.includes(lesson.slug) ? "done" : ""}`}><Icon name={solved.includes(lesson.slug) ? "check" : "code"} size={16} /></span><span>{lesson.title}<small>{solved.includes(lesson.slug) ? "Completed" : `${lesson.publicTests.length} public tests`}</small></span><Icon name="chevron" size={16} /></button>)}</div>;
          })}</section><aside className="outcomes-card"><span className="eyebrow">BUILT FOR REAL UNDERSTANDING</span><h2>What you’ll take away</h2><ul>{selectedCourse.outcomes.map((outcome) => <li key={outcome}><Icon name="check" size={18} />{outcome}</li>)}</ul><h3>Your progress</h3><ProgressBar {...courseProgress(selectedCourse, solved)} /><p className="muted-line">{courseProgress(selectedCourse, solved).completed} of {lessons.length} lessons complete in this browser.</p><div className="info-note">A code editor, instant test results, and helpful videos. Everything you need, right here.</div></aside></div>
        </>}

        {selectedCourse && selectedProblem && <>
          <div className="lesson-page-heading"><div><button className="back-link" onClick={() => navigate(`course/${selectedCourse.slug}`)}>← {selectedCourse.title}</button><h1>Let’s put it into practice.</h1></div><span className="lesson-counter">LESSON {lessons.indexOf(selectedProblem) + 1} OF {lessons.length}</span></div>
          <div className="lesson-workspace"><aside className="lesson-outline"><h2>Course content</h2><ProgressBar {...courseProgress(selectedCourse, solved)} /><p>{courseProgress(selectedCourse, solved).completed} / {lessons.length} completed</p><nav aria-label="Course lessons">{lessons.map((lesson, index) => <button key={lesson.slug} className={`outline-lesson ${lesson.slug === selectedProblem.slug ? "active" : ""}`} aria-current={lesson.slug === selectedProblem.slug ? "step" : undefined} onClick={() => openLesson(selectedCourse, lesson.slug)}><span className={solved.includes(lesson.slug) ? "outline-check" : "outline-number"}>{solved.includes(lesson.slug) ? <Icon name="check" size={15} /> : String(index + 1).padStart(2, "0")}</span>{lesson.title}</button>)}</nav></aside><div className="lesson-content"><ProblemView key={selectedProblem.slug} problem={selectedProblem} conceptNames={conceptNames} relatedResources={resources.filter((resource) => resource.concepts.some((slug) => selectedProblem.concepts.includes(slug)))} onBack={() => navigate(`course/${selectedCourse.slug}`)} backLabel="← Course overview" onSolved={markSolved} accessToken={session?.access_token} /><div className="lesson-pagination"><span className={solved.includes(selectedProblem.slug) ? "pass" : "muted-line"}>{solved.includes(selectedProblem.slug) ? "✓ Lesson complete. Nicely done!" : "Pass all public tests to complete this lesson."}</span><button className="btn-primary" onClick={() => lessons.indexOf(selectedProblem) < lessons.length - 1 ? openLesson(selectedCourse, lessons[lessons.indexOf(selectedProblem) + 1].slug) : navigate(`course/${selectedCourse.slug}`)}>{lessons.indexOf(selectedProblem) < lessons.length - 1 ? "Next lesson" : "Course overview"}<Icon name="arrow" size={17} /></button></div><p className="storage-note">Drafts and course progress stay in this browser. {session ? "Signed-in runs are saved when the API is available." : "Sign in to save attempts to your account."}</p></div></div>
        </>}

        {route === "progress" && <><div className="page-heading"><div><span className="eyebrow">EVERY STEP COUNTS</span><h1>Look how far you can go.</h1><p>Your learning, at a glance. Progress is stored in this browser, not synced across devices.</p></div></div><div className="stats-grid">{([{ value: solved.length, label: "Lessons completed", icon: "check" }, { value: myCourses.length, label: "Courses started", icon: "book" }, { value: courses.filter((course) => courseProgress(course, solved).percent === 100).length, label: "Courses completed", icon: "chart" }] as const).map(({ value, label, icon }) => <div className="stat-card" key={label}><span className="stat-icon"><Icon name={icon} /></span><strong>{value}</strong><span>{label}</span></div>)}</div><section className="progress-panel"><h2>Your learning path</h2>{courses.map((course) => { const progress = courseProgress(course, solved); return <div className="progress-course" key={course.slug}><span className={`course-monogram ${course.theme}`}>{course.symbol}</span><div><button className="title-button" onClick={() => navigate(`course/${course.slug}`)}>{course.title}</button><ProgressBar {...progress} /><span>{progress.completed} of {progress.total} lessons complete</span></div><strong>{progress.percent}%</strong><button className="round-button" aria-label={`Continue ${course.title}`} onClick={() => startCourse(course)}><Icon name="arrow" /></button></div>; })}</section><div className="info-note">Completion is based on passing the public tests. It’s a practice milestone, not a certificate or a mastery assessment.</div></>}

        {route === "resources" && <><div className="page-heading"><div><span className="eyebrow">A LITTLE HELP ALONG THE WAY</span><h1>Another way to see it.</h1><p>{resources.length} curated Python videos. Find a fresh explanation when a concept needs another look.</p></div></div><div className="resource-controls"><label className="catalog-search"><Icon name="search" size={18} /><span className="sr-only">Search resources</span><input type="search" placeholder="Find a video or concept…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="concept-select">Concept<select value={conceptFilter} onChange={(event) => setConceptFilter(event.target.value)}><option value="all">All concepts</option>{concepts.map((concept) => <option key={concept.slug} value={concept.slug}>{concept.name}</option>)}</select></label><span className="muted-line">{filteredResources.length} videos</span></div><ul className="video-grid">{filteredResources.map((resource, index) => <li className="video-card" key={`${resource.url}-${resource.start_seconds}`}><span className={`video-icon ${courses[index % 4].theme}`}><Icon name="play" size={26} /></span><div><span className="eyebrow">CURATED VIDEO · EXTERNAL RESOURCE</span><h2><a href={resourceUrl(resource)} target="_blank" rel="noreferrer">{resource.title}<span aria-hidden="true"> ↗</span></a></h2><div className="concept-pills">{resource.concepts.map((slug) => <span className="tag" key={slug}>{conceptNames[slug]}</span>)}</div></div></li>)}</ul>{!filteredResources.length && <div className="empty-state"><h2>No videos found.</h2><p>Try another search or concept.</p></div>}</>}

        {route === "account" && <div className="account-page"><span className="eyebrow">YOUR LEARNING COMPANION</span><h1>A space for your progress.</h1><p>Practice freely without an account. Sign in to save your coding attempts to the learning API.</p><div className="problem-panel account-panel">{supabase ? <Auth client={supabase} session={session} /> : <><h2>Keep learning, no account needed.</h2><p>Sign-in is not configured in this environment. All courses and the Python editor are still available.</p></>}</div><p className="storage-note">Course enrollment, completed lessons, and code drafts are saved on this browser only. Signing in does not sync them across devices.</p></div>}
        {!validRoute && <div className="empty-state"><h1>This page isn’t on the roadmap.</h1><p>Let’s get you back to learning.</p><button className="btn-primary" onClick={() => navigate("explore")}>Explore courses</button></div>}
        <footer className="app-footer"><span>AI Coding LMS <span> / </span> A little better, every day.</span><span>{problems.length} challenges. Endless possibilities.</span></footer>
      </main>
    </div>
  </div>;
}
