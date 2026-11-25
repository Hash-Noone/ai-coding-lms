import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { App } from "./App";

it("renders the LMS placeholder heading", () => {
  expect(renderToStaticMarkup(<App />)).toContain("<h1>AI Coding LMS</h1>");
});
