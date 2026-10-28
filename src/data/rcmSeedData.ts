import {
  EligibilityVerification,
  PriorAuthorization,
  ClaimRecord,
  ClearinghouseRejection,
  DenialRecord,
  ARAgingBucket,
  ERARemittance,
  UnderpaymentRecord,
  CredentialingRecord,
  GuardedAction,
  RCMConnector,
  AuditLogEntry
} from '../types/rcmCopilot';

export const SYNTHETIC_ELIGIBILITY: EligibilityVerification[] = [
  {
    id: 'ELIG-SYN-001',
    patientName: 'Jane Doe [Synthetic]',
    patientDob: '1982-04-14',
    payerName: 'Blue Cross Blue Shield (Texas)',
    payerId: 'BCBSTX',
    memberId: 'TXB99214482',
    policyStatus: 'Active',
    copayAmount: 25.00,
    coinsurancePercent: 20,
    deductibleTotal: 1500.00,
    deductibleRemaining: 240.00,
    outOfPocketRemaining: 950.00,
    priorAuthRequired: true,
    serviceCategory: 'Cardiovascular Intervention & Catheterization',
    checkedAt: '2026-10-13 08:30 CST',
    verificationSource: 'Availity 271 EDI'
  },
  {
    id: 'ELIG-SYN-002',
    patientName: 'Robert Martinez [Synthetic]',
    patientDob: '1975-11-22',
    payerName: 'UnitedHealthcare Commercial',
    payerId: 'UHC877',
    memberId: 'UHC4819002',
    policyStatus: 'Active',
    copayAmount: 40.00,
    coinsurancePercent: 15,
    deductibleTotal: 2500.00,
    deductibleRemaining: 0.00,
    outOfPocketRemaining: 320.00,
    priorAuthRequired: false,
    serviceCategory: 'Outpatient Orthopedic Arthroscopy',
    checkedAt: '2026-10-13 09:15 CST',
    verificationSource: 'Availity 271 EDI'
  },
  {
    id: 'ELIG-SYN-003',
    patientName: 'Eleanor Vance [Synthetic]',
    patientDob: '1961-08-03',
    payerName: 'Medicare Part B (Novitas Solutions)',
    payerId: '12202',
    memberId: '1EG4TE5MK72',
    policyStatus: 'Active',
    copayAmount: 0.00,
    coinsurancePercent: 20,
    deductibleTotal: 240.00,
    deductibleRemaining: 0.00,
    outOfPocketRemaining: 0.00,
    priorAuthRequired: true,
    serviceCategory: 'DME - Continuous BiPAP System',
    checkedAt: '2026-10-13 09:45 CST',
    verificationSource: 'Direct Payer API'
  },
  {
    id: 'ELIG-SYN-004',
    patientName: 'David Chen [Synthetic]',
    patientDob: '1990-01-19',
    payerName: 'Aetna Open Choice PPO',
    payerId: '60054',
    memberId: 'W108492048',
    policyStatus: 'Pending Re-verification',
    copayAmount: 30.00,
    coinsurancePercent: 20,
    deductibleTotal: 3000.00,
    deductibleRemaining: 1850.00,
    outOfPocketRemaining: 4200.00,
    priorAuthRequired: true,
    serviceCategory: 'Spine Injection / Interventional Pain',
    checkedAt: '2026-10-12 16:10 CST',
    verificationSource: 'Synthetic Sandbox'
  }
];

export const SYNTHETIC_PRIOR_AUTHS: PriorAuthorization[] = [
  {
    id: 'PA-SYN-101',
    authNumber: 'AUTH-BCBS-88912',
    patientName: 'Jane Doe [Synthetic]',
    payerName: 'Blue Cross Blue Shield (Texas)',
    procedureCode: 'CPT 93458 (Left Heart Cath)',
    diagnosisCode: 'ICD-10 I25.10 (CAD Native Artery)',
    status: 'Approved',
    requestedDate: '2026-10-01',
    validFrom: '2026-10-05',
    validTo: '2026-12-05',
    authorizedUnits: 1,
    clinicalNotes: 'Approved per Carelon cardiology guidelines. Echo findings and stress test documented.'
  },
  {
    id: 'PA-SYN-102',
    authNumber: 'PA-PEND-9421',
    patientName: 'Eleanor Vance [Synthetic]',
    payerName: 'Medicare Part B (Novitas Solutions)',
    procedureCode: 'HCPCS E0470 (BiPAP Device)',
    diagnosisCode: 'ICD-10 G47.33 (Obstructive Sleep Apnea)',
    status: 'Additional Clinicals Requested',
    requestedDate: '2026-10-08',
    authorizedUnits: 1,
    clinicalNotes: 'Payer requested polysomnography 90-day compliance download and face-to-face evaluation note.'
  },
  {
    id: 'PA-SYN-103',
    authNumber: 'AUTH-AET-55102',
    patientName: 'David Chen [Synthetic]',
    payerName: 'Aetna Open Choice PPO',
    procedureCode: 'CPT 64493 (Lumbar Facet Joint Inj)',
    diagnosisCode: 'ICD-10 M54.5 (Low Back Pain)',
    status: 'Expiring Soon',
    requestedDate: '2026-08-15',
    validFrom: '2026-08-20',
    validTo: '2026-10-20',
    authorizedUnits: 2,
    clinicalNotes: '3 days remaining on authorization window. 1 unit consumed on 09/02.'
  }
];

export const SYNTHETIC_CLAIMS: ClaimRecord[] = [
  {
    id: 'CLM-SYN-8801',
    claimControlNumber: 'CCN-20261013-001',
    patientName: 'Jane Doe [Synthetic]',
    providerName: 'Dr. Marcus Vance, MD',
    providerNpi: '1487654321',
    payerName: 'Blue Cross Blue Shield (Texas)',
    payerId: 'BCBSTX',
    dateOfService: '2026-10-06',
    billedAmount: 4250.00,
    expectedAllowed: 2890.00,
    paidAmount: 0.00,
    patientResponsibility: 0.00,
    status: 'Scrubbed',
    cleanClaimScore: 98,
    cptCodes: ['93458', '99214'],
    icd10Codes: ['I25.10', 'I10'],
    modifiers: ['25'],
    ncciEditPassed: true,
    ncciEditWarnings: ['Modifier 25 verified against separate distinct E/M documentation.'],
    clearinghouseBatchId: 'BAT-2026-1013-A'
  },
  {
    id: 'CLM-SYN-8802',
    claimControlNumber: 'CCN-20261012-004',
    patientName: 'Robert Martinez [Synthetic]',
    providerName: 'Dr. Elena Rostova, MD',
    providerNpi: '1928374650',
    payerName: 'UnitedHealthcare Commercial',
    payerId: 'UHC877',
    dateOfService: '2026-09-28',
    billedAmount: 6800.00,
    expectedAllowed: 4450.00,
    paidAmount: 0.00,
    patientResponsibility: 0.00,
    status: 'Rejected',
    cleanClaimScore: 72,
    cptCodes: ['29881', '29877'],
    icd10Codes: ['M23.22', 'M17.11'],
    modifiers: ['59'],
    ncciEditPassed: false,
    ncciEditWarnings: ['Clearinghouse rejected Loop 2010BA: Missing rendering physician Taxonomy Code.'],
    submissionTimestamp: '2026-10-12 11:40'
  },
  {
    id: 'CLM-SYN-8803',
    claimControlNumber: 'CCN-20260915-089',
    patientName: 'Eleanor Vance [Synthetic]',
    providerName: 'Austin Heart & Vascular DME',
    providerNpi: '1092837465',
    payerName: 'Medicare Part B (Novitas Solutions)',
    payerId: '12202',
    dateOfService: '2026-09-10',
    billedAmount: 1850.00,
    expectedAllowed: 1220.00,
    paidAmount: 0.00,
    patientResponsibility: 0.00,
    status: 'Denied',
    cleanClaimScore: 90,
    cptCodes: ['E0470', 'A7030'],
    icd10Codes: ['G47.33'],
    modifiers: ['RR', 'KX'],
    ncciEditPassed: true,
    submissionTimestamp: '2026-09-12 14:22'
  },
  {
    id: 'CLM-SYN-8804',
    claimControlNumber: 'CCN-20260901-012',
    patientName: 'Arthur Pendelton [Synthetic]',
    providerName: 'Dr. Jonathan Blake, MD',
    providerNpi: '1384759201',
    payerName: 'Aetna Health Management',
    payerId: '60054',
    dateOfService: '2026-08-28',
    billedAmount: 3400.00,
    expectedAllowed: 2150.00,
    paidAmount: 1720.00,
    patientResponsibility: 430.00,
    status: 'Paid',
    cleanClaimScore: 100,
    cptCodes: ['99215', '93000'],
    icd10Codes: ['R00.0'],
    modifiers: [],
    ncciEditPassed: true,
    submissionTimestamp: '2026-08-30 10:15'
  }
];

export const SYNTHETIC_REJECTIONS: ClearinghouseRejection[] = [
  {
    id: 'REJ-SYN-201',
    claimId: 'CLM-SYN-8802',
    claimControlNumber: 'CCN-20261012-004',
    patientName: 'Robert Martinez [Synthetic]',
    payerName: 'UnitedHealthcare Commercial',
    rejectionCode: '277CA A7:140:PR',
    rejectionCategory: 'Missing Rendering NPI',
    rawRejectionMessage: 'STC*A7:140:PR*20261012*U*0.00~ Acknowledgement / Rejected for Relational Field: Rendering Provider Taxonomy Code 207X00000X missing in Loop 2310B.',
    fieldWithError: 'Loop 2310B PRV03 (Provider Taxonomy Code)',
    suggestedCorrection: 'Auto-inject Dr. Rostova Orthopedic Taxonomy Code (207X00000X) into EDI 837P Loop 2310B PRV segment.',
    autoFixAvailable: true,
    resolved: false,
    timestamp: '2026-10-12 12:05 CST'
  },
  {
    id: 'REJ-SYN-202',
    claimId: 'CLM-SYN-8809',
    claimControlNumber: 'CCN-20261010-055',
    patientName: 'Sarah Jenkins [Synthetic]',
    payerName: 'Humana Medicare Advantage',
    rejectionCode: '999 REJ-AK403:7',
    rejectionCategory: 'Invalid Subscriber ID',
    rawRejectionMessage: 'AK4*NM109*7*Segment Error in Subscriber Primary Identifier. Member ID H992144 does not match Humana 9-digit format.',
    fieldWithError: 'Loop 2010BA NM109 (Subscriber Primary ID)',
    suggestedCorrection: 'Verify insurance card scan: subscriber prefix is missing leading zero "H099214482".',
    autoFixAvailable: false,
    resolved: false,
    timestamp: '2026-10-11 15:30 CST'
  }
];

export const SYNTHETIC_DENIALS: DenialRecord[] = [
  {
    id: 'DEN-SYN-301',
    claimId: 'CLM-SYN-8803',
    claimControlNumber: 'CCN-20260915-089',
    patientName: 'Eleanor Vance [Synthetic]',
    providerName: 'Austin Heart & Vascular DME',
    payerName: 'Medicare Part B (Novitas Solutions)',
    dateOfService: '2026-09-10',
    deniedAmount: 1850.00,
    carcCode: 'CO-197',
    rarcCode: 'N517',
    carcDescription: 'Precertification / Prior authorization / Notification / Pre-treatment absent or untimely.',
    denialCategory: 'Missing Prior Authorization',
    timelyFilingDeadline: '2026-12-09',
    daysRemainingToAppeal: 57,
    appealStatus: 'Proposed',
    evidenceCitations: [
      'CMS LCD L33797 (Positive Airway Pressure Devices for Sleep Apnea)',
      'Polysomnography AHI Score = 34.2 events/hour (Meets severe criterion > 30)',
      'Signed Face-to-Face Clinical Evaluation from Dr. Marcus Vance dated 08/29/2026'
    ],
    recommendedAppealStrategy: 'Attach retrospective polysomnography diagnostic report, 30-day compliance smartcard log, and certificate of medical necessity (CMS-849).',
    generatedAppealText: `ATTN: Medicare Part B Redetermination Department
Novitas Solutions, Inc.
P.O. Box 3115, Mechanicsburg, PA 17055

RE: Formal Redetermination Request / Level 1 Appeal
Patient: Eleanor Vance [Synthetic]
Medicare Beneficiary ID: 1EG4TE5MK72
Claim Control Number: CCN-20260915-089
Date of Service: September 10, 2026
Denied Amount: $1,850.00 (Denial Code CO-197 / N517)

Dear Appeals Committee,

We are writing on behalf of Austin Heart & Vascular Institute to formally appeal the denial of HCPCS E0470 (BiPAP Device) rendered under denial code CO-197.

The denial cites absent pre-treatment notification. However, per CMS Local Coverage Determination L33797, all medical necessity criteria were fully satisfied prior to dispensing:
1. Formal overnight polysomnography performed on 08/15/2026 documented an Apnea-Hypopnea Index (AHI) of 34.2 events per hour with nocturnal oxygen desaturation below 82%.
2. Trial of continuous CPAP failed due to persistent hypoventilation, necessitating bilevel PAP.
3. The treating physician Dr. Marcus Vance conducted a documented face-to-face evaluation on 08/29/2026 prior to device order.

Enclosed please find:
- Complete Polysomnography Diagnostic Report & Sleep Study Tracings
- Physician Face-to-Face Clinical Consultation Note
- CMS-849 Certificate of Medical Necessity (Signed & Dated)

We respectfully request an immediate reversal of this denial and prompt adjudication of $1,850.00.

Sincerely,
Revenue Cycle & Appeals Architecture Team
Austin Heart & Vascular Institute`
  },
  {
    id: 'DEN-SYN-302',
    claimId: 'CLM-SYN-8799',
    claimControlNumber: 'CCN-20260902-044',
    patientName: 'Michael Chang [Synthetic]',
    providerName: 'Northwest Orthopedic & Spine Surgery',
    payerName: 'Aetna Commercial',
    dateOfService: '2026-08-25',
    deniedAmount: 2450.00,
    carcCode: 'CO-50',
    rarcCode: 'M127',
    carcDescription: 'These are non-covered services because this is not deemed a medical necessity by the payer.',
    denialCategory: 'Medical Necessity',
    timelyFilingDeadline: '2026-11-23',
    daysRemainingToAppeal: 41,
    appealStatus: 'Approved',
    evidenceCitations: [
      'CPG Milliman Care Guidelines (MCG) 28th Edition - Arthroscopic Meniscectomy',
      'MRI Lumbar & Knee Joint radiologist report showing complex tear of posterior horn',
      'Failure of 8 weeks conservative physical therapy and NSAID therapy documented'
    ],
    recommendedAppealStrategy: 'Cite MCG clinical guidelines and enclosed conservative management physical therapy logs proving exhaustion of non-operative options.'
  },
  {
    id: 'DEN-SYN-303',
    claimId: 'CLM-SYN-8760',
    claimControlNumber: 'CCN-20260810-019',
    patientName: 'Gregory House [Synthetic]',
    providerName: 'Dr. Marcus Vance, MD',
    payerName: 'Cigna Healthcare',
    dateOfService: '2026-07-29',
    deniedAmount: 890.00,
    carcCode: 'CO-97',
    rarcCode: 'N390',
    carcDescription: 'The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated.',
    denialCategory: 'Bundled Procedure (NCCI)',
    timelyFilingDeadline: '2026-10-27',
    daysRemainingToAppeal: 14,
    appealStatus: 'Proposed',
    evidenceCitations: [
      'NCCI Policy Manual Chapter 1, Section E (Modifier 59 / XS application)',
      'Operative note demonstrates distinct anatomical site (separate cardiac vessel)'
    ],
    recommendedAppealStrategy: 'Resubmit with Modifier XS proving distinct lesion intervention outside global surgical bundle.'
  }
];

export const SYNTHETIC_AR_BUCKETS: ARAgingBucket[] = [
  {
    range: '0-30 Days',
    amount: 142500.00,
    claimsCount: 88,
    percentOfTotal: 44.5,
    collectibilityScore: 96,
    urgency: 'Low'
  },
  {
    range: '31-60 Days',
    amount: 88400.00,
    claimsCount: 46,
    percentOfTotal: 27.6,
    collectibilityScore: 84,
    urgency: 'Medium'
  },
  {
    range: '61-90 Days',
    amount: 49200.00,
    claimsCount: 24,
    percentOfTotal: 15.4,
    collectibilityScore: 68,
    urgency: 'High'
  },
  {
    range: '91-120 Days',
    amount: 26100.00,
    claimsCount: 12,
    percentOfTotal: 8.2,
    collectibilityScore: 48,
    urgency: 'High'
  },
  {
    range: '120+ Days',
    amount: 13800.00,
    claimsCount: 7,
    percentOfTotal: 4.3,
    collectibilityScore: 22,
    urgency: 'Critical'
  }
];

export const SYNTHETIC_ERA_REMITTANCES: ERARemittance[] = [
  {
    id: 'ERA-SYN-501',
    checkOrEftNumber: 'EFT-8849201948',
    payerName: 'Blue Cross Blue Shield (Texas)',
    paymentDate: '2026-10-12',
    totalPaid: 48250.00,
    totalAdjusted: 14120.00,
    claimsCovered: 32,
    paymentMethod: 'EFT / ACH',
    postingStatus: 'Fully Posted',
    reconciliationStatus: 'Balanced'
  },
  {
    id: 'ERA-SYN-502',
    checkOrEftNumber: 'EFT-3392019481',
    payerName: 'UnitedHealthcare Commercial',
    paymentDate: '2026-10-11',
    totalPaid: 29400.00,
    totalAdjusted: 9150.00,
    claimsCovered: 18,
    paymentMethod: 'EFT / ACH',
    postingStatus: 'Pending Exception Review',
    reconciliationStatus: 'Variance Detected'
  },
  {
    id: 'ERA-SYN-503',
    checkOrEftNumber: 'CHK-0094821',
    payerName: 'Aetna Commercial',
    paymentDate: '2026-10-09',
    totalPaid: 12800.00,
    totalAdjusted: 4200.00,
    claimsCovered: 9,
    paymentMethod: 'Virtual Credit Card',
    postingStatus: 'Fully Posted',
    reconciliationStatus: 'Balanced'
  }
];

export const SYNTHETIC_UNDERPAYMENTS: UnderpaymentRecord[] = [
  {
    id: 'UND-SYN-401',
    claimId: 'CLM-SYN-8750',
    claimControlNumber: 'CCN-20260901-088',
    payerName: 'UnitedHealthcare Commercial',
    cptCode: '93458 (Left Heart Cath)',
    billedAmount: 4250.00,
    expectedAllowed: 2890.00,
    actualAllowed: 2210.00,
    underpaidVariance: 680.00,
    contractClause: 'Section 4.2 Cardiology Fee Schedule (145% of CMS RBRVS)',
    resolutionStatus: 'Detected',
    dateDetected: '2026-10-10'
  },
  {
    id: 'UND-SYN-402',
    claimId: 'CLM-SYN-8690',
    claimControlNumber: 'CCN-20260814-012',
    payerName: 'Aetna Commercial',
    cptCode: '29881 (Knee Arthroscopy)',
    billedAmount: 5100.00,
    expectedAllowed: 3450.00,
    actualAllowed: 2950.00,
    underpaidVariance: 500.00,
    contractClause: 'Exhibit B Outpatient Surgery Fee Guarantee',
    resolutionStatus: 'Dispute Lodged',
    dateDetected: '2026-09-22'
  }
];

export const SYNTHETIC_CREDENTIALING: CredentialingRecord[] = [
  {
    id: 'CRED-SYN-01',
    providerName: 'Dr. Marcus Vance, MD, FACC',
    npi: '1487654321',
    specialty: 'Interventional Cardiology',
    payerName: 'Blue Cross Blue Shield (Texas)',
    caqhId: '12948201',
    status: 'Active & In-Network',
    effectiveDate: '2024-01-01',
    revalidationDeadline: '2027-01-01',
    daysUntilExpiry: 445
  },
  {
    id: 'CRED-SYN-02',
    providerName: 'Dr. Elena Rostova, MD',
    npi: '1928374650',
    specialty: 'Orthopedic Surgery & Sports Med',
    payerName: 'UnitedHealthcare Commercial',
    caqhId: '14892019',
    status: 'Revalidation Due',
    effectiveDate: '2023-11-15',
    revalidationDeadline: '2026-11-15',
    daysUntilExpiry: 33
  },
  {
    id: 'CRED-SYN-03',
    providerName: 'Brenda Miller, PA-C',
    npi: '1839201948',
    specialty: 'Physician Assistant - Cardiology',
    payerName: 'Medicare Part B (Novitas Solutions)',
    caqhId: '19482014',
    status: 'Application Pending',
    effectiveDate: '2026-09-01',
    revalidationDeadline: '2029-09-01',
    daysUntilExpiry: 1052
  }
];

export const SYNTHETIC_GUARDED_ACTIONS: GuardedAction[] = [
  {
    id: 'ACT-GA-001',
    title: 'File Formal Level 1 Appeal for BiPAP Device Denial ($1,850.00)',
    description: 'Autonomous generation of Medicare Part B redetermination package including LCD L33797 clinical citations and sleep study diagnostics.',
    actionType: 'file_appeal_packet',
    targetEntity: 'denial',
    targetId: 'DEN-SYN-301',
    financialImpact: 1850.00,
    requiresHumanApproval: true, // Above $1,000 threshold
    status: 'proposed',
    dryRunMode: true,
    evidence: [
      'Denial Amount $1,850.00 exceeds $1,000 human review safety threshold',
      'Timely filing deadline: December 9, 2026 (57 days remaining)',
      'Verified LCD L33797 polysomnography AHI severity score 34.2'
    ],
    proposedBy: 'RCM Copilot Autonomous Appeals Agent',
    timestamp: '2026-10-13 10:14 CST',
    connector: 'availity'
  },
  {
    id: 'ACT-GA-002',
    title: 'Dispute Orthopedic Fee Schedule Underpayment ($680.00)',
    description: 'Lodge contractual rate underpayment dispute with UnitedHealthcare for CPT 93458 reimbursement variance.',
    actionType: 'dispute_underpayment',
    targetEntity: 'underpayment',
    targetId: 'UND-SYN-401',
    financialImpact: 680.00,
    requiresHumanApproval: false, // Below $1,000 threshold
    status: 'approved',
    dryRunMode: true,
    evidence: [
      'Financial impact $680.00 is below $1,000 human review threshold',
      'Contract clause Section 4.2 specifies 145% of CMS RBRVS rate ($2,890.00)',
      'Payer remitted $2,210.00 without contractual carving justification'
    ],
    proposedBy: 'RCM Copilot Contract Variance Sentinel',
    approvedBy: 'Auto-Approved (Under $1k Threshold Policy)',
    timestamp: '2026-10-13 10:30 CST',
    connector: 'availity'
  },
  {
    id: 'ACT-GA-003',
    title: 'Transmit Corrected 837P Claim with Provider Taxonomy Code ($6,800.00)',
    description: 'Auto-correct Loop 2310B taxonomy code 207X00000X and re-transmit rejected claim CCN-20261012-004 to clearinghouse.',
    actionType: 'correct_clearinghouse_rejection',
    targetEntity: 'rejection',
    targetId: 'REJ-SYN-201',
    financialImpact: 6800.00,
    requiresHumanApproval: true, // Above $1,000 threshold
    status: 'proposed',
    dryRunMode: true,
    evidence: [
      'Claim value $6,800.00 exceeds $1,000 safety threshold',
      '277CA Rejection Code A7:140:PR resolved with verified NPI registry taxonomy',
      'Zero change to clinical CPT/ICD coding'
    ],
    proposedBy: 'RCM Copilot Pre-Adjudication Scrubber',
    timestamp: '2026-10-13 11:05 CST',
    connector: 'brightree'
  }
];

export const SYNTHETIC_CONNECTORS: RCMConnector[] = [
  {
    id: 'brightree',
    name: 'Brightree EHR & Practice Management',
    category: 'Practice Management & EHR',
    logoBadge: 'BT',
    configStatus: 'Mock Active',
    authStatus: 'Synthetic Mode (Active)',
    isMock: true,
    endpointUrl: 'https://api.brightree.net/v2/rcm-core',
    supportedCapabilities: [
      'Patient Demographic Sync',
      'Charge Capture Ingestion',
      'Billing Master Scheduling',
      '837P Claim Creation',
      'Patient Responsibility Invoicing'
    ],
    lastSync: '2026-10-13 11:20 CST (2 mins ago)',
    dataFreshness: '100% Real-time Synthetic Bridge',
    recentErrors: [],
    readOperations: ['GET /patients', 'GET /charges', 'GET /appointments'],
    writeOperations: ['POST /claims/draft', 'PUT /charges/verify'],
    verificationStatus: 'Verified (Synthetic)',
    documentationUrl: 'https://www.brightree.com/developers/api-documentation',
    clientIdMasked: 'bt_sandbox_client_****8812'
  },
  {
    id: 'availity',
    name: 'Availity Essentials Clearinghouse',
    category: 'National Clearinghouse',
    logoBadge: 'AV',
    configStatus: 'Mock Active',
    authStatus: 'Synthetic Mode (Active)',
    isMock: true,
    endpointUrl: 'https://api.availity.com/availity/v1',
    supportedCapabilities: [
      '270/271 Real-Time Eligibility Verification',
      '837 Professional & Institutional Claim Submission',
      '276/277 Real-Time Claim Status Inquiry',
      '835 Electronic Remittance Advice (ERA) Ingestion',
      'Payer Clinical Attachments & Appeals Dispatch'
    ],
    lastSync: '2026-10-13 11:15 CST (7 mins ago)',
    dataFreshness: '100% Real-time Synthetic Clearinghouse Bridge',
    recentErrors: [],
    readOperations: ['POST /coverages (270)', 'GET /claim-status (276)', 'GET /remittances (835)'],
    writeOperations: ['POST /claims (837)', 'POST /attachments (Appeals)'],
    verificationStatus: 'Verified (Synthetic)',
    documentationUrl: 'https://developer.availity.com/products',
    clientIdMasked: 'availity_oauth_live_****3921'
  },
  {
    id: 'waystar',
    name: 'Waystar Enterprise Clearinghouse',
    category: 'Enterprise Clearinghouse',
    logoBadge: 'WS',
    configStatus: 'Unconfigured',
    authStatus: 'Credentials Missing',
    isMock: false,
    endpointUrl: 'https://api.waystar.com/v1/clearinghouse',
    supportedCapabilities: [
      'Claim Monitoring & Denial Prevention',
      'Predictive Denial AI Analytics',
      'Payer Contract Modeling'
    ],
    lastSync: 'Never Connected',
    dataFreshness: 'Awaiting Enterprise Client Credentials',
    recentErrors: ['401 Unauthorized: WAYSTAR_API_KEY environment variable missing.'],
    readOperations: ['GET /analytics/denials'],
    writeOperations: ['POST /claims/scrub'],
    verificationStatus: 'Unverified',
    documentationUrl: 'https://www.waystar.com/solutions/claims-management/'
  },
  {
    id: 'epic_community',
    name: 'Epic Community Connect & Care Everywhere',
    category: 'Health System Bridge',
    logoBadge: 'EP',
    configStatus: 'Unconfigured',
    authStatus: 'Awaiting OAuth',
    isMock: false,
    endpointUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    supportedCapabilities: [
      'SMART on FHIR Clinical Chart Extraction',
      'ExplanationOfBenefit FHIR Resource Sync',
      'Coverage FHIR Resource Ingestion'
    ],
    lastSync: 'Never Connected',
    dataFreshness: 'Requires Health System Partner App Registration',
    recentErrors: ['SMART on FHIR Client ID not registered with Epic USCDI portal.'],
    readOperations: ['GET /Coverage', 'GET /ExplanationOfBenefit'],
    writeOperations: ['POST /ClaimResponse'],
    verificationStatus: 'Unverified',
    documentationUrl: 'https://open.epic.com/Interface/FHIR'
  }
];

export const SYNTHETIC_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-SYN-9001',
    timestamp: '2026-10-13 11:15 CST',
    actor: 'RCM Copilot Autonomous Sentinel',
    role: 'Autonomous System Agent',
    action: 'Scrubbed 837P Claim CCN-20261013-001 against NCCI Edit Version 30.3',
    stage: 'charge_capture',
    targetId: 'CLM-SYN-8801',
    financialImpact: 4250.00,
    approvalStatus: 'Automated Rule Execution',
    dryRun: true,
    verificationHash: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    details: 'Verified separate E/M service modifier 25 validity. Clean claim score: 98%.'
  },
  {
    id: 'AUD-SYN-9002',
    timestamp: '2026-10-13 10:45 CST',
    actor: 'Admin Controller',
    role: 'Master Controller Admin',
    action: 'Approved Guarded Action ACT-GA-002: Lodge Contract Underpayment Dispute',
    stage: 'guarded_actions',
    targetId: 'ACT-GA-002',
    financialImpact: 680.00,
    approvalStatus: 'Human Supervisor Approved',
    dryRun: true,
    verificationHash: 'sha256-8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    details: 'Disputed variance on CPT 93458 under contract section 4.2.'
  },
  {
    id: 'AUD-SYN-9003',
    timestamp: '2026-10-13 10:14 CST',
    actor: 'RCM Copilot Appeals Agent',
    role: 'Autonomous System Agent',
    action: 'Proposed Level 1 Redetermination Packet for BiPAP Claim CCN-20260915-089',
    stage: 'denials_appeals',
    targetId: 'DEN-SYN-301',
    financialImpact: 1850.00,
    approvalStatus: 'Pending Human Approval (Threshold > $1,000)',
    dryRun: true,
    verificationHash: 'sha256-3829482910481948291048194829104819482910481948291048194829104819',
    details: 'Attached polysomnography test tracings and physician F2F evaluation.'
  }
];
