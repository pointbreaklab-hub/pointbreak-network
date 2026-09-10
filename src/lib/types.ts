/**
 * Shapes for everything stored in Git.
 *
 * snake_case throughout, matching the schema reference in the master plan —
 * these are wire formats read straight out of JSON files, not internal models,
 * so they keep the on-disk casing rather than being converted at the boundary.
 */

export type ISODate = string;

/* ---------- Profile (user.json) ---------- */

export interface VerifiedSkill {
  skill: string;
  /** Commit count is the evidence. Claimed proficiency is not stored. */
  commits: number;
}

export interface ShipLog {
  repo: string;
  pr: number;
  merged_at: ISODate;
  title?: string;
  url?: string;
}

export interface UserProfile {
  github_login: string;
  verified_skills: VerifiedSkill[];
  ship_logs: ShipLog[];
  display_name?: string;
  updated_at?: ISODate;
}

/* ---------- Jobs (job.json) ---------- */

/**
 * Exact salary is mandatory. `min`/`max` exist for roles with a genuine band,
 * but a wide band is rejected at submit — see `isExactSalary()` in utils.
 */
export interface Salary {
  min: number;
  max: number;
  currency: string;
  period: 'year' | 'month' | 'day' | 'hour';
}

/** The action metrics a Ghost Score is computed from. */
export interface JobMetrics {
  applications: number;
  views: number;
  interviews_scheduled: number;
  rejections_sent: number;
  /** Count of prior near-identical postings by the same company. */
  reposts: number;
}

export type JobStatus = 'open' | 'closed';
export type CloseReason = 'external_hire' | 'internal_hire' | 'cancelled';

export interface Job {
  id: string;
  company_id: string;
  title: string;
  salary: Salary;
  tech_stack: string[];
  description: string;
  posted_at: ISODate;
  status: JobStatus;
  closed_at?: ISODate;
  close_reason?: CloseReason;
  metrics: JobMetrics;
  receipt_id?: string;
}

/* ---------- Applications (event log) ---------- */

export type ApplicationStatus = 'submitted' | 'viewed' | 'interviewing' | 'rejected';

export interface Application {
  job_id: string;
  github_login: string;
  status: ApplicationStatus;
  submitted_at: ISODate;
  /** Last time the company did anything. Silence here is the whole signal. */
  last_action_at: ISODate;
}

/* ---------- Receipts (receipt.json) ---------- */

export type ReceiptKind = 'job_post_payment';

export interface Receipt {
  id: string;
  kind: ReceiptKind;
  subject: string;
  amount: number;
  currency: string;
  issued_at: ISODate;
  signature: string;
  public_key_id: string;
}

/* ---------- Derived: scores and states ---------- */

/** One applied Ghost Score rule and what it contributed. */
export interface ScoreRule {
  id: string;
  label: string;
  points: number;
  applied: boolean;
}

export type GhostBand = 'active' | 'evergreen' | 'ghost';

export interface GhostScore {
  job_id: string;
  /** 0–100. Higher is worse. */
  score: number;
  band: GhostBand;
  breakdown: ScoreRule[];
}

export type TrackedState = ApplicationStatus | 'black_hole';

export interface BlackHoleState {
  job_id: string;
  github_login: string;
  state: TrackedState;
  days_silent: number;
  is_black_hole: boolean;
  /** How many other candidates are stuck on this same posting. */
  squad_size?: number;
}

export interface RepostMatch {
  job_id: string;
  title: string;
  posted_at: ISODate;
  similarity: number;
}

/* ---------- Messaging ---------- */

export interface MessageRequest {
  thread_id: string;
  from: string;
  to: string;
  sent_at: ISODate;
  /** Ciphertext. Nothing renders until it is decrypted locally. */
  body: string;
  accepted?: boolean;
}

/* ---------- Extensions ---------- */

export interface ExtensionRoute {
  path: string;
  component: string;
  nav?: { label: string; icon?: string; order?: number };
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
  routes: ExtensionRoute[];
  permissions: string[];
  requires?: { core?: string };
}

export interface LoadedExtension {
  manifest: ExtensionManifest;
  components: Record<string, () => Promise<unknown>>;
}
