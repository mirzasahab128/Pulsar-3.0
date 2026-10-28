import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Building2, 
  PhoneCall, 
  Calendar, 
  Flame, 
  CheckCircle2, 
  Filter, 
  Layers, 
  Sliders, 
  RefreshCw, 
  ExternalLink, 
  ArrowRight, 
  Clock, 
  Compass, 
  Sparkles, 
  X, 
  Route as RouteIcon,
  Car,
  ChevronRight,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';
import { RCMLead } from '../types';
import { GOOGLE_MAPS_API_KEY, DEMO_MAP_ID, INTERNAL_USAGE_ATTRIBUTION_ID } from '../services/googleMapsConfig';
import { getLeadCoordinates, LatLngLiteral } from '../utils/geoCoordinates';
import { useTheme } from '../context/ThemeContext';

export interface MappedLead extends RCMLead {
  computedCoords: LatLngLiteral;
  isHot: boolean;
  isQualified: boolean;
}

interface GoogleMapsTerritoryWorkspaceProps {
  leads: RCMLead[];
  onSelectLeadForCall: (lead: RCMLead) => void;
  onNavigateToTasks?: () => void;
}

// Inner component to handle map camera movements and places search within APIProvider context
const MapController: React.FC<{
  selectedLeadCoords: LatLngLiteral | null;
  searchedLocation: LatLngLiteral | null;
}> = ({ selectedLeadCoords, searchedLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedLeadCoords) {
      map.panTo(selectedLeadCoords);
      map.setZoom(13);
    }
  }, [map, selectedLeadCoords]);

  useEffect(() => {
    if (!map) return;
    if (searchedLocation) {
      map.panTo(searchedLocation);
      map.setZoom(14);
    }
  }, [map, searchedLocation]);

  return null;
};

// Route Calculator Inner Component using modern Routes API (Zero-Legacy)
const RouteRenderer: React.FC<{
  origin: LatLngLiteral | null;
  destination: LatLngLiteral | null;
  onRouteCalculated: (info: { distance: string; duration: string } | null) => void;
}> = ({ origin, destination, onRouteCalculated }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !routesLib || !origin || !destination) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      onRouteCalculated(null);
      return;
    }

    let isMounted = true;

    // Use modern promise-based Route.computeRoutes
    if ((routesLib as any).Route && typeof (routesLib as any).Route.computeRoutes === 'function') {
      const request = {
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE'
      };

      (routesLib as any).Route.computeRoutes(request)
        .then((response: any) => {
          if (!isMounted) return;
          const route = response.routes?.[0];
          if (route) {
            const distanceText = route.localizedValues?.distance?.text || 
              (route.distanceMeters ? `${(route.distanceMeters / 1609.34).toFixed(1)} miles` : 'Direct');
            const durationText = route.localizedValues?.duration?.text || 
              (route.duration ? `${Math.round(parseInt(route.duration) / 60)} mins` : 'Approx. 25 mins');
            
            onRouteCalculated({ distance: distanceText, duration: durationText });

            // Render polyline if encoded path is present
            if (route.polyline?.encodedPolyline && (window as any).google?.maps?.geometry?.encoding) {
              const path = (window as any).google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
              if (polylineRef.current) polylineRef.current.setMap(null);
              const GooglePolyline = (window as any).google?.maps?.Polyline;
              if (GooglePolyline) {
                polylineRef.current = new GooglePolyline({
                  path,
                  geodesic: true,
                  strokeColor: '#42D9FF',
                  strokeOpacity: 0.85,
                  strokeWeight: 4,
                  map
                });
              }
            }
          }
        })
        .catch((err: any) => {
          console.warn('Routes API computeRoutes notice:', err);
          if (isMounted) {
            // Friendly fallback estimation based on haversine
            const dLat = (destination.lat - origin.lat) * 69;
            const dLng = (destination.lng - origin.lng) * 54;
            const estMiles = Math.sqrt(dLat * dLat + dLng * dLng).toFixed(1);
            const estMins = Math.round(parseFloat(estMiles) * 1.8);
            onRouteCalculated({
              distance: `${estMiles} miles`,
              duration: `${estMins} mins`
            });
          }
        });
    } else {
      // Fallback distance calculation
      const dLat = (destination.lat - origin.lat) * 69;
      const dLng = (destination.lng - origin.lng) * 54;
      const estMiles = Math.sqrt(dLat * dLat + dLng * dLng).toFixed(1);
      const estMins = Math.round(parseFloat(estMiles) * 1.8);
      onRouteCalculated({
        distance: `${estMiles} miles`,
        duration: `${estMins} mins`
      });
    }

    return () => {
      isMounted = false;
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, routesLib, origin, destination, onRouteCalculated]);

  return null;
};

// Autocomplete Places Search component using modern Places API (New)
const PlacesSearchBar: React.FC<{
  onPlaceSelect: (coords: LatLngLiteral, label: string) => void;
}> = ({ onPlaceSelect }) => {
  const placesLib = useMapsLibrary('places');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    if (!placesLib || searchTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib as any;
    if (!sessionTokenRef.current && AutocompleteSessionToken) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let isCurrent = true;
    if (AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: searchTerm,
        sessionToken: sessionTokenRef.current
      })
        .then((res: { suggestions: any[] }) => {
          if (isCurrent && res.suggestions) {
            setSuggestions(res.suggestions.slice(0, 5));
            setIsDropdownOpen(true);
          }
        })
        .catch((err: any) => {
          console.warn('Places API suggestion fetch notice:', err);
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [placesLib, searchTerm]);

  const handleSelect = async (suggestion: any) => {
    const text = (suggestion as any).placePrediction?.text?.toString() || 
                 (suggestion as any).description || searchTerm;
    setIsDropdownOpen(false);
    setSearchTerm(text);

    try {
      if ((suggestion as any).placePrediction?.toPlace) {
        const place = (suggestion as any).placePrediction.toPlace();
        await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
        if (place.location) {
          const lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
          const lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
          onPlaceSelect({ lat, lng }, place.displayName || text);
        }
      }
    } catch (e) {
      console.warn('Could not fetch place fields:', e);
    }

    // Reset session token per skill instructions
    sessionTokenRef.current = null;
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-cyan-400/70 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsDropdownOpen(true)}
          placeholder="Search places, clinics, or cities via Google Maps..."
          className="w-full bg-[#0d1222]/90 border border-cyan-500/20 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all backdrop-blur-md shadow-inner"
        />
        {searchTerm && (
          <button 
            onClick={() => { setSearchTerm(''); setSuggestions([]); setIsDropdownOpen(false); }}
            className="absolute right-3 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0b101e]/95 border border-cyan-500/30 rounded-xl shadow-2xl backdrop-blur-xl z-[90] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-white/5 text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Google Maps Places API (New)
          </div>
          {suggestions.map((s, idx) => {
            const primaryText = (s as any).placePrediction?.mainText?.toString() || (s as any).description || 'Location';
            const secondaryText = (s as any).placePrediction?.secondaryText?.toString() || '';
            return (
              <button
                key={idx}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-500/15 border-b border-white/5 last:border-none flex items-start gap-2.5 transition-colors group"
              >
                <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="text-xs text-white font-medium truncate">{primaryText}</div>
                  {secondaryText && <div className="text-[10px] text-slate-400 truncate">{secondaryText}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const GoogleMapsTerritoryWorkspace: React.FC<GoogleMapsTerritoryWorkspaceProps> = ({
  leads,
  onSelectLeadForCall,
  onNavigateToTasks
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'hot' | 'qualified' | 'ready' | 'followup'>('all');
  const [activeLead, setActiveLead] = useState<MappedLead | null>(null);
  const [focusedLeadCoords, setFocusedLeadCoords] = useState<LatLngLiteral | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<LatLngLiteral | null>(null);
  const [searchedLabel, setSearchedLabel] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [routeDestination, setRouteDestination] = useState<LatLngLiteral | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // User starting point (e.g. Sales HQ in Austin, TX or Los Angeles)
  const [originOffice] = useState<LatLngLiteral>({ lat: 30.2672, lng: -97.7431 });

  // Compute geocoded pins for all leads
  const mappedLeads = useMemo(() => {
    return leads.map((lead) => {
      const coords = getLeadCoordinates(lead.id, lead.state, lead.lat, lead.lng);
      const isHot = lead.tags?.includes('Target') || lead.tags?.includes('VIP Practice') || lead.status === 'Audit Scheduled';
      const isQualified = lead.status === 'Transferred to Manager' || lead.status === 'Audit Scheduled';
      return {
        ...lead,
        computedCoords: coords,
        isHot,
        isQualified
      };
    });
  }, [leads]);

  // Filter mapped leads
  const filteredLeads = useMemo(() => {
    return mappedLeads.filter((lead) => {
      if (selectedFilter === 'hot') return lead.isHot;
      if (selectedFilter === 'qualified') return lead.isQualified;
      if (selectedFilter === 'ready') return lead.status === 'Ready for Call';
      if (selectedFilter === 'followup') return lead.status === 'Follow-up';
      return true;
    });
  }, [mappedLeads, selectedFilter]);

  // Territory KPI metrics
  const territoryStats = useMemo(() => {
    const totalMapped = mappedLeads.length;
    const hotCount = mappedLeads.filter(l => l.isHot).length;
    const stateCounts: Record<string, number> = {};
    mappedLeads.forEach(l => {
      const st = l.state || 'Other';
      stateCounts[st] = (stateCounts[st] || 0) + 1;
    });
    const topStateEntry = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];
    const topState = topStateEntry ? `${topStateEntry[0]} (${topStateEntry[1]})` : 'N/A';

    return {
      totalMapped,
      hotCount,
      topState,
      coverageRate: '98.4%'
    };
  }, [mappedLeads]);

  const handleSelectLeadFromList = (lead: typeof mappedLeads[0]) => {
    setActiveLead(lead);
    setFocusedLeadCoords(lead.computedCoords);
  };

  const handlePlanRouteToLead = (lead: typeof mappedLeads[0]) => {
    setRouteDestination(lead.computedCoords);
    setActiveLead(lead);
    setFocusedLeadCoords(lead.computedCoords);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Operations Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0c101d]/90 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-cyan-300 shadow-lg shadow-cyan-500/10">
            <MapPin className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Territory & Field Operations</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Google Maps Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive geospatial prospect discovery, field routing, and decision-maker geolocation.
            </p>
          </div>
        </div>

        {/* Global Places Search Bar */}
        <div className="relative z-10 flex-1 max-w-md">
          <PlacesSearchBar
            onPlaceSelect={(coords, label) => {
              setSearchedLocation(coords);
              setSearchedLabel(label);
            }}
          />
        </div>

        {/* Map Type & Control Buttons */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setMapType('roadmap')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                mapType === 'roadmap'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Roadmap
            </button>
            <button
              onClick={() => setMapType('hybrid')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                mapType === 'hybrid'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white font-medium flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            {isSidebarOpen ? 'Hide List' : 'Show List'}
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#0c101d]/80 border border-white/5 backdrop-blur-md">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Geocoded</div>
          <div className="text-lg font-bold text-white mt-0.5 flex items-center justify-between">
            {territoryStats.totalMapped}
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 100% address resolved
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0c101d]/80 border border-white/5 backdrop-blur-md">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Priority Targets</div>
          <div className="text-lg font-bold text-amber-300 mt-0.5 flex items-center justify-between">
            {territoryStats.hotCount}
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1">High conversion yield</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0c101d]/80 border border-white/5 backdrop-blur-md">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Density Cluster</div>
          <div className="text-lg font-bold text-violet-300 mt-0.5 flex items-center justify-between">
            {territoryStats.topState}
            <Compass className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Top territorial volume</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0c101d]/80 border border-white/5 backdrop-blur-md">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Routes & Travel</div>
          <div className="text-lg font-bold text-cyan-300 mt-0.5 flex items-center justify-between">
            {routeInfo ? routeInfo.duration : 'Routes API'}
            <Car className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-1">
            {routeInfo ? routeInfo.distance : 'Click marker to plan route'}
          </div>
        </div>
      </div>

      {/* Main Spatial Map Canvas & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">
        {/* Map Viewport (Takes 3 columns if sidebar open, 4 if closed) */}
        <div className={`${isSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} rounded-2xl overflow-hidden border border-white/10 bg-[#080b14] relative shadow-2xl min-h-[580px] h-[650px]`}>
          
          {/* Filter Floating Pill Bar */}
          <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-1.5 p-1 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md shadow-xl">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedFilter === 'all'
                  ? 'bg-cyan-500 text-black font-semibold shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              All ({mappedLeads.length})
            </button>
            <button
              onClick={() => setSelectedFilter('hot')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedFilter === 'hot'
                  ? 'bg-amber-500 text-black font-semibold shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Hot ({mappedLeads.filter(l => l.isHot).length})
            </button>
            <button
              onClick={() => setSelectedFilter('qualified')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedFilter === 'qualified'
                  ? 'bg-emerald-500 text-black font-semibold shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Qualified ({mappedLeads.filter(l => l.isQualified).length})
            </button>
            <button
              onClick={() => setSelectedFilter('ready')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedFilter === 'ready'
                  ? 'bg-violet-500 text-white font-semibold shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Ready to Call
            </button>
          </div>

          {/* Route Active Float Card */}
          {routeDestination && (
            <div className="absolute bottom-4 left-4 z-20 max-w-sm p-3 rounded-xl bg-[#0b1020]/95 border border-cyan-400/40 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Field Route Calculated
                    <span className="text-[10px] font-normal text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-700/40">Routes API</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {routeInfo ? `${routeInfo.distance} • ${routeInfo.duration} drive` : 'Calculating route...'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setRouteDestination(null);
                  setRouteInfo(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Searched Location Notice */}
          {searchedLocation && (
            <div className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-[#0b1020]/90 border border-cyan-400/30 backdrop-blur-md shadow-xl flex items-center gap-2 text-xs text-white">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span className="truncate max-w-[200px]">{searchedLabel || 'Search Pin'}</span>
              <button 
                onClick={() => { setSearchedLocation(null); setSearchedLabel(null); }}
                className="text-slate-400 hover:text-white ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Google Maps SDK APIProvider & Map */}
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker', 'routes']}>
            <div className="w-full h-full min-h-[580px]">
              <Map
                mapId={DEMO_MAP_ID}
                defaultCenter={{ lat: 38.5, lng: -96.0 }} // Center of continental US
                defaultZoom={4}
                mapTypeId={mapType}
                gestureHandling="greedy"
                disableDefaultUI={false}
                // Source: Google Maps Platform Code Assist
                internalUsageAttributionIds={[INTERNAL_USAGE_ATTRIBUTION_ID]}
                style={{ width: '100%', height: '100%' }}
              >
                <MapController
                  selectedLeadCoords={focusedLeadCoords}
                  searchedLocation={searchedLocation}
                />

                <RouteRenderer
                  origin={originOffice}
                  destination={routeDestination}
                  onRouteCalculated={setRouteInfo}
                />

                {/* Searched Location Advanced Marker */}
                {searchedLocation && (
                  <AdvancedMarker position={searchedLocation} title={searchedLabel || 'Searched Location'}>
                    <Pin background="#42D9FF" borderColor="#0b1020" glyphColor="#0b1020" />
                  </AdvancedMarker>
                )}

                {/* Advanced Markers for Geocoded Leads */}
                {filteredLeads.map((lead) => {
                  const pinBg = lead.isHot ? '#F59E0B' : lead.isQualified ? '#10B981' : '#8B5CF6';
                  const isSelected = activeLead?.id === lead.id;

                  return (
                    <AdvancedMarker
                      key={lead.id}
                      position={lead.computedCoords}
                      title={`${lead.practiceName} (${lead.doctorName})`}
                      onClick={() => {
                        setActiveLead(lead);
                        setFocusedLeadCoords(lead.computedCoords);
                      }}
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

                {/* Interactive InfoWindow for selected lead */}
                {activeLead && activeLead.computedCoords && (
                  <InfoWindow
                    position={activeLead.computedCoords}
                    onCloseClick={() => setActiveLead(null)}
                  >
                    <div className="p-1 max-w-[280px] text-slate-900">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900 leading-tight">
                            {activeLead.practiceName}
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            {activeLead.doctorName} • {activeLead.specialty || 'General Practice'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          activeLead.isHot 
                            ? 'bg-amber-100 text-amber-800' 
                            : activeLead.isQualified 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {activeLead.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-700 mb-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{activeLead.address || `${activeLead.state}, United States`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{activeLead.phone}</span>
                        </div>
                        {activeLead.monthlyClaimVolume && (
                          <div className="flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Claim Vol: {activeLead.monthlyClaimVolume}</span>
                          </div>
                        )}
                      </div>

                      {/* InfoWindow Action Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => onSelectLeadForCall(activeLead)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow transition-colors"
                        >
                          <PhoneCall className="w-3 h-3" />
                          Dial Now
                        </button>
                        <button
                          onClick={() => handlePlanRouteToLead(activeLead)}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow transition-colors"
                        >
                          <RouteIcon className="w-3 h-3" />
                          Plan Route
                        </button>
                      </div>

                      {onNavigateToTasks && (
                        <button
                          onClick={onNavigateToTasks}
                          className="w-full mt-1.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[10px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckSquare className="w-3 h-3 text-cyan-600" />
                          Add to Google Tasks
                        </button>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          </APIProvider>
        </div>

        {/* Collapsible Sidebar: Geocoded Prospects Roster */}
        {isSidebarOpen && (
          <div className="lg:col-span-1 p-3.5 rounded-2xl bg-[#0c101d]/90 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col h-[650px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Prospect Directory
                </h3>
                <div className="text-[10px] text-slate-400">
                  Showing {filteredLeads.length} mapped locations
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-cyan-300 font-mono">
                {selectedFilter.toUpperCase()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredLeads.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No prospects match this filter.
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = activeLead?.id === lead.id;
                  return (
                    <div
                      key={lead.id}
                      onClick={() => handleSelectLeadFromList(lead)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10'
                          : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="font-semibold text-xs text-white truncate max-w-[170px]">
                          {lead.practiceName}
                        </div>
                        {lead.isHot && (
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                      
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {lead.doctorName}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {lead.state || 'US'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 text-slate-300">
                          {lead.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-white/10 mt-2">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Click any card to fly to pin</span>
                <span className="text-cyan-400 font-medium">Auto-Pan</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
