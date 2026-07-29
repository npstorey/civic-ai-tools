#!/usr/bin/env node
// render-rulespec-interop-html.mjs — standalone HTML render of the rulespec interop POC memo.
//
// What it does:
//   Renders docs/research/rulespec-interop-poc.md (this repo, branch poc/rulespec-interop)
//   to a single fully self-contained HTML file: inline CSS (light/dark/print), no external
//   scripts, stylesheets, fonts, or images. The memo's three ```mermaid fences are replaced,
//   in order, with the committed sidecar SVGs — document order is diagram (c)
//   (contemporaneous-vs-backfill, in the front matter), then (a) and (b) in the appendix,
//   so the DIAGRAMS list below is c, a, b — inlined verbatim, so re-rendering never needs
//   mermaid tooling. Relative ../adr/ and ../architecture/ links are rewritten to public
//   github.com URLs; heading ids match GitHub's slugger so intra-doc anchors keep working.
//
// How to run (from anywhere; paths resolve from this script's location):
//   node scripts/render-rulespec-interop-html.mjs [output.html]
//
// Where output goes:
//   Default: /Users/npstorey/code/civic-ai-tools-planning/rulespec-interop-poc.html
//   (planning-repo root, the established convention for standalone HTML copies).
//   Pass a path as the first argument to write elsewhere.
//
// Dependency: `marked` (not part of this repo's dependency tree). Install it in the
// gitignored scratch dir:  cd .rulespec-clones/mdrender && npm init -y && npm install marked

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'docs', 'research', 'rulespec-interop-poc.md');
const DIAGRAMS = [
  // Document order: fence 1 is diagram (c) in "What adopting would cost them" (front matter);
  // fences 2 and 3 are diagrams (a) and (b) in the appendix.
  join(ROOT, 'docs', 'research', 'rulespec-interop-poc-diagram-c.svg'),
  join(ROOT, 'docs', 'research', 'rulespec-interop-poc-diagram-a.svg'),
  join(ROOT, 'docs', 'research', 'rulespec-interop-poc-diagram-b.svg'),
];
const OUT =
  process.argv[2] ??
  '/Users/npstorey/code/civic-ai-tools-planning/rulespec-interop-poc.html';

// `marked` lives in a gitignored scratch install, never in the repo tree. Try the normal
// resolution first (in case a caller has it on NODE_PATH), then the scratch dir; fail loudly.
let Marked;
try {
  ({ Marked } = await import('marked'));
} catch {
  try {
    const req = createRequire(join(ROOT, '.rulespec-clones', 'mdrender', 'package.json'));
    const mod = await import(pathToFileURL(req.resolve('marked')).href);
    Marked = mod.Marked ?? mod.default?.Marked;
    if (!Marked) throw new Error('marked resolved but exports no Marked class');
  } catch {
    console.error('error: cannot find the `marked` package.');
    console.error('install hint: cd .rulespec-clones/mdrender && npm init -y && npm install marked');
    process.exit(1);
  }
}

let md = readFileSync(SRC, 'utf8');

// Version label comes from the memo's own top-of-file changelog comment, so the
// provenance line can never go stale against the content.
const memoVersion = (md.match(/^<!-- (v\d+)/) || [, 'unversioned'])[1];

// Replace each ```mermaid fence (in order) with a placeholder; the sidecar SVGs are
// substituted into the rendered HTML afterwards, so marked never touches SVG markup.
let fenceIndex = 0;
md = md.replace(/```mermaid\n[\s\S]*?\n```/g, () => `\n<!--__DIAGRAM_${fenceIndex++}__-->\n`);
if (fenceIndex !== DIAGRAMS.length) {
  console.error(
    `error: expected ${DIAGRAMS.length} mermaid fences in ${SRC}, found ${fenceIndex}. ` +
      'Update the DIAGRAMS list (and add sidecar SVGs) to match.'
  );
  process.exit(1);
}

// Relative repo links are dead in a standalone file. Rewrite to public GitHub URLs.
const GH = 'https://github.com/npstorey/civic-ai-tools/blob/main/docs';
md = md
  .replace(/\]\(\.\.\/adr\//g, `](${GH}/adr/`)
  .replace(/\]\(\.\.\/architecture\//g, `](${GH}/architecture/`);

// Match GitHub's slugger: strip non-word chars, then map EACH remaining space to a
// hyphen without collapsing runs — so "establishes — and" yields "establishes--and".
const slug = (s) =>
  s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-');

const marked = new Marked({ gfm: true, breaks: false });
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const raw = text.replace(/<[^>]+>/g, '');
      return `<h${depth} id="${slug(raw)}">${text}</h${depth}>\n`;
    },
    table(token) {
      // Wrap every table so wide ones scroll inside their own box.
      let out = '<div class="tw"><table>\n<thead>\n<tr>\n';
      for (const cell of token.header) {
        out += `<th>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      out += '</tr>\n</thead>\n<tbody>\n';
      for (const row of token.rows) {
        out += '<tr>\n';
        for (const cell of row) {
          out += `<td>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        out += '</tr>\n';
      }
      return out + '</tbody>\n</table></div>\n';
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${title ? ` title="${title}"` : ''}${ext}>${text}</a>`;
    },
  },
});

let body = marked.parse(md);

// Inline the sidecar SVGs in place of the mermaid fences.
DIAGRAMS.forEach((path, i) => {
  const svg = readFileSync(path, 'utf8').trim();
  body = body.replace(`<!--__DIAGRAM_${i}__-->`, `<figure class="diagram">\n${svg}\n</figure>`);
});

const provenance = `<!-- Standalone, fully self-contained copy (generated ${new Date().toISOString().slice(0, 10)}) of docs/research/rulespec-interop-poc.md (${memoVersion}) from branch poc/rulespec-interop in civic-ai-tools. Source of truth is the markdown on that branch; regenerate with scripts/render-rulespec-interop-html.mjs rather than hand-editing this file. The three mermaid diagrams are inlined as SVG from the committed sidecars docs/research/rulespec-interop-poc-diagram-c.svg / -a.svg / -b.svg (document order). Relative repo links were rewritten to public github.com/npstorey/civic-ai-tools URLs so they resolve for an outside reader. No external CSS, fonts, scripts, or images — opens offline in any browser and prints cleanly to PDF. -->`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rulespec Interop POC</title>
${provenance}
<style>
  :root {
    --paper:#f7f7f5; --card:#fff; --ink:#1e2426; --muted:#5b6769; --faint:#8b9698;
    --line:#e0e3e1; --rule:#cfd4d1; --accent:#0d6e62; --accent-wash:rgba(13,110,98,.07);
    --warn:#9a5518; --warn-wash:rgba(154,85,24,.07); --code-bg:#f0f2f0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper:#14181a; --card:#1a1f21; --ink:#e6eae9; --muted:#a3b0b1; --faint:#7d8a8b;
      --line:#2b3335; --rule:#39433f; --accent:#5ec8b6; --accent-wash:rgba(94,200,182,.10);
      --warn:#e0a06a; --warn-wash:rgba(224,160,106,.10); --code-bg:#111618;
    }
  }
  :root[data-theme="dark"] {
    --paper:#14181a; --card:#1a1f21; --ink:#e6eae9; --muted:#a3b0b1; --faint:#7d8a8b;
    --line:#2b3335; --rule:#39433f; --accent:#5ec8b6; --accent-wash:rgba(94,200,182,.10);
    --warn:#e0a06a; --warn-wash:rgba(224,160,106,.10); --code-bg:#111618;
  }
  :root[data-theme="light"] {
    --paper:#f7f7f5; --card:#fff; --ink:#1e2426; --muted:#5b6769; --faint:#8b9698;
    --line:#e0e3e1; --rule:#cfd4d1; --accent:#0d6e62; --accent-wash:rgba(13,110,98,.07);
    --warn:#9a5518; --warn-wash:rgba(154,85,24,.07); --code-bg:#f0f2f0;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background:var(--paper); color:var(--ink);
    font:16px/1.65 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased; overflow-x:hidden;
  }
  main {
    max-width:50rem; margin:0 auto; padding:3.5rem 1.5rem 6rem;
  }
  h1 {
    font-size:2.1rem; line-height:1.2; letter-spacing:-.02em; margin:0 0 1.25rem;
    font-weight:650;
  }
  h2 {
    font-size:1.42rem; line-height:1.3; letter-spacing:-.01em; font-weight:650;
    margin:3rem 0 1rem; padding-bottom:.4rem; border-bottom:1px solid var(--rule);
  }
  h3 { font-size:1.12rem; font-weight:650; margin:2.1rem 0 .7rem; }
  h4 { font-size:1rem; font-weight:650; margin:1.6rem 0 .5rem; color:var(--muted); }
  p, li { color:var(--ink); }
  p { margin:0 0 1rem; }
  ul, ol { margin:0 0 1rem; padding-left:1.35rem; }
  li { margin:.35rem 0; }
  li > ul, li > ol { margin:.35rem 0; }
  a { color:var(--accent); text-decoration:none; border-bottom:1px solid var(--accent-wash); }
  a:hover { border-bottom-color:var(--accent); }
  strong { font-weight:650; }
  em { font-style:italic; }
  hr { border:0; border-top:1px solid var(--rule); margin:2.75rem 0; }
  code {
    font:.87em/1.5 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    background:var(--code-bg); padding:.12em .38em; border-radius:3px;
    overflow-wrap:break-word; word-break:break-word;
  }
  pre {
    background:var(--code-bg); border:1px solid var(--line); border-radius:6px;
    padding:1rem 1.1rem; overflow-x:auto; margin:0 0 1.25rem;
  }
  pre code {
    background:none; padding:0; border-radius:0; white-space:pre;
    font-size:.795rem; line-height:1.55; word-break:normal; overflow-wrap:normal;
  }
  blockquote {
    margin:0 0 1.25rem; padding:.15rem 0 .15rem 1.1rem;
    border-left:3px solid var(--rule); color:var(--muted);
  }
  blockquote p:last-child { margin-bottom:0; }
  .tw { overflow-x:auto; margin:0 0 1.5rem; border:1px solid var(--line); border-radius:6px; background:var(--card); }
  table { border-collapse:collapse; width:100%; font-size:.9rem; }
  th, td { padding:.6rem .8rem; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
  th { font-weight:650; background:var(--accent-wash); white-space:nowrap; }
  tbody tr:last-child td { border-bottom:0; }
  td code, th code { font-size:.85em; }
  em + em { display:none; }
  main > p > em:only-child { color:var(--faint); font-size:.9rem; }
  .diagram {
    margin:0 0 1.5rem; padding:0; overflow-x:auto;
    border:1px solid var(--line); border-radius:6px; background:#fff;
  }
  .diagram svg { display:block; max-width:100%; height:auto; margin:0 auto; }
  /* Collapsible appendix blocks (raw <details> in the memo). */
  details {
    margin:0 0 1rem; border:1px solid var(--line); border-radius:6px;
    background:var(--card); padding:.15rem .95rem;
  }
  details > summary { cursor:pointer; padding:.55rem 0; }
  details > summary:hover { color:var(--accent); }
  details[open] { padding-bottom:.75rem; }
  details > :last-child { margin-bottom:0; }
  /* Side-by-side verdicts (raw <table class="verdicts"> in the memo).
     Two columns on wide viewports (breaking out of the 50rem column so both
     verdicts are legible), stacked on narrow; each pre cell scrolls on its own. */
  table.verdicts {
    table-layout:fixed; width:100%; font-size:.9rem;
    border:1px solid var(--line); border-radius:6px; background:var(--card);
  }
  table.verdicts th, table.verdicts td {
    width:50%; vertical-align:top; padding:.6rem .8rem;
    white-space:normal; border-bottom:1px solid var(--line);
  }
  table.verdicts th { font-weight:650; background:var(--accent-wash); }
  table.verdicts td { border-bottom:0; }
  table.verdicts pre { margin:0; max-width:100%; overflow-x:auto; }
  @media (min-width:900px) {
    table.verdicts {
      width:min(94vw, 80rem);
      margin-left:calc((100% - min(94vw, 80rem)) / 2);
    }
  }
  @media (max-width:899.98px) {
    table.verdicts, table.verdicts tbody, table.verdicts tr,
    table.verdicts th, table.verdicts td { display:block; width:100%; }
    table.verdicts th { border-bottom:1px solid var(--line); }
  }
  @media (max-width:640px) {
    main { padding:2.25rem 1.1rem 4rem; }
    h1 { font-size:1.7rem; }
    h2 { font-size:1.25rem; }
    pre code { font-size:.72rem; }
  }
  @media print {
    :root {
      --paper:#fff; --card:#fff; --ink:#111; --muted:#444; --faint:#666;
      --line:#ccc; --rule:#999; --accent:#0a5;  --code-bg:#f4f4f4;
    }
    body { font-size:10.5pt; }
    main { max-width:none; padding:0; }
    h2 { page-break-after:avoid; }
    pre, .tw, table { page-break-inside:avoid; }
    .diagram { page-break-inside:avoid; border-color:#ccc; }
    table.verdicts { width:100%; margin-left:0; page-break-inside:auto; }
    details { border-color:#ccc; }
    a { color:#111; border:0; }
    a[href^="http"]::after { content:" (" attr(href) ")"; font-size:.75em; color:#666; word-break:break-all; }
  }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
console.log(`wrote ${OUT}`);
console.log(`bytes: ${Buffer.byteLength(html)}`);
