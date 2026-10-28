import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Layers, 
  Building2, 
  TrendingUp, 
  Filter, 
  Sparkles, 
  PhoneCall, 
  Stethoscope, 
  Info,
  Maximize2,
  DollarSign,
  Activity,
  CheckCircle2,
  X
} from 'lucide-react';
import { RCMLead } from '../types';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY, DEMO_MAP_ID, INTERNAL_USAGE_ATTRIBUTION_ID } from '../services/googleMapsConfig';
import { getLeadCoordinates } from '../utils/geoCoordinates';

interface USLeadDensityMapProps {
  leads: RCMLead[];
  selectedStateFilter: string;
  onSelectState: (state: string) => void;
  onSelectLeadForCall: (lead: RCMLead) => void;
}

// US States with SVG centroid / position for display & markers
interface StateGeoData {
  abbr: string;
  name: string;
  region: 'West' | 'Midwest' | 'South' | 'Northeast';
  x: number;
  y: number;
  width?: number;
  height?: number;
}

const US_STATES_DATA: StateGeoData[] = [
  // West
  { abbr: 'WA', name: 'Washington', region: 'West', x: 120, y: 70 },
  { abbr: 'OR', name: 'Oregon', region: 'West', x: 100, y: 140 },
  { abbr: 'CA', name: 'California', region: 'West', x: 80, y: 270 },
  { abbr: 'NV', name: 'Nevada', region: 'West', x: 145, y: 220 },
  { abbr: 'ID', name: 'Idaho', region: 'West', x: 190, y: 130 },
  { abbr: 'MT', name: 'Montana', region: 'West', x: 270, y: 80 },
  { abbr: 'WY', name: 'Wyoming', region: 'West', x: 280, y: 170 },
  { abbr: 'UT', name: 'Utah', region: 'West', x: 220, y: 240 },
  { abbr: 'CO', name: 'Colorado', region: 'West', x: 320, y: 260 },
  { abbr: 'AZ', name: 'Arizona', region: 'West', x: 190, y: 350 },
  { abbr: 'NM', name: 'New Mexico', region: 'West', x: 280, y: 360 },
  { abbr: 'AK', name: 'Alaska', region: 'West', x: 90, y: 490 },
  { abbr: 'HI', name: 'Hawaii', region: 'West', x: 210, y: 500 },

  // Midwest
  { abbr: 'ND', name: 'North Dakota', region: 'Midwest', x: 390, y: 90 },
  { abbr: 'SD', name: 'South Dakota', region: 'Midwest', x: 390, y: 160 },
  { abbr: 'NE', name: 'Nebraska', region: 'Midwest', x: 410, y: 230 },
  { abbr: 'KS', name: 'Kansas', region: 'Midwest', x: 430, y: 300 },
  { abbr: 'MN', name: 'Minnesota', region: 'Midwest', x: 490, y: 120 },
  { abbr: 'IA', name: 'Iowa', region: 'Midwest', x: 500, y: 210 },
  { abbr: 'MO', name: 'Missouri', region: 'Midwest', x: 520, y: 290 },
  { abbr: 'WI', name: 'Wisconsin', region: 'Midwest', x: 560, y: 140 },
  { abbr: 'IL', name: 'Illinois', region: 'Midwest', x: 570, y: 230 },
  { abbr: 'MI', name: 'Michigan', region: 'Midwest', x: 650, y: 160 },
  { abbr: 'IN', name: 'Indiana', region: 'Midwest', x: 630, y: 240 },
  { abbr: 'OH', name: 'Ohio', region: 'Midwest', x: 690, y: 230 },

  // South
  { abbr: 'OK', name: 'Oklahoma', region: 'South', x: 440, y: 370 },
  { abbr: 'TX', name: 'Texas', region: 'South', x: 420, y: 460 },
  { abbr: 'AR', name: 'Arkansas', region: 'South', x: 530, y: 360 },
  { abbr: 'LA', name: 'Louisiana', region: 'South', x: 540, y: 450 },
  { abbr: 'KY', name: 'Kentucky', region: 'South', x: 660, y: 290 },
  { abbr: 'TN', name: 'Tennessee', region: 'South', x: 650, y: 330 },
  { abbr: 'MS', name: 'Mississippi', region: 'South', x: 590, y: 410 },
  { abbr: 'AL', name: 'Alabama', region: 'South', x: 650, y: 400 },
  { abbr: 'GA', name: 'Georgia', region: 'South', x: 720, y: 390 },
  { abbr: 'FL', name: 'Florida', region: 'South', x: 770, y: 480 },
  { abbr: 'SC', name: 'South Carolina', region: 'South', x: 760, y: 350 },
  { abbr: 'NC', name: 'North Carolina', region: 'South', x: 780, y: 300 },
  { abbr: 'VA', name: 'Virginia', region: 'South', x: 770, y: 250 },
  { abbr: 'WV', name: 'West Virginia', region: 'South', x: 720, y: 250 },
  { abbr: 'MD', name: 'Maryland', region: 'South', x: 790, y: 220 },
  { abbr: 'DE', name: 'Delaware', region: 'South', x: 825, y: 220 },
  { abbr: 'DC', name: 'Washington DC', region: 'South', x: 805, y: 235 },

  // Northeast
  { abbr: 'PA', name: 'Pennsylvania', region: 'Northeast', x: 760, y: 190 },
  { abbr: 'NJ', name: 'New Jersey', region: 'Northeast', x: 825, y: 195 },
  { abbr: 'NY', name: 'New York', region: 'Northeast', x: 795, y: 135 },
  { abbr: 'CT', name: 'Connecticut', region: 'Northeast', x: 840, y: 165 },
  { abbr: 'RI', name: 'Rhode Island', region: 'Northeast', x: 865, y: 160 },
  { abbr: 'MA', name: 'Massachusetts', region: 'Northeast', x: 855, y: 140 },
  { abbr: 'VT', name: 'Vermont', region: 'Northeast', x: 820, y: 100 },
  { abbr: 'NH', name: 'New Hampshire', region: 'Northeast', x: 850, y: 95 },
  { abbr: 'ME', name: 'Maine', region: 'Northeast', x: 885, y: 65 }
];

// Approximate city coordinate offsets for practice pin markers
const CITY_COORDINATES: Record<string, { x: number; y: number }> = {
  'Austin, TX': { x: 425, y: 450 },
  'Dallas, TX': { x: 440, y: 415 },
  'Houston, TX': { x: 460, y: 470 },
  'San Antonio, TX': { x: 415, y: 475 },
  'Seattle, WA': { x: 125, y: 65 },
  'Boston, MA': { x: 855, y: 140 },
  'Atlanta, GA': { x: 715, y: 385 },
  'Miami, FL': { x: 800, y: 520 },
  'Tampa, FL': { x: 760, y: 465 },
  'Orlando, FL': { x: 775, y: 450 },
  'Los Angeles, CA': { x: 95, y: 315 },
  'San Francisco, CA': { x: 65, y: 240 },
  'San Diego, CA': { x: 110, y: 345 },
  'New York, NY': { x: 815, y: 175 },
  'Chicago, IL': { x: 585, y: 200 },
  'Phoenix, AZ': { x: 195, y: 345 },
  'Denver, CO': { x: 320, y: 255 }
};

export const USLeadDensityMap: React.FC<USLeadDensityMapProps> = ({
  leads,
  selectedStateFilter,
  onSelectState,
  onSelectLeadForCall
}) => {
  const [hoveredState, setHoveredState] = useState<StateGeoData | null>(null);
  const [hoveredLead, setHoveredLead] = useState<RCMLead | null>(null);
  const [mapMode, setMapMode] = useState<'google_maps' | 'combined' | 'density' | 'pins'>('google_maps');
  const [selectedMapLead, setSelectedMapLead] = useState<RCMLead | null>(null);
  const [activeRegionFilter, setActiveRegionFilter] = useState<string>('All');

  // Deduplicate incoming leads to guarantee unique key identity
  const uniqueLeads = useMemo(() => {
    const seen = new Set<string>();
    return leads.filter(l => {
      if (!l || !l.id || seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [leads]);

  // Compute lead counts, total pipeline volume, and leads per state
  const stateStats = useMemo(() => {
    const stats: Record<string, { count: number; volumeSum: number; leads: RCMLead[]; specialties: Record<string, number> }> = {};

    US_STATES_DATA.forEach(s => {
      stats[s.abbr] = { count: 0, volumeSum: 0, leads: [], specialties: {} };
    });

    uniqueLeads.forEach(lead => {
      const st = lead.state?.toUpperCase().trim() || 'UNKNOWN';
      if (!stats[st]) {
        stats[st] = { count: 0, volumeSum: 0, leads: [], specialties: {} };
      }
      stats[st].count += 1;
      stats[st].leads.push(lead);

      // Extract numeric claim volume approximation if present
      const match = lead.monthlyClaimVolume.replace(/,/g, '').match(/\$(\d+)/);
      if (match) {
        stats[st].volumeSum += parseInt(match[1], 10);
      } else {
        stats[st].volumeSum += 350000; // default estimated benchmark
      }

      const spec = lead.specialty || 'General';
      stats[st].specialties[spec] = (stats[st].specialties[spec] || 0) + 1;
    });

    return stats;
  }, [leads]);

  // Max lead count for color scaling
  const maxLeadCount = useMemo(() => {
    let max = 1;
    Object.values(stateStats).forEach(s => {
      if (s.count > max) max = s.count;
    });
    return max;
  }, [stateStats]);

  // Regional metrics summary
  const regionalMetrics = useMemo(() => {
    const regions: Record<'West' | 'Midwest' | 'South' | 'Northeast', { leadsCount: number; volume: number; topEhr: Record<string, number> }> = {
      West: { leadsCount: 0, volume: 0, topEhr: {} },
      Midwest: { leadsCount: 0, volume: 0, topEhr: {} },
      South: { leadsCount: 0, volume: 0, topEhr: {} },
      Northeast: { leadsCount: 0, volume: 0, topEhr: {} }
    };

    uniqueLeads.forEach(l => {
      const stateData = US_STATES_DATA.find(s => s.abbr === l.state?.toUpperCase());
      const reg = stateData ? stateData.region : 'South';
      regions[reg].leadsCount += 1;
      
      const match = l.monthlyClaimVolume.replace(/,/g, '').match(/\$(\d+)/);
      regions[reg].volume += match ? parseInt(match[1], 10) : 350000;

      const ehr = l.ehrSystem || 'AthenaHealth';
      regions[reg].topEhr[ehr] = (regions[reg].topEhr[ehr] || 0) + 1;
    });

    return regions;
  }, [uniqueLeads]);

  // Helper for state node color based on lead density
  const getStateColor = (abbr: string) => {
    const data = stateStats[abbr];
    const count = data ? data.count : 0;
    const isSelected = selectedStateFilter.toUpperCase() === abbr.toUpperCase();

    if (isSelected) {
      return {
        fill: 'rgba(20, 184, 166, 0.85)',
        stroke: '#2dd4bf',
        strokeWidth: 3,
        glow: 'rgba(45, 212, 191, 0.9)'
      };
    }

    if (count === 0) {
      return {
        fill: 'rgba(15, 23, 42, 0.65)',
        stroke: 'rgba(51, 65, 85, 0.4)',
        strokeWidth: 1.2,
        glow: 'none'
      };
    } else if (count === 1) {
      return {
        fill: 'rgba(13, 148, 136, 0.35)',
        stroke: 'rgba(20, 184, 166, 0.6)',
        strokeWidth: 1.5,
        glow: 'rgba(20, 184, 166, 0.3)'
      };
    } else if (count <= 3) {
      return {
        fill: 'rgba(13, 148, 136, 0.65)',
        stroke: 'rgba(45, 212, 191, 0.85)',
        strokeWidth: 2,
        glow: 'rgba(45, 212, 191, 0.5)'
      };
    } else {
      return {
        fill: 'rgba(16, 185, 129, 0.85)',
        stroke: '#34d399',
        strokeWidth: 2.5,
        glow: 'rgba(52, 211, 153, 0.8)'
      };
    }
  };

  // Resolve pin coordinates for each lead
  const leadPins = useMemo(() => {
    return uniqueLeads.map(lead => {
      // Check for exact city coordinate match
      const cityKey = Object.keys(CITY_COORDINATES).find(c => 
        lead.address.toLowerCase().includes(c.split(',')[0].toLowerCase())
      );

      if (cityKey && CITY_COORDINATES[cityKey]) {
        return {
          lead,
          x: CITY_COORDINATES[cityKey].x,
          y: CITY_COORDINATES[cityKey].y
        };
      }

      // Fallback to state centroid with minor pseudo-random jitter based on lead id
      const st = US_STATES_DATA.find(s => s.abbr === lead.state?.toUpperCase());
      if (st) {
        const hash = lead.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const offsetX = ((hash % 21) - 10) * 1.5;
        const offsetY = (((hash >> 2) % 21) - 10) * 1.5;
        return {
          lead,
          x: st.x + offsetX,
          y: st.y + offsetY
        };
      }

      return {
        lead,
        x: 450,
        y: 350
      };
    });
  }, [uniqueLeads]);

  return (
    <div className="space-y-4">
      {/* Map Header & Controls */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 bg-slate-950/70 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[11px] font-semibold uppercase tracking-wider mb-1">
            <Layers className="w-3 h-3 text-teal-400" />
            Geographic Density & Field Radar
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>US Provider Coverage & Pipeline Density</span>
            {selectedStateFilter !== 'All' && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">
                Filtered: {selectedStateFilter} ({stateStats[selectedStateFilter]?.count || 0} leads)
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">
            Interactive territory map showing clinical accounts, EHR concentrations, and monthly billing claim densities. Click any state or practice pin to filter.
          </p>
        </div>

        {/* View Mode & Reset Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="p-1 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMapMode('google_maps')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                mapMode === 'google_maps' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                  : 'text-cyan-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
              Google Maps Live
            </button>
            <button
              type="button"
              onClick={() => setMapMode('combined')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                mapMode === 'combined' 
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Density SVG
            </button>
            <button
              type="button"
              onClick={() => setMapMode('density')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                mapMode === 'density' 
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Heatmap Only
            </button>
            <button
              type="button"
              onClick={() => setMapMode('pins')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                mapMode === 'pins' 
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Practice Pins
            </button>
          </div>

          {/* Reset Filter Button */}
          {selectedStateFilter !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectState('All')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear State ({selectedStateFilter})</span>
            </button>
          )}
        </div>
      </div>

      {/* Regional Quick Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['South', 'West', 'Northeast', 'Midwest'] as const).map(regName => {
          const reg = regionalMetrics[regName];
          const isFilterActive = activeRegionFilter === regName;
          const topEhrKey = Object.entries(reg.topEhr).sort((a, b) => b[1] - a[1])[0]?.[0] || 'AthenaHealth';

          return (
            <div
              key={regName}
              onClick={() => setActiveRegionFilter(isFilterActive ? 'All' : regName)}
              className={`p-3 rounded-xl glass-card border transition cursor-pointer ${
                isFilterActive 
                  ? 'border-teal-400 bg-teal-950/30 ring-1 ring-teal-400/40' 
                  : 'border-white/10 hover:border-white/20 bg-slate-950/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">{regName} Region</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-white/10">
                  {reg.leadsCount} Prospects
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-black text-white font-mono">
                  ${(reg.volume / 1000000).toFixed(1)}M
                </span>
                <span className="text-[10px] text-slate-400">Mo. Claims</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Top EHR:</span>
                <span className="font-mono text-cyan-300 truncate max-w-[90px]">{topEhrKey}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Map View: Google Maps Platform Live Spatial Canvas OR SVG Density Canvas */}
      {mapMode === 'google_maps' ? (
        <div className="relative overflow-hidden rounded-2xl glass-card border border-cyan-500/30 bg-slate-950/90 shadow-2xl h-[560px] w-full">
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
            <Map
              mapId={DEMO_MAP_ID}
              defaultCenter={{ lat: 38.5, lng: -96.0 }}
              defaultZoom={4}
              gestureHandling="greedy"
              disableDefaultUI={false}
              // Source: Google Maps Platform Code Assist
              internalUsageAttributionIds={[INTERNAL_USAGE_ATTRIBUTION_ID]}
              style={{ width: '100%', height: '100%' }}
            >
              {uniqueLeads.map((lead) => {
                const coords = getLeadCoordinates(lead.id, lead.state, lead.lat, lead.lng);
                const isSelected = selectedMapLead?.id === lead.id;
                const isHot = lead.tags?.includes('Target') || lead.tags?.includes('VIP Practice') || lead.status === 'Audit Scheduled';
                const isQualified = lead.status === 'Transferred to Manager' || lead.status === 'Audit Scheduled';
                const pinBg = isHot ? '#F59E0B' : isQualified ? '#10B981' : '#06B6D4';

                return (
                  <AdvancedMarker
                    key={lead.id}
                    position={coords}
                    title={`${lead.practiceName} (${lead.doctorName})`}
                    onClick={() => setSelectedMapLead(lead)}
                  >
                    <Pin
                      background={pinBg}
                      borderColor="#080A12"
                      glyphColor="#FFFFFF"
                      scale={isSelected ? 1.3 : 1.0}
                    />
                  </AdvancedMarker>
                );
              })}

              {selectedMapLead && (
                <InfoWindow
                  position={getLeadCoordinates(selectedMapLead.id, selectedMapLead.state, selectedMapLead.lat, selectedMapLead.lng)}
                  onCloseClick={() => setSelectedMapLead(null)}
                >
                  <div className="p-1 max-w-[260px] text-slate-900">
                    <div className="font-bold text-xs text-slate-900">{selectedMapLead.practiceName}</div>
                    <div className="text-[11px] text-slate-600">{selectedMapLead.doctorName} • {selectedMapLead.specialty}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{selectedMapLead.address || selectedMapLead.state}</div>
                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-emerald-700">{selectedMapLead.status}</span>
                      <button
                        onClick={() => onSelectLeadForCall(selectedMapLead)}
                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow"
                      >
                        <PhoneCall className="w-3 h-3" />
                        Call Now
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>
      ) : (
        /* Interactive US Density Map SVG Canvas */
        <div className="relative overflow-hidden rounded-2xl glass-card border border-white/10 bg-slate-950/80 p-4 sm:p-6 shadow-2xl">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          <div className="relative z-10 w-full overflow-x-auto">
            <svg
              viewBox="0 0 960 560"
              className="w-full h-auto min-w-[700px] select-none"
            style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}
          >
            <defs>
              {/* Radial gradient for glowing practice pins */}
              <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#0d9488" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#042f2e" stopOpacity="0" />
              </radialGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* US State Territory Shapes / Tiles */}
            {mapMode !== 'pins' && (
              <g id="states-layer">
                {US_STATES_DATA.map((state) => {
                  const data = stateStats[state.abbr];
                  const count = data ? data.count : 0;
                  const colors = getStateColor(state.abbr);
                  const isHovered = hoveredState?.abbr === state.abbr;
                  const isSelected = selectedStateFilter.toUpperCase() === state.abbr.toUpperCase();
                  const matchesRegion = activeRegionFilter === 'All' || state.region === activeRegionFilter;

                  // Dim non-matching regions if region filter active
                  const opacity = matchesRegion ? 1 : 0.35;

                  return (
                    <g
                      key={state.abbr}
                      onClick={() => onSelectState(isSelected ? 'All' : state.abbr)}
                      onMouseEnter={() => setHoveredState(state)}
                      onMouseLeave={() => setHoveredState(null)}
                      className="cursor-pointer transition-all duration-200"
                      style={{ opacity }}
                    >
                      {/* State Rounded Capsule / Geographic Territory Node */}
                      <rect
                        x={state.x - 26}
                        y={state.y - 20}
                        width={52}
                        height={40}
                        rx={10}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isHovered ? colors.strokeWidth + 1.5 : colors.strokeWidth}
                        style={{
                          transition: 'all 0.2s ease',
                          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                          transformOrigin: `${state.x}px ${state.y}px`
                        }}
                      />

                      {/* State Code Text */}
                      <text
                        x={state.x}
                        y={state.y - 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="font-mono text-xs font-bold"
                        fill={count > 0 ? '#ffffff' : '#94a3b8'}
                      >
                        {state.abbr}
                      </text>

                      {/* State Lead Count Pill */}
                      {count > 0 && (
                        <g>
                          <circle
                            cx={state.x + 18}
                            cy={state.y - 14}
                            r={8.5}
                            fill="#0f172a"
                            stroke="#2dd4bf"
                            strokeWidth={1.5}
                          />
                          <text
                            x={state.x + 18}
                            y={state.y - 14}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="font-mono text-[9px] font-black"
                            fill="#2dd4bf"
                          >
                            {count}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Connecting arcs or regional grouping bounds */}
            <g id="territory-connectors" opacity={0.15}>
              <line x1="420" y1="460" x2="770" y2="480" stroke="#2dd4bf" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="420" y1="460" x2="120" y2="70" stroke="#2dd4bf" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="770" y1="480" x2="855" y2="140" stroke="#2dd4bf" strokeWidth="1" strokeDasharray="4 4" />
            </g>

            {/* Practice Pin Markers Layer */}
            {mapMode !== 'density' && (
              <g id="practice-pins-layer">
                {leadPins.map(({ lead, x, y }, index) => {
                  const isHovered = hoveredLead?.id === lead.id;
                  const isReadyForCall = lead.status === 'Ready for Call';

                  return (
                    <g
                      key={`pin-${lead.id}-${index}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLeadForCall(lead);
                      }}
                      onMouseEnter={() => setHoveredLead(lead)}
                      onMouseLeave={() => setHoveredLead(null)}
                      className="cursor-pointer group"
                      transform={`translate(${x}, ${y})`}
                    >
                      {/* Radiating radar pulse animation */}
                      <circle
                        r={isHovered ? 16 : 9}
                        fill="none"
                        stroke={isReadyForCall ? '#2dd4bf' : '#34d399'}
                        strokeWidth="1.5"
                        opacity={isHovered ? 0.9 : 0.4}
                        className={isReadyForCall ? 'animate-ping' : ''}
                        style={{ animationDuration: '2.5s' }}
                      />

                      {/* Glowing center dot */}
                      <circle
                        r={isHovered ? 6 : 4}
                        fill={isReadyForCall ? '#2dd4bf' : '#34d399'}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        style={{
                          filter: 'drop-shadow(0 0 6px rgba(45, 212, 191, 0.9))',
                          transition: 'all 0.2s ease'
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip for Hovered State */}
          {hoveredState && (
            <div className="absolute top-4 right-4 z-20 w-64 p-3.5 rounded-xl glass-modal border border-teal-500/40 shadow-2xl text-xs space-y-2 pointer-events-none animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="font-bold text-white text-sm">{hoveredState.name} ({hoveredState.abbr})</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                  {stateStats[hoveredState.abbr]?.count || 0} Accounts
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Volume:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    ${((stateStats[hoveredState.abbr]?.volumeSum || 0) / 1000).toLocaleString()}k / mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Region:</span>
                  <span className="text-slate-200">{hoveredState.region}</span>
                </div>
                {stateStats[hoveredState.abbr]?.leads[0] && (
                  <div className="pt-1 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 block">Lead Example:</span>
                    <span className="text-teal-300 font-semibold truncate block">
                      {stateStats[hoveredState.abbr].leads[0].practiceName}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-teal-400/90 font-mono italic pt-1">
                Click state to isolate leads
              </div>
            </div>
          )}

          {/* Interactive Floating Tooltip for Hovered Practice Pin */}
          {hoveredLead && (
            <div className="absolute bottom-4 left-4 z-20 max-w-sm p-4 rounded-xl glass-modal border border-emerald-500/50 shadow-2xl text-xs space-y-2.5 pointer-events-none animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {hoveredLead.state} • {hoveredLead.ehrSystem}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{hoveredLead.status}</span>
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{hoveredLead.practiceName}</h4>
                <p className="text-teal-400 text-xs">{hoveredLead.doctorName} • {hoveredLead.specialty}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-white/10 flex items-center justify-between font-mono">
                <span className="text-slate-400 text-[11px]">Monthly Claims:</span>
                <span className="text-emerald-300 font-bold">{hoveredLead.monthlyClaimVolume}</span>
              </div>
              <div className="text-[11px] text-teal-300 flex items-center gap-1 font-semibold">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Click pin to launch autonomous AI call</span>
              </div>
            </div>
          )}
        </div>

        {/* Density Legend & Key */}
        <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
              Density Scale:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-900 border border-slate-700" />
              <span className="text-[11px]">0 Leads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-900/60 border border-teal-500/50" />
              <span className="text-[11px]">1-2 Leads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-600/70 border border-teal-400" />
              <span className="text-[11px]">3-5 Leads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-300" />
              <span className="text-[11px] font-bold text-emerald-400">6+ Leads (Hotspot)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>Pulsing Pins = Practice Locations</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
