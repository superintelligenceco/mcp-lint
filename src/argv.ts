/**
 * Splits a command line into words the way a POSIX shell would for simple
 * cases: whitespace separates words, single quotes are literal, double quotes
 * allow backslash escapes. It does not expand variables or globs.
 */
export function splitCommandLine(line: string): string[] {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let quote: "'" | '"' | undefined;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quote === "'") {
      if (ch === "'") quote = undefined;
      else current += ch;
    } else if (quote === '"') {
      if (ch === '"') quote = undefined;
      else if (ch === "\\" && i + 1 < line.length && '"\\$`'.includes(line[i + 1] as string)) {
        current += line[++i];
      } else current += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === "\\" && i + 1 < line.length) {
      current += line[++i];
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) words.push(current);
      current = "";
      inWord = false;
    } else {
      current += ch;
      inWord = true;
    }
  }
  if (quote) throw new Error(`unterminated ${quote} quote in command line`);
  if (inWord) words.push(current);
  return words;
}
