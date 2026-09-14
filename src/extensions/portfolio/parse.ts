/**
 * Turns CV text into a draft portfolio.
 *
 * This is a head start, not an import. CV layouts are arbitrary, so any parser
 * is wrong some of the time, and quietly mangling someone's employment dates is
 * worse than not parsing at all. Everything it produces goes into an editor for
 * correction before it can be saved, and nothing here is ever published
 * directly.
 *
 * Contact details are found only so they can be stripped. A parsed CV contains
 * a phone number and often a home address, and publishing those into a public
 * repository would be the most harmful thing this feature could do.
 */

import {
  newId,
  type Company,
  type Education,
  type Portfolio,
  type Role
} from '$lib/portfolio';

const SECTION_PATTERNS: Array<{ section: Section; pattern: RegExp }> = [
  { section: 'experience', pattern: /^(work\s+)?(experience|employment|career|professional)\b/i },
  { section: 'education', pattern: /^(education|academic|qualifications)\b/i },
  { section: 'skills', pattern: /^(skills|technical skills|technologies|stack)\b/i },
  { section: 'projects', pattern: /^(projects|open source|portfolio|selected work)\b/i },
  { section: 'summary', pattern: /^(summary|profile|about|objective)\b/i }
];

type Section = 'experience' | 'education' | 'skills' | 'projects' | 'summary' | 'header';

/** Removed before anything is stored, never merely hidden. */
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g;

/**
 * Loose candidates, then filtered. A single regex tight enough to exclude
 * "2012 - 2016" and loose enough to catch "+49 151 234 5678" is unreadable,
 * and getting it wrong eats the date ranges the parser depends on.
 */
const PHONE_CANDIDATE = /\+?\d[\d\s().\-/]{6,}\d/g;
const YEAR_RANGE = /^\s*\d{4}\s*[-–—/]\s*\d{4}\s*$/;

function isPhone(candidate: string): boolean {
  if (YEAR_RANGE.test(candidate)) return false;

  const digits = candidate.replace(/\D/g, '');
  // Shortest real numbers are around nine digits including an area code.
  if (digits.length < 9 || digits.length > 15) return false;

  // A bare four digit year repeated is a date, not a number.
  return !/^\d{4}\d{4}$/.test(digits);
}

function stripPhones(text: string): { text: string; count: number } {
  let count = 0;
  const stripped = text.replace(PHONE_CANDIDATE, (match) => {
    if (!isPhone(match)) return match;
    count++;
    return ' ';
  });
  return { text: stripped, count };
}

const MONTHS =
  '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

/** "Mar 2021 - Present", "03/2021 to 2023", "2021-2023". */
const DATE_RANGE = new RegExp(
  `(${MONTHS}\\.?\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4})` +
    `\\s*(?:-|–|—|to|until)\\s*` +
    `(present|current|now|${MONTHS}\\.?\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4})`,
  'i'
);

function toMonth(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  if (/^(present|current|now)$/.test(value)) return undefined;

  const named = value.match(new RegExp(`^${MONTHS}\\.?\\s+(\\d{4})$`));
  if (named) return `${named[2]}-${String(MONTH_INDEX[named[1].slice(0, 3)]).padStart(2, '0')}`;

  const numeric = value.match(/^(\d{1,2})[/.](\d{4})$/);
  if (numeric) return `${numeric[2]}-${numeric[1].padStart(2, '0')}`;

  const year = value.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01`;

  return undefined;
}

function sectionFor(line: string): Section | null {
  const trimmed = line.trim();
  // Headings are short. A sentence beginning with "Experience" is not one.
  if (trimmed.length > 40) return null;

  for (const { section, pattern } of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return section;
  }
  return null;
}

const BULLET = /^\s*[-•*·▪‣]\s+/;

export interface ParseResult {
  portfolio: Portfolio;
  /** What was found and removed, shown so the user knows it was there. */
  redacted: { emails: number; phones: number };
  /** Lines the parser could not place, offered for manual sorting. */
  unplaced: string[];
}

export function parseCv(text: string, login: string): ParseResult {
  const emails = text.match(EMAIL)?.length ?? 0;
  const withoutPhones = stripPhones(text);
  const phones = withoutPhones.count;

  const clean = withoutPhones.text.replace(EMAIL, ' ');
  const lines = clean.split(/\r?\n/).map((line) => line.replace(/\s+$/, ''));

  const portfolio: Portfolio = {
    github_login: login,
    companies: [],
    education: [],
    projects: [],
    skills: [],
    theme: { id: 'plain' },
    visibility: 'hidden',
    updated_at: new Date().toISOString()
  };

  let section: Section = 'header';
  let company: Company | null = null;
  let role: Role | null = null;
  const summary: string[] = [];
  const unplaced: string[] = [];

  const closeRole = () => {
    if (company && role) company.roles.push(role);
    role = null;
  };
  const closeCompany = () => {
    closeRole();
    if (company && company.roles.length > 0) portfolio.companies.push(company);
    company = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = sectionFor(line);
    if (heading) {
      closeCompany();
      section = heading;
      continue;
    }

    if (section === 'header') {
      if (!portfolio.display_name) portfolio.display_name = line;
      else if (!portfolio.headline) portfolio.headline = line;
      continue;
    }

    if (section === 'summary') {
      summary.push(line);
      continue;
    }

    if (section === 'skills') {
      for (const skill of line.split(/[,;|•·]/)) {
        const value = skill.trim().replace(BULLET, '');
        if (value && value.length < 30) portfolio.skills.push(value);
      }
      continue;
    }

    if (section === 'projects') {
      if (BULLET.test(raw)) {
        const last = portfolio.projects.at(-1);
        if (last) last.summary = `${last.summary ?? ''} ${line.replace(BULLET, '')}`.trim();
        continue;
      }
      portfolio.projects.push({
        id: newId('proj'),
        name: line,
        skills: [],
        evidence: [{ kind: 'claimed' }]
      });
      continue;
    }

    if (section === 'education') {
      const dates = line.match(DATE_RANGE);
      portfolio.education.push({
        id: newId('edu'),
        institution: line.replace(DATE_RANGE, '').replace(/[,\-–—]\s*$/, '').trim() || line,
        started: dates ? toMonth(dates[1]) : undefined,
        ended: dates ? toMonth(dates[3] ?? dates[2]) : undefined,
        evidence: [{ kind: 'claimed' }]
      });
      continue;
    }

    // experience
    if (BULLET.test(raw)) {
      if (role) role.highlights.push(line.replace(BULLET, ''));
      else unplaced.push(line);
      continue;
    }

    const dates = line.match(DATE_RANGE);
    if (dates) {
      // A dated line starts a role. The text around the dates is its title.
      const title = line.replace(DATE_RANGE, '').replace(/[,\-–—|]\s*$/, '').trim();
      closeRole();

      if (!company) {
        company = { id: newId('co'), name: title || 'Unknown', roles: [], evidence: [{ kind: 'claimed' }] };
      }

      role = {
        id: newId('role'),
        title: title || 'Role',
        started: toMonth(dates[1]) ?? '',
        ended: toMonth(dates[3] ?? dates[2]),
        highlights: [],
        skills: [],
        evidence: [{ kind: 'claimed' }]
      };
      continue;
    }

    // An undated, unbulleted line in the experience section is a company name.
    closeCompany();
    company = { id: newId('co'), name: line, roles: [], evidence: [{ kind: 'claimed' }] };
  }

  closeCompany();

  if (summary.length) portfolio.summary = summary.join(' ');
  portfolio.skills = [...new Set(portfolio.skills)];

  return { portfolio, redacted: { emails, phones }, unplaced };
}

/**
 * Extracts text from an uploaded file.
 *
 * PDF support loads pdfjs on demand so the parser costs nothing for people who
 * paste text, which is the more reliable route anyway.
 */
export async function extractText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file);
  }

  if (/\.(docx?)$/i.test(file.name)) {
    throw new Error(
      'Word files are not supported. Export the CV as a PDF, or copy the text and paste it below.'
    );
  }

  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  let pdfjs: typeof import('pdfjs-dist');
  try {
    pdfjs = await import('pdfjs-dist');
  } catch {
    throw new Error('Could not load the PDF reader. Paste the text of the CV instead.');
  }

  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();

    // PDFs have no line breaks, only positioned text runs, so lines are
    // reconstructed from the y coordinate of each item.
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);

      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = '';
      }
      line += item.str + (item.hasEOL ? '\n' : ' ');
      lastY = y;
    }

    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}
