import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const FILES = ['editor.css'];
const FIX = process.argv.includes('--fix');

function comments(text) {
  const out = [];
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) break;
      out.push([i, end + 2]);
      i = end + 1;
    }
    i++;
  }
  return out;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function cut(text, start, end) {
  let s = start;
  while (s > 0 && (text[s - 1] === ' ' || text[s - 1] === '\t')) s--;
  const ownsStart = s === 0 || text[s - 1] === '\n';
  let e = end;
  while (e < text.length && (text[e] === ' ' || text[e] === '\t')) e++;
  const ownsEnd = e >= text.length || text[e] === '\n';
  if (ownsStart && ownsEnd) return [s, Math.min(text.length, e + 1)];
  if (ownsEnd) return [s, end];
  return [start, end];
}

let failures = 0;

for (const rel of FILES) {
  const file = join(root, rel);
  let text = readFileSync(file, 'utf8');
  const found = comments(text);
  if (!found.length) continue;

  if (FIX) {
    for (const [start, end] of found.reverse()) {
      const [s, e] = cut(text, start, end);
      text = text.slice(0, s) + text.slice(e);
    }
    writeFileSync(file, text);
    continue;
  }

  for (const [start, end] of found) {
    const first = text.slice(start, end).split('\n')[0].trim();
    console.error(`  ${rel}:${lineOf(text, start)}  ${first.slice(0, 70)}`);
    failures++;
  }
}

if (failures) {
  console.error(
    `\nCSS comments are not allowed. Put the WHY in .claude/rules/ or CLAUDE.md.\n${failures} comment(s).`,
  );
  process.exitCode = 1;
} else if (!FIX) {
  console.log(`no-comments: ${FILES.length} CSS file(s) clean.`);
}
