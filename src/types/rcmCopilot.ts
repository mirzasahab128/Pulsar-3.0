export type RCMStage = 
  | 'eligibility'
  | 'patient_access'
  | 'charge_capture'
  | 'claim_submission'
  | 'clearinghouse_rejections'
  | 'denials_appeals'
  | 'ar_aging'
  | 'era_payment'
  | 'underpayments'
  | 'credentialing'
  | 'guarded_actions'
  | 'connector_registry'
  | 'audit_logs';

export interface EligibilityVerification {
  id: string;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
  policyStatus: 'Active' | 'Inactive' | 'Terminated' | 'Pending Re-verification';
  copayAmount: number;
  coinsurancePercent: number;
  deductibleTotal: number;
  deductibleRemaining: number;
  outOfPocketRemaining: number;
  priorAuthRequired: boolean;
  serviceCategory: string;
  checkedAt: string;
  verificationSource: 'Availity 271 EDI' | 'Direct Payer API' | 'Synthetic Sandbox';
}

export interface PriorAuthorization {
  id: string;
  authNumber: string;
  patientName: string;
  payerName: string;
  procedureCode: string;
  diagnosisCode: string;
  status: 'Approved' | 'Pending Payer Review' | 'Additional Clinicals Requested' | 'Denied' | 'Expiring Soon';
  requestedDate: string;
  validFrom?: string;
  validTo?: string;
  authorizedUnits: number;
  clinicalNotes: string;
}

export interface ClaimRecord {
  id: string;
  claimControlNumber: string;
  patientName: string;
  providerName: string;
  providerNpi: string;
  payerName: string;
  payerId: string;
  dateOfService: string;
  billedAmount: number;
  expectedAllowed: number;
  paidAmount: number;
  patientResponsibility: number;
  status: 'Draft' | 'Scrubbed' | 'Submitted' | 'Rejected' | 'Adjudicated' | 'Denied' | 'Paid' | 'Appealed';
  cleanClaimScore: number; // 0 - 100
  cptCodes: string[];
  icd10Codes: string[];
  modifiers: string[];
  ncciEditPassed: boolean;
  ncciEditWarnings?: string[];
  submissionTimestamp?: string;
  clearinghouseBatchId?: string;
}

export interface ClearinghouseRejection {
  id: string;
  claimId: string;
  claimControlNumber: string;
  patientName: string;
  payerName: string;
  rejectionCode: string; // e.g. 277CA A7:140:PR
  rejectionCategory: 'Invalid Subscriber ID' | 'Missing Rendering NPI' | 'Invalid Diagnosis Pointer' | 'Payer ID Mismatch' | 'Timely Filing Exceeded';
  rawRejectionMessage: string;
  fieldWithError: string;
  suggestedCorrection: string;
  autoFixAvailable: boolean;
  resolved: boolean;
  timestamp: string;
}

export interface DenialRecord {
  id: string;
  claimId: string;
  claimControlNumber: string;
  patientName: string;
  providerName: string;
  payerName: string;
  dateOfService: string;
  deniedAmount: number;
  carcCode: string; // e.g. CO-16, CO-197, CO-97
  rarcCode: string; // e.g. N517, M127
  carcDescription: string;
  denialCategory: 
    | 'Medical Necessity' 
    | 'Missing Prior Authorization' 
    | 'Bundled Procedure (NCCI)' 
    | 'Coordination of Benefits' 
    | 'Timely Filing' 
    | 'Non-Covered Benefit';
  timelyFilingDeadline: string;
  daysRemainingToAppeal: number;
  appealStatus: 'Proposed' | 'Approved' | 'Drafted' | 'Submitted' | 'Overturned (Won)' | 'Upheld';
  evidenceCitations: string[];
  recommendedAppealStrategy: string;
  generatedAppealText?: string;
}

export interface ARAgingBucket {
  range: '0-30 Days' | '31-60 Days' | '61-90 Days' | '91-120 Days' | '120+ Days';
  amount: number;
  claimsCount: number;
  percentOfTotal: number;
  collectibilityScore: number; // 0 - 100
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ERARemittance {
  id: string;
  checkOrEftNumber: string;
  payerName: string;
  paymentDate: string;
  totalPaid: number;
  totalAdjusted: number;
  claimsCovered: number;
  paymentMethod: 'EFT / ACH' | 'Virtual Credit Card' | 'Paper Check';
  postingStatus: 'Fully Posted' | 'Pending Exception Review' | 'Zero-Pay Unmatched';
  reconciliationStatus: 'Balanced' | 'Variance Detected';
}

export interface UnderpaymentRecord {
  id: string;
  claimId: string;
  claimControlNumber: string;
  payerName: string;
  cptCode: string;
  billedAmount: number;
  expectedAllowed: number;
  actualAllowed: number;
  underpaidVariance: number;
  contractClause: string;
  resolutionStatus: 'Detected' | 'Dispute Lodged' | 'Recovered' | 'Payer Accepted';
  dateDetected: string;
}

export interface CredentialingRecord {
  id: string;
  providerName: string;
  npi: string;
  specialty: string;
  payerName: string;
  caqhId: string;
  status: 'Active & In-Network' | 'Application Pending' | 'Revalidation Due' | 'Credentialing Lapsed';
  effectiveDate: string;
  revalidationDeadline: string;
  daysUntilExpiry: number;
}

export interface GuardedAction {
  id: string;
  title: string;
  description: string;
  actionType: 
    | 'submit_claim_batch'
    | 'file_appeal_packet'
    | 'adjust_denial_balance'
    | 'post_era_reconciliation'
    | 'dispute_underpayment'
    | 'correct_clearinghouse_rejection'
    | 'write_off_uncollectible';
  targetEntity: 'claim' | 'denial' | 'remittance' | 'underpayment' | 'rejection';
  targetId: string;
  financialImpact: number;
  requiresHumanApproval: boolean;
  status: 'proposed' | 'approved' | 'executed' | 'verified' | 'failed' | 'unverified';
  dryRunMode: boolean;
  evidence: string[];
  proposedBy: string; // e.g. "RCM Copilot Autonomous Agent"
  approvedBy?: string; // e.g. "Admin Controller"
  timestamp: string;
  executedAt?: string;
  verificationHash?: string;
  connector: 'brightree' | 'availity' | 'waystar' | 'mock_sandbox';
}

export interface RCMConnector {
  id: 'brightree' | 'availity' | 'waystar' | 'epic_community';
  name: string;
  category: 'Practice Management & EHR' | 'National Clearinghouse' | 'Enterprise Clearinghouse' | 'Health System Bridge';
  logoBadge: string;
  configStatus: 'Configured' | 'Unconfigured' | 'Mock Active';
  authStatus: 'Connected (Live)' | 'Synthetic Mode (Active)' | 'Awaiting OAuth' | 'Credentials Missing';
  isMock: boolean;
  endpointUrl: string;
  supportedCapabilities: string[];
  lastSync: string;
  dataFreshness: string;
  recentErrors: string[];
  readOperations: string[];
  writeOperations: string[];
  verificationStatus: 'Verified (Synthetic)' | 'Verified (Production)' | 'Unverified';
  documentationUrl: string;
  clientIdMasked?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  stage: RCMStage;
  targetId: string;
  financialImpact: number;
  approvalStatus: string;
  dryRun: boolean;
  verificationHash: string;
  details: string;
}

export interface RCMGlobalControls {
  killSwitchActive: boolean;
  agentAutonomyMode: 'guarded' | 'autonomous' | 'paused';
  humanReviewThresholdUSD: number;
  dryRunMode: boolean;
  syntheticDataMode: boolean;
}
