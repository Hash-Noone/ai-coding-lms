import { problems } from "virtual:problem-bank";

export const courses = [
  { slug: "python-foundations", title: "Python Foundations", subtitle: "Your first steps, a world of possibilities.", description: "Build a solid foundation in Python. Work with types, expressions, and functions, then turn small ideas into working programs.", level: "Beginner", theme: "mint", symbol: "Py", concepts: ["variables", "operators", "types", "functions"], outcomes: ["Work confidently with Python values and types", "Write expressions that solve everyday problems", "Break a solution into reusable functions"] },
  { slug: "thinking-in-python", title: "Thinking in Python", subtitle: "Make decisions. Find patterns. Solve problems.", description: "Teach your programs to make decisions and repeat useful work. Practice conditionals and loops with hands-on challenges.", level: "Beginner", theme: "peach", symbol: "ƒ", concepts: ["conditionals", "loops"], outcomes: ["Choose the right conditional for a problem", "Build loops without off-by-one errors", "Read test results and improve your code"] },
  { slug: "data-and-collections", title: "Data & Collections", subtitle: "Bring structure to your next big idea.", description: "Go beyond single values. Explore strings, lists, dictionaries, and sets, and learn how to organize and transform real data.", level: "Intermediate", theme: "lilac", symbol: "[ ]", concepts: ["strings", "arrays", "hashing", "indexing"], outcomes: ["Transform strings and navigate sequences", "Choose between lists, sets, and dictionaries", "Solve common collection-based challenges"] },
  { slug: "problem-solving", title: "Deeper Problem Solving", subtitle: "Build a more resilient way of thinking.", description: "Take on recursive problems and handle the unexpected. Build dependable solutions one test at a time.", level: "Intermediate", theme: "sky", symbol: "∞", concepts: ["recursion", "exceptions"], outcomes: ["Recognize recursive patterns and base cases", "Handle invalid input and exceptions", "Test edge cases for more reliable solutions"] },
] as const;

export type Course = (typeof courses)[number];

// A problem belongs to one course, based on its primary concept. Secondary
// concepts still appear on the lesson and in the resource library.
export function courseLessons(course: Course) {
  const orderedConcepts = course.concepts as readonly string[];
  return problems.filter((problem) => orderedConcepts.includes(problem.concepts[0]))
    .sort((a, b) => orderedConcepts.indexOf(a.concepts[0]) - orderedConcepts.indexOf(b.concepts[0]));
}

export function courseProgress(course: Course, solved: readonly string[]) {
  const lessons = courseLessons(course);
  const completed = lessons.filter((lesson) => solved.includes(lesson.slug)).length;
  return { completed, total: lessons.length, percent: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
}

export function nextLesson(course: Course, solved: readonly string[]) {
  const lessons = courseLessons(course);
  return lessons.find((lesson) => !solved.includes(lesson.slug)) ?? lessons[0];
}
