/**
 * Canonical shapes for everything stored in Git.
 * Prose version: docs/API_SPECS.md
 */

export type ISODate = string;

/* ---------- Jobs ---------- */

export type JobStatus = 'open' | 'filled' | 'withdrawn' | 'expired';
export type LocationType = 'remote' | 'hybrid' | 'onsite';

export interface Compensation {
  min: number;
  max: number;
  currency: string;
  period: 'year' | 'month' | 'day' | 'hour';
  equity?: string;
}

/** The disclosed funnel. Every field is optional; missing fields lower confidence. */
export interface Disclosure {
  applicationsReceived?: number;
  advancedToScreen?: number;
  advancedToOnsite?: number;
  offersExtended?: number;
  hires?: number;
  lastUpdated?: ISODate;
}

export interface JobPost {
  id: string;
  companyId: string;
  title: string;
  location: { type: LocationType; region?: string };
  compensation: Compensation;
  description: string;
  postedAt: ISODate;
  closesAt?: ISODate;
  status: JobStatus;
  disclosure: Disclosure;
  receiptId?: string;
}

/* ---------- Companies & profiles ---------- */

export interface CompanyProfile {
  id: string;
  name: string;
  website?: string;
  githubOrg?: string;
  verifiedAt?: ISODate;
  trustScore?: number;
}

export interface ShipLog {
  id: string;
  login: string;
  title: string;
  shippedAt: ISODate;
  skills: string[];
  evidence: Array<{ type: 'repo' | 'writeup' | 'demo' | 'other'; url: string }>;
  verifiedBy?: string[];
}

export interface Profile {
  login: string;
  displayName?: string;
  shipLogs: ShipLog[];
  skills: Record<string, number>;
  openTo?: LocationType[];
}

/* ---------- Applications ---------- */

export type ApplicationStage =
  | 'submitted'
  | 'screen'
  | 'onsite'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'ghosted';

export interface StageTransition {
  stage: ApplicationStage;
  at: ISODate;
  /** true when inferred from silence rather than reported by the company */
  inferred?: boolean;
}

export interface Application {
  jobId: string;
  login: string;
  submittedAt: ISODate;
  history: StageTransition[];
  lastCompanyContactAt?: ISODate;
}

/* ---------- Receipts ---------- */

export type ReceiptKind = 'job_post_payment' | 'outcome_attestation';

export interface Receipt {
  id: string;
  kind: ReceiptKind;
  subject: string;
  amount: number;
  currency: string;
  issuedAt: ISODate;
  signature: string;
  publicKeyId: string;
}

/* ---------- Scores ---------- */

export interface Signal {
  name: string;
  weight: number;
  /** normalized 0..1, where 1 is the worst outcome for the subject */
  value: number;
}

export interface GhostScore {
  jobId: string;
  score: number;
  confidence: number;
  signals: Signal[];
}

export interface TrustScore {
  companyId: string;
  score: number;
  confidence: number;
  signals: Signal[];
}

/* ---------- Messaging ---------- */

export interface MessageRequest {
  threadId: string;
  from: string;
  to: string;
  sentAt: ISODate;
  /** ciphertext; the shell never sees plaintext it did not decrypt locally */
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
  /** lazy loaders keyed by the manifest's `component` path */
  components: Record<string, () => Promise<unknown>>;
}
