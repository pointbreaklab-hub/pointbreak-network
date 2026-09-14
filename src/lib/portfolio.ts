/**
 * The canonical portfolio.
 *
 * One structure, several themes. A theme may only change how this renders,
 * never what it says, so switching theme can never alter a claim.
 *
 * Every entry carries `evidence`, because a CV is self-reported and this
 * product's whole argument is that self-reporting is not trusted. A portfolio
 * that quietly presented claims as facts would undercut the thing it sits
 * inside. Claimed is the default and is not a criticism; it is simply what a
 * line is until something corroborates it.
 */

export type ISODate = string;

/** What backs a line. `claimed` means the person typed it and nothing else. */
export type Corroboration =
  | { kind: 'claimed' }
  | { kind: 'domain_verified'; domain: string; at: ISODate }
  | { kind: 'peer_vouched'; by: string[]; weight: number }
  | { kind: 'merged_prs'; count: number; repo?: string }
  | { kind: 'commits'; count: number; language?: string };

export interface Role {
  id: string;
  title: string;
  /** Free text. A promotion is a separate Role at the same company. */
  summary?: string;
  started: string;
  ended?: string;
  /** Bullet points as written, one per line. */
  highlights: string[];
  skills: string[];
  evidence: Corroboration[];
}

export interface Company {
  id: string;
  name: string;
  /** Used for domain verification and for grouping roles. */
  domain?: string;
  location?: string;
  /**
   * Newest first. Several roles at one company is a progression, which the
   * Series theme renders as seasons.
   */
  roles: Role[];
  evidence: Corroboration[];
}

export interface Education {
  id: string;
  institution: string;
  domain?: string;
  qualification?: string;
  field?: string;
  started?: string;
  ended?: string;
  evidence: Corroboration[];
}

export interface Project {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  skills: string[];
  evidence: Corroboration[];
}

/**
 * Visibility.
 *
 * Only two of these are enforceable by a static site reading a public
 * repository, and the other two are recorded but explicitly not offered. A
 * control that implies restriction without restricting anything is worse than
 * no control, because people put real information behind it.
 */
export type Visibility = 'public' | 'hidden' | 'specific_people' | 'hiring_managers';

export const ENFORCEABLE_VISIBILITY: Visibility[] = ['public', 'hidden'];

export type ThemeId = 'series' | 'plain' | 'tinted';

export interface ThemeSettings {
  id: ThemeId;
  /** Tinted theme only. Validated for contrast before it is applied. */
  accent?: string;
}

export interface Portfolio {
  github_login: string;
  display_name?: string;
  headline?: string;
  summary?: string;
  /**
   * Contact details are deliberately optional and never populated by the
   * importer. A parsed CV carries a phone number and a home address, and
   * publishing those into a public repository would be the most harmful thing
   * this feature could do.
   */
  contact?: { email?: string; website?: string };
  companies: Company[];
  education: Education[];
  projects: Project[];
  skills: string[];
  theme: ThemeSettings;
  visibility: Visibility;
  updated_at: ISODate;
}

export function emptyPortfolio(login: string): Portfolio {
  return {
    github_login: login,
    companies: [],
    education: [],
    projects: [],
    skills: [],
    theme: { id: 'plain' },
    visibility: 'hidden',
    updated_at: new Date().toISOString()
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/** Total months across every role, used by themes for a headline figure. */
export function totalMonths(portfolio: Portfolio): number {
  let months = 0;

  for (const company of portfolio.companies) {
    for (const role of company.roles) {
      const from = Date.parse(`${role.started}-01`);
      const to = role.ended ? Date.parse(`${role.ended}-01`) : Date.now();
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
        months += Math.round((to - from) / (1000 * 60 * 60 * 24 * 30.44));
      }
    }
  }

  return months;
}

export function formatSpan(started?: string, ended?: string): string {
  const show = (value?: string) => {
    if (!value) return 'now';
    const date = new Date(`${value}-01`);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : value;
  };

  if (!started) return '';
  return `${show(started)} to ${show(ended)}`;
}

/** True when anything other than the person's own assertion backs this. */
export function isCorroborated(evidence: Corroboration[]): boolean {
  return evidence.some((item) => item.kind !== 'claimed');
}

export function describeEvidence(item: Corroboration): string {
  switch (item.kind) {
    case 'claimed':
      return 'claimed';
    case 'domain_verified':
      return `verified @${item.domain}`;
    case 'peer_vouched':
      return `vouched by ${item.by.join(', ')}`;
    case 'merged_prs':
      return `${item.count} merged PRs`;
    case 'commits':
      return `${item.count} commits${item.language ? ` in ${item.language}` : ''}`;
  }
}
