#!/usr/bin/env tsx
/**
 * Worked scenario for company-level scoring.
 *
 *   npm run scenario:company
 *
 * Four companies that must score differently, including one with too little
 * data to score at all and one that logged actions its candidates dispute.
 */

import { deriveCompanyMetrics, scoreCompany } from '../src/core/math-engine/company-score';
import { COMPANY_BAND_LABELS } from '../src/core/math-engine/company-score';
import type { Job, LedgerEvent } from '../src/lib/types';

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
let seq = 0;
const id = () => `ev_${++seq}`;

function job(company: string, n: number, ageDays: number): Job {
  return {
    id: `${company}_job_${n}`,
    company_id: company,
    title: `Role ${n}`,
    source: 'external',
    salary_disclosed: false,
    tech_stack: [],
    posted_at: ago(ageDays),
    first_seen_at: ago(ageDays),
    status: 'open'
  };
}

const jobs: Job[] = [];
const events: LedgerEvent[] = [];

function applicant(company: string, jobN: number, ref: string, submittedDaysAgo: number) {
  events.push({
    id: id(), job_id: `${company}_job_${jobN}`, application_ref: ref,
    action: 'application_submitted', at: ago(submittedDaysAgo), actor: 'candidate'
  });
}

function companyResponds(company: string, jobN: number, ref: string, daysAgo: number, confirmed: boolean) {
  const claim: LedgerEvent = {
    id: id(), job_id: `${company}_job_${jobN}`, application_ref: ref,
    action: 'rejection_sent', at: ago(daysAgo), actor: 'company'
  };
  events.push(claim);
  events.push({
    id: id(), job_id: `${company}_job_${jobN}`, application_ref: ref,
    action: confirmed ? 'claim_confirmed' : 'claim_disputed',
    at: ago(daysAgo - 1), actor: 'candidate', ref_event: claim.id
  });
}

const ref = (c: string, i: number) => `app_${c.slice(0, 4)}${String(i).padStart(28, '0')}`;

// Responsive: answers nearly everyone, and quickly.
jobs.push(job('helios', 1, 20));
for (let i = 0; i < 8; i++) {
  applicant('helios', 1, ref('helios', i), 20);
  if (i < 7) companyResponds('helios', 1, ref('helios', i), 17, true);
}

// Black hole: nobody hears anything, across several long-open postings.
for (let n = 1; n <= 4; n++) jobs.push(job('vertex', n, 120));
for (let i = 0; i < 10; i++) applicant('vertex', (i % 4) + 1, ref('vertex', i), 90);

// Too little data to say anything.
jobs.push(job('tiny', 1, 30));
for (let i = 0; i < 2; i++) applicant('tiny', 1, ref('tiny', i), 30);

// Logs rejections that candidates say never arrived.
jobs.push(job('claimco', 1, 40));
for (let i = 0; i < 6; i++) {
  applicant('claimco', 1, ref('claimco', i), 40);
  if (i < 5) companyResponds('claimco', 1, ref('claimco', i), 30, false);
}

const pad = (s: string, n: number) => String(s).padEnd(n);
console.log('\n' + pad('company', 10), pad('score', 7), pad('band', 14), pad('sample', 7), 'response rate');

for (const company of ['helios', 'vertex', 'tiny', 'claimco']) {
  const metrics = deriveCompanyMetrics(company, jobs, events);
  const result = scoreCompany(metrics);
  const band = result.measured ? COMPANY_BAND_LABELS[result.band].label : 'not measured';

  console.log(
    pad(company, 10),
    pad(result.measured ? String(result.score) : '-', 7),
    pad(band, 14),
    pad(String(result.sample), 7),
    `${Math.round(metrics.response_rate * 100)}%` +
      (metrics.median_days_to_response !== null
        ? `, median ${Math.round(metrics.median_days_to_response)}d`
        : ', never')
  );

  for (const rule of result.breakdown.filter((r) => r.applied)) {
    console.log(`           ${rule.points > 0 ? '+' : ''}${rule.points}  ${rule.label}`);
  }
}
