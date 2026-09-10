/**
 * Shapes for everything stored in Git.
 *
 * snake_case throughout: these are on-disk wire formats read straight out of
 * JSON files, not internal models.
 *
 * Two invariants drive most of the design here:
 *
 *   1. Nothing a company self-reports is trusted. Every number that feeds a
 *      Ghost Score is derived from the ledger, and company claims only count
 *      once the affected candidate attests to them.
 *   2. The public ledger contains no candidate identity. Applications are
 *      referenced by a random pseudonym minted client side.
 */

export type ISODate = string;

/* ---------- Identity ---------- */

/**
 * Pseudonymous handle for one candidate's application to one job.
 *
 * Random, minted in the browser, never derived from the GitHub login. The
 * mapping from ref to job lives in the candidate's own IndexedDB and optional
 * private backup repo, so the public ledger cannot be mined to find out who
 * applied where. A hash of the login would not do: it is guessable, so anyone
 * could test "did this specific person apply here".
 *
 * The tradeoff is sybil resistance. Distinct refs are assumed to be distinct
 * people, which is true in practice and cheap to violate deliberately. Squad
 * counts are therefore a floor, not a proof.
 */
export type ApplicationRef = string;

/* ---------- Companies ---------- */

export interface Company {
  id: string;
  name: string;
  /** Canonical identity for externally sourced jobs, e.g. "acme.com". */
  domain?: string;
  github_org?: string;
  /** Set when someone proved they work there and claimed the profile. */
  claimed_by?: string;
  claimed_at?: ISODate;
}

/* ---------- Jobs ---------- */

/**
 * `external` jobs were logged by a candidate from somewhere else entirely
 * (LinkedIn, Greenhouse, a careers page). They are the majority case and they
 * require no participation from the company at all, which is the point: a
 * company cannot avoid being measured by declining to sign up.
 */
export type JobSource = 'pointbreak' | 'external';

export type JobStatus = 'open' | 'closed';
export type CloseReason = 'external_hire' | 'internal_hire' | 'cancelled';

export interface Salary {
  min: number;
  max: number;
  currency: string;
  period: 'year' | 'month' | 'day' | 'hour';
}

export interface Job {
  id: string;
  company_id: string;
  title: string;
  source: JobSource;

  /** External only. Normalized before hashing so the same posting dedupes. */
  source_url?: string;
  source_hash?: string;

  /**
   * Optional because external postings frequently disclose nothing. Absence is
   * itself a signal and is scored as one, rather than being treated as neutral.
   */
  salary?: Salary;
  salary_disclosed: boolean;

  tech_stack: string[];
  description?: string;
  /** Lets a repost be detected without refetching every past description. */
  description_hash?: string;

  posted_at: ISODate;
  first_seen_at: ISODate;
  status: JobStatus;
  closed_at?: ISODate;
  close_reason?: CloseReason;
  receipt_id?: string;

  // Deliberately no `metrics` field. Every number that feeds the Ghost Score is
  // derived from the ledger by deriveMetrics(). A company writing its own
  // metrics into its own job file was the single largest hole in the design.
}

/* ---------- Event Ledger ---------- */

export type LedgerAction =
  // Authored by the candidate. Self-evident, counted immediately.
  | 'application_submitted'
  | 'rejection_received'
  | 'interview_held'
  | 'offer_received'
  | 'withdrawn'
  // Authored by the company. A claim, worth nothing until attested.
  | 'resume_viewed'
  | 'rejection_sent'
  | 'interview_scheduled'
  // Attestation of a company claim, authored by the affected candidate.
  | 'claim_confirmed'
  | 'claim_disputed';

export type Actor = 'candidate' | 'company';

/** Company claims that require candidate attestation before they count. */
export const CLAIM_ACTIONS: LedgerAction[] = [
  'resume_viewed',
  'rejection_sent',
  'interview_scheduled'
];

/**
 * One line of `events/<job_id>.jsonl`. Append only: lines are never edited or
 * deleted, which is what makes attestation and auditing possible. An
 * attestation is a new event pointing at an old one, never a mutation of it.
 */
export interface LedgerEvent {
  id: string;
  job_id: string;
  application_ref: ApplicationRef;
  action: LedgerAction;
  at: ISODate;
  actor: Actor;
  /** For claim_confirmed and claim_disputed: the event being attested. */
  ref_event?: string;
}

/* ---------- Derived metrics ---------- */

/**
 * Computed from the ledger, never stored, never written by a company.
 * "attested" means the candidate on the other end confirmed it happened.
 */
export interface JobMetrics {
  applications: number;
  interviews_attested: number;
  rejections_attested: number;
  /** Claims nobody has confirmed. These earn no credit and no penalty. */
  claims_unattested: number;
  /** Claims a candidate said did not happen. */
  claims_disputed: number;
  claims_total: number;
  reposts: number;
}

/* ---------- Applications ---------- */

export type ApplicationStatus =
  | 'submitted'
  | 'viewed'
  | 'interviewing'
  | 'rejected'
  | 'offer'
  | 'withdrawn';

/** Derived from the ledger by projectAll(), never stored. */
export interface Application {
  job_id: string;
  application_ref: ApplicationRef;
  status: ApplicationStatus;
  submitted_at: ISODate;
  /** Last company action the candidate accepted as real. Silence is the signal. */
  last_action_at: ISODate;
  /** Company claims on this application awaiting the candidate's response. */
  pending_claims: LedgerEvent[];
}

export type TrackedState = ApplicationStatus | 'black_hole';

export interface BlackHoleState {
  job_id: string;
  application_ref: ApplicationRef;
  state: TrackedState;
  days_silent: number;
  is_black_hole: boolean;
  /** Other candidates stuck on this same posting. A floor, not a proof. */
  squad_size?: number;
}

/* ---------- Scores ---------- */

export interface ScoreRule {
  id: string;
  label: string;
  points: number;
  applied: boolean;
}

export type GhostBand = 'active' | 'evergreen' | 'ghost';

export interface GhostScore {
  job_id: string;
  score: number;
  band: GhostBand;
  breakdown: ScoreRule[];
  /**
   * How many tracked applications the score is based on. Externally sourced
   * jobs are only visible through candidates who logged them here, so this is
   * shown alongside the score rather than hidden.
   */
  sample: number;
}

/* ---------- Profile ---------- */

/**
 * How a skill claim is backed. Public commit volume is only one path, and a bad
 * one on its own: most professional engineering happens in private repos, so
 * ranking on public commits alone systematically buries senior people and
 * flatters anyone with a lot of tutorial repositories.
 */
export type EvidenceKind =
  | 'public_commits'
  | 'merged_prs'
  | 'private_contributions'
  | 'peer_attestation'
  | 'external_artifact';

export interface SkillEvidence {
  kind: EvidenceKind;
  count?: number;
  url?: string;
  /** GitHub login of the peer who vouched, for peer_attestation. */
  attested_by?: string;
  at: ISODate;
}

export interface Skill {
  skill: string;
  evidence: SkillEvidence[];
}

export interface ShipLog {
  repo: string;
  pr: number;
  merged_at: ISODate;
  title?: string;
  url?: string;
  /** True when the repository is private and only the count is public. */
  redacted?: boolean;
}

/**
 * Aggregate contribution volume including private work.
 *
 * GitHub reports restricted (private) contribution totals without revealing
 * repository names, so an engineer whose work is entirely behind a corporate
 * firewall can still demonstrate volume. This is the fix for the senior
 * engineer with an empty public profile.
 */
export interface ContributionVolume {
  total: number;
  restricted: number;
  from: ISODate;
  to: ISODate;
}

export interface UserProfile {
  github_login: string;
  display_name?: string;
  skills: Skill[];
  ship_logs: ShipLog[];
  contributions?: ContributionVolume;
  updated_at?: ISODate;
}

/* ---------- Receipts ---------- */

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
