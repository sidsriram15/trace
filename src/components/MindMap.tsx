type Section = { heading: string; bullets: string[] };

/** Groups markdown ("## " headings, "- " bullets) into heading/bullet sections. */
function parseSections(markdown: string): Section[] {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = { heading: line.slice(3), bullets: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: "", bullets: [] };
      sections.push(current);
    }
    current.bullets.push(
      line.startsWith("- ") ? line.slice(2) : line.replace(/^#+\s*/, ""),
    );
  }

  return sections;
}

/**
 * Renders class notes as a branching tree: each topic hangs off a shared
 * spine, with its points branching off the topic. The structure is carried
 * by real headings and lists rather than by color or indentation alone, so
 * it reads the same to a screen reader as it looks on screen — a student
 * revisiting a class can jump between topics instead of hearing one long
 * wall of text.
 */
export function MindMap({ markdown }: { markdown: string }) {
  const sections = parseSections(markdown);
  if (sections.length === 0) return null;

  return (
    <div aria-label="Class notes, organized by topic">
      {sections.map((section, i) => (
        <div
          key={i}
          className="relative border-l-2 border-line py-7 pl-9 first:pt-0 last:pb-0 sm:pl-10"
        >
          <span
            aria-hidden="true"
            className="absolute top-9 -left-[7px] h-3 w-3 bg-foreground"
          />
          {section.heading && (
            <h3 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {section.heading}
            </h3>
          )}
          {section.bullets.length > 0 && (
            <ul className={section.heading ? "mt-5 space-y-4" : "space-y-4"}>
              {section.bullets.map((bullet, j) => (
                <li
                  key={j}
                  className="relative pl-7 text-xl leading-9 sm:text-2xl"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-4 left-0 h-px w-5 bg-line-soft"
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
