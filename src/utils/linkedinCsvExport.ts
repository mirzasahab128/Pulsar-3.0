import { LinkedInQueueItem } from '../types';

/**
 * Escapes values properly for CSV formats according to RFC 4180
 */
export const escapeCsvValue = (val: unknown): string => {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Formats and downloads LinkedIn connection statuses and profile details to a CSV file
 * designed for seamless external CRM management (Salesforce, HubSpot, Apollo, Close, etc.)
 */
export const exportLinkedInQueueToCSV = (
  items: LinkedInQueueItem[],
  filenamePrefix: string = 'Pulsar_LinkedIn_Outreach'
): { count: number; filename: string } => {
  const headers = [
    'Connection Status',
    'Prospect Full Name',
    'Professional Headline',
    'Practice / Organization',
    'Medical Specialty',
    'Location',
    'LinkedIn Profile URL',
    'Direct Email',
    'Direct Phone',
    'Connection Degree',
    'AI Decision Maker Status',
    'Buying Authority Level',
    'AI Confidence Score (%)',
    'AI Analysis Reasoning',
    'Dispatched Template Name',
    'Personalized Connection Note',
    'Time Added to Queue',
    'Time Dispatched',
    'Tailored Icebreaker'
  ];

  const rows = items.map(item => {
    const p = item.prospect;
    const sf = item.smartFilter;

    // Readable status formatting
    let statusLabel: string = item.status;
    if (item.status === 'accepted') statusLabel = 'Connected / Accepted';
    else if (item.status === 'sent') statusLabel = 'Request Dispatched';
    else if (item.status === 'sending') statusLabel = 'Actively Sending';
    else if (item.status === 'approved') statusLabel = 'Ready / Approved in Queue';
    else if (item.status === 'queued') statusLabel = 'Queued';
    else if (item.status === 'rejected_by_ai') statusLabel = 'Filtered by AI (Non-Buyer)';

    return [
      escapeCsvValue(statusLabel),
      escapeCsvValue(p.fullName),
      escapeCsvValue(p.headline),
      escapeCsvValue(p.practice),
      escapeCsvValue(p.specialty || 'Medical Practice Management'),
      escapeCsvValue(p.location),
      escapeCsvValue(p.linkedInUrl),
      escapeCsvValue(p.email || ''),
      escapeCsvValue(p.phone || ''),
      escapeCsvValue(p.connectionDegree || '2nd'),
      escapeCsvValue(sf ? (sf.isDecisionMaker ? 'YES (Decision Maker)' : 'NO (Non-Buyer)') : 'Unverified'),
      escapeCsvValue(sf?.authorityLevel || 'N/A'),
      escapeCsvValue(sf ? (typeof sf.confidence === 'number' ? `${sf.confidence}%` : `${sf.confidenceBand || 'unscored'} band (heuristic)`) : 'N/A'),
      escapeCsvValue(sf?.reasoning || ''),
      escapeCsvValue(item.templateName || 'Clean Claims Focus'),
      escapeCsvValue(item.personalizedNote || ''),
      escapeCsvValue(item.addedAt || ''),
      escapeCsvValue(item.sentAt || 'Pending Dispatch'),
      escapeCsvValue(p.tailoredIcebreaker || '')
    ].join(',');
  });

  // UTF-8 BOM prefix (\uFEFF) for Excel / Google Sheets compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${timestamp}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: items.length, filename };
};
