/**
 * Fixture postings, one per interesting Ghost Score shape.
 *
 * Dates are relative so the scores stay put as time passes. Hardcoded
 * timestamps would drift every posting toward "stale" and quietly break the
 * spread this fixture exists to demonstrate.
 *
 * TODO: delete once the indexer publishes jobs/ to the data repo.
 */

import type { Job } from '$lib/types';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const MOCK_JOBS: Job[] = [
  {
    // Healthy: acting on applicants drives the score to the floor.
    id: 'job_aurelia_backend',
    company_id: 'aurelia-systems',
    title: 'Senior Backend Engineer',
    salary: { min: 95000, max: 110000, currency: 'EUR', period: 'year' },
    tech_stack: ['go', 'postgres', 'kubernetes'],
    description:
      'You will own the ledger service end to end: schema, migrations, and the replay tooling ' +
      'that reconciles it nightly. We run a small on-call rotation and expect you to be in it. ' +
      'The interview is a paid take-home followed by two conversations, both with people you ' +
      'would work with directly.',
    posted_at: daysAgo(12),
    status: 'open',
    metrics: { applications: 64, views: 1840, interviews_scheduled: 9, rejections_sent: 31, reposts: 0 },
    receipt_id: 'rcp_aurelia_01'
  },
  {
    // Evergreen: stale with zero engagement, and reposted more than twice.
    id: 'job_northwind_platform',
    company_id: 'northwind-robotics',
    title: 'Platform Engineer',
    salary: { min: 88000, max: 100000, currency: 'EUR', period: 'year' },
    tech_stack: ['terraform', 'aws', 'python'],
    description:
      'Northwind Robotics is looking for a Platform Engineer to join our growing team. The ideal ' +
      'candidate will have strong experience with cloud infrastructure and a passion for ' +
      'automation. You will work cross-functionally with stakeholders to deliver scalable ' +
      'solutions in a fast-paced environment.',
    posted_at: daysAgo(55),
    status: 'open',
    metrics: { applications: 30, views: 540, interviews_scheduled: 0, rejections_sent: 0, reposts: 3 },
    receipt_id: 'rcp_northwind_01'
  },
  {
    // Evergreen: high volume with no interviews, partly offset by rejections
    // actually being sent.
    id: 'job_halcyon_fullstack',
    company_id: 'halcyon-retail',
    title: 'Full-Stack Developer',
    salary: { min: 62000, max: 74000, currency: 'GBP', period: 'year' },
    tech_stack: ['typescript', 'react', 'node', 'mysql'],
    description:
      'Join Halcyon Retail Group as a Full-Stack Developer working on our customer-facing ' +
      'storefront and internal merchandising tools. You will be responsible for building ' +
      'features across the stack, from database schema through to the browser.',
    posted_at: daysAgo(70),
    status: 'open',
    metrics: { applications: 140, views: 3100, interviews_scheduled: 0, rejections_sent: 12, reposts: 3 },
    receipt_id: 'rcp_halcyon_01'
  },
  {
    // Ghost: every positive rule fires at once. Open four months, three hundred
    // applicants, nobody interviewed, nobody rejected, reposted five times.
    id: 'job_vertex_swe',
    company_id: 'vertex-talent',
    title: 'Software Engineer (All Levels)',
    salary: { min: 70000, max: 85000, currency: 'USD', period: 'year' },
    tech_stack: ['javascript', 'python', 'java'],
    description:
      'We are always looking for talented Software Engineers at all levels to join our network ' +
      'of world-class clients. Submit your resume and one of our recruiters will reach out when ' +
      'a suitable opportunity becomes available. Multiple positions available across a variety ' +
      'of industries and locations.',
    posted_at: daysAgo(140),
    status: 'open',
    metrics: { applications: 312, views: 9400, interviews_scheduled: 0, rejections_sent: 0, reposts: 5 },
    receipt_id: 'rcp_vertex_01'
  },
  {
    // Redemption: reposted three times, which adds 30, but the company is
    // actually hiring, interviews and rejections pull it back to zero.
    id: 'job_meridian_data',
    company_id: 'meridian-data',
    title: 'Data Engineer',
    salary: { min: 105000, max: 125000, currency: 'USD', period: 'year' },
    tech_stack: ['rust', 'clickhouse', 'kafka'],
    description:
      'Our ingestion pipeline handles four billion events a day and the person who built it has ' +
      'moved to another team. You would inherit it, including the parts that are held together ' +
      'with cron. We will show you the postmortems during the interview.',
    posted_at: daysAgo(80),
    status: 'open',
    metrics: { applications: 120, views: 2600, interviews_scheduled: 11, rejections_sent: 64, reposts: 3 },
    receipt_id: 'rcp_meridian_01'
  }
];
