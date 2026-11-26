// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { problems, resources } from "virtual:problem-bank";
import { App } from "./App";
import { courses, courseLessons, courseProgress } from "./courses";
import { SOLVED_STORAGE_KEY, ENROLLED_STORAGE_KEY } from "./learningState";

vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("./ProblemView", async (importOriginal) => {
  const original = await importOriginal<typeof import("./ProblemView")>();
  return {
    ...original,
    ProblemView: ({ problem, onSolved }: { problem: { slug: string; title: string }; onSolved: (slug: string) => void }) =>
      <section><h2>{problem.title}</h2><button onClick={() => onSolved(problem.slug)}>Pass public tests</button></section>,
  };
});

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "#explore");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("puts every existing problem in exactly one course", () => {
  const assigned = courses.flatMap(courseLessons).map((lesson) => lesson.slug);
  expect(assigned.length).toBe(problems.length);
  expect(new Set(assigned).size).toBe(problems.length);
  expect(new Set(assigned)).toEqual(new Set(problems.map((problem) => problem.slug)));
  expect(courses.every((course) => courseLessons(course).length > 0)).toBe(true);
});

it("filters courses by level and concept, with a recoverable empty state", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Intermediate" }));
  expect(screen.queryByRole("button", { name: "View Python Foundations" })).toBeNull();
  expect(screen.getByRole("button", { name: "View Data & Collections" })).toBeTruthy();
  await user.type(screen.getByRole("searchbox"), "no-such-course");
  expect(screen.getByText("No courses found.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Explore all courses" }));
  await user.type(screen.getByRole("searchbox"), "recursion");
  expect(screen.getByRole("button", { name: "View Deeper Problem Solving" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "View Python Foundations" })).toBeNull();
});

it("enrolls, saves completion once, advances, and resumes at the first incomplete lesson", async () => {
  const user = userEvent.setup();
  const course = courses[0];
  const [first, second] = courseLessons(course);
  const { unmount } = render(<App />);
  await user.click(screen.getByRole("button", { name: "View Python Foundations" }));
  expect(screen.getByRole("heading", { name: "Your course roadmap" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Start course" }));
  expect(screen.getByRole("heading", { name: first.title })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(ENROLLED_STORAGE_KEY)!)).toEqual([course.slug]);
  await user.click(screen.getByRole("button", { name: "Pass public tests" }));
  await user.click(screen.getByRole("button", { name: "Pass public tests" }));
  expect(JSON.parse(localStorage.getItem(SOLVED_STORAGE_KEY)!)).toEqual([first.slug]);
  await user.click(screen.getByRole("button", { name: "Next lesson" }));
  expect(screen.getByRole("heading", { name: second.title })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "My progress" }));
  expect(screen.getByText(`1 of ${courseLessons(course).length} lessons complete`)).toBeTruthy();
  unmount();
  window.history.replaceState(null, "", "#learning");
  render(<App />);
  await user.click(screen.getAllByRole("button", { name: "Continue learning" })[0]);
  expect(screen.getByRole("heading", { name: second.title })).toBeTruthy();
});

it("loads lesson deep links and keeps invalid stored slugs out of progress", () => {
  const first = courseLessons(courses[0])[0];
  localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify([first.slug, first.slug, "removed-problem", 10]));
  window.history.replaceState(null, "", `#course/${courses[0].slug}/${first.slug}`);
  render(<App />);
  expect(screen.getByRole("heading", { name: first.title })).toBeTruthy();
  expect(screen.getByText("✓ Lesson complete. Nicely done!")).toBeTruthy();
  expect(courseProgress(courses[0], [first.slug, first.slug]).completed).toBe(1);
});

it("records enrollment when opening a shared lesson before passing any tests", async () => {
  const first = courseLessons(courses[0])[0];
  window.history.replaceState(null, "", `#course/${courses[0].slug}/${first.slug}`);
  const user = userEvent.setup();
  render(<App />);
  expect(JSON.parse(localStorage.getItem(ENROLLED_STORAGE_KEY)!)).toEqual([courses[0].slug]);
  await user.click(screen.getByRole("button", { name: "My learning 1" }));
  expect(screen.getByRole("button", { name: "View Python Foundations" })).toBeTruthy();
  expect(localStorage.getItem(SOLVED_STORAGE_KEY)).toBeNull();
});

it("preserves another tab's enrollment and completion and reacts to storage changes", async () => {
  const user = userEvent.setup();
  render(<App />);
  // Another tab saved after this tab mounted, before its storage event arrived.
  localStorage.setItem(ENROLLED_STORAGE_KEY, JSON.stringify([courses[1].slug]));
  await user.click(screen.getByRole("button", { name: "Start learning for free" }));
  expect(new Set(JSON.parse(localStorage.getItem(ENROLLED_STORAGE_KEY)!))).toEqual(new Set([courses[0].slug, courses[1].slug]));
  const otherLesson = courseLessons(courses[1])[0];
  localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify([otherLesson.slug]));
  await user.click(screen.getByRole("button", { name: "Pass public tests" }));
  expect(new Set(JSON.parse(localStorage.getItem(SOLVED_STORAGE_KEY)!))).toEqual(new Set([otherLesson.slug, courseLessons(courses[0])[0].slug]));
  localStorage.setItem(ENROLLED_STORAGE_KEY, JSON.stringify(courses.map((course) => course.slug)));
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: ENROLLED_STORAGE_KEY })));
  expect(screen.getByRole("button", { name: "My learning 4" })).toBeTruthy();
});

it("recommends an unfinished course after finishing the only enrolled course", async () => {
  localStorage.setItem(ENROLLED_STORAGE_KEY, JSON.stringify([courses[0].slug]));
  localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(courseLessons(courses[0]).map((lesson) => lesson.slug)));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Continue learning" }));
  expect(screen.getByRole("heading", { name: courseLessons(courses[1])[0].title })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(ENROLLED_STORAGE_KEY)!)).toContain(courses[1].slug);
});

it("filters the real video library and preserves timestamped external links", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Resource library" }));
  expect(screen.getByText(`${resources.length} videos`)).toBeTruthy();
  const resource = resources.find((item) => item.start_seconds > 0)!;
  await user.type(screen.getByRole("searchbox"), resource.title);
  const links = screen.getAllByRole("link", { name: new RegExp(resource.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  expect(links.some((link) => link.getAttribute("href")?.endsWith(`t=${resource.start_seconds}s`))).toBe(true);
  await user.clear(screen.getByRole("searchbox"));
  await user.selectOptions(screen.getByRole("combobox"), "exceptions");
  const list = screen.getByRole("list");
  expect(within(list).getAllByRole("listitem").length).toBe(resources.filter((item) => item.concepts.includes("exceptions")).length);
});
