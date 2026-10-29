import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  PhoneCall, 
  Download, 
  Sparkles, 
  MapPin, 
  Building2, 
  Stethoscope, 
  Mail, 
  Phone, 
  FileSpreadsheet, 
  CheckCircle2, 
  ExternalLink, 
  PlusCircle, 
  Database, 
  RefreshCw, 
  Flame, 
  Tag as TagIcon, 
  X, 
  Plus, 
  ChevronDown,
  ArrowRight,
  Radio,
  PhoneForwarded,
  Clock,
  Voicemail,
  XCircle,
  Activity,
  Layers,
  UploadCloud,
  Send,
  Map as MapIcon,
  FileText,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  Square,
  Zap,
  Sliders,
  AlertCircle,
  RotateCcw,
  Infinity
} from 'lucide-react';
import { RCMLead, LeadTag, MeetingNote, ContinuousScrapeStatus, ScrapeBatchInfo } from '../types';
import { apiService } from '../services/api';
import { ContinuousLeadScraper } from '../services/leadScrapingService';
import { USLeadDensityMap } from './USLeadDensityMap';
import { EmailOutreachModal } from './EmailOutreachModal';
import { CSVUploadModal } from './CSVUploadModal';
import { LeadStatusDistributionChart } from './LeadStatusDistributionChart';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export const LEAD_TAGS_CONFIG: { 
  name: string; 
  badgeClass: string; 
  dotClass: string; 
  desc: string; 
}[] = [
  { 
    name: 'Target', 
    badgeClass: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/25', 
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    desc: 'High-priority outreach prospect'
  },
  { 
    name: 'Do Not Call', 
    badgeClass: 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/25', 
    dotClass: 'bg-rose-500 dark:bg-rose-400',
    desc: 'Exclusion list / requested no contact'
  },
  { 
    name: 'Follow-up Needed', 
    badgeClass: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/25', 
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    desc: 'Requires callback or audit follow-up'
  },
  { 
    name: 'VIP Practice', 
    badgeClass: 'bg-purple-50 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/25', 
    dotClass: 'bg-purple-500 dark:bg-purple-400',
    desc: 'High claim volume medical center'
  },
  { 
    name: 'High Denial Rate', 
    badgeClass: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/25', 
    dotClass: 'bg-cyan-500 dark:bg-cyan-400',
    desc: '>15% claim denials detected'
  }
];

export const LEAD_STATUS_CONFIG: {
  status: RCMLead['status'];
  label: string;
  badgeClass: string;
  dotClass: string;
  glowColor: string;
  iconName: string;
  nextStatus?: RCMLead['status'];
}[] = [
  {
    status: 'Ready for Call',
    label: 'Ready for Call',
    badgeClass: 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500',
    dotClass: 'bg-slate-500 dark:bg-slate-400',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    iconName: 'phone',
    nextStatus: 'Calling'
  },
  {
    status: 'Calling',
    label: 'Dialing / Calling',
    badgeClass: 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 hover:bg-teal-100 dark:hover:bg-teal-500/25',
    dotClass: 'bg-teal-500 dark:bg-teal-400 animate-ping',
    glowColor: 'rgba(20, 184, 166, 0.8)',
    iconName: 'radio',
    nextStatus: 'Transferred to Manager'
  },
  {
    status: 'Transferred to Manager',
    label: 'Warm Transferred',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/10',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    glowColor: 'rgba(16, 185, 129, 0.85)',
    iconName: 'phone-forwarded',
    nextStatus: 'Audit Scheduled'
  },
  {
    status: 'Audit Scheduled',
    label: 'Audit Booked',
    badgeClass: 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/30 shadow-sm shadow-amber-500/10',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.85)',
    iconName: 'check-circle-2',
    nextStatus: 'Follow-up'
  },
  {
    status: 'Follow-up',
    label: 'Follow-Up Needed',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 hover:bg-indigo-100 dark:hover:bg-indigo-500/30',
    dotClass: 'bg-indigo-500 dark:bg-indigo-400',
    glowColor: 'rgba(99, 102, 241, 0.75)',
    iconName: 'clock',
    nextStatus: 'Audit Scheduled'
  },
  {
    status: 'Voicemail',
    label: 'Voicemail Left',
    badgeClass: 'bg-orange-50 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/25',
    dotClass: 'bg-orange-500 dark:bg-orange-400',
    glowColor: 'rgba(249, 115, 22, 0.75)',
    iconName: 'voicemail',
    nextStatus: 'Follow-up'
  },
  {
    status: 'Not Interested',
    label: 'Not Interested',
    badgeClass: 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/25',
    dotClass: 'bg-rose-500 dark:bg-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.75)',
    iconName: 'x-circle'
  }
];

export const getStatusConfig = (status: string) => {
  const match = LEAD_STATUS_CONFIG.find(s => s.status.toLowerCase() === status.toLowerCase());
  if (match) return match;
  return {
    status: status as any,
    label: status,
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-500 dark:bg-slate-400',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    iconName: 'phone',
    nextStatus: undefined
  };
};

export const getTagConfig = (tag: string) => {
  const match = LEAD_TAGS_CONFIG.find(t => t.name.toLowerCase() === tag.toLowerCase());
  if (match) return match;
  return {
    name: tag,
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700',
    dotClass: 'bg-slate-500 dark:bg-slate-400',
    desc: 'Custom tag'
  };
};

interface LeadScraperProps {
  leads: RCMLead[];
  meetingNotes?: MeetingNote[];
  onSelectLeadForCall: (lead: RCMLead) => void;
  onAddLeads: (newLeads: RCMLead[]) => void;
  onUpdateLeadTags?: (leadId: string, tags: string[]) => void;
  onUpdateLeadStatus?: (leadId: string, status: RCMLead['status']) => void;
  onUpdateLeadAuditNotes?: (leadId: string, auditNotes: string) => void;
}

export const LeadScraper: React.FC<LeadScraperProps> = ({
  leads,
  meetingNotes,
  onSelectLeadForCall,
  onAddLeads,
  onUpdateLeadTags,
  onUpdateLeadStatus,
  onUpdateLeadAuditNotes
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [specialtyFilter, setSpecialtyFilter] = useState<string>('All');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [newlyScrapedIds, setNewlyScrapedIds] = useState<Set<string>>(new Set());
  const [selectedLead, setSelectedLead] = useState<RCMLead | null>(null);
  const [auditNotesInput, setAuditNotesInput] = useState<string>('');
  const [auditNotesSavedNotice, setAuditNotesSavedNotice] = useState<boolean>(false);
  const [activeTagDropdownLeadId, setActiveTagDropdownLeadId] = useState<string | null>(null);
  const [activeStatusDropdownLeadId, setActiveStatusDropdownLeadId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [exportNotice, setExportNotice] = useState<boolean>(false);
  const [exportNoticeMessage, setExportNoticeMessage] = useState<string>('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'map' | 'both'>('table');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailModalLead, setEmailModalLead] = useState<RCMLead | null>(null);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState<boolean>(false);

  // Status Change Animations tracking
  const prevStatusesRef = useRef<Record<string, string>>({});
  const [statusChanges, setStatusChanges] = useState<Record<string, { prev: string; current: string; timestamp: number }>>({});

  // Detect when lead statuses change (e.g. from CallStudio, warm transfer, or manual selection)
  useEffect(() => {
    const currentMap: Record<string, string> = {};
    const newChanges: Record<string, { prev: string; current: string; timestamp: number }> = {};
    let hasChange = false;

    leads.forEach(l => {
      currentMap[l.id] = l.status;
      const oldStatus = prevStatusesRef.current[l.id];
      if (oldStatus && oldStatus !== l.status) {
        newChanges[l.id] = { prev: oldStatus, current: l.status, timestamp: Date.now() };
        hasChange = true;
      }
    });

    if (hasChange) {
      setStatusChanges(prev => ({ ...prev, ...newChanges }));
      const timer = setTimeout(() => {
        setStatusChanges(prev => {
          const next = { ...prev };
          Object.keys(newChanges).forEach(id => delete next[id]);
          return next;
        });
      }, 2200);
      return () => clearTimeout(timer);
    }

    prevStatusesRef.current = currentMap;
  }, [leads]);

  // States and specialties
  const US_STATES = ['All', 'TX', 'CA', 'FL', 'NY', 'IL', 'WA', 'GA', 'MA', 'OH', 'AZ'];
  const SPECIALTIES = [
    'All',
    'Cardiology',
    'Orthopedic Surgery',
    'Pediatrics',
    'Pathology & Diagnostic Labs',
    'Dermatology',
    'Community Hospital',
    'Internal Medicine'
  ];

  // Filter leads with deduplication to guarantee unique keys across rendering
  const filteredLeads = useMemo<RCMLead[]>(() => {
    const seenIds = new Set<string>();
    return leads.filter((lead: RCMLead) => {
      if (!lead || !lead.id || seenIds.has(lead.id)) {
        return false;
      }
      seenIds.add(lead.id);

      const matchSpecialty = specialtyFilter === 'All' || lead.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());
      const matchState = stateFilter === 'All' || lead.state.toLowerCase() === stateFilter.toLowerCase();
      const matchTag = tagFilter === 'All' || (lead.tags && lead.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase()));
      const matchStatus = statusFilter === 'All' || lead.status.toLowerCase() === statusFilter.toLowerCase();
      const matchQuery = 
        lead.practiceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.ehrSystem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.tags && lead.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchSpecialty && matchState && matchTag && matchStatus && matchQuery;
    });
  }, [leads, specialtyFilter, stateFilter, tagFilter, statusFilter, searchQuery]);

  // Pagination State (Prevents UI lag and memory issues by windowing DOM rendering)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8); // Default 8 items per page
  const PAGE_SIZE_OPTIONS = [5, 8, 10, 20, 50];

  const totalLeads = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));

  // Reset to page 1 whenever search, filters, or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [specialtyFilter, stateFilter, tagFilter, statusFilter, searchQuery, pageSize]);

  // Ensure currentPage is within bounds if leads are deleted or filtered
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalLeads);

  // Paginated leads slice: Only these items are rendered and animated to prevent UI lag & memory leaks
  const paginatedLeads = useMemo<RCMLead[]>(() => {
    return filteredLeads.slice(startIndex, endIndex);
  }, [filteredLeads, startIndex, endIndex]);

  // Continuous Scrape (Perpetual Lead Pipeline) State & Ref
  const [isContinuousScraping, setIsContinuousScraping] = useState<boolean>(false);
  const [isContinuousPaused, setIsContinuousPaused] = useState<boolean>(false);
  const [continuousStatus, setContinuousStatus] = useState<ContinuousScrapeStatus>('Idle');
  const [currentScrapeBatch, setCurrentScrapeBatch] = useState<ScrapeBatchInfo | null>(null);
  const [continuousBatchesCount, setContinuousBatchesCount] = useState<number>(0);
  const [continuousLeadsAddedCount, setContinuousLeadsAddedCount] = useState<number>(0);
  const [continuousBatchSize, setContinuousBatchSize] = useState<number>(5);
  const [continuousIntervalMs, setContinuousIntervalMs] = useState<number>(2500);
  const [showContinuousSettings, setShowContinuousSettings] = useState<boolean>(false);
  const scraperInstanceRef = useRef<ContinuousLeadScraper | null>(null);

  // Clean up continuous scraper on component unmount
  useEffect(() => {
    return () => {
      if (scraperInstanceRef.current) {
        scraperInstanceRef.current.stop();
        scraperInstanceRef.current = null;
      }
    };
  }, []);

  // Continuous Scrape Handlers: Automatically queues next batch when previous hits 'Completed'
  const handleStartContinuousScrape = () => {
    if (scraperInstanceRef.current) {
      scraperInstanceRef.current.stop();
    }

    const scraper = new ContinuousLeadScraper({
      batchSize: continuousBatchSize,
      intervalDelayMs: continuousIntervalMs,
      targetSpecialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
      targetState: stateFilter !== 'All' ? stateFilter : undefined,
      query: searchQuery || undefined,
      autoProcessDelayMs: 1200,
    });

    scraperInstanceRef.current = scraper;

    scraper.subscribe({
      onStatusChange: (status, batch) => {
        setContinuousStatus(status);
        if (batch) setCurrentScrapeBatch({ ...batch });
      },
      onBatchQueued: (_num, batch) => {
        setCurrentScrapeBatch({ ...batch });
      },
      onBatchScraping: (_num, batch) => {
        setCurrentScrapeBatch({ ...batch });
      },
      onBatchProcessing: (_num, batch) => {
        setCurrentScrapeBatch({ ...batch });
      },
      onBatchCompleted: (_num, batch) => {
        setContinuousBatchesCount(prev => prev + 1);
        setCurrentScrapeBatch({ ...batch });
      },
      onLeadsDelivered: (newLeads, _batch) => {
        setContinuousLeadsAddedCount(prev => prev + newLeads.length);
        setNewlyScrapedIds(new Set(newLeads.map(l => l.id)));
        onAddLeads(newLeads);
      },
      onError: (err, num) => {
        console.warn(`Continuous scraper batch #${num} encountered an error:`, err);
      }
    });

    scraper.start();
    setIsContinuousScraping(true);
    setIsContinuousPaused(false);
  };

  const handlePauseContinuousScrape = () => {
    if (scraperInstanceRef.current) {
      scraperInstanceRef.current.pause();
      setIsContinuousPaused(true);
    }
  };

  const handleResumeContinuousScrape = () => {
    if (scraperInstanceRef.current) {
      scraperInstanceRef.current.resume();
      setIsContinuousPaused(false);
    }
  };

  const handleStopContinuousScrape = () => {
    if (scraperInstanceRef.current) {
      scraperInstanceRef.current.stop();
      scraperInstanceRef.current = null;
    }
    setIsContinuousScraping(false);
    setIsContinuousPaused(false);
    setContinuousStatus('Idle');
    setCurrentScrapeBatch(null);
  };

  // Reusable Pagination Controls Bar (Prevents UI lag and memory issues)
  const renderPaginationControls = () => {
    if (totalLeads === 0) return null;

    // Generate smart page numbers (e.g. 1, 2, 3, 4, 5...)
    const getPageNumbers = () => {
      const delta = 2;
      const range: (number | string)[] = [];
      const left = Math.max(2, currentPage - delta);
      const right = Math.min(totalPages - 1, currentPage + delta);

      range.push(1);
      if (left > 2) range.push('...');
      for (let i = left; i <= right; i++) {
        range.push(i);
      }
      if (right < totalPages - 1) range.push('...');
      if (totalPages > 1) range.push(totalPages);

      return range;
    };

    return (
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs backdrop-blur-xl transition-all ${
        isDark 
          ? 'glass-card border-white/10 text-slate-300' 
          : 'bg-white/95 border-slate-200 text-slate-700 shadow-sm'
      }`}>
        {/* Left: Summary and Page Size */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Phase 0 (C1): demo records are visibly labeled wherever they render */}
          {leads.some((l: any) => l?.simulated === true) && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold tracking-wide">
              DEMO DATA — simulated sample records, not live prospects
            </span>
          )}
          <span className="font-mono text-slate-400">
            Showing <strong className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{startIndex + 1}</strong> – <strong className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{endIndex}</strong> of <strong className="text-teal-400 font-bold">{totalLeads}</strong> leads
          </span>

          <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
            <span className="text-[11px] text-slate-400 font-mono">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={`border rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:border-teal-500 cursor-pointer transition ${
                isDark 
                  ? 'bg-slate-900 border-white/10 text-white' 
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt} leads</option>
              ))}
            </select>
          </div>

          {isContinuousScraping && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Perpetual Pipeline Streaming</span>
            </span>
          )}
        </div>

        {/* Right: Page Navigation Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* First Page */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First Page"
            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-300' 
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-300' 
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-500 font-mono text-xs">
                    ...
                  </span>
                );
              }
              const pageNum = p as number;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/25 ring-1 ring-white/50'
                      : isDark
                        ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-300' 
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-300' 
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Autonomous scrape trigger (Single batch)
  const handleTriggerScrape = async () => {
    setIsScraping(true);
    try {
      let scraped: RCMLead[] = [];
      try {
        scraped = await apiService.searchNpiRegistry({
          state: stateFilter !== 'All' ? stateFilter : undefined,
          city: searchQuery || undefined,
          taxonomy_description: specialtyFilter !== 'All' ? specialtyFilter : undefined,
          limit: 6
        });
      } catch (npiErr) {
        console.warn('NPI search note, using AI discovery fallback:', npiErr);
      }

      if (!scraped || scraped.length === 0) {
        scraped = await apiService.scrapeLeads({
          specialty: specialtyFilter !== 'All' ? specialtyFilter : undefined,
          state: stateFilter !== 'All' ? stateFilter : undefined,
          query: searchQuery || undefined,
          count: 4
        });
      }
      // Pre-seed some default tags and ensure unique IDs for newly scraped leads
      const enrichedLeads = scraped.map((lead, idx) => ({
        ...lead,
        id: lead.id && !lead.id.startsWith('lead-') ? lead.id : `scraped-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        tags: lead.tags && lead.tags.length > 0 ? lead.tags : ['Target']
      }));
      
      const newIds = new Set(enrichedLeads.map(l => l.id));
      setNewlyScrapedIds(newIds);
      onAddLeads(enrichedLeads);

      // Auto-clear newly scraped highlight tag after 6 seconds
      setTimeout(() => {
        setNewlyScrapedIds(new Set());
      }, 6000);
    } catch (err) {
      console.error('Scraping error:', err);
    } finally {
      setIsScraping(false);
    }
  };

  // Toggle or add tag for a lead
  const handleToggleLeadTag = (lead: RCMLead, tagToToggle: string) => {
    const currentTags = lead.tags || [];
    const exists = currentTags.some(t => t.toLowerCase() === tagToToggle.toLowerCase());
    const newTags = exists 
      ? currentTags.filter(t => t.toLowerCase() !== tagToToggle.toLowerCase())
      : [...currentTags, tagToToggle];

    if (onUpdateLeadTags) {
      onUpdateLeadTags(lead.id, newTags);
    } else {
      lead.tags = newTags;
    }

    if (selectedLead && selectedLead.id === lead.id) {
      setSelectedLead({ ...selectedLead, tags: newTags });
    }
  };

  // Status Progression Handler with Subtle Animation Trigger
  const handleStatusChange = (lead: RCMLead, newStatus: RCMLead['status']) => {
    if (lead.status === newStatus) return;
    const oldStatus = lead.status;

    // Immediately trigger highlight pulse & sliding animation state
    setStatusChanges(prev => ({
      ...prev,
      [lead.id]: { prev: oldStatus, current: newStatus, timestamp: Date.now() }
    }));

    if (onUpdateLeadStatus) {
      onUpdateLeadStatus(lead.id, newStatus);
    } else {
      lead.status = newStatus;
    }

    if (selectedLead && selectedLead.id === lead.id) {
      setSelectedLead({ ...selectedLead, status: newStatus });
    }

    setActiveStatusDropdownLeadId(null);

    // Auto-clear highlight pulse after 2.2s
    setTimeout(() => {
      setStatusChanges(prev => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
    }, 2200);
  };

  // Quick 1-click Advance to Next Pipeline Step
  const handleAdvanceStatus = (e: React.MouseEvent, lead: RCMLead) => {
    e.stopPropagation();
    const config = getStatusConfig(lead.status);
    if (config.nextStatus) {
      handleStatusChange(lead, config.nextStatus);
    }
  };

  // Add custom tag
  const handleAddCustomTag = (lead: RCMLead) => {
    if (!customTagInput.trim()) return;
    const tag = customTagInput.trim();
    handleToggleLeadTag(lead, tag);
    setCustomTagInput('');
  };

  // Helper to extract or synthesize audit notes for practice management migration
  const getAuditNotesForLead = (l: RCMLead): string => {
    if (l.auditNotes && l.auditNotes.trim()) {
      return l.auditNotes.trim();
    }
    if (meetingNotes && meetingNotes.length > 0) {
      const match = meetingNotes.find(
        n => (l.callNotesId && n.id === l.callNotesId) ||
             n.leadId === l.id ||
             (n.practiceName && l.practiceName && n.practiceName.toLowerCase() === l.practiceName.toLowerCase()) ||
             (n.doctorName && l.doctorName && n.doctorName.toLowerCase() === l.doctorName.toLowerCase())
      );
      if (match) {
        const parts: string[] = [];
        if (match.qualificationStatus) parts.push(`[Qualification: ${match.qualificationStatus}]`);
        if (match.executiveSummary) parts.push(`Executive Summary: ${match.executiveSummary}`);
        if (match.statedBillingPainPoints?.length) parts.push(`Stated Billing Issues: ${match.statedBillingPainPoints.join('; ')}`);
        if (match.currentSoftwareAndStaffing) parts.push(`Software & Staffing: ${match.currentSoftwareAndStaffing}`);
        if (match.recommendedFollowUpStrategy) parts.push(`Recommended Strategy: ${match.recommendedFollowUpStrategy}`);
        if (parts.length > 0) return parts.join(' | ');
      }
    }
    if (l.painPoints && l.painPoints.length > 0) {
      return `Audit Focus: ${l.painPoints.join('; ')}${l.status === 'Audit Scheduled' ? ' — Complimentary 50-claim forensic billing audit booked' : ''}`;
    }
    return l.status === 'Audit Scheduled' ? 'Complimentary 50-claim forensic billing audit booked' : 'Initial audit review pending contact';
  };

  // Export to CSV Function mapping all RCMLead object fields
  const handleExportCSV = (scope: 'filtered' | 'all' = 'filtered') => {
    const targetLeads = scope === 'all' ? leads : filteredLeads;
    if (targetLeads.length === 0) {
      alert('No leads available to export with the current filter selection.');
      return;
    }

    const headers = [
      'Lead ID',
      'Practice Name',
      'Doctor / Provider Name',
      'Professional Title',
      'Medical Specialty',
      'Practice Size',
      'Lead Status',
      'Forensic Audit Notes & Practice Findings',
      'Direct Phone',
      'Direct Email',
      'Practice Address',
      'US State / Territory',
      'Current EHR / PM System',
      'Monthly Claim Volume',
      'Business Pain Points',
      'Priority Tags',
      'LinkedIn Profile URL',
      'Admin / Front Desk Contact',
      'Lead Acquisition Source',
      'Last Contacted / Dialed',
      'Call Notes / Recording ID'
    ];

    const escapeCsv = (val: unknown) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = targetLeads.map(l => [
      escapeCsv(l.id),
      escapeCsv(l.practiceName),
      escapeCsv(l.doctorName),
      escapeCsv(l.title),
      escapeCsv(l.specialty),
      escapeCsv(l.practiceSize || '1-3 Providers'),
      escapeCsv(l.status),
      escapeCsv(l.auditNotes || getAuditNotesForLead(l)),
      escapeCsv(l.phone),
      escapeCsv(l.email),
      escapeCsv(l.address),
      escapeCsv(l.state),
      escapeCsv(l.ehrSystem),
      escapeCsv(l.monthlyClaimVolume),
      escapeCsv((l.painPoints || []).join('; ')),
      escapeCsv((l.tags || []).join('; ')),
      escapeCsv(l.linkedInProfile || ''),
      escapeCsv(l.adminContact || 'Main Practice Desk'),
      escapeCsv(l.source),
      escapeCsv(l.lastContacted || 'Pending Outbound Dialer'),
      escapeCsv(l.callNotesId || '')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `Pulsar_Leads_${scope === 'all' ? 'All' : 'Filtered'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNoticeMessage(`Successfully downloaded ${targetLeads.length} leads as CSV (${filename}) with all lead fields mapped.`);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 5000);
    setIsExportDropdownOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Deck - Luxury Glassmorphic Aesthetic */}
      <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 backdrop-blur-2xl ${
        isDark 
          ? 'glass-panel bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-teal-950/40 border-white/10 shadow-2xl' 
          : 'bg-white/85 border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.08)]'
      }`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 backdrop-blur-md">
              <Database className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
              Automated Healthcare Lead Scraper & CRM Pipeline
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight font-display ${
              isDark ? 'text-white text-glow-teal' : 'text-slate-900'
            }`}>
              US Healthcare Providers, Labs & Hospital Prospects
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed ${
              isDark ? 'text-slate-300/80' : 'text-slate-600'
            }`}>
              Continuously scrubs NPI registry records, Google Places medical clinics, state medical boards, and CLIA lab directories with live pipeline progression feedback, smooth status animations, and CRM export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Upload CSV Button */}
            <button
              onClick={() => setIsCSVModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition transform active:scale-95 cursor-pointer backdrop-blur-md ${
                isDark
                  ? 'bg-slate-900/80 hover:bg-slate-800 text-teal-300 border-teal-500/30 shadow-lg shadow-black/30'
                  : 'bg-white hover:bg-slate-50 text-teal-700 border-teal-300 shadow-sm'
              }`}
              title="Upload external CSV spreadsheet of healthcare leads"
            >
              <UploadCloud className="w-4 h-4 text-teal-500 dark:text-teal-400" />
              <span>Upload CSV</span>
            </button>

            {/* Email Templates Button */}
            <button
              onClick={() => {
                setEmailModalLead(leads[0] || null);
                setIsEmailModalOpen(true);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition transform active:scale-95 cursor-pointer backdrop-blur-md ${
                isDark
                  ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-100 border-white/15 shadow-lg shadow-black/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm'
              }`}
              title="Manage cold-outreach email templates with auto-token population"
            >
              <Mail className="w-4 h-4 text-teal-500 dark:text-teal-400" />
              <span>Email Templates</span>
            </button>

            {/* Download Leads CSV Button with Dropdown Scope Selection */}
            <div className="relative">
              <div className={`inline-flex rounded-xl shadow-lg border overflow-hidden backdrop-blur-md transition-colors ${
                isDark 
                  ? 'border-emerald-500/40 bg-slate-900/90 shadow-black/30' 
                  : 'border-emerald-500/50 bg-white shadow-emerald-500/10'
              }`}>
                <button
                  type="button"
                  onClick={() => handleExportCSV('filtered')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold transition transform active:scale-95 cursor-pointer ${
                    isDark
                      ? 'hover:bg-slate-800 text-emerald-300 hover:text-emerald-200'
                      : 'hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800'
                  }`}
                  title="Download current leads list as CSV file (mapped with all lead fields)"
                >
                  <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Download Leads CSV ({filteredLeads.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className={`px-2 py-2.5 border-l transition cursor-pointer ${
                    isDark
                      ? 'hover:bg-slate-800 text-emerald-400 border-emerald-500/30'
                      : 'hover:bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}
                  title="Choose CSV export scope"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {isExportDropdownOpen && (
                <div className={`absolute right-0 mt-1 z-30 w-64 rounded-xl p-2 border shadow-2xl space-y-1 text-xs animate-in fade-in backdrop-blur-2xl ${
                  isDark
                    ? 'bg-slate-950/95 border-white/20 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
                }`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Select CSV Export Scope:
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportCSV('filtered')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>Current Filtered Leads</span>
                    <span className="font-mono text-emerald-500 dark:text-emerald-400 font-bold">{filteredLeads.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCSV('all')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>All Leads in Database</span>
                    <span className="font-mono text-cyan-600 dark:text-cyan-300 font-bold">{leads.length}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Continuous Scrape Perpetual Mode Toggle & Config Button */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={isContinuousScraping ? (isContinuousPaused ? handleResumeContinuousScrape : handlePauseContinuousScrape) : handleStartContinuousScrape}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-black text-xs transition shadow-lg cursor-pointer transform active:scale-95 ${
                  isContinuousScraping
                    ? isContinuousPaused
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 ring-2 ring-blue-400/50'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400/60 animate-pulse'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-emerald-600/20'
                }`}
                title={isContinuousScraping ? (isContinuousPaused ? 'Resume perpetual continuous scraper' : 'Pause continuous scraper') : 'Start continuous perpetual scraping loop'}
              >
                {isContinuousScraping ? (
                  isContinuousPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Resume Perpetual Scraper</span>
                    </>
                  ) : (
                    <>
                      <Infinity className="w-4 h-4 text-slate-950 animate-spin" />
                      <span>Continuous Scrape Active</span>
                      <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                    </>
                  )
                ) : (
                  <>
                    <Infinity className="w-4 h-4" />
                    <span>Continuous Scrape (Perpetual)</span>
                  </>
                )}
              </button>

              {isContinuousScraping && (
                <button
                  type="button"
                  onClick={handleStopContinuousScrape}
                  className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                  title="Stop continuous scraping"
                >
                  <Square className="w-3.5 h-3.5 fill-rose-300" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowContinuousSettings(!showContinuousSettings)}
                className={`p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                  showContinuousSettings
                    ? 'bg-teal-500 text-slate-950 border-teal-400'
                    : isDark ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Continuous scraper configuration (batch size, interval delay)"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Single Batch Scrape Button */}
              <button
                onClick={handleTriggerScrape}
                disabled={isScraping || isContinuousScraping}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 shadow transition transform active:scale-95 cursor-pointer disabled:opacity-40"
                title="Trigger a single manual scrape batch"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin text-teal-400' : ''}`} />
                <span>{isScraping ? 'Scraping...' : 'Single Batch'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Continuous Scrape Settings Bar */}
        {showContinuousSettings && (
          <div className={`relative z-10 mt-3 p-4 rounded-2xl border text-xs space-y-3 animate-in fade-in ${
            isDark ? 'bg-slate-900/90 border-teal-500/30' : 'bg-white border-teal-500/30 shadow-lg'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-400" />
                <span className="font-bold font-display text-slate-900 dark:text-white">Continuous Scrape Engine Parameters</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">Perpetual Queue Automation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Batch Size per Cycle:</label>
                <div className="flex items-center gap-1">
                  {[3, 5, 8, 12].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setContinuousBatchSize(num);
                        if (scraperInstanceRef.current) scraperInstanceRef.current.updateConfig({ batchSize: num });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        continuousBatchSize === num
                          ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-sm'
                          : isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {num} leads
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Cycle Interval Delay (Post 'Completed'):</label>
                <div className="flex items-center gap-1">
                  {[
                    { label: '1.5s', ms: 1500 },
                    { label: '2.5s', ms: 2500 },
                    { label: '4.0s', ms: 4000 }
                  ].map(int => (
                    <button
                      key={int.ms}
                      type="button"
                      onClick={() => {
                        setContinuousIntervalMs(int.ms);
                        if (scraperInstanceRef.current) scraperInstanceRef.current.updateConfig({ intervalDelayMs: int.ms });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        continuousIntervalMs === int.ms
                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                          : isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {int.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Target Filter Scope:</label>
                <div className="text-[11px] font-mono text-teal-400 pt-1">
                  {specialtyFilter !== 'All' ? specialtyFilter : 'All Specialties'} • {stateFilter !== 'All' ? stateFilter : 'All US States'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Perpetual Lead Pipeline Live HUD Banner */}
        {isContinuousScraping && (
          <div className={`relative z-10 mt-4 p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
            isDark 
              ? 'bg-slate-950/90 border-emerald-500/35 shadow-xl shadow-emerald-500/5' 
              : 'bg-emerald-50/70 border-emerald-400 shadow-md'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-emerald-500/15">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isContinuousPaused ? 'bg-blue-400' : 'bg-emerald-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    isContinuousPaused ? 'bg-blue-500' : 'bg-emerald-500'
                  }`} />
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono">
                      Perpetual Lead Pipeline Engine: {isContinuousPaused ? 'Paused' : 'Active'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      Batch #{currentScrapeBatch?.batchNumber || continuousBatchesCount + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {continuousStatus === 'Queued' && 'Batch registered in pipeline queue. Initializing NPI scrape worker...'}
                    {continuousStatus === 'Scraping' && 'Scraping live healthcare provider directories, state medical boards & NPI registries...'}
                    {continuousStatus === 'Processing' && 'Processing denial history, verifying EHR integration & assigning priority tags...'}
                    {continuousStatus === 'Completed' && 'Batch Completed! Auto-queueing next batch into pipeline without manual intervention...'}
                    {continuousStatus === 'Paused' && 'Perpetual loop paused. Click "Resume" to continue perpetual ingestion.'}
                    {continuousStatus === 'Idle' && 'Pipeline engine standing by.'}
                  </p>
                </div>
              </div>

              {/* HUD Live Metrics */}
              <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Batches Done:</span>
                  <strong className="text-teal-400 font-bold">{continuousBatchesCount}</strong>
                </div>
                <div className="text-right pl-3 border-l border-white/10">
                  <span className="text-slate-400 block text-[10px]">Leads Ingested:</span>
                  <strong className="text-emerald-400 font-bold">+{continuousLeadsAddedCount}</strong>
                </div>
              </div>
            </div>

            {/* 4-Phase Visual Progression Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
              <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                continuousStatus === 'Queued'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 font-bold ring-1 ring-blue-400/50'
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${continuousStatus === 'Queued' ? 'bg-blue-400 animate-ping' : 'bg-slate-600'}`} />
                <span>1. Queued</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                continuousStatus === 'Scraping'
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-300 font-bold ring-1 ring-teal-400/50'
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <RefreshCw className={`w-3 h-3 ${continuousStatus === 'Scraping' ? 'animate-spin text-teal-400' : 'text-slate-600'}`} />
                <span>2. Scraping</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                continuousStatus === 'Processing'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold ring-1 ring-amber-400/50'
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <Zap className={`w-3 h-3 ${continuousStatus === 'Processing' ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                <span>3. Processing</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                continuousStatus === 'Completed'
                  ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300 font-bold ring-1 ring-emerald-400/60'
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <CheckCircle2 className={`w-3 h-3 ${continuousStatus === 'Completed' ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>4. Completed ➔ Loop</span>
              </div>
            </div>
          </div>
        )}

        {exportNotice && (
          <div className="relative z-10 mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-lg animate-status-chip-slide">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportNoticeMessage || 'CSV file downloaded successfully! All lead fields mapped.'}</span>
            </div>
            <button 
              onClick={() => setExportNotice(false)} 
              className="text-emerald-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters Bar & Pipeline Stage Selector */}
        <div className={`relative z-10 mt-6 pt-5 border-t space-y-3.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search box */}
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search practice, doctor, EHR, status, tag..."
                className={`w-full border rounded-xl pl-9 pr-3 py-2 text-xs backdrop-blur-md focus:outline-none focus:border-teal-500 transition ${
                  isDark 
                    ? 'bg-slate-950/80 border-white/10 text-white placeholder-slate-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
            </div>

            {/* Specialty */}
            <div className="flex items-center gap-2">
              <label className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Specialty:</label>
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 cursor-pointer backdrop-blur-md transition ${
                  isDark 
                    ? 'bg-slate-950/80 border-white/10 text-slate-200' 
                    : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                }`}
              >
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* US State */}
            <div className="flex items-center gap-2">
              <label className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>US State:</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 cursor-pointer backdrop-blur-md transition ${
                  isDark 
                    ? 'bg-slate-950/80 border-white/10 text-slate-200' 
                    : 'bg-white border-slate-300 text-slate-800 shadow-sm'
                }`}
              >
                {US_STATES.map(st => <option key={st} value={st}>{st === 'All' ? 'All US States' : st}</option>)}
              </select>
            </div>

            {/* Stats quick tally */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono transition ${
              isDark 
                ? 'bg-slate-950/50 border-white/10 text-slate-400' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span>Filtered: <strong className="text-teal-500 font-bold">{filteredLeads.length}</strong> / {leads.length}</span>
              <span className="text-[10px] text-emerald-500 font-semibold">Live Pipeline Active</span>
            </div>
          </div>

          {/* Pipeline Status Filter Bar */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-teal-400" />
              Pipeline Stage:
            </span>

            <button
              onClick={() => setStatusFilter('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                statusFilter === 'All' 
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-md shadow-teal-500/20' 
                  : isDark 
                    ? 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800' 
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              }`}
            >
              All Stages ({leads.length})
            </button>

            {LEAD_STATUS_CONFIG.map((statusItem) => {
              const count = leads.filter(l => l.status.toLowerCase() === statusItem.status.toLowerCase()).length;
              const isSelected = statusFilter.toLowerCase() === statusItem.status.toLowerCase();
              return (
                <button
                  key={statusItem.status}
                  onClick={() => setStatusFilter(isSelected ? 'All' : statusItem.status)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isSelected 
                      ? `${statusItem.badgeClass} ring-2 ring-white/30 font-bold` 
                      : isDark 
                        ? 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-slate-800 hover:text-white' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusItem.dotClass}`} />
                  <span>{statusItem.label}</span>
                  <span className="text-[10px] opacity-70 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Tag Filtering Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <TagIcon className="w-3 h-3 text-teal-500 dark:text-teal-400" />
              Filter by Tag:
            </span>

            <button
              onClick={() => setTagFilter('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                tagFilter === 'All' 
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-sm' 
                  : isDark 
                    ? 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800' 
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
              }`}
            >
              All Tags
            </button>

            {LEAD_TAGS_CONFIG.map((tag) => {
              const count = leads.filter(l => l.tags && l.tags.some(t => t.toLowerCase() === tag.name.toLowerCase())).length;
              const isSelected = tagFilter.toLowerCase() === tag.name.toLowerCase();
              return (
                <button
                  key={tag.name}
                  onClick={() => setTagFilter(isSelected ? 'All' : tag.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isSelected 
                      ? `${tag.badgeClass} ring-2 ring-white/30 font-bold` 
                      : isDark 
                        ? 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-slate-800 hover:text-white' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                  }`}
                  title={tag.desc}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tag.dotClass}`} />
                  <span>{tag.name}</span>
                  <span className="text-[10px] opacity-70 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Summary Pie Chart: Lead Status Distribution across sales pipeline */}
      <LeadStatusDistributionChart
        leads={leads}
        activeStatusFilter={statusFilter}
        onSelectStatus={(status) => setStatusFilter(status)}
      />

      {/* View Mode Switcher: Table View vs Responsive Cards Grid vs Territory Map vs Split */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel border transition-colors shadow-lg ${
        isDark ? 'bg-slate-950/60 border-white/10' : 'bg-white/85 border-slate-200'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wider pl-1 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            Display Mode:
          </span>
          <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs flex-wrap transition-colors ${
            isDark ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Table ({filteredLeads.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>US Territory Map</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'both'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
          </div>
        </div>

        <div className={`text-xs flex items-center gap-2.5 flex-wrap ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <span>Active Accounts: <strong className={`font-mono ${isDark ? 'text-white' : 'text-slate-900 font-bold'}`}>{leads.length}</strong></span>
          <span>•</span>
          <span>Filtered: <strong className={`font-mono ${isDark ? 'text-teal-300' : 'text-teal-700 font-bold'}`}>{filteredLeads.length}</strong></span>
          <span>•</span>
          <span>Page <strong className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{currentPage}</strong> of {totalPages} (Rows {totalLeads === 0 ? 0 : startIndex + 1}–{endIndex})</span>
          {stateFilter !== 'All' && (
            <button
              type="button"
              onClick={() => setStateFilter('All')}
              className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
            >
              (Clear State)
            </button>
          )}
          <button
            type="button"
            onClick={() => handleExportCSV('filtered')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              isDark 
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
            }`}
            title="Download current filtered leads list to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* US Territory Map Density View */}
      {(viewMode === 'map' || viewMode === 'both') && (
        <USLeadDensityMap
          leads={filteredLeads}
          selectedStateFilter={stateFilter}
          onSelectState={(st) => setStateFilter(st)}
          onSelectLeadForCall={(lead) => onSelectLeadForCall(lead)}
        />
      )}

      {/* Leads Table - Only displays and processes current page slice to eliminate UI lag & memory pressure */}
      {(viewMode === 'table' || viewMode === 'both') && (
      <div className="space-y-3">
        <div className={`border rounded-2xl overflow-hidden backdrop-blur-2xl transition-all duration-300 ${
          isDark 
            ? 'glass-card border-white/10 shadow-2xl' 
            : 'bg-white/90 border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b font-semibold uppercase tracking-wider text-[10px] backdrop-blur-md transition-colors ${
                  isDark 
                    ? 'border-white/10 bg-slate-950/70 text-slate-400' 
                    : 'border-slate-200 bg-slate-50/90 text-slate-600'
                }`}>
                  <th className="py-3 px-4">Practice & Doctor</th>
                  <th className="py-3 px-4">Pipeline Status & Progression</th>
                  <th className="py-3 px-4">Lead Priority Tags</th>
                  <th className="py-3 px-4">Specialty & Size</th>
                  <th className="py-3 px-4">Phone & Direct Email</th>
                  <th className="py-3 px-4">Address / State</th>
                  <th className="py-3 px-4">EHR System</th>
                  <th className="py-3 px-4">Monthly Claims</th>
                  <th className="py-3 px-4 text-right">Instant AI Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y transition-colors ${
                isDark ? 'divide-white/5 text-slate-200' : 'divide-slate-100 text-slate-800'
              }`}>
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No leads match your filter criteria. Click "Scrape New Clients from Web" or start Continuous Scrape.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {paginatedLeads.map((lead, index) => {
                      const statusConf = getStatusConfig(lead.status);
                      const isRecentlyUpdated = !!statusChanges[lead.id];
                      const changeInfo = statusChanges[lead.id];
                      const isNewScraped = newlyScrapedIds.has(lead.id);

                    return (
                      <motion.tr 
                        key={lead.id} 
                        layout="position"
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.2 } }}
                        transition={{
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                          delay: isNewScraped ? Math.min(index * 0.08, 0.4) : 0
                        }}
                        className={`transition cursor-pointer group relative ${
                          isNewScraped
                            ? isDark ? 'bg-teal-950/40 ring-1 ring-teal-400/40' : 'bg-teal-50 ring-1 ring-teal-300'
                            : isRecentlyUpdated 
                              ? 'animate-status-row-pulse' 
                              : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          setSelectedLead(lead);
                          setAuditNotesInput(lead.auditNotes || getAuditNotesForLead(lead));
                          setAuditNotesSavedNotice(false);
                        }}
                      >
                        {/* Practice & Doctor */}
                        <td className="py-3.5 px-4">
                          <div className={`font-bold transition flex items-center gap-1.5 flex-wrap ${
                            isDark ? 'text-white group-hover:text-teal-400' : 'text-slate-900 group-hover:text-teal-600'
                          }`}>
                            <span>{lead.practiceName}</span>
                            {isNewScraped && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/40 animate-pulse">
                                <Sparkles className="w-2.5 h-2.5 text-teal-500 dark:text-teal-300" />
                                <span>New Scraped</span>
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Stethoscope className="w-3 h-3 text-teal-500 dark:text-teal-400" />
                            <span>{lead.doctorName}</span>
                          </div>
                          {lead.adminContact && (
                            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              Admin: {lead.adminContact}
                            </div>
                          )}
                        </td>

                      {/* Pipeline Status & Progression with Sliding Transitions & Highlight Pulses */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            
                            {/* Interactive Status Badge with Slide Animation */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveStatusDropdownLeadId(activeStatusDropdownLeadId === lead.id ? null : lead.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusConf.badgeClass} ${
                                  isRecentlyUpdated 
                                    ? 'animate-status-badge-slide animate-status-pill-glow ring-2 ring-teal-400/50' 
                                    : ''
                                } transition transform hover:scale-[1.02] cursor-pointer`}
                                title="Click to change pipeline status"
                              >
                                <span className={`w-2 h-2 rounded-full ${statusConf.dotClass}`} />
                                <span className="font-mono text-[11px] tracking-tight">{statusConf.label}</span>
                                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                              </button>

                              {/* Status Change Dropdown Menu */}
                              {activeStatusDropdownLeadId === lead.id && (
                                <div className="absolute left-0 mt-1 z-30 w-56 rounded-xl glass-modal p-2 border border-white/20 shadow-2xl space-y-1 text-xs animate-in fade-in">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                    Set Pipeline Stage:
                                  </div>
                                  {LEAD_STATUS_CONFIG.map((opt) => {
                                    const isCurrent = lead.status.toLowerCase() === opt.status.toLowerCase();
                                    return (
                                      <button
                                        key={opt.status}
                                        type="button"
                                        onClick={() => handleStatusChange(lead, opt.status)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                                          isCurrent 
                                            ? `${opt.badgeClass} font-bold ring-1 ring-white/20` 
                                            : 'text-slate-300 hover:bg-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`w-1.5 h-1.5 rounded-full ${opt.dotClass}`} />
                                          <span>{opt.label}</span>
                                        </div>
                                        {isCurrent && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Quick Next Stage Advance Button */}
                            {statusConf.nextStatus && (
                              <button
                                type="button"
                                onClick={(e) => handleAdvanceStatus(e, lead)}
                                className="p-1 rounded-md bg-slate-800/80 hover:bg-teal-500 hover:text-slate-950 text-slate-400 text-[10px] border border-white/10 transition transform active:scale-95 cursor-pointer"
                                title={`Advance status to: ${statusConf.nextStatus}`}
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Subtle Status Transition Banner when Status Changed */}
                          {isRecentlyUpdated && changeInfo && (
                            <div className="animate-status-chip-slide inline-flex items-center gap-1 text-[10px] text-teal-300 font-mono bg-teal-500/15 px-2 py-0.5 rounded-md border border-teal-500/30">
                              <span className="text-slate-400 line-through truncate max-w-[80px]">{changeInfo.prev}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                              <span className="font-bold text-teal-200 truncate max-w-[100px]">{changeInfo.current}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Color-Coded Lead Tags */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[180px]">
                          {lead.tags && lead.tags.length > 0 ? (
                            lead.tags.map((t) => {
                              const config = getTagConfig(t);
                              return (
                                <span
                                  key={t}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${config.badgeClass} transition`}
                                  title={config.desc}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                                  <span>{t}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLeadTag(lead, t)}
                                    className="hover:text-white ml-0.5 text-slate-400 cursor-pointer"
                                    title={`Remove ${t}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">No tags</span>
                          )}

                          {/* Quick Tag Popover Trigger */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveTagDropdownLeadId(activeTagDropdownLeadId === lead.id ? null : lead.id)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] border border-white/10 transition cursor-pointer"
                              title="Add / toggle tag"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tag</span>
                            </button>

                            {activeTagDropdownLeadId === lead.id && (
                              <div className="absolute left-0 mt-1 z-30 w-48 rounded-xl glass-modal p-2 border border-white/20 shadow-2xl space-y-1 text-xs animate-in fade-in">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  Assign Lead Tag:
                                </div>
                                {LEAD_TAGS_CONFIG.map((tag) => {
                                  const isTagged = (lead.tags || []).some(t => t.toLowerCase() === tag.name.toLowerCase());
                                  return (
                                    <button
                                      key={tag.name}
                                      type="button"
                                      onClick={() => handleToggleLeadTag(lead, tag.name)}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition cursor-pointer ${
                                        isTagged ? `${tag.badgeClass} font-bold` : 'text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${tag.dotClass}`} />
                                        <span>{tag.name}</span>
                                      </div>
                                      {isTagged && <span className="text-[10px] text-emerald-400">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Specialty & Size */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded font-medium border ${
                          isDark 
                            ? 'bg-slate-900 border-white/10 text-slate-300' 
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}>
                          {lead.specialty}
                        </span>
                        <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lead.practiceSize}</div>
                      </td>

                      {/* Phone & Direct Email */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{lead.phone}</span>
                        </div>
                        <div className={`text-[11px] truncate max-w-[160px] flex items-center gap-1 mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`} title={lead.email}>
                          <Mail className="w-3 h-3" />
                          <span>{lead.email}</span>
                        </div>
                      </td>

                      {/* Address & State */}
                      <td className="py-3.5 px-4">
                        <div className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={lead.address}>{lead.address}</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border mt-1 inline-block ${
                          isDark 
                            ? 'bg-slate-900 border-white/10 text-teal-400' 
                            : 'bg-slate-100 border-slate-200 text-teal-700'
                        }`}>
                          {lead.state}
                        </span>
                      </td>

                      {/* EHR System */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded border font-mono font-medium ${
                          isDark 
                            ? 'bg-cyan-950/60 border-cyan-700/40 text-cyan-300' 
                            : 'bg-cyan-50 border-cyan-200 text-cyan-800'
                        }`}>
                          {lead.ehrSystem}
                        </span>
                      </td>

                      {/* Monthly Claims */}
                      <td className="py-3.5 px-4">
                        <div className={`font-mono font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{lead.monthlyClaimVolume}</div>
                        <div className={`text-[11px] truncate max-w-[180px] mt-0.5 ${
                          isDark ? 'text-rose-300/90' : 'text-rose-600'
                        }`} title={lead.painPoints.join(', ')}>
                          ⚠️ {lead.painPoints[0] || 'High denial rate'}
                        </div>
                      </td>

                      {/* Instant Actions: Email + Dial */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEmailModalLead(lead);
                              setIsEmailModalOpen(true);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold shadow transition transform active:scale-95 cursor-pointer ${
                              isDark 
                                ? 'bg-slate-900/90 hover:bg-slate-800 text-teal-300 hover:text-white border-teal-500/30' 
                                : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300'
                            }`}
                            title="Open pre-written cold outreach email with 1-click mailto"
                          >
                            <Mail className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
                            <span>Email</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectLeadForCall(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-bold shadow-md shadow-teal-500/20 transition transform active:scale-95 cursor-pointer"
                            title="Launch hyper-realistic human AI cold call and warm transfer"
                          >
                            <PhoneCall className="w-3.5 h-3.5 fill-slate-950" />
                            <span>Dial AI Call</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
            </tbody>
          </table>
        </div>
      </div>
      {renderPaginationControls()}
    </div>
    )}

      {/* Responsive Cards Grid View (Automatic reflow for viewer's screen size) */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
            {paginatedLeads.length === 0 ? (
              <div className={`col-span-full p-12 text-center rounded-2xl border ${
                isDark ? 'glass-card border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
              }`}>
                No leads match your filter criteria. Click "Scrape New Clients from Web" or start Continuous Scrape.
              </div>
            ) : (
              paginatedLeads.map((lead) => {
                const statusConf = getStatusConfig(lead.status);
                return (
                  <div
                    key={lead.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between space-y-4 backdrop-blur-xl ${
                      isDark 
                        ? 'glass-card border-white/10 hover:border-teal-500/40 shadow-xl' 
                        : 'bg-white border-slate-200/90 shadow-md hover:border-teal-500/50'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${statusConf.badgeClass}`}>
                            {statusConf.label}
                          </span>
                          <h4 className={`text-sm font-bold truncate mt-1.5 font-display ${isDark ? 'text-white' : 'text-slate-900'}`} title={lead.practiceName}>
                            {lead.practiceName}
                          </h4>
                          <p className={`text-xs truncate ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                            {lead.doctorName}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold shrink-0">
                          {lead.state}
                        </span>
                      </div>

                      <div className={`text-xs space-y-1.5 font-mono pt-2 border-t ${isDark ? 'border-white/5 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Phone:</span>
                          <a href={`tel:${lead.phone}`} className="hover:underline text-teal-400 font-bold">{lead.phone}</a>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Specialty:</span>
                          <span className="truncate max-w-[130px]">{lead.specialty}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">EHR:</span>
                          <span>{lead.ehrSystem}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Monthly Claims:</span>
                          <span className="text-emerald-400 font-bold">{lead.monthlyClaimVolume}</span>
                        </div>
                      </div>

                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {lead.tags.map(t => (
                            <span key={t} className="text-[9px] font-mono px-2 py-0.2 rounded-md bg-white/5 text-slate-300 border border-white/10">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(lead)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectLeadForCall(lead)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs font-black shadow-md transition transform active:scale-95 cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Dial Call</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {renderPaginationControls()}
        </div>
      )}

      {/* Selected Lead Modal Detail - Frosted Glassmorphism Modal with Live Pipeline Progression Stepper */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border transition-all duration-300 ${
            isDark 
              ? 'glass-modal border-white/15 text-slate-100' 
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)]'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30 font-bold">
                    {selectedLead.source}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark ? 'bg-slate-800 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    State: {selectedLead.state}
                  </span>
                </div>
                <h3 className={`text-xl font-bold mt-1 font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedLead.practiceName}</h3>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">{selectedLead.doctorName} • {selectedLead.title}</p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  isDark ? 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Pipeline Stage Progression Stepper Bar */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${
              isDark ? 'bg-slate-950/80 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  <Activity className="w-3.5 h-3.5 text-teal-500" />
                  Live Sales Pipeline Progression:
                </span>
                <span className="text-[11px] font-mono text-teal-600 dark:text-teal-300">
                  Current: <strong>{selectedLead.status}</strong>
                </span>
              </div>

              {/* Stepper items */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { status: 'Ready for Call', label: '1. Ready' },
                  { status: 'Calling', label: '2. Calling' },
                  { status: 'Transferred to Manager', label: '3. Bridged' },
                  { status: 'Audit Scheduled', label: '4. Audit Booked' }
                ].map((step, idx) => {
                  const isCurrent = selectedLead.status === step.status;
                  const stepConfig = getStatusConfig(step.status);
                  return (
                    <button
                      key={step.status}
                      type="button"
                      onClick={() => handleStatusChange(selectedLead, step.status as any)}
                      className={`p-2 rounded-xl text-left transition transform active:scale-95 cursor-pointer border ${
                        isCurrent
                          ? `${stepConfig.badgeClass} ring-2 ring-teal-400/40 font-bold shadow-md`
                          : isDark 
                            ? 'bg-slate-900/60 text-slate-400 border-white/10 hover:bg-slate-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 shadow-sm'
                      }`}
                    >
                      <div className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Stage 0{idx + 1}</div>
                      <div className="text-xs font-semibold mt-0.5 flex items-center justify-between">
                        <span>{step.label}</span>
                        {isCurrent && <span className="text-teal-500 dark:text-teal-400 text-xs font-bold">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Other status options */}
              <div className="flex items-center gap-1.5 pt-1 text-xs">
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Other Outcomes:</span>
                {['Follow-up', 'Voicemail', 'Not Interested'].map((other) => {
                  const isCur = selectedLead.status === other;
                  return (
                    <button
                      key={other}
                      type="button"
                      onClick={() => handleStatusChange(selectedLead, other as any)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                        isCur 
                          ? 'bg-slate-700 text-white border-white/30 font-bold' 
                          : isDark 
                            ? 'bg-slate-900 text-slate-400 border-white/10 hover:bg-slate-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {other}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lead Tag Manager in Detail Modal */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              isDark ? 'bg-slate-950/70 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <TagIcon className="w-3.5 h-3.5 text-teal-500" />
                  Lead Priority Tags:
                </span>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Click to toggle</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {LEAD_TAGS_CONFIG.map((tag) => {
                  const isTagged = (selectedLead.tags || []).some(t => t.toLowerCase() === tag.name.toLowerCase());
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => handleToggleLeadTag(selectedLead, tag.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                        isTagged 
                          ? `${tag.badgeClass} ring-2 ring-white/20 font-bold` 
                          : isDark 
                            ? 'bg-slate-900 text-slate-400 border-white/10 hover:bg-slate-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${tag.dotClass}`} />
                      <span>{tag.name}</span>
                      {isTagged && <span>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Tag */}
              <div className={`flex items-center gap-2 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag(selectedLead);
                    }
                  }}
                  placeholder="Create custom tag (e.g. Urgent Callback)..."
                  className={`flex-1 rounded-lg px-2.5 py-1 text-xs transition border focus:outline-none focus:border-teal-400 ${
                    isDark 
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomTag(selectedLead)}
                  className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-sm"
                >
                  + Add Tag
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-2xl border ${
              isDark ? 'bg-slate-950/70 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Phone:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{selectedLead.phone}</span>
              </div>
              <div>
                <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email:</span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{selectedLead.email}</span>
              </div>
              <div>
                <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>EHR / Billing Software:</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{selectedLead.ehrSystem}</span>
              </div>
              <div>
                <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Estimated Volume:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-300 font-semibold">{selectedLead.monthlyClaimVolume}</span>
              </div>
              <div className="col-span-2">
                <span className={`block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Physical Address:</span>
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{selectedLead.address}</span>
              </div>
            </div>

            <div>
              <span className={`text-xs font-semibold block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Identified Business Pain Points:</span>
              <ul className="space-y-1">
                {selectedLead.painPoints.map((pp, idx) => (
                  <li key={idx} className={`text-xs flex items-start gap-2 p-2 rounded-xl border ${
                    isDark 
                      ? 'bg-slate-950/60 border-white/10 text-slate-300' 
                      : 'bg-rose-50/50 border-rose-200/60 text-slate-700'
                  }`}>
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{pp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Forensic Audit Notes & Practice Management Clinical Observations */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${
              isDark 
                ? 'bg-slate-950/80 border-teal-500/30' 
                : 'bg-teal-50/40 border-teal-200/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-500" />
                  Forensic Audit Notes & PM Migration Summary:
                </span>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Included in CSV Migration Export
                </span>
              </div>
              <textarea
                value={auditNotesInput}
                onChange={(e) => setAuditNotesInput(e.target.value)}
                placeholder="Enter audit notes, fee schedule findings, denial percentages, CPT undercoding notes, or EHR migration instructions..."
                rows={3}
                className={`w-full rounded-xl p-3 text-xs resize-none font-mono transition border focus:outline-none focus:border-teal-400 ${
                  isDark 
                    ? 'bg-slate-900 border-white/10 text-slate-100 placeholder-slate-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                {auditNotesSavedNotice ? (
                  <span className="text-emerald-600 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Audit notes saved and synchronized for CSV export!
                  </span>
                ) : (
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Auto-synthesizes clinical notes and call meeting summaries if left blank.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateLeadAuditNotes) {
                      onUpdateLeadAuditNotes(selectedLead.id, auditNotesInput);
                    }
                    setSelectedLead({ ...selectedLead, auditNotes: auditNotesInput });
                    setAuditNotesSavedNotice(true);
                    setTimeout(() => setAuditNotesSavedNotice(false), 3000);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-700 dark:text-teal-300 border border-teal-500/40 text-xs font-bold transition cursor-pointer"
                >
                  Save Audit Notes
                </button>
              </div>
            </div>

            <div className={`pt-3 border-t flex items-center justify-between ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              {selectedLead.linkedInProfile && (
                <a 
                  href={selectedLead.linkedInProfile} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>LinkedIn Profile</span>
                </a>
              )}
              <div className="flex gap-2 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const l = selectedLead;
                    setEmailModalLead(l);
                    setIsEmailModalOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-teal-300 border-teal-500/30' 
                      : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300 shadow-sm'
                  }`}
                  title="Open pre-written cold-outreach email templates for this lead"
                >
                  <Mail className="w-3.5 h-3.5 text-teal-500" />
                  <span>Cold Email</span>
                </button>

                <button
                  onClick={() => setSelectedLead(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const l = selectedLead;
                    setSelectedLead(null);
                    onSelectLeadForCall(l);
                  }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition transform active:scale-98"
                >
                  <PhoneCall className="w-4 h-4 fill-slate-950" />
                  <span>Dial with Sarah & Warm Transfer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cold Outreach Email Templates Modal */}
      <EmailOutreachModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        leads={leads}
        initialLead={emailModalLead}
        onUpdateLeadStatus={onUpdateLeadStatus}
      />

      {/* Bulk CSV Lead Upload Modal */}
      <CSVUploadModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onAddLeads={(newLeads) => {
          onAddLeads(newLeads);
        }}
        existingLeads={leads}
      />

    </div>
  );
};
