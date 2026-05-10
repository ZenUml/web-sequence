#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = __dirname;
const files = fs.readdirSync(reportsDir).filter(f => /^case-\d{2}-.+\.html$/.test(f)).sort();

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const stripTags = s => decode(s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

const cases = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(reportsDir, file), 'utf8');
  const caseNum = parseInt(file.match(/^case-(\d{2})/)[1], 10);
  const slug = file.replace(/\.html$/, '');

  const titleMatch = html.match(/<h1>Case \d+ — ([^<]+)<\/h1>/);
  const subtitleMatch = html.match(/<header>[\s\S]*?<p>([^<]+)<\/p>\s*<\/header>/);
  const captionMatch = html.match(/<div class="gif-caption">([\s\S]*?)<\/div>/);
  const gifMatch = html.match(/<img src="(ux-case-[^"]+)"/);

  // Parse the entire body between </header> and <footer>
  const bodySection = html.match(/<\/header>([\s\S]*?)<footer/);
  const gaps = [];
  if (bodySection) {
    // Match: class="gap-card high|medium|low" OR class="gap high|medium|low" OR class="gap-card severity-high|medium|low"
    const pieces = bodySection[1].split(/<div class="gap(?:-card)? (?:severity-)?(high|medium|low)">/);
    // pieces: [pre, sev1, body1, sev2, body2, ...]
    for (let i = 1; i < pieces.length; i += 2) {
      const sev = pieces[i];
      const body = pieces[i + 1];
      const idMatch = body.match(/<span class="gap-id">([^<]+)<\/span>/);
      const titleMatchG = body.match(/<span class="gap-title">([\s\S]*?)<\/span>/) || body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      const paragraphs = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x => stripTags(x[1])).filter(Boolean);
      const evidenceMatch = body.match(/<div class="evidence">([\s\S]*?)<\/div>/);
      const fixMatch = body.match(/<div class="fix">([\s\S]*?)<\/div>/);
      const principles = [...body.matchAll(/<span class="principle">([^<]+)<\/span>/g)].map(x => decode(x[1].trim()));

      const synthId = `GAP-${String(caseNum).padStart(2,'0')}-${String(gaps.length + 1).padStart(3,'0')}`;
      gaps.push({
        id: idMatch ? idMatch[1].trim() : synthId,
        severity: sev,
        title: titleMatchG ? stripTags(titleMatchG[1]) : null,
        paragraphs,
        evidence: evidenceMatch ? decode(evidenceMatch[1].trim()) : null,
        fix: fixMatch ? stripTags(fixMatch[1]) : null,
        principles,
      });
    }
  }

  cases.push({
    number: caseNum,
    slug,
    title: titleMatch ? decode(titleMatch[1]) : null,
    subtitle: subtitleMatch ? stripTags(subtitleMatch[1]) : null,
    caption: captionMatch ? stripTags(captionMatch[1]) : null,
    gif: gifMatch ? gifMatch[1] : null,
    gaps,
  });
}

const totals = { high: 0, medium: 0, low: 0 };
for (const c of cases) for (const g of c.gaps) totals[g.severity]++;

const output = { generated: new Date().toISOString(), totals, cases };
fs.writeFileSync(path.join(reportsDir, 'gaps.json'), JSON.stringify(output, null, 2));
console.log(`Parsed ${cases.length} cases, ${cases.reduce((s,c) => s+c.gaps.length, 0)} gaps`);
console.log(`Severities: ${totals.high} high / ${totals.medium} medium / ${totals.low} low`);
