/**
 * Google Maps Platform Configuration & Attribution Constants
 * Source: Google Maps Platform Code Assist
 */

export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  'AIzaSyCESzxO08ZD8lbuU7i3cTC15piWf_NTQ5U';

// Required usage attribution ID for Google Maps Platform agentic code
export const INTERNAL_USAGE_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

// Standard demo map ID for AdvancedMarkerElement support
export const DEMO_MAP_ID = 'DEMO_MAP_ID';
