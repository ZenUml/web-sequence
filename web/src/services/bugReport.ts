// Pure builder for a prefilled GitHub "new issue" URL. No DOM, no globals — every
// input is passed in, so this is trivially unit-tested. The caller (ReportBugModal)
// supplies navigator.userAgent and the current editor DSL.

const REPO = 'https://github.com/ZenUml/web-sequence';

// Conservative cap on total URL length. GitHub returns 414 (URI Too Long) on
// oversized issue prefills; ~8 KB is the practical ceiling, so 6 KB leaves headroom.
const URL_BUDGET = 6000;

const TRUNCATION_MARKER = '\n… (truncated — please paste the rest)';

export interface BuildIssueInput {
  description: string;
  includeDsl: boolean;
  dsl?: string;
  appVersion: string;
  userAgent: string;
  view: string;
  signedIn: boolean;
}

function firstLine(description: string, max = 80): string {
  const line = description
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return 'Bug report';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function environmentBlock(input: BuildIssueInput): string {
  return [
    '**Describe the bug**',
    input.description.trim(),
    '',
    '**Environment**',
    `- App version: ${input.appVersion}`,
    `- Browser: ${input.userAgent}`,
    `- View: ${input.view} · Signed in: ${input.signedIn ? 'yes' : 'no'}`,
  ].join('\n');
}

function dslBlock(dsl: string): string {
  return ['', '<details><summary>Diagram DSL</summary>', '', '```', dsl, '```', '</details>'].join('\n');
}

function composeUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body, labels: 'bug' });
  return `${REPO}/issues/new?${params.toString()}`;
}

// Largest prefix of `dsl` whose composed URL still fits URL_BUDGET, with the
// truncation marker appended when the full DSL doesn't fit. Binary search keeps
// this O(log n) and deterministic.
function fitDsl(title: string, baseBody: string, dsl: string): string {
  const withDsl = (d: string) => `${baseBody}${dslBlock(d)}`;
  if (composeUrl(title, withDsl(dsl)).length <= URL_BUDGET) return withDsl(dsl);
  let lo = 0;
  let hi = dsl.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = dsl.slice(0, mid) + TRUNCATION_MARKER;
    if (composeUrl(title, withDsl(candidate)).length <= URL_BUDGET) lo = mid;
    else hi = mid - 1;
  }
  return withDsl(dsl.slice(0, lo) + TRUNCATION_MARKER);
}

export function buildIssueUrl(input: BuildIssueInput): string {
  const title = firstLine(input.description);
  const baseBody = environmentBlock(input);
  const dsl = input.dsl?.trim() ? input.dsl : '';
  if (!input.includeDsl || !dsl) return composeUrl(title, baseBody);
  return composeUrl(title, fitDsl(title, baseBody, dsl));
}
