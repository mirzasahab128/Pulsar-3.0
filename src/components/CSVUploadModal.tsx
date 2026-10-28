import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  X, 
  RefreshCw, 
  Database, 
  Tag as TagIcon, 
  Check, 
  Info,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RCMLead } from '../types';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLeads: (newLeads: RCMLead[]) => void;
  existingLeads: RCMLead[];
}

// CSV Field mapping dictionary for fuzzy auto-matching
const FIELD_ALIASES: Record<keyof Omit<RCMLead, 'id' | 'status' | 'painPoints' | 'workspaceId'> | 'painPoints', string[]> = {
  practiceName: ['practicename', 'practice', 'clinic', 'facility', 'name', 'company', 'hospital', 'center'],
  doctorName: ['doctorname', 'doctor', 'physician', 'provider', 'md', 'contact', 'fullname', 'lead'],
  title: ['title', 'role', 'position', 'jobtitle'],
  specialty: ['specialty', 'speciality', 'medicalspecialty', 'department', 'type'],
  practiceSize: ['practicesize', 'size', 'physicians', 'providers', 'staff'],
  phone: ['phone', 'telephone', 'tel', 'cell', 'officephone', 'contactnumber'],
  email: ['email', 'mail', 'contactemail', 'directemail'],
  address: ['address', 'street', 'location', 'fulladdress'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'st', 'province'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'longitude', 'long'],
  ehrSystem: ['ehrsystem', 'ehr', 'emr', 'software', 'billingsoftware', 'system'],
  monthlyClaimVolume: ['monthlyclaimvolume', 'volume', 'claims', 'monthlyclaims', 'claimvolume', 'revenue'],
  painPoints: ['painpoints', 'painpoint', 'issues', 'denials', 'notes', 'problems', 'challenges'],
  tags: ['tags', 'tag', 'category', 'priority', 'labels'],
  source: ['source', 'leadsource', 'origin'],
  adminContact: ['admincontact', 'admin', 'administrator', 'manager', 'officemanager'],
  linkedInProfile: ['linkedinprofile', 'linkedin', 'profile', 'url'],
  createdAt: ['createdat', 'created', 'dateadded', 'addedat'],
  lastContacted: ['lastcontacted', 'lastcontact', 'contacted'],
  callNotesId: ['callnotesid', 'notesid'],
  auditNotes: ['auditnotes', 'audit', 'findings', 'auditfinding', 'clinicalnotes', 'notes'],
  lastVerifiedDate: ['lastverifieddate', 'verifieddate', 'verifiedat'],
  lawfulBasis: ['lawfulbasis', 'consent', 'basis', 'optin'],
  npiNumber: ['npinumber', 'npi', 'nationalprovideridentifier'],
  verified: ['verified', 'isverified', 'npiverified'],
  // Phase 4: provenance/simulated are set by the pipeline, never from CSV
  // columns — empty alias lists keep them unmappable here.
  provenance: [],
  simulated: []
};

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({
  isOpen,
  onClose,
  onAddLeads,
  existingLeads
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [defaultTag, setDefaultTag] = useState<string>('Target');

  if (!isOpen) return null;

  // Robust CSV Parser capable of handling quotes, commas inside fields, and multi-line items
  const parseCSVText = (text: string) => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    // Normalize Windows CRLF to LF
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const nextChar = normalized[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentLine += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    // Parse each line into columns
    const parsedGrid: string[][] = lines.map(line => {
      const row: string[] = [];
      let cell = '';
      let cellInQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        const nextC = line[j + 1];

        if (c === '"') {
          if (cellInQuotes && nextC === '"') {
            cell += '"';
            j++;
          } else {
            cellInQuotes = !cellInQuotes;
          }
        } else if (c === ',' && !cellInQuotes) {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += c;
        }
      }
      row.push(cell.trim());
      return row;
    });

    const headers = parsedGrid[0].map(h => h.replace(/^\uFEFF/, '').trim());
    const dataRows = parsedGrid.slice(1);

    return { headers, dataRows };
  };

  // Process File selection
  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setParsingError('Please upload a valid .csv file.');
      return;
    }

    setParsingError(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, dataRows } = parseCSVText(text);

        setRawHeaders(headers);
        setRawRows(dataRows);

        // Auto-match headers to Lead fields
        const autoMapping: Record<string, string> = {};
        headers.forEach(header => {
          const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
            if (aliases.some(a => cleanHeader === a || cleanHeader.includes(a))) {
              autoMapping[header] = field;
              break;
            }
          }
        });

        setColumnMapping(autoMapping);
      } catch (err: any) {
        setParsingError(err.message || 'Failed to parse CSV file. Ensure it is formatted properly.');
      }
    };
    reader.readAsText(selectedFile);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Download Sample CSV template
  const handleDownloadSample = () => {
    const sampleHeaders = [
      'Practice Name',
      'Doctor Name',
      'Title',
      'Specialty',
      'Practice Size',
      'Phone',
      'Email',
      'Address',
      'State',
      'EHR System',
      'Monthly Claim Volume',
      'Pain Points',
      'Admin Contact'
    ];

    const sampleRows = [
      [
        '"Lone Star Cardiology Associates"',
        '"Dr. Robert Hayes, MD"',
        '"Managing Partner"',
        '"Cardiology"',
        '"5 Physicians, 3 PAs"',
        '"(512) 441-2090"',
        '"rhayes@lonestarcardiology.com"',
        '"3801 S Congress Ave, Austin, TX 78704"',
        '"TX"',
        '"AthenaHealth"',
        '"$520,000 / mo (approx. 2,100 claims)"',
        '"EHR surgical modifier 59 denials lingering over 60 days; understaffed billing"',
        '"Laura Jenkins - Clinic Manager"'
      ],
      [
        '"Pacific Coast Orthopedic Center"',
        '"Dr. Claire Sun, MD"',
        '"Chief of Orthopedic Surgery"',
        '"Orthopedic Surgery"',
        '"8 Surgeons, 2 Surgery Centers"',
        '"(415) 890-3310"',
        '"csun@pacificorthocenter.com"',
        '"1800 Sullivan Ave, Daly City, CA 94015"',
        '"CA"',
        '"eClinicalWorks"',
        '"$980,000 / mo (approx. 3,800 claims)"',
        '"Out-of-network surgical fee schedule disputes; high aging AR over 90 days"',
        '"Marcus Reed - Director of Revenue Cycle"'
      ],
      [
        '"Sunshine Pediatric Health Care"',
        '"Dr. Mateo Gomez, MD, FAAP"',
        '"Pediatrician & Founder"',
        '"Pediatrics"',
        '"4 Doctors, 2 Nurse Practitioners"',
        '"(305) 672-1144"',
        '"mgomez@sunshinepedsmiami.com"',
        '"1680 Meridian Ave, Miami Beach, FL 33139"',
        '"FL"',
        '"Epic (Community Connect)"',
        '"$340,000 / mo (approx. 2,400 claims)"',
        '"Medicaid HMO vaccine administration rate disputes; prior auth delays"',
        '"Maria Santos - Practice Administrator"'
      ]
    ];

    const content = '\uFEFF' + [sampleHeaders.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Pulsar_Sample_Medical_Leads_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convert parsed rows into RCMLead objects
  const handleImportLeads = () => {
    setIsProcessing(true);
    try {
      const newLeads: RCMLead[] = [];
      const existingNames = new Set(existingLeads.map(l => l.practiceName.toLowerCase().trim()));
      const existingEmails = new Set(existingLeads.map(l => l.email.toLowerCase().trim()).filter(Boolean));

      rawRows.forEach((row, idx) => {
        const rowData: Record<string, string> = {};
        rawHeaders.forEach((header, colIdx) => {
          const field = columnMapping[header];
          if (field) {
            rowData[field] = row[colIdx] || '';
          }
        });

        const practiceName = rowData.practiceName?.trim() || `Healthcare Account #${idx + 1}`;
        const email = rowData.email?.trim() || '';

        // Duplicate check
        if (skipDuplicates) {
          if (existingNames.has(practiceName.toLowerCase())) return;
          if (email && existingEmails.has(email.toLowerCase())) return;
        }

        // Parse pain points
        let painPoints: string[] = [];
        if (rowData.painPoints) {
          painPoints = rowData.painPoints
            .split(/[;|\n]/)
            .map(p => p.trim())
            .filter(Boolean);
        }
        if (painPoints.length === 0) {
          painPoints = ['Claim denial rate above national specialty benchmark', 'Excessive days in AR (>45 days)'];
        }

        // Tags
        const tags: string[] = [defaultTag];
        if (rowData.tags) {
          rowData.tags.split(/[,;|]/).forEach(t => {
            const cleanT = t.trim();
            if (cleanT && !tags.includes(cleanT)) tags.push(cleanT);
          });
        }

        const lead: RCMLead = {
          id: `csv-lead-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          practiceName,
          doctorName: rowData.doctorName?.trim() || 'Medical Director',
          title: rowData.title?.trim() || 'Physician Partner',
          specialty: rowData.specialty?.trim() || 'General Medical Practice',
          practiceSize: rowData.practiceSize?.trim() || '3-5 Providers',
          phone: rowData.phone?.trim() || '(800) 555-0199',
          email: email || `contact@${practiceName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'clinic'}.com`,
          address: rowData.address?.trim() || 'US Medical Plaza',
          state: rowData.state?.toUpperCase().trim() || 'TX',
          ehrSystem: rowData.ehrSystem?.trim() || 'AthenaHealth',
          monthlyClaimVolume: rowData.monthlyClaimVolume?.trim() || '$350,000 / mo',
          painPoints,
          tags,
          adminContact: rowData.adminContact?.trim() || 'Practice Administrator',
          linkedInProfile: rowData.linkedInProfile?.trim() || undefined,
          source: 'CSV Bulk Upload',
          status: 'Ready for Call'
        };

        newLeads.push(lead);
      });

      if (newLeads.length === 0) {
        setParsingError('No new leads were imported (all rows may have been flagged as duplicates or empty).');
        setIsProcessing(false);
        return;
      }

      onAddLeads(newLeads);
      onClose();
    } catch (err: any) {
      setParsingError(err.message || 'Failed to assemble leads from CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl glass-modal border border-white/15 rounded-2xl shadow-2xl text-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Bulk CSV Lead Importer</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Instant Auto-Mapping
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload your external medical lead spreadsheets, NPI scrubs, or CRM exports directly into Pulsar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* File Upload Drag & Drop Zone */}
          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? 'border-teal-400 bg-teal-950/30 ring-2 ring-teal-400/30' 
                  : 'border-white/20 hover:border-teal-400/70 bg-slate-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-lg">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Drag & drop your CSV file here, or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Supports standard CSV with headers (Practice, Doctor, Phone, EHR, Volume, State)</p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSample();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-white/10 text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-teal-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs sm:text-sm">{file.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB • {rawRows.length} prospects identified • {rawHeaders.length} columns detected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setRawHeaders([]);
                  setRawRows([]);
                  setColumnMapping({});
                }}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Change File</span>
              </button>
            </div>
          )}

          {parsingError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{parsingError}</span>
            </div>
          )}

          {/* Column Auto-Mapping Section (Shown once file is uploaded) */}
          {rawHeaders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span>Column Mapping & Verification</span>
                </h4>
                <span className="text-[11px] text-teal-400 font-mono">
                  {Object.keys(columnMapping).length} / {rawHeaders.length} Columns Mapped
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[160px] overflow-y-auto p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
                {rawHeaders.map((header) => {
                  const mappedField = columnMapping[header] || '';
                  return (
                    <div key={header} className="p-2 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono truncate" title={header}>
                        CSV: <strong className="text-white">{header}</strong>
                      </div>
                      <select
                        value={mappedField}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-[11px] text-teal-300 focus:outline-none"
                      >
                        <option value="">-- Ignore Column --</option>
                        <option value="practiceName">Practice Name *</option>
                        <option value="doctorName">Doctor Name</option>
                        <option value="title">Title / Role</option>
                        <option value="specialty">Medical Specialty</option>
                        <option value="phone">Phone Number</option>
                        <option value="email">Direct Email</option>
                        <option value="address">Address</option>
                        <option value="state">US State</option>
                        <option value="ehrSystem">EHR System</option>
                        <option value="monthlyClaimVolume">Claim Volume</option>
                        <option value="painPoints">Pain Points</option>
                        <option value="adminContact">Admin Contact</option>
                        <option value="tags">Lead Tags</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* First 5 Rows Preview Table */}
          {rawRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-wider">
                  Data Preview (First 5 Rows):
                </span>
                <span className="text-[11px] text-slate-400">
                  Ready to import <strong className="text-white">{rawRows.length}</strong> prospects
                </span>
              </div>

              <div className="border border-white/10 rounded-xl overflow-x-auto bg-slate-950/70">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 bg-slate-900/80 font-mono">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Practice Name</th>
                      <th className="py-2 px-3">Doctor</th>
                      <th className="py-2 px-3">Specialty</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">EHR</th>
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {rawRows.slice(0, 5).map((row, idx) => {
                      const getVal = (field: string) => {
                        const h = Object.keys(columnMapping).find(k => columnMapping[k] === field);
                        if (!h) return '—';
                        const colIdx = rawHeaders.indexOf(h);
                        return row[colIdx] || '—';
                      };

                      return (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-white">{getVal('practiceName')}</td>
                          <td className="py-2 px-3 text-teal-300">{getVal('doctorName')}</td>
                          <td className="py-2 px-3">{getVal('specialty')}</td>
                          <td className="py-2 px-3 font-mono text-emerald-400">{getVal('phone')}</td>
                          <td className="py-2 px-3 font-mono text-cyan-300">{getVal('ehrSystem')}</td>
                          <td className="py-2 px-3 font-mono">{getVal('state')}</td>
                          <td className="py-2 px-3 font-mono text-emerald-300">{getVal('monthlyClaimVolume')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Settings & Default Tagging */}
          {rawRows.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded bg-slate-950 border-white/20 text-teal-500 focus:ring-0"
                  />
                  <span>Skip duplicate practice names / emails</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Assign Default Tag:</span>
                  <select
                    value={defaultTag}
                    onChange={(e) => setDefaultTag(e.target.value)}
                    className="bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white"
                  >
                    <option value="Target">Target (High Priority)</option>
                    <option value="VIP Practice">VIP Practice</option>
                    <option value="Follow-up Needed">Follow-up Needed</option>
                    <option value="High Denial Rate">High Denial Rate</option>
                  </select>
                </div>
              </div>

              <div className="font-mono text-teal-400 font-semibold text-right">
                + {rawRows.length} Leads to Add
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={rawRows.length === 0 || isProcessing}
            onClick={handleImportLeads}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs font-black shadow-lg shadow-teal-500/25 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            <span>{isProcessing ? 'Importing Leads...' : `Confirm & Import ${rawRows.length} Leads`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
