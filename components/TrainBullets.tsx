// Official MTA line colors. Yellow lines use black text; the rest white.
const LINE_COLORS: Record<string, string> = {
  "1": "#EE352E", "2": "#EE352E", "3": "#EE352E",
  "4": "#00933C", "5": "#00933C", "6": "#00933C",
  "7": "#B933AD",
  A: "#0039A6", C: "#0039A6", E: "#0039A6",
  B: "#FF6319", D: "#FF6319", F: "#FF6319", M: "#FF6319",
  G: "#6CBE45",
  J: "#996633", Z: "#996633",
  L: "#A7A9AC",
  N: "#FCCC0A", Q: "#FCCC0A", R: "#FCCC0A", W: "#FCCC0A",
  S: "#808183",
};
const YELLOW_LINES = new Set(["N", "Q", "R", "W"]);
const VALID = new Set(Object.keys(LINE_COLORS));

// Matches a slash/comma group of lines (e.g. "3/4", "A/C", "J/M/Z") or a
// standalone letter line (e.g. "L"). Deliberately does NOT match a lone
// digit, so "3 min walk" won't be read as the 3 train.
const LINE_RE = /(?<![A-Za-z0-9])([1-7A-Z](?:\s?[/,]\s?[1-7A-Z])+|[A-Z])(?![A-Za-z0-9])/g;

function parse(transit: string): { lines: string[]; rest: string } {
  const lines: string[] = [];
  const seen = new Set<string>();
  let rest = transit;

  for (const m of transit.matchAll(LINE_RE)) {
    for (const tok of m[1].split(/[/,]/)) {
      const line = tok.trim().toUpperCase();
      if (VALID.has(line) && !seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
    rest = rest.replace(m[0], " ");
  }

  // Clean the leftover descriptive text (station name, walk time, etc.).
  rest = rest.replace(/\(\s*\)/g, " ").replace(/[·,]/g, " ").replace(/\s+/g, " ").trim();
  return { lines, rest };
}

function Bullet({ line }: { line: string }) {
  const bg = LINE_COLORS[line] ?? "#4b5563";
  const fg = YELLOW_LINES.has(line) ? "#000000" : "#ffffff";
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shrink-0"
      style={{ backgroundColor: bg, color: fg, fontFamily: "var(--font-sans)" }}
      aria-label={`${line} train`}
    >
      {line}
    </span>
  );
}

export function TrainBullets({ transit }: { transit: string }) {
  const { lines, rest } = parse(transit);
  if (lines.length === 0) {
    return <span>{transit}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {lines.map((l) => (
        <Bullet key={l} line={l} />
      ))}
      {rest && <span className="text-muted">{rest}</span>}
    </span>
  );
}
