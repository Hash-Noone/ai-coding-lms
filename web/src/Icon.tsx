const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  book: "M3 4h6a4 4 0 0 1 3 1.5A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.5A4 4 0 0 0 9 19H3z M12 6v14",
  chart: "M4 3v17h17 M9 15v-4 M14 15V7 M19 15v-7",
  play: "m9 5 11 7-11 7Z",
  arrow: "M4 12h15 m-6-6 6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14 m5-2 5 5",
  check: "m5 12 4 4L19 6",
  code: "m8 5-7 7 7 7 m8-14 7 7-7 7 M14 3l-4 18",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2",
  user: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7A5 5 0 1 1 7 7a5 5 0 0 1 10 0",
  chevron: "m9 5 7 7-7 7",
  leaf: "M20 3c-9-1-16 4-16 10a6 6 0 0 0 6 6c6 0 11-7 10-16Z M3 22 15 10",
} as const;
export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
