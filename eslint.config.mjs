const ALLOWED = /^\s*(eslint-disable|eslint-enable|translators:)/;

const NO_COMMENTS =
  'Comments are not allowed. Put the WHY in .claude/rules/ or CLAUDE.md, not next to the code.';

function cutRange(text, start, end) {
  let s = start;
  while (s > 0 && (text[s - 1] === ' ' || text[s - 1] === '\t')) s--;
  const ownsLineStart = s === 0 || text[s - 1] === '\n';
  let e = end;
  while (e < text.length && (text[e] === ' ' || text[e] === '\t')) e++;
  const ownsLineEnd = e >= text.length || text[e] === '\n';
  if (ownsLineStart && ownsLineEnd) return [s, Math.min(text.length, e + 1)];
  if (ownsLineEnd) return [s, end];
  return [start, end];
}

const local = {
  rules: {
    'no-comments': {
      meta: { type: 'problem', fixable: 'whitespace', schema: [] },
      create(ctx) {
        const sc = ctx.sourceCode;
        return {
          Program() {
            for (const c of sc.getAllComments()) {
              if (c.type === 'Shebang') continue;
              if (ALLOWED.test(c.value)) continue;
              ctx.report({
                loc: c.loc,
                message: NO_COMMENTS,
                fix: (fixer) =>
                  fixer.removeRange(cutRange(sc.text, c.range[0], c.range[1])),
              });
            }
          },
        };
      },
    },
  },
};

export default [
  { ignores: ['build/**', 'node_modules/**', '.wp-env/**/node_modules/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    plugins: { local },
    rules: { 'local/no-comments': 'error' },
  },
];
