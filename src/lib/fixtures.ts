/**
 * Temporary fixture data.
 *
 * Jobs and events have to be one consistent dataset now that every metric is
 * derived from the ledger, so they live together here rather than inside two
 * extensions that would drift apart. Both extensions import from here, which is
 * a deliberate exception to the no-cross-extension rule: in the real system
 * both read the same `jobs/` and `events/` from the data repo, and this stands
 * in for that shared source.
 *
 * TODO: delete once pointbreaklab-hub/pointbreak-data exists.
 */

import type { Job, LedgerEvent } from './types';

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Refs the fixture treats as belonging to the signed-in user. */
export const MY_REFS = [
  'app_00000000000000000000000000000001',
  'app_00000000000000000000000000000002',
  'app_00000000000000000000000000000003',
  'app_00000000000000000000000000000004',
  'app_00000000000000000000000000000005'
];

const VERTEX_HASH = 'sha256:8c1de0e1f4a2b7c9d3e5f6a7b8c9d0e1';

export const MOCK_JOBS: Job[] = [
  {
    // Posted here, pays the fee, discloses salary, and actually interviews.
    id: 'job_aurelia_backend',
    company_id: 'aurelia-systems',
    title: 'Senior Backend Engineer',
    source: 'pointbreak',
    salary: { min: 95000, max: 110000, currency: 'EUR', period: 'year' },
    salary_disclosed: true,
    tech_stack: ['go', 'postgres', 'kubernetes'],
    description: 'You will own the ledger service end to end: schema, migrations, replay tooling.',
    description_hash: 'sha256:1a2b3c4d5e6f708192a3b4c5d6e7f801',
    posted_at: ago(12),
    first_seen_at: ago(12),
    status: 'open',
    receipt_id: 'rcp_aurelia_01'
  },
  {
    // Logged off LinkedIn by a candidate. The company has never heard of us.
    id: 'job_northwind_platform',
    company_id: 'northwind-robotics',
    title: 'Platform Engineer',
    source: 'external',
    source_url: 'https://linkedin.com/jobs/view/3947120114',
    source_hash: 'sha256:c4f1a09b7e2d63518a4c9f0b2e7d1a63',
    salary_disclosed: false,
    tech_stack: ['terraform', 'aws', 'python'],
    posted_at: ago(55),
    first_seen_at: ago(55),
    status: 'open'
  },
  {
    id: 'job_halcyon_fullstack',
    company_id: 'halcyon-retail',
    title: 'Full-Stack Developer',
    source: 'external',
    source_url: 'https://boards.greenhouse.io/halcyon/jobs/4102887',
    source_hash: 'sha256:772be3c19d0a4f6581b2c3d4e5f60718',
    salary: { min: 62000, max: 74000, currency: 'GBP', period: 'year' },
    salary_disclosed: true,
    tech_stack: ['typescript', 'react', 'node', 'mysql'],
    posted_at: ago(70),
    first_seen_at: ago(70),
    status: 'open'
  },
  {
    // The worst case: open four months, reposted, and the recruiter logged
    // rejections that four candidates say they never received.
    id: 'job_vertex_swe',
    company_id: 'vertex-talent',
    title: 'Software Engineer (All Levels)',
    source: 'external',
    source_url: 'https://linkedin.com/jobs/view/3881204551',
    source_hash: 'sha256:aa11bb22cc33dd44ee55ff6677889900',
    salary_disclosed: false,
    tech_stack: ['javascript', 'python', 'java'],
    description: 'We are always looking for talented Software Engineers at all levels.',
    description_hash: VERTEX_HASH,
    posted_at: ago(140),
    first_seen_at: ago(140),
    status: 'open'
  },
  {
    // Reposted three times, but genuinely hiring, so the score comes back down.
    id: 'job_meridian_data',
    company_id: 'meridian-data',
    title: 'Data Engineer',
    source: 'pointbreak',
    salary: { min: 105000, max: 125000, currency: 'USD', period: 'year' },
    salary_disclosed: true,
    tech_stack: ['rust', 'clickhouse', 'kafka'],
    description: 'Our ingestion pipeline handles four billion events a day.',
    description_hash: 'sha256:5f4e3d2c1b0a99887766554433221100',
    posted_at: ago(80),
    first_seen_at: ago(80),
    status: 'open',
    receipt_id: 'rcp_meridian_01'
  },

  // Vertex's earlier identical postings. Closed, so they never reach the feed,
  // but they are what makes reposts = 3 rather than a number Vertex types in.
  ...[210, 260, 310].map((days, i) => ({
    id: `job_vertex_swe_prior_${i + 1}`,
    company_id: 'vertex-talent',
    title: 'Software Engineer (All Levels)',
    source: 'external' as const,
    salary_disclosed: false,
    tech_stack: ['javascript', 'python', 'java'],
    description: 'We are always looking for talented Software Engineers at all levels.',
    description_hash: VERTEX_HASH,
    posted_at: ago(days),
    first_seen_at: ago(days),
    status: 'closed' as const,
    closed_at: ago(days - 40),
    close_reason: 'cancelled' as const
  }))
];

/* ---------- Ledger ---------- */

let seq = 0;
const nextId = () => `ev_${String(++seq).padStart(4, '0')}`;

function event(
  job_id: string,
  application_ref: string,
  action: LedgerEvent['action'],
  days: number,
  actor: LedgerEvent['actor'],
  ref_event?: string
): LedgerEvent {
  return { id: nextId(), job_id, application_ref, action, at: ago(days), actor, ref_event };
}

/** Extra applicants beyond the signed-in user, all pseudonymous. */
function others(job_id: string, count: number, offset: number) {
  return Array.from({ length: count }, (_, i) =>
    event(job_id, `app_${String(offset + i).padStart(32, '0')}`, 'application_submitted', 30 + i, 'candidate')
  );
}

function buildLedger(): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const [mineAurelia, mineNorthwind, mineHalcyon, mineVertex, mineMeridian] = MY_REFS;

  // Aurelia: responsive. Claims exist and candidates confirmed them.
  events.push(event('job_aurelia_backend', mineAurelia, 'application_submitted', 12, 'candidate'));
  const viewed = event('job_aurelia_backend', mineAurelia, 'resume_viewed', 11, 'company');
  const scheduled = event('job_aurelia_backend', mineAurelia, 'interview_scheduled', 5, 'company');
  events.push(viewed, scheduled);
  events.push(event('job_aurelia_backend', mineAurelia, 'claim_confirmed', 10, 'candidate', viewed.id));
  events.push(event('job_aurelia_backend', mineAurelia, 'claim_confirmed', 4, 'candidate', scheduled.id));
  events.push(...others('job_aurelia_backend', 7, 100));
  // Two more interviews and five rejections, reported by the candidates themselves.
  for (let i = 0; i < 2; i++) {
    events.push(event('job_aurelia_backend', `app_${String(100 + i).padStart(32, '0')}`, 'interview_held', 6, 'candidate'));
  }
  for (let i = 2; i < 7; i++) {
    events.push(event('job_aurelia_backend', `app_${String(100 + i).padStart(32, '0')}`, 'rejection_received', 8, 'candidate'));
  }

  // Northwind: the recruiter says it opened the application, and nobody has
  // confirmed that. The claim earns no credit and, critically, does not reset
  // the silence clock, so the row is still heading for a black hole.
  events.push(event('job_northwind_platform', mineNorthwind, 'application_submitted', 20, 'candidate'));
  events.push(event('job_northwind_platform', mineNorthwind, 'resume_viewed', 16, 'company'));
  events.push(...others('job_northwind_platform', 5, 200));

  // Halcyon: silent at larger scale.
  events.push(event('job_halcyon_fullstack', mineHalcyon, 'application_submitted', 60, 'candidate'));
  events.push(...others('job_halcyon_fullstack', 11, 300));

  // Vertex: silent, reposted, and caught inflating. The recruiter logged five
  // rejections; four of the candidates say they never arrived.
  events.push(event('job_vertex_swe', mineVertex, 'application_submitted', 100, 'candidate'));
  events.push(...others('job_vertex_swe', 23, 400));
  for (let i = 0; i < 5; i++) {
    const ref = `app_${String(400 + i).padStart(32, '0')}`;
    const claim = event('job_vertex_swe', ref, 'rejection_sent', 40, 'company');
    events.push(claim);
    if (i < 4) events.push(event('job_vertex_swe', ref, 'claim_disputed', 38, 'candidate', claim.id));
  }

  // Meridian: reposted three times but genuinely hiring.
  events.push(event('job_meridian_data', mineMeridian, 'application_submitted', 40, 'candidate'));
  events.push(event('job_meridian_data', mineMeridian, 'rejection_received', 35, 'candidate'));
  events.push(...others('job_meridian_data', 14, 500));
  for (let i = 0; i < 4; i++) {
    events.push(event('job_meridian_data', `app_${String(500 + i).padStart(32, '0')}`, 'interview_held', 20, 'candidate'));
  }
  for (let i = 4; i < 12; i++) {
    events.push(event('job_meridian_data', `app_${String(500 + i).padStart(32, '0')}`, 'rejection_received', 25, 'candidate'));
  }

  return events;
}

export const MOCK_EVENTS: LedgerEvent[] = buildLedger();

export const MOCK_TITLES: Record<string, string> = Object.fromEntries(
  MOCK_JOBS.map((j) => [j.id, j.title])
);
