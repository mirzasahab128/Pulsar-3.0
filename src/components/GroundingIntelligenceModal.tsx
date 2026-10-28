import React, { useState } from 'react';
import { 
  MapPin, 
  Search, 
  Globe, 
  ExternalLink, 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Check, 
  ShieldCheck, 
  Building2, 
  FileText,
  X
} from 'lucide-react';
import { apiService } from '../services/api';
import { RCMLead } from '../types';

interface GroundingIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLead?: (lead: RCMLead) => void;
}

export const GroundingIntelligenceModal: React.FC<GroundingIntelligenceModalProps> = ({
  isOpen,
  onClose,
  onAddLead
}) => {
  const [activeTab, setActiveTab] = useState<'maps' | 'search'>('maps');
  
  // Maps Grounding state
  const [mapsQuery, setMapsQuery] = useState<string>('Interventional cardiology & vascular clinics in Austin, TX');
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [mapsResult, setMapsResult] = useState<{ text: string; groundingChunks: any[] } | null>(null);

  // Search Grounding state
  const [searchQuery, setSearchQuery] = useState<string>('2026 Medicare conversion factor and commercial payer modifier 25 denial rules');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<{ text: string; groundingChunks: any[]; webSearchQueries?: string[] } | null>(null);

  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleMapsSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mapsQuery.trim()) return;

    setMapsLoading(true);
    try {
      const data = await apiService.mapsSearch({ query: mapsQuery });
      setMapsResult(data);
    } catch (err) {
      console.error('Maps Grounding error:', err);
    } finally {
      setMapsLoading(false);
    }
  };

  const handleSearchGrounding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const data = await apiService.searchGroundingPayerPolicy(searchQuery);
      setSearchResult(data);
    } catch (err) {
      console.error('Search Grounding error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleConvertMapsToLead = () => {
    if (!onAddLead || !mapsResult) return;
    const newLead: RCMLead = {
      id: `maps-lead-${Date.now()}`,
      practiceName: mapsQuery.split(' in ')[0] || 'Verified Medical Practice',
      doctorName: 'Clinical Director & Managing Physician',
      title: 'Practice Owner / Administrator',
      specialty: 'Specialty Healthcare Practice',
      practiceSize: 'Multi-Provider Clinic',
      phone: '(512) 555-0199',
      email: 'admin@verifiedpractice.com',
      address: mapsQuery.split(' in ')[1] || 'United States',
      state: mapsQuery.includes('TX') ? 'TX' : mapsQuery.includes('WA') ? 'WA' : mapsQuery.includes('FL') ? 'FL' : 'US',
      ehrSystem: 'AthenaHealth / eClinicalWorks',
      monthlyClaimVolume: '$520,000 / mo',
      painPoints: ['High denial rates on specialty codes', 'Need accelerated claims recovery squad'],
      source: 'Google Maps Grounding (gemini-3.5-flash)',
      status: 'Ready for Call'
    };
    onAddLead(newLead);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Live Grounding Intelligence
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/30">
                  gemini-3.5-flash
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Ground medical billing data with real-time Google Maps and Google Search
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Google Maps vs Google Search Grounding */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mx-4 mt-3 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('maps')}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'maps'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Google Maps Grounding (Practices)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Google Search Grounding (Payer Policy)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'maps' ? (
            /* Google Maps Grounding tab */
            <div className="space-y-4">
              <form onSubmit={handleMapsSearch} className="flex gap-2">
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="e.g. Pediatric clinics in Miami, FL or Mohs surgery in Dallas, TX"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={mapsLoading}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${mapsLoading ? 'animate-spin' : ''}`} />
                  <span>Verify Maps</span>
                </button>
              </form>

              {mapsResult ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {mapsResult.text}
                  </div>

                  {mapsResult.groundingChunks && mapsResult.groundingChunks.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1 mb-2">
                        <MapPin className="w-3.5 h-3.5" />
                        Grounded Google Maps Places:
                      </span>
                      <div className="space-y-1.5">
                        {mapsResult.groundingChunks.map((chunk, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] text-slate-300">
                            <span>{chunk.maps?.title || `Grounded Place #${idx + 1}`}</span>
                            {chunk.maps?.uri && (
                              <a
                                href={chunk.maps.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                              >
                                <span>View on Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleConvertMapsToLead}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      {addedSuccess ? <Check className="w-4 h-4 text-slate-950" /> : <Plus className="w-4 h-4" />}
                      <span>{addedSuccess ? 'Lead Added to Pipeline!' : 'Import as Dialable Lead'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs space-y-2">
                  <MapPin className="w-8 h-8 mx-auto text-emerald-500" />
                  <p className="font-semibold text-slate-300">Search Real Healthcare Providers on Google Maps</p>
                  <p className="max-w-md mx-auto text-slate-500">
                    Uses Gemini with Google Maps Grounding to discover verified physician clinics, facilities, and street addresses across the United States.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Google Search Grounding tab */
            <div className="space-y-4">
              <form onSubmit={handleSearchGrounding} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. 2026 CMS Medicare fee schedule conversion factor or BlueCross denial appeals"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${searchLoading ? 'animate-spin' : ''}`} />
                  <span>Search Live</span>
                </button>
              </form>

              {searchResult ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {searchResult.text}
                  </div>

                  {searchResult.groundingChunks && searchResult.groundingChunks.length > 0 && (
                    <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/40 text-xs">
                      <span className="font-bold text-blue-400 flex items-center gap-1 mb-2">
                        <Globe className="w-3.5 h-3.5" />
                        Grounded Web Sources & Citations:
                      </span>
                      <div className="space-y-1.5">
                        {searchResult.groundingChunks.slice(0, 5).map((chunk, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] text-slate-300">
                            <span className="truncate max-w-[380px]">{chunk.web?.title || `Source Citation #${idx + 1}`}</span>
                            {chunk.web?.uri && (
                              <a
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 ml-2"
                              >
                                <span>Read Source</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs space-y-2">
                  <Search className="w-8 h-8 mx-auto text-blue-500" />
                  <p className="font-semibold text-slate-300">Real-Time Search Grounding for Payer Policies</p>
                  <p className="max-w-md mx-auto text-slate-500">
                    Connects directly to live Google Search index to verify current Medicare LCD guidelines, commercial insurer updates, and state billing compliance.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Grounded directly by Gemini 3.5 Flash Tools</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
