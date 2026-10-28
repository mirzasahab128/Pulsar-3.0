/**
 * Google Forms API Client Service for Pulsar
 *
 * Implements client-side token pattern to communicate with Google Forms API and Google Drive API:
 * - https://www.googleapis.com/auth/forms.body
 * - https://www.googleapis.com/auth/forms.body.readonly
 * - https://www.googleapis.com/auth/forms.responses.readonly
 * - https://www.googleapis.com/auth/drive.readonly
 * - https://www.googleapis.com/auth/drive.file
 *
 * Tokens are held strictly in-memory per security constitution.
 */

export interface GoogleFormQuestionChoice {
  value: string;
}

export interface GoogleFormQuestion {
  questionId?: string;
  required?: boolean;
  textQuestion?: {
    paragraph?: boolean;
  };
  choiceQuestion?: {
    type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
    options: GoogleFormQuestionChoice[];
    shuffle?: boolean;
  };
  scaleQuestion?: {
    low: number;
    high: number;
    lowLabel?: string;
    highLabel?: string;
  };
}

export interface GoogleFormItem {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: {
    question: GoogleFormQuestion;
  };
  pageBreakItem?: Record<string, unknown>;
  textItem?: Record<string, unknown>;
}

export interface GoogleFormInfo {
  title: string;
  documentTitle?: string;
  description?: string;
}

export interface GoogleForm {
  formId: string;
  info: GoogleFormInfo;
  revisionId?: string;
  responderUri?: string;
  items?: GoogleFormItem[];
  linkedSheetId?: string;
}

export interface GoogleFormResponseAnswer {
  questionId?: string;
  textAnswers?: {
    answers: { value: string }[];
  };
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  respondentEmail?: string;
  answers?: Record<string, GoogleFormResponseAnswer>;
}

export interface DriveFormFile {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  description?: string;
  responderUri?: string;
  responseCount?: number;
}

const FORMS_API_BASE = 'https://forms.googleapis.com/v1/forms';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

class GoogleFormsService {
  /**
   * Helper to execute authorized Google Workspace requests
   */
  private async request<T>(url: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      let errorMsg = `Google Forms / Drive API error (${response.status} ${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use fallback message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  /**
   * List Google Forms accessible by the user from Google Drive
   */
  async listForms(accessToken: string): Promise<DriveFormFile[]> {
    // Query Google Drive for Google Forms files that are not in trash
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false");
    const fields = encodeURIComponent('files(id,name,createdTime,modifiedTime,webViewLink,description)');
    const url = `${DRIVE_API_BASE}?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=50`;

    const res = await this.request<{ files?: DriveFormFile[] }>(url, accessToken);
    return res.files || [];
  }

  /**
   * Get complete details and question items of a specific Google Form
   */
  async getForm(formId: string, accessToken: string): Promise<GoogleForm> {
    const safeFormId = encodeURIComponent(formId.trim());
    const url = `${FORMS_API_BASE}/${safeFormId}`;
    return this.request<GoogleForm>(url, accessToken);
  }

  /**
   * Create a new Google Form
   */
  async createForm(title: string, documentTitle: string, accessToken: string): Promise<GoogleForm> {
    const payload = {
      info: {
        title,
        documentTitle: documentTitle || title
      }
    };

    return this.request<GoogleForm>(FORMS_API_BASE, accessToken, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Execute batch update on a form (add questions, update titles, rearrange items)
   */
  async batchUpdate(formId: string, requests: any[], accessToken: string): Promise<any> {
    const safeFormId = encodeURIComponent(formId.trim());
    const url = `${FORMS_API_BASE}/${safeFormId}:batchUpdate`;

    return this.request(url, accessToken, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  /**
   * List all submitted responses for a form
   */
  async listResponses(formId: string, accessToken: string): Promise<GoogleFormResponse[]> {
    const safeFormId = encodeURIComponent(formId.trim());
    const url = `${FORMS_API_BASE}/${safeFormId}/responses`;
    const res = await this.request<{ responses?: GoogleFormResponse[] }>(url, accessToken);
    return res.responses || [];
  }

  /**
   * Delete a form (Permanently moves form to Google Drive trash or deletes it)
   * Note: Destructive action — must be gated by GoogleWorkspaceConfirmModal
   */
  async deleteForm(formId: string, accessToken: string): Promise<void> {
    const safeFormId = encodeURIComponent(formId.trim());
    const url = `${DRIVE_API_BASE}/${safeFormId}`;
    await this.request(url, accessToken, {
      method: 'DELETE'
    });
  }

  /**
   * Fast Provisioning: Generate specialized Pulsar Client Questionnaires & Audits
   */
  async createPresetForm(
    presetType: '50_claim_audit' | 'clinical_denial' | 'niche_discovery' | 'provider_onboarding',
    practiceName: string,
    accessToken: string
  ): Promise<GoogleForm> {
    let title = 'Pulsar 50-Claim Diagnostic Billing Audit Questionnaire';
    let docTitle = `Pulsar Audit - ${practiceName || 'Healthcare Provider'}`;
    let description = 'Please complete this questionnaire to initiate your complimentary 50-claim revenue cycle audit, denial analysis, and AR recovery projection.';
    
    interface QuestionSpec {
      title: string;
      description?: string;
      type: 'TEXT' | 'PARAGRAPH' | 'RADIO' | 'CHECKBOX' | 'SCALE';
      options?: string[];
      required?: boolean;
    }

    let questions: QuestionSpec[] = [];

    switch (presetType) {
      case '50_claim_audit':
        title = `Pulsar 50-Claim Clinical Billing Audit: ${practiceName || 'Practice'}`;
        docTitle = `50-Claim Audit - ${practiceName || 'Medical Practice'}`;
        description = 'Official intake form for Pulsar Autonomous RCM 50-Claim Diagnostic Audit. Identify unpaid claims, aging balances past 60 days, and coding overturn potential.';
        questions = [
          {
            title: '1. Primary Practice Legal Name & NPI Number',
            description: 'Enter organizational NPI or group billing NPI',
            type: 'TEXT',
            required: true
          },
          {
            title: '2. Primary EHR / Practice Management (PM) System',
            type: 'RADIO',
            options: ['Epic Systems', 'eClinicalWorks', 'AthenaHealth', 'NextGen Healthcare', 'Cerner / Oracle Health', 'AdvancedMD', 'Kareo / Tebra', 'Other'],
            required: true
          },
          {
            title: '3. Estimated Monthly Gross Claims Billed Volume',
            type: 'RADIO',
            options: ['Under $250,000 / month', '$250,000 – $600,000 / month', '$600,000 – $1,200,000 / month', '$1.2M – $2.5M / month', 'Over $2.5M / month'],
            required: true
          },
          {
            title: '4. Current Claim Denial / Rejection Rate Estimate',
            type: 'RADIO',
            options: ['Under 5% (Healthy)', '5% – 9% (Industry Average)', '10% – 15% (Significant Revenue Leakage)', 'Over 15% (Critical Denial Backlog)', 'Not actively monitored'],
            required: true
          },
          {
            title: '5. Primary Denial Categories Experienced Most Frequently',
            type: 'CHECKBOX',
            options: [
              'Medical Necessity / Clinical Documentation Lack',
              'Prior Authorization Missing or Expired',
              'Coordination of Benefits (COB) Invalidation',
              'Timely Filing Limit Exceeded (Aging 90+ Days)',
              'Modifier Incompatibilities (e.g. Mod 25 / 59)',
              'Payer Eligibility / Inactive Coverage at DOS'
            ],
            required: true
          },
          {
            title: '6. Average Days in Accounts Receivable (AR Days)',
            type: 'RADIO',
            options: ['Under 32 days', '33 – 45 days', '46 – 60 days', 'Over 60 days (High Bad Debt Risk)'],
            required: false
          },
          {
            title: '7. Chief Contact for Audit Findings Review (Name, Title, Direct Phone & Email)',
            type: 'PARAGRAPH',
            required: true
          }
        ];
        break;

      case 'clinical_denial':
        title = `Pulsar Complex Denial Overturn Assessment: ${practiceName || 'Provider Group'}`;
        docTitle = `Denial Assessment - ${practiceName || 'Provider'}`;
        description = 'Evaluate complex commercial and Medicare Advantage denial overturning feasibility with Pulsar autonomous clinical agents.';
        questions = [
          {
            title: '1. Which payers represent the highest percentage of recurring denials?',
            type: 'CHECKBOX',
            options: ['UnitedHealthcare', 'Blue Cross Blue Shield (Elevance / Anthem)', 'Aetna / CVS Health', 'Cigna Healthcare', 'Humana Medicare Advantage', 'State Medicaid Plans'],
            required: true
          },
          {
            title: '2. Do you currently have staff dedicated strictly to denial appeals?',
            type: 'RADIO',
            options: ['Yes, in-house dedicated team (1-3 specialists)', 'Yes, in-house team (4+ specialists)', 'No, front-office handles as time permits', 'Outsourced to standard vendor'],
            required: true
          },
          {
            title: '3. What percentage of initial appeal submissions get approved without secondary arbitration?',
            type: 'RADIO',
            options: ['Less than 30%', '30% – 50%', '50% – 75%', 'Over 75%', 'Unknown'],
            required: false
          },
          {
            title: '4. Summary of largest outstanding unpaid claim balance or recurring CARC/RARC code',
            type: 'PARAGRAPH',
            required: false
          }
        ];
        break;

      case 'niche_discovery':
        title = `Pulsar Business Growth Discovery Questionnaire: ${practiceName || 'Enterprise Partner'}`;
        docTitle = `Discovery - ${practiceName || 'Enterprise'}`;
        description = 'Strategic intake for evaluating sales pipeline automation, prospect discovery, and outbound outreach acceleration.';
        questions = [
          {
            title: '1. Primary Business Niche / Target Market',
            type: 'RADIO',
            options: ['Healthcare & Medical Billing', 'Real Estate & Acquisitions', 'B2B SaaS & Tech', 'Recruitment & Staffing', 'Professional Services'],
            required: true
          },
          {
            title: '2. What is your primary bottleneck in business development?',
            type: 'CHECKBOX',
            options: ['Finding verified decision-maker contact numbers', 'Time wasted on cold dials and gatekeepers', 'Connecting with interested prospects live', 'Consistent follow-up after initial demo'],
            required: true
          },
          {
            title: '3. Target Monthly Qualified Meetings or Audits Goal',
            type: 'RADIO',
            options: ['5 – 10 meetings / month', '11 – 25 meetings / month', '26 – 50 meetings / month', '50+ enterprise meetings / month'],
            required: true
          },
          {
            title: '4. Primary Decision-Maker Titles Targeted in Campaigns',
            type: 'TEXT',
            required: false
          }
        ];
        break;

      case 'provider_onboarding':
      default:
        title = `Pulsar Provider Onboarding & Credentialing Intake: ${practiceName || 'New Client'}`;
        docTitle = `Onboarding - ${practiceName || 'Practice'}`;
        description = 'Collect credentialing details, clearinghouse setup information, and practice banking preferences for automated revenue cycle management.';
        questions = [
          {
            title: '1. Medical Director / Managing Partner Full Name & NPI',
            type: 'TEXT',
            required: true
          },
          {
            title: '2. Medical Specialty & Sub-Specialties',
            type: 'TEXT',
            required: true
          },
          {
            title: '3. Current Clearinghouse Utilized',
            type: 'RADIO',
            options: ['Change Healthcare / Optum', 'Availity', 'Waystar', 'Office Ally', 'Trizetto', 'Other / Direct Payer Portals'],
            required: true
          },
          {
            title: '4. Practice Physical Address and Billing Locations',
            type: 'PARAGRAPH',
            required: true
          },
          {
            title: '5. Direct Point of Contact for Daily 4 PM PST Briefing Dispatch',
            type: 'TEXT',
            required: true
          }
        ];
        break;
    }

    // Step 1: Create the base form
    const createdForm = await this.createForm(title, docTitle, accessToken);
    const formId = createdForm.formId;

    // Step 2: Build batch update requests for description and questions
    const requests: any[] = [];

    // Update Form Info Description
    requests.push({
      updateFormInfo: {
        info: {
          description
        },
        updateMask: 'description'
      }
    });

    // Create each question item
    questions.forEach((q, index) => {
      const questionPayload: any = {
        required: q.required || false
      };

      if (q.type === 'TEXT') {
        questionPayload.textQuestion = { paragraph: false };
      } else if (q.type === 'PARAGRAPH') {
        questionPayload.textQuestion = { paragraph: true };
      } else if (q.type === 'RADIO' || q.type === 'CHECKBOX') {
        questionPayload.choiceQuestion = {
          type: q.type,
          options: (q.options || ['Option 1', 'Option 2']).map(val => ({ value: val })),
          shuffle: false
        };
      } else if (q.type === 'SCALE') {
        questionPayload.scaleQuestion = {
          low: 1,
          high: 5,
          lowLabel: 'Poor',
          highLabel: 'Excellent'
        };
      }

      requests.push({
        createItem: {
          item: {
            title: q.title,
            description: q.description || '',
            questionItem: {
              question: questionPayload
            }
          },
          location: {
            index
          }
        }
      });
    });

    // Execute batch update
    await this.batchUpdate(formId, requests, accessToken);

    // Return the updated form
    return this.getForm(formId, accessToken);
  }
}

export const googleFormsService = new GoogleFormsService();
