import React, { useState } from 'react';
import { 
  X, 
  Code2, 
  ShieldCheck, 
  Lock, 
  FileCode, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Terminal, 
  Database,
  Cpu,
  Eye,
  Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface CodebaseViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CodeSnippet {
  id: string;
  filename: string;
  category: 'Rules' | 'Blueprint' | 'Services' | 'Autonomous Engine' | 'Niche Library';
  description: string;
  code: string;
}

const SNIPPETS: CodeSnippet[] = [
  {
    id: 'niche-library',
    filename: 'src/data/nicheTemplates.ts',
    category: 'Niche Library',
    description: 'Universal Business Niche Library: Pre-configured templates (Real Estate, SaaS, Recruitment, Healthcare RCM, HVAC, Growth Marketing) auto-populating agent instructions & personas with tenant isolation.',
    code: `// Universal Multi-Tenant Niche Configuration
export interface NicheTemplate {
  id: string;
  name: string;
  category: 'Real Estate' | 'B2B SaaS' | 'Recruitment & Staffing' | 'Healthcare & RCM' | 'Home & Field Services' | 'Growth & Agencies';
  tagline: string;
  targetPersona: {
    targetRoles: string[];
    companyTypes: string[];
    decisionMakers: string[];
    corePainPoints: string[];
  };
  agentConfig: {
    agentName: string;
    tone: 'Consultative' | 'Direct' | 'Analytical' | 'Diplomatic' | 'High-Authority';
    systemPrompt: string;
    valueProposition: string;
    primaryOffer: string;
    objectionHandlers: { objection: string; rebuttal: string }[];
    samplePitchScript: string;
  };
}

// Queries automatically filter by authenticated user's workspaceId
const leadsQuery = query(collection(db, 'leads'), where('workspaceId', '==', activeWorkspaceId));
const notesQuery = query(collection(db, 'meeting_notes'), where('workspaceId', '==', activeWorkspaceId));`
  },
  {
    id: 'firestore-rules',
    filename: 'firestore.rules',
    category: 'Rules',
    description: 'Cloud Firestore RBAC security rules enforcing Admin Master Controller write permissions & Customer Read-Only gates with strict tenant isolation.',
    code: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { 
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }
    
    // User profile access
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && (request.auth.uid == userId || isAdmin());
    }

    // Tenant Isolated Leads: Filtered strictly by user's workspaceId
    match /leads/{leadId} {
      allow read: if isSignedIn() && (
        isAdmin() || 
        (resource.data.workspaceId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.workspaceId)
      );
      allow create, update: if isSignedIn() && (
        isAdmin() || 
        (!get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isReadOnly &&
         request.resource.data.workspaceId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.workspaceId)
      );
      allow delete: if isAdmin();
    }

    // Tenant Isolated Meeting Notes
    match /meeting_notes/{noteId} {
      allow read: if isSignedIn() && (
        isAdmin() || 
        (resource.data.workspaceId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.workspaceId)
      );
      allow create, update: if isSignedIn() && (
        isAdmin() || 
        (!get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isReadOnly &&
         request.resource.data.workspaceId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.workspaceId)
      );
      allow delete: if isAdmin();
    }
  }
}`
  },
  {
    id: 'firebase-blueprint',
    filename: 'firebase-blueprint.json',
    category: 'Blueprint',
    description: 'Intermediate schema representation defining tenant isolation, workspaceId bounds, and customer/admin role structures.',
    code: `{
  "entities": {
    "UserProfile": {
      "collection": "users",
      "fields": {
        "uid": { "type": "string", "required": true },
        "email": { "type": "string", "required": true },
        "workspaceId": { "type": "string", "required": true },
        "role": { "type": "string", "enum": ["admin", "customer"] },
        "isReadOnly": { "type": "boolean" },
        "permissions": { "type": "array" }
      }
    },
    "RCMLead": {
      "collection": "leads",
      "fields": {
        "id": { "type": "string", "required": true },
        "workspaceId": { "type": "string", "required": true },
        "practiceName": { "type": "string", "required": true },
        "doctorName": { "type": "string" },
        "status": { "type": "string" }
      }
    }
  }
}`
  },
  {
    id: 'autonomous-core',
    filename: 'src/components/ZoeyPulsarCore.tsx',
    category: 'Autonomous Engine',
    description: 'Autonomous telephony engine and kinetic orb status beacon with Atom & Leap loading animations.',
    code: `import { Atom, Leap } from "loading-dev";

// Atomic Resonance Indicator on Pulsar Core
export function AtomSize() {
  return (
    <div className="flex items-center gap-6">
      <Atom size={16} />
      <Atom size={24} />
      <Atom size={40} />
    </div>
  );
}

// Autonomous State Transition Monitor
export function LeapLoader() {
  return <Leap size={48} />;
}`
  },
  {
    id: 'voice-listener',
    filename: 'src/hooks/useVoiceCommandListener.ts',
    category: 'Services',
    description: 'Need-based hands-free voice command listener with automatic turn-on/turn-off and hotkey triggers.',
    code: `export type VoiceMode = 'need-based' | 'always-on' | 'off';

// Need-based voice engine automatically powers down after 8s inactivity
// or immediately upon command execution completion.`
  }
];

export const CodebaseViewerModal: React.FC<CodebaseViewerModalProps> = ({ isOpen, onClose }) => {
  const { role, isReadOnly, isMasterAdmin, setQuickProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet>(SNIPPETS[0]);
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedSnippet.code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isMasterAdmin 
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' 
                : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
            }`}>
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Codebase & System Architecture Inspector</h2>
                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border ${
                  isMasterAdmin 
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' 
                    : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                }`}>
                  {isMasterAdmin ? 'Master Controller Access' : 'Customer Read-Only Access'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect architecture blueprints, RBAC security rules, and autonomous engine hooks
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Status Banner */}
        <div className={`px-5 py-2.5 border-b flex items-center justify-between text-xs ${
          isReadOnly 
            ? 'bg-sky-950/40 border-sky-900/50 text-sky-200' 
            : 'bg-amber-950/40 border-amber-900/50 text-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {isReadOnly ? <Lock className="w-4 h-4 text-sky-400 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />}
            <span>
              {isReadOnly ? (
                <>
                  <strong>Customer Account Detected:</strong> You have <strong>strictly read-only access</strong> to the codebase and application architecture. Code modifications, rule deployments, and master dials are restricted.
                </>
              ) : (
                <>
                  <strong>Master Controller Admin Active:</strong> You have <strong>full administrative access</strong> to inspect, configure, and control all operational codebase components.
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setQuickProfile(isReadOnly ? 'admin' : 'customer')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                isReadOnly
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                  : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/40'
              }`}
            >
              Simulate {isReadOnly ? 'Master Controller' : 'Customer View'}
            </button>
          </div>
        </div>

        {/* Main Content: Left file list + Right code preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer Sidebar */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/60 p-3 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Modules & Files ({SNIPPETS.length})
            </div>
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.id}
                onClick={() => setSelectedSnippet(snippet)}
                className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex flex-col gap-1 cursor-pointer ${
                  selectedSnippet.id === snippet.id
                    ? 'bg-slate-800/90 border-slate-700 text-white shadow-sm ring-1 ring-white/10'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold truncate">{snippet.filename}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {snippet.category}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 truncate">{snippet.description}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span className="font-mono font-bold text-white">{selectedSnippet.filename}</span>
                <span className="text-slate-500 text-[11px]">• {selectedSnippet.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-emerald-400 bg-slate-950/95 selection:bg-emerald-500 selection:text-slate-950">
              <pre className="whitespace-pre">{selectedSnippet.code}</pre>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-teal-400" />
              Environment: Google AI Studio Production
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Firestore Database: ai-studio-pulsercmautonomo
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {isReadOnly ? (
              <span className="text-sky-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                READ-ONLY SANDBOX
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                MASTER CONTROLLER READY
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
