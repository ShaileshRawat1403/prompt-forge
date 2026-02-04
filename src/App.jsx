import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wand2,
  Save,
  Copy,
  Download,
  RefreshCw,
  Zap,
  Library,
  Menu,
  X,
  AlertTriangle,
  UserCog,
  Flame,
  Plus,
  Trash2,
  Code2,
  BrainCircuit,
  Home,
  Play,
  History,
  Share2,
  Briefcase,
  Search,
  FileDown,
  Lock,
  Check,
  Settings,
  Terminal,
  Wifi,
  Shield,
  Activity,
  StopCircle,
  Eye,
  EyeOff
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* ERROR BOUNDARY (Reliability) */
/* -------------------------------------------------------------------------- */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PromptForge Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-8 font-mono">
          <div className="bg-white p-8 rounded-2xl shadow-xl border-4 border-red-500 max-w-lg w-full">
            <h1 className="text-3xl font-black text-red-600 mb-4 flex items-center gap-3">
              <AlertTriangle size={32} /> SYSTEM FAILURE
            </h1>
            <p className="text-stone-600 mb-4">The application encountered a critical error.</p>
            <div className="bg-stone-900 text-red-300 p-4 rounded-lg text-xs overflow-auto mb-6 max-h-32">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
            >
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/* AGENT RUNTIME ENGINE (Real Implementation) */
/* -------------------------------------------------------------------------- */

const AGENT_RUNTIME = {
  adapters: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      type: 'commercial',
      defaultUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4-turbo',
      chat: async (config, messages, signal) => {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4-turbo',
            messages,
            temperature: 0.7
          }),
          signal
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || `OpenAI Error: ${res.status}`);
        }
        const data = await res.json();
        return data.choices[0].message.content;
      },
      check: async (config) => {
        if (!config.apiKey) throw new Error('Missing API Key');
        const res = await fetch(`${config.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        });
        if (!res.ok) throw new Error('Invalid API Key');

        if (config.model) {
          const data = await res.json();
          const hasModel = data.data?.some((m) => m.id === config.model);
          if (!hasModel) throw new Error(`Model '${config.model}' not found or not accessible.`);
        }
        return true;
      }
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      type: 'commercial',
      defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-1.5-flash',
      chat: async (config, messages, signal) => {
        const systemMsg = messages.find((m) => m.role === 'system');
        const chatMsgs = messages.filter((m) => m.role !== 'system');

        const contents = chatMsgs.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        const payload = { contents };
        if (systemMsg) {
          payload.system_instruction = { parts: [{ text: systemMsg.content }] };
        }

        const modelId = config.model || 'gemini-1.5-flash';
        const url = `${config.baseUrl}/models/${modelId}:generateContent?key=${config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || `Gemini Error: ${res.status}`);
        }
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
      },
      check: async (config) => {
        if (!config.apiKey) throw new Error('Missing API Key');
        const modelId = config.model || 'gemini-1.5-flash';
        const url = `${config.baseUrl}/models/${modelId}:generateContent?key=${config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
        });
        if (!res.ok) throw new Error(`Invalid Key or Model ID (${modelId})`);
        return true;
      }
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama (Local)',
      type: 'local',
      defaultUrl: 'http://localhost:11434',
      defaultModel: 'first installed model (auto)',
      normalizeModelName: (name = '') => name.trim().toLowerCase(),
      fetchLocalModels: async (baseUrl, signal) => {
        const res = await fetch(`${baseUrl}/api/tags`, { signal });
        if (!res.ok) throw new Error('Unreachable');
        const data = await res.json();
        return data.models || [];
      },
      resolveModel: async (config, signal) => {
        const models = await AGENT_RUNTIME.adapters.ollama.fetchLocalModels(config.baseUrl, signal);
        const requested = config.model?.trim();

        if (!models.length) {
          throw new Error("No local Ollama models found. Pull one first (example: 'ollama pull phi3').");
        }

        if (!requested) {
          return models[0].name;
        }

        const requestedNorm = AGENT_RUNTIME.adapters.ollama.normalizeModelName(requested);
        const matched = models.find((m) => {
          const name = AGENT_RUNTIME.adapters.ollama.normalizeModelName(m.name || '');
          const baseName = name.split(':')[0];
          return name === requestedNorm || name.startsWith(`${requestedNorm}:`) || baseName === requestedNorm;
        });

        if (!matched) {
          const available = models.map((m) => m.name).join(', ');
          throw new Error(`Model '${requested}' not found locally. Available: ${available}`);
        }

        return matched.name;
      },
      chat: async (config, messages, signal) => {
        const modelName = await AGENT_RUNTIME.adapters.ollama.resolveModel(config, signal);
        const res = await fetch(`${config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages,
            stream: false
          }),
          signal
        });
        if (!res.ok) throw new Error('Ollama connection failed. Check CORS settings.');
        const data = await res.json();
        return data.message.content;
      },
      check: async (config) => {
        try {
          await AGENT_RUNTIME.adapters.ollama.resolveModel(config);
          return true;
        } catch (e) {
          throw new Error(
            e.message.includes('Model') || e.message.includes('No local Ollama models')
              ? e.message
              : 'Ensure Ollama is running with OLLAMA_ORIGINS="*"'
          );
        }
      }
    }
  }
};

/* -------------------------------------------------------------------------- */
/* DATA & CONFIGURATION             */
/* -------------------------------------------------------------------------- */

const STRATEGIES = {
  role_constraints: {
    id: 'role_constraints',
    title: 'Standard Mode',
    icon: UserCog,
    desc: 'Role + Task + Strict Constraints.',
    whenToUse: 'General purpose tasks.',
    inputs: [],
    scaffold: (parts) =>
      `### ROLE\n${parts.role}\n\n### OBJECTIVE\n${parts.task}\n\n### CONSTRAINTS\n${parts.constraints}`,
    qualityCheck: (data) => (!data.constraints?.trim() ? ['Missing constraints'] : [])
  },
  few_shot: {
    id: 'few_shot',
    title: 'Few-Shot',
    icon: Copy,
    desc: 'Teach by example.',
    whenToUse: 'Complex formatting or style mimicry.',
    inputs: ['examples'],
    scaffold: (parts, extras) => {
      const examples =
        extras?.examples?.map((e) => `Input: ${e.input}\nOutput: ${e.output}`).join('\n\n') || '';
      return `### ROLE\n${parts.role}\n\n### TASK\n${parts.task}\n\n### EXAMPLES\n${examples}\n\n### YOUR TURN\nInput: ${parts.context}`;
    },
    qualityCheck: (data) => {
      const issues = [];
      const validExamples =
        data.extraData?.examples?.filter((e) => e.input.trim() && e.output.trim()) || [];
      if (validExamples.length < 2) issues.push('Add 2+ complete examples');
      return issues;
    }
  },
  chain_of_thought: {
    id: 'chain_of_thought',
    title: 'Chain-of-Thought',
    icon: BrainCircuit,
    desc: 'Step-by-step reasoning.',
    whenToUse: 'Logic, math, coding.',
    inputs: [],
    scaffold: (parts) =>
      `### ROLE\n${parts.role}\n\n### OBJECTIVE\n${parts.task}\n\n### METHODOLOGY\nThink step-by-step. Break down the problem.\n\n### STEPS\n1. Analyze\n2. Plan\n3. Solve\n\n### OUTPUT\n${parts.format}`,
    qualityCheck: () => []
  },
  output_schema: {
    id: 'output_schema',
    title: 'Schema Mode',
    icon: Code2,
    desc: 'Strict JSON/XML output.',
    whenToUse: 'API integrations.',
    inputs: ['schema'],
    scaffold: (parts, extras) =>
      `### ROLE\n${parts.role}\n\n### TASK\n${parts.task}\n\n### SCHEMA\n\`\`\`json\n${extras?.schema || '{}'}\n\`\`\`\n\nReturn ONLY valid JSON.`,
    qualityCheck: (data) => (!data.extraData?.schema?.trim() ? ['Define schema'] : [])
  }
};

const PERSONAS = [
  {
    id: 'p1',
    title: 'Product Manager',
    description: 'User-centric, strategic, data-driven.',
    icon: Briefcase
  },
  {
    id: 'p2',
    title: 'Senior Engineer',
    description: 'Clean code, performance, security.',
    icon: Code2
  },
  {
    id: 'p3',
    title: 'Marketing Pro',
    description: 'Persuasive, SEO-focused, creative.',
    icon: Flame
  },
  {
    id: 'p4',
    title: 'Socratic Tutor',
    description: 'Patient, questioning, educational.',
    icon: BrainCircuit
  },
  {
    id: 'p5',
    title: 'Social Media Mgr',
    description: 'Trend-aware, viral hooks, engagement.',
    icon: Share2
  }
];

const TASKS = [
  { id: 't1', title: 'Generate Code', action: 'write production-ready code' },
  { id: 't2', title: 'Code Review', action: 'review for bugs and security' },
  { id: 't3', title: 'Summarize', action: 'summarize key points' },
  { id: 't4', title: 'Strategic Plan', action: 'create an execution plan' },
  { id: 't5', title: 'LinkedIn Post', action: 'write a high-engagement LinkedIn post' },
  { id: 't6', title: 'Twitter Thread', action: 'write a compelling thread' }
];

const TONES = [
  { id: 'bold', label: 'Bold', text: 'Confident, assertive, and direct.' },
  { id: 'friendly', label: 'Friendly', text: 'Warm, encouraging, and inclusive.' },
  { id: 'precise', label: 'Precise', text: 'Technical, dry, and factual.' },
  { id: 'viral', label: 'Viral', text: 'Punchy, emotional, and hook-driven.' }
];

const TEMPLATES = [
  {
    id: 'tmp1',
    name: 'Executive Summary Generator',
    category: 'Business',
    desc: 'Creates concise summaries for C-suite executives focusing on ROI.',
    data: {
      persona: PERSONAS[0],
      task: TASKS[2],
      context: 'Summarizing Q3 financial reports for the board.',
      constraints: 'Max 200 words. Focus on ROI and Growth.',
      tone: TONES[2],
      strategyId: 'role_constraints',
      outputFormat: 'Bullet points',
      extraData: { examples: [], schema: '' }
    }
  },
  {
    id: 'tmp2',
    name: 'React Component Factory',
    category: 'Coding',
    desc: 'Generates typed, accessible React components with Tailwind.',
    data: {
      persona: PERSONAS[1],
      task: TASKS[0],
      context: 'Create a button component.',
      constraints: 'Use Tailwind. Must be accessible.',
      tone: TONES[2],
      strategyId: 'role_constraints',
      outputFormat: 'TSX + CSS',
      extraData: { examples: [], schema: '' }
    }
  },
  {
    id: 'tmp3',
    name: 'Viral Hook Generator',
    category: 'Social',
    desc: 'Generates scroll-stopping hooks for social content.',
    data: {
      persona: PERSONAS[4],
      task: TASKS[4],
      context: 'Topic: Remote work productivity hacks.',
      constraints: 'First line must be under 15 words. Provocative but professional.',
      tone: TONES[3],
      strategyId: 'few_shot',
      outputFormat: 'List of 10 hooks',
      extraData: {
        examples: [
          {
            input: 'Topic: AI',
            output: "AI isn't coming for your job. The person using AI is."
          }
        ],
        schema: ''
      }
    }
  }
];

/* -------------------------------------------------------------------------- */
/* LOGIC ENGINE                           */
/* -------------------------------------------------------------------------- */

const generatePrompt = (state) => {
  const strategy = STRATEGIES[state.strategyId] || STRATEGIES.role_constraints;

  const parts = {
    role: state.persona
      ? `You are a ${state.persona.title}. ${state.persona.description}`
      : 'You are a helpful assistant.',
    task: `${state.task?.action || 'assist'}. ${state.context || ''}`,
    constraints: state.constraints?.trim() || 'No specific constraints.',
    format: state.outputFormat || 'Markdown',
    context: state.context
  };

  const userPrompt = strategy.scaffold(parts, state.extraData);
  const systemInstruction = `[SYSTEM]\nStrategy: ${strategy.title}\nRole: ${parts.role}\nConstraints: ${parts.constraints}\nFormat: ${parts.format}\nTone: ${state.tone?.text || 'Neutral'}`;

  const agentsMd = `# Agent: ${state.persona?.title || 'Assistant'}
## Strategy: ${strategy.title}
- **Pattern**: ${strategy.id}
- **Trigger**: ${strategy.whenToUse}

## Core Logic
${userPrompt.slice(0, 200)}...
`;

  return { userPrompt, systemInstruction, agentsMd };
};

const calculateScore = (state) => {
  let score = 50;
  const issues = [];

  if (state.persona) score += 10;
  else issues.push('Pick Persona');
  if (state.task) score += 10;
  else issues.push('Pick Task');
  if (state.context.trim().length > 20) score += 10;
  if (state.constraints.trim().length > 10) score += 10;
  if (state.outputFormat.trim()) score += 10;
  else issues.push('Add Output Format');

  const strategy = STRATEGIES[state.strategyId];
  if (strategy) {
    const strategyIssues = strategy.qualityCheck(state);
    score -= strategyIssues.length * 10;
    issues.push(...strategyIssues);
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
};

/* -------------------------------------------------------------------------- */
/* COMPONENTS                               */
/* -------------------------------------------------------------------------- */

const ArcadeCard = ({ title, children, className = '', active = false, onClick }) => (
  <div
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick && onClick();
      }
    }}
    className={`border-2 rounded-xl transition-all relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-300 ${
      active
        ? 'border-indigo-600 bg-indigo-50/50 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)]'
        : 'border-stone-200 bg-white hover:border-indigo-300 hover:bg-stone-50 cursor-pointer'
    } ${className}`}
  >
    {title && (
      <div className="bg-stone-100 border-b border-stone-200 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">
        {title}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

const ExampleBuilder = ({ examples, onChange }) => (
  <div className="space-y-3">
    {examples.map((ex, idx) => (
      <div
        key={idx}
        className="bg-white p-3 rounded-lg border-2 border-stone-200 relative group shadow-sm"
      >
        <button
          onClick={() => onChange(examples.filter((_, i) => i !== idx))}
          className="absolute top-2 right-2 text-stone-400 hover:text-red-500"
          aria-label="Remove example"
        >
          <Trash2 size={14} />
        </button>
        <div className="grid gap-2">
          <input
            placeholder="User Input"
            className="text-sm p-2 bg-stone-50 border border-stone-200 rounded font-mono focus:border-indigo-500 focus:ring-0 outline-none"
            value={ex.input}
            onChange={(e) => {
              const newEx = [...examples];
              newEx[idx].input = e.target.value;
              onChange(newEx);
            }}
          />
          <textarea
            placeholder="AI Response"
            className="text-sm p-2 bg-stone-50 border border-stone-200 rounded font-mono focus:border-indigo-500 focus:ring-0 outline-none h-16 resize-none"
            value={ex.output}
            onChange={(e) => {
              const newEx = [...examples];
              newEx[idx].output = e.target.value;
              onChange(newEx);
            }}
          />
        </div>
      </div>
    ))}
    <button
      onClick={() => onChange([...examples, { input: '', output: '' }])}
      className="w-full py-2 border-2 border-dashed border-stone-300 rounded-lg text-stone-500 font-bold text-xs uppercase hover:bg-stone-50 hover:border-stone-400 flex items-center justify-center gap-2"
    >
      <Plus size={14} /> Add Training Block
    </button>
  </div>
);

const OnboardingModal = ({ onComplete }) => (
  <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
    <div className="bg-white max-w-md w-full rounded-2xl p-8 shadow-2xl border-4 border-indigo-600 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-16 bg-indigo-100 rounded-full -mr-8 -mt-8 opacity-50 pointer-events-none" />
      <h2 className="text-3xl font-black font-mono mb-4 text-stone-900 relative z-10">
        WELCOME, BOSS!
      </h2>
      <p className="text-stone-600 mb-6 font-mono text-sm leading-relaxed relative z-10">
        Prompt Like A Boss is your offline-first studio for engineering perfect AI instructions.
        <br />
        <br />
        Build tailored prompts, use proven strategies, and manage versions-no API keys needed.
      </p>
      <div className="space-y-3 relative z-10">
        <button
          onClick={onComplete}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono rounded-lg shadow-lg flex items-center justify-center gap-2"
        >
          <Play size={18} fill="currentColor" /> START CREATING
        </button>
      </div>
    </div>
  </div>
);

const TerminalLine = ({ text, type = 'info', delay = 0 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  const colors = {
    info: 'text-stone-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
    input: 'text-white font-bold'
  };

  return <div className={`font-mono text-xs mb-1 ${colors[type]}`}>{text}</div>;
};

/* -------------------------------------------------------------------------- */
/* MAIN APP                                    */
/* -------------------------------------------------------------------------- */

function PromptForgeApp() {
  const [view, setView] = useState('dashboard');
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('prompt');
  const [projects, setProjects] = useState([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [settings, setSettings] = useState({
    activeProvider: 'ollama',
    providers: {
      openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
      gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: '' },
      ollama: { baseUrl: 'http://localhost:11434', model: '' }
    }
  });

  const [secrets, setSecrets] = useState({
    openai: '',
    gemini: '',
    ollama: ''
  });

  const [testStatus, setTestStatus] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState([]);

  const toastTimer = useRef(null);
  const agentRunTimer = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('plab_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setProjects(parsed);
      }

      const onboarded = localStorage.getItem('plab_onboarded');
      if (!onboarded) setShowOnboarding(true);

      const savedSettings = localStorage.getItem('plab_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((s) => ({
          ...s,
          activeProvider: parsed.activeProvider || 'ollama',
          providers: {
            openai: { ...s.providers.openai, ...parsed.providers?.openai },
            gemini: { ...s.providers.gemini, ...parsed.providers?.gemini },
            ollama: { ...s.providers.ollama, ...parsed.providers?.ollama }
          }
        }));
      }
    } catch (e) {
      console.error('Failed to load local data', e);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (agentRunTimer.current) clearTimeout(agentRunTimer.current);
    };
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('plab_onboarded', 'true');
    setShowOnboarding(false);
  };

  const [state, setState] = useState({
    id: null,
    name: 'Untitled Run',
    persona: null,
    task: null,
    context: '',
    constraints: '',
    strategyId: 'role_constraints',
    outputFormat: '',
    tone: TONES[0],
    extraData: { examples: [], schema: '' },
    revisions: []
  });

  const output = useMemo(() => generatePrompt(state), [state]);
  const score = useMemo(() => calculateScore(state), [state]);

  const isStepValid = () => {
    switch (step) {
      case 1:
        return !!state.persona;
      case 2:
        return !!state.task;
      case 3:
        return state.context.trim().length > 0 && state.constraints.trim().length > 0;
      case 4:
        if (state.strategyId === 'few_shot') {
          return state.extraData?.examples?.filter((e) => e.input.trim() && e.output.trim()).length >= 2;
        }
        if (state.strategyId === 'output_schema') {
          return !!state.extraData?.schema?.trim();
        }
        return true;
      case 5:
        return !!state.outputFormat.trim();
      default:
        return true;
    }
  };

  const showNotification = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2000);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const saveProject = () => {
    const newRevision = {
      timestamp: new Date().toISOString(),
      displayDate: new Date().toLocaleString(),
      data: { ...state, revisions: [] }
    };

    const newProjectState = {
      ...state,
      id: state.id || Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      preview: `${output.userPrompt.slice(0, 100)}...`,
      revisions: [...(state.revisions || []), newRevision]
    };

    setProjects((prev) => {
      const existingIdx = prev.findIndex((p) => p.id === newProjectState.id);
      let updated;
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newProjectState;
      } else {
        updated = [newProjectState, ...prev];
      }
      localStorage.setItem('plab_projects', JSON.stringify(updated));
      return updated;
    });
    setState(newProjectState);
    showNotification('Version Saved!');
  };

  const loadProject = (p) => {
    setState({
      ...p,
      extraData: { examples: [], schema: '', ...(p.extraData || {}) },
      revisions: p.revisions || []
    });
    setView('builder');
    setStep(6);
  };

  const restoreRevision = (rev) => {
    if (confirm('Restore this version? Unsaved changes will be lost.')) {
      setState({
        ...rev.data,
        id: state.id,
        revisions: state.revisions
      });
      showNotification('Version Restored');
    }
  };

  const cloneTemplate = (template) => {
    setState({
      ...template.data,
      id: null,
      name: `Copy of ${template.name}`,
      revisions: []
    });
    setView('builder');
    setStep(6);
    showNotification('Template Cloned');
  };

  const resetBuilder = () => {
    setState({
      id: null,
      name: 'Untitled Run',
      persona: null,
      task: null,
      context: '',
      constraints: '',
      strategyId: 'role_constraints',
      outputFormat: '',
      tone: TONES[0],
      extraData: { examples: [], schema: '' },
      revisions: []
    });
    setStep(1);
    setView('builder');
  };

  const copyToClipboard = async () => {
    const text =
      activeTab === 'prompt'
        ? output.userPrompt
        : activeTab === 'system'
          ? output.systemInstruction
          : output.agentsMd;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showNotification('Copied!');
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        if (document.execCommand('copy')) showNotification('Copied!');
        else showNotification('Copy Failed');
      } catch {
        showNotification('Copy Failed');
      }
      document.body.removeChild(textarea);
    }
  };

  const downloadFile = (filename, content) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const downloadSingle = (type) => {
    const content =
      type === 'prompt'
        ? output.userPrompt
        : type === 'system'
          ? output.systemInstruction
          : output.agentsMd;
    downloadFile(`${state.name.replace(/\s+/g, '_')}_${type}.md`, content);
    showNotification(`Downloaded ${type}.md`);
  };

  const downloadPack = () => {
    const content = `
---
PROMPT LIKE A BOSS EXPORT PACK
Date: ${new Date().toLocaleDateString()}
Project: ${state.name}
---

=== USER PROMPT ===
${output.userPrompt}

=== SYSTEM INSTRUCTION ===
${output.systemInstruction}

=== AGENTS.MD ===
${output.agentsMd}
`;
    downloadFile(`${state.name.replace(/\s+/g, '_')}_pack.txt`, content);
    showNotification('Download Started');
  };

  const remixPrompt = () => {
    const randomTone = TONES[Math.floor(Math.random() * TONES.length)];
    const formats = ['Markdown Table', 'JSON', 'Step-by-step List', 'Python Script'];
    const randomFormat = formats[Math.floor(Math.random() * formats.length)];

    setState((prev) => ({
      ...prev,
      tone: randomTone,
      outputFormat: randomFormat
    }));
    showNotification('Remixed!');
  };

  /* ---------------- AGENT RUNTIME LOGIC ---------------- */

  const handleStopAgent = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (agentRunTimer.current) {
      clearTimeout(agentRunTimer.current);
    }
    setAgentLogs((prev) => [...prev, { text: '> STOPPED: User cancelled operation.', type: 'error' }]);
    setTimeout(() => setAgentRunning(false), 1000);
  };

  const runAgentReal = async () => {
    setAgentRunning(true);
    setAgentLogs([]);

    if (agentRunTimer.current) clearTimeout(agentRunTimer.current);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const addLog = (text, type = 'info', delay = 0) => {
      setAgentLogs((prev) => [...prev, { text, type, delay }]);
    };

    const providerId = settings.activeProvider;
    const activeAdapter = AGENT_RUNTIME.adapters[providerId];

    const config = {
      ...settings.providers[providerId],
      apiKey: secrets[providerId]
    };

    addLog(`Initializing Runtime: ${activeAdapter.name}...`, 'info', 0);

    try {
      await activeAdapter.check(config);
      addLog('Connection Verified.', 'success', 200);

      const messages = [
        { role: 'system', content: output.systemInstruction },
        { role: 'user', content: output.userPrompt }
      ];

      addLog(`Payload: ${JSON.stringify(messages[0]).slice(0, 50)}...`, 'info', 400);
      addLog(`Sending request to ${activeAdapter.name}...`, 'warning', 600);

      agentRunTimer.current = setTimeout(async () => {
        if (signal.aborted) return;
        try {
          const response = await activeAdapter.chat(config, messages, signal);
          addLog(`Response Received: ${response.length} chars`, 'success', 0);
          addLog(`\n--- OUTPUT ---\n${response.slice(0, 200)}...`, 'input', 200);
        } catch (err) {
          if (err.name === 'AbortError') {
            addLog('Request Aborted by user.', 'warning', 0);
          } else {
            addLog(`Execution Failed: ${err.message}`, 'error', 0);
            if (providerId === 'ollama') {
              addLog("Tip: Run 'ollama serve' and ensure CORS is allowed.", 'info', 100);
            }
          }
        } finally {
          if (!signal.aborted) {
            addLog('Process Terminated.', 'info', 500);
            agentRunTimer.current = setTimeout(() => setAgentRunning(false), 4000);
          }
        }
      }, 800);
    } catch (e) {
      addLog(`Connection Failed: ${e.message}`, 'error', 200);
      addLog('Please check Settings > Model Registry', 'warning', 300);
      agentRunTimer.current = setTimeout(() => setAgentRunning(false), 4000);
    }
  };

  const persistSettings = (newSettings) => {
    const safeSettings = {
      activeProvider: newSettings.activeProvider,
      providers: {
        openai: {
          baseUrl: newSettings.providers.openai.baseUrl,
          model: newSettings.providers.openai.model
        },
        gemini: {
          baseUrl: newSettings.providers.gemini.baseUrl,
          model: newSettings.providers.gemini.model
        },
        ollama: {
          baseUrl: newSettings.providers.ollama.baseUrl,
          model: newSettings.providers.ollama.model
        }
      }
    };
    localStorage.setItem('plab_settings', JSON.stringify(safeSettings));
  };

  const updateSetting = (provider, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: { ...prev.providers[provider], [field]: value }
        }
      };
      persistSettings(next);
      return next;
    });
  };

  const updateSecret = (provider, value) => {
    setSecrets((prev) => ({ ...prev, [provider]: value }));
  };

  const testConnection = async () => {
    setTestStatus('testing');
    const providerId = settings.activeProvider;
    const adapter = AGENT_RUNTIME.adapters[providerId];
    const config = {
      ...settings.providers[providerId],
      apiKey: secrets[providerId]
    };

    try {
      await adapter.check(config);
      setTestStatus('success');
      showNotification('Connection Successful!');
    } catch (e) {
      setTestStatus('error');
      console.error(e);
      showNotification(`Error: ${e.message}`);
    }
  };

  /* ---------------- VIEWS ---------------- */

  const renderSettings = () => (
    <div className="p-8 max-w-4xl mx-auto animate-fadeIn">
      <h1 className="text-4xl font-black font-mono mb-8 flex items-center gap-3">
        <Settings size={32} /> MODEL REGISTRY
      </h1>

      <div className="bg-white rounded-2xl p-6 border-2 border-stone-200 shadow-sm mb-8">
        <h2 className="font-bold font-mono text-lg mb-4 flex items-center gap-2">
          <Activity size={18} /> Active Runtime
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Object.values(AGENT_RUNTIME.adapters).map((adapter) => (
            <button
              key={adapter.id}
              onClick={() => {
                setSettings((s) => {
                  const next = { ...s, activeProvider: adapter.id };
                  persistSettings(next);
                  return next;
                });
                setTestStatus(null);
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                settings.activeProvider === adapter.id
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                  : 'border-stone-200 hover:border-indigo-300'
              }`}
            >
              <div className="font-bold mb-1">{adapter.name}</div>
              <div className="text-xs opacity-70 font-mono capitalize">{adapter.type}</div>
            </button>
          ))}
        </div>

        <div className="bg-stone-50 p-6 rounded-xl border-2 border-stone-200 relative">
          <h3 className="font-bold font-mono text-sm mb-4 uppercase text-stone-500">
            Configuration: {AGENT_RUNTIME.adapters[settings.activeProvider].name}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold font-mono text-stone-500 mb-2">Base URL</label>
              <input
                className="w-full p-3 rounded-lg border-2 border-stone-200 font-mono text-sm"
                value={
                  settings.providers[settings.activeProvider].baseUrl ||
                  AGENT_RUNTIME.adapters[settings.activeProvider].defaultUrl
                }
                onChange={(e) => updateSetting(settings.activeProvider, 'baseUrl', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-mono text-stone-500 mb-2">
                Model ID (Optional)
              </label>
              <input
                className="w-full p-3 rounded-lg border-2 border-stone-200 font-mono text-sm"
                placeholder={`Default: ${AGENT_RUNTIME.adapters[settings.activeProvider].defaultModel}`}
                value={settings.providers[settings.activeProvider].model || ''}
                onChange={(e) => updateSetting(settings.activeProvider, 'model', e.target.value)}
              />
            </div>

            {AGENT_RUNTIME.adapters[settings.activeProvider].type === 'commercial' && (
              <div>
                <label className="block text-xs font-bold font-mono text-stone-500 mb-2 flex items-center gap-2 justify-between">
                  <span>API Key</span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="w-full p-3 rounded-lg border-2 border-stone-200 font-mono text-sm pr-10"
                    placeholder="sk-..."
                    value={secrets[settings.activeProvider]}
                    onChange={(e) => updateSecret(settings.activeProvider, e.target.value)}
                  />
                  <Lock size={14} className="absolute right-3 top-3.5 text-stone-400" />
                </div>
                <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-[10px] flex gap-2">
                  <Shield size={14} className="shrink-0" />
                  <span>
                    <strong>Production Note:</strong> API keys are used client-side. For production
                    deployments, configure a backend proxy in <code>baseUrl</code> to protect your
                    credentials.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              className={`px-4 py-2 text-white font-mono text-xs font-bold rounded flex items-center gap-2 transition-all ${
                testStatus === 'success'
                  ? 'bg-green-600'
                  : testStatus === 'error'
                    ? 'bg-red-600'
                    : 'bg-stone-800 hover:bg-stone-700'
              }`}
            >
              {testStatus === 'testing' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Wifi size={14} />
              )}
              {testStatus === 'success'
                ? 'CONNECTED'
                : testStatus === 'error'
                  ? 'FAILED'
                  : 'TEST CONNECTION'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="mb-8 relative z-10">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-stone-400" />
        </div>
        <input
          type="text"
          placeholder="Search saved runs and templates..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-stone-200 focus:border-indigo-500 outline-none text-stone-700 bg-white shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {!searchQuery && (
        <div className="bg-stone-900 rounded-2xl p-8 mb-10 text-white relative overflow-hidden shadow-2xl border-b-8 border-indigo-600">
          <div className="absolute top-0 right-0 p-32 bg-indigo-600 rounded-full blur-[100px] opacity-30 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-stone-400">
              LEVEL UP YOUR PROMPTS
            </h1>
            <p className="text-stone-400 max-w-lg text-lg mb-8 font-mono">
              Craft, test, and optimize AI instructions with deterministic precision. No API
              required.
            </p>
            <div className="flex gap-4">
              <button
                onClick={resetBuilder}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono rounded-lg shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center gap-3"
              >
                <Play size={20} className="fill-current" /> START NEW RUN
              </button>
              <button
                onClick={() => setView('templates')}
                className="px-8 py-4 bg-stone-800 hover:bg-stone-700 text-white font-bold font-mono rounded-lg border border-stone-700 transition-all flex items-center gap-3"
              >
                <Library size={20} /> TEMPLATES
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="col-span-2">
          <div className="flex justify-between items-end mb-4 border-b-2 border-stone-200 pb-2">
            <h2 className="text-xl font-black font-mono text-stone-800 uppercase flex items-center gap-2">
              <History size={20} /> {searchQuery ? 'Found Runs' : 'Recent Runs'}
            </h2>
          </div>
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 bg-stone-50 rounded-xl border-2 border-dashed border-stone-300">
                <p className="text-stone-400 font-mono text-sm">NO DATA FOUND.</p>
              </div>
            ) : (
              filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-xl border-2 border-stone-200 hover:border-indigo-400 cursor-pointer group transition-all focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  onClick={() => loadProject(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadProject(p);
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-stone-800">{p.name}</h3>
                    <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-2 py-1 rounded">
                      {p.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 font-mono truncate">
                    {p.preview || 'No preview available'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
            <h3 className="font-black font-mono text-orange-800 mb-2 flex items-center gap-2">
              <Flame size={18} className="fill-current" /> DAILY CHALLENGE
            </h3>
            <p className="text-sm text-orange-800/80 mb-4 font-bold">"Fix this vague prompt"</p>
            <div className="bg-white/50 p-3 rounded text-xs font-mono text-stone-600 mb-4 border border-orange-100">
              "Write me a blog about marketing."
            </div>
            <button className="w-full py-2 bg-orange-500 text-white font-bold font-mono rounded shadow-[2px_2px_0px_0px_#7c2d12] active:translate-y-[2px] active:shadow-none text-xs">
              ACCEPT CHALLENGE
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWizardStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black font-mono mb-6">SELECT PERSONA</h2>
            <div className="grid grid-cols-1 gap-3">
              {PERSONAS.map((p) => (
                <ArcadeCard
                  key={p.id}
                  active={state.persona?.id === p.id}
                  className="cursor-pointer"
                  onClick={() => setState({ ...state, persona: p })}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        state.persona?.id === p.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      <p.icon size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-stone-800">{p.title}</div>
                      <div className="text-xs text-stone-500 font-mono">{p.description}</div>
                    </div>
                  </div>
                </ArcadeCard>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black font-mono mb-6">SELECT TASK</h2>
            <div className="grid grid-cols-2 gap-3">
              {TASKS.map((t) => (
                <ArcadeCard
                  key={t.id}
                  active={state.task?.id === t.id}
                  className="cursor-pointer"
                  onClick={() => setState({ ...state, task: t })}
                >
                  <div className="font-bold text-stone-800 mb-1">{t.title}</div>
                  <div className="text-[10px] text-stone-500 font-mono leading-tight">{t.action}</div>
                </ArcadeCard>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black font-mono mb-6">CONTEXT &amp; RULES</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold font-mono text-stone-500 mb-2 uppercase flex justify-between">
                  Background Context {state.context.trim() && <Check size={12} className="text-green-500" />}
                </label>
                <textarea
                  className="w-full p-4 rounded-xl border-2 border-stone-200 focus:border-indigo-500 outline-none h-32 font-mono text-sm bg-stone-50 focus:bg-white transition-colors resize-none"
                  placeholder="Who is the audience? What is the goal?"
                  value={state.context}
                  onChange={(e) => setState({ ...state, context: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold font-mono text-stone-500 mb-2 uppercase flex justify-between">
                  Strict Constraints{' '}
                  {state.constraints.trim() && <Check size={12} className="text-green-500" />}
                </label>
                <textarea
                  className="w-full p-4 rounded-xl border-2 border-stone-200 focus:border-indigo-500 outline-none h-24 font-mono text-sm bg-stone-50 focus:bg-white transition-colors resize-none"
                  placeholder="- Max 500 words&#10;- No jargon"
                  value={state.constraints}
                  onChange={(e) => setState({ ...state, constraints: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black font-mono mb-6">CHOOSE TECHNIQUE</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {Object.values(STRATEGIES).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setState({ ...state, strategyId: s.id })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      state.strategyId === s.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-stone-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <s.icon size={14} /> {s.title}
                    </div>
                    <div className="text-[10px] opacity-70 font-mono leading-tight">{s.desc}</div>
                  </button>
                ))}
              </div>

              {state.strategyId === 'few_shot' && (
                <div className="bg-stone-50 p-4 rounded-xl border-2 border-stone-200">
                  <label className="block text-xs font-bold font-mono text-stone-500 mb-3 uppercase">
                    Training Examples (Min 2)
                  </label>
                  <ExampleBuilder
                    examples={state.extraData.examples}
                    onChange={(ex) =>
                      setState({ ...state, extraData: { ...state.extraData, examples: ex } })
                    }
                  />
                </div>
              )}

              {state.strategyId === 'output_schema' && (
                <div className="bg-stone-50 p-4 rounded-xl border-2 border-stone-200">
                  <label className="block text-xs font-bold font-mono text-stone-500 mb-3 uppercase">
                    JSON Schema
                  </label>
                  <textarea
                    className="w-full h-32 bg-stone-900 text-green-400 font-mono text-xs p-3 rounded-lg"
                    value={state.extraData.schema}
                    onChange={(e) =>
                      setState({ ...state, extraData: { ...state.extraData, schema: e.target.value } })
                    }
                    placeholder="{}"
                  />
                </div>
              )}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-black font-mono mb-6">OUTPUT FORMAT</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold font-mono text-stone-500 mb-3 uppercase">
                  Tone of Voice
                </label>
                <div className="flex gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setState({ ...state, tone: t })}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                        state.tone?.id === t.id
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-white text-stone-500 border-stone-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold font-mono text-stone-500 mb-3 uppercase">
                  Final Format
                </label>
                <input
                  className="w-full p-4 rounded-xl border-2 border-stone-200 focus:border-indigo-500 outline-none font-mono text-sm"
                  placeholder="e.g., Markdown Table, Python Script, Bulleted List"
                  value={state.outputFormat}
                  onChange={(e) => setState({ ...state, outputFormat: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="animate-fadeIn h-full flex flex-col">
            <h2 className="text-2xl font-black font-mono mb-6">EXPORT &amp; RUN</h2>

            <div className="flex-1 bg-stone-50 rounded-xl border-2 border-stone-200 p-4 mb-6 overflow-y-auto relative">
              {agentRunning ? (
                <div className="absolute inset-0 bg-stone-900 rounded-xl p-6 font-mono text-xs overflow-y-auto z-20">
                  <div className="flex justify-between items-center mb-4 border-b border-stone-700 pb-2">
                    <span className="text-green-400 font-bold flex items-center gap-2">
                      <Terminal size={14} /> AGENT TERMINAL
                    </span>
                    <button onClick={handleStopAgent} className="text-red-400 hover:text-red-300">
                      <StopCircle size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {agentLogs.map((log, i) => (
                      <TerminalLine key={i} text={log.text} type={log.type} delay={log.delay} />
                    ))}
                    <div className="animate-pulse text-green-500 mt-2">_</div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-2">
                    <span className="font-mono text-xs font-bold text-stone-500 uppercase">
                      Version History
                    </span>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-mono font-bold">
                        Current Draft
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {state.revisions && state.revisions.length > 0 ? (
                      state.revisions
                        .slice()
                        .reverse()
                        .map((rev, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-3 bg-white border border-stone-200 rounded-lg hover:border-indigo-300 transition-colors"
                          >
                            <div>
                              <div className="text-xs font-bold text-stone-700">{rev.displayDate}</div>
                              <div className="text-[10px] text-stone-500 font-mono">
                                {state.revisions.length - idx} revisions ago
                              </div>
                            </div>
                            <button
                              onClick={() => restoreRevision(rev)}
                              className="text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                            >
                              Restore
                            </button>
                          </div>
                        ))
                    ) : (
                      <div className="text-center text-xs text-stone-400 py-4 italic">
                        No saved revisions yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex gap-2">
                <button
                  onClick={() => downloadSingle('prompt')}
                  className="flex-1 py-2 border-2 border-stone-200 rounded-lg text-xs font-bold text-stone-600 hover:border-indigo-500 hover:text-indigo-600 flex items-center justify-center gap-2"
                >
                  <FileDown size={14} /> Prompt
                </button>
                <button
                  onClick={runAgentReal}
                  className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold font-mono hover:bg-indigo-500 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Terminal size={14} /> RUN AGENT ({AGENT_RUNTIME.adapters[settings.activeProvider].name})
                </button>
              </div>

              <button
                onClick={saveProject}
                className="p-4 bg-stone-800 text-white rounded-xl font-bold font-mono hover:bg-stone-700 flex items-center justify-center gap-2"
              >
                <Save size={18} /> SAVE VERSION
              </button>
              <button
                onClick={downloadPack}
                className="p-4 bg-white border-2 border-stone-800 text-stone-800 rounded-xl font-bold font-mono hover:bg-stone-100 flex items-center justify-center gap-2"
              >
                <Download size={18} /> PACK
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  /* ---------------- MAIN RENDER ---------------- */

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.preview || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-100 font-sans text-stone-900 flex overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
        {showOnboarding && <OnboardingModal onComplete={completeOnboarding} />}

        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
            showToast ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="bg-stone-900 text-white px-6 py-2 rounded-full shadow-xl flex items-center gap-2 font-mono text-sm font-bold">
            <Zap size={14} className="text-yellow-400 fill-current" />
            {toastMsg}
          </div>
        </div>

        <aside
          className={`fixed md:relative z-20 w-64 h-full bg-stone-900 text-stone-300 flex flex-col border-r border-stone-800 transition-transform ${
            mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-6 border-b border-stone-800 flex justify-between items-center">
            <div className="font-mono font-black text-white tracking-tighter text-lg leading-none">
              PROMPT
              <br />
              <span className="text-indigo-500">LIKE A BOSS</span>
            </div>
            <button className="md:hidden" onClick={() => setMobileMenu(false)} aria-label="Close menu">
              <X />
            </button>
          </div>

          <nav className="p-4 space-y-2 flex-1 font-mono text-sm font-bold">
            <button
              onClick={() => setView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-stone-800'
              }`}
            >
              <Home size={18} /> DASHBOARD
            </button>
            <button
              onClick={() => {
                setView('builder');
                setStep(1);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                view === 'builder' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-stone-800'
              }`}
            >
              <Wand2 size={18} /> BUILDER
            </button>
            <button
              onClick={() => setView('templates')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                view === 'templates' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-stone-800'
              }`}
            >
              <Library size={18} /> TEMPLATES
            </button>
            <button
              onClick={() => setView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                view === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-stone-800'
              }`}
            >
              <Settings size={18} /> SETTINGS
            </button>
          </nav>

          <div className="p-6 border-t border-stone-800">
            <div className="bg-stone-800 rounded p-3 text-xs font-mono">
              <div className="flex justify-between text-stone-400 mb-1">XP LEVEL</div>
              <div className="text-white font-bold mb-2">PROMPT WIZARD</div>
              <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-3/4" />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <button
            className="md:hidden absolute top-4 right-4 z-50 p-2 bg-stone-900 text-white rounded"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>

          {view === 'dashboard' && renderDashboard()}

          {view === 'templates' && (
            <div className="p-8 animate-fadeIn overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-black font-mono">TEMPLATE LIBRARY</h1>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="text"
                    placeholder="Filter templates..."
                    className="pl-9 pr-4 py-2 rounded-lg border-2 border-stone-200 text-sm outline-none focus:border-indigo-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    className="text-left w-full bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-indigo-500 hover:shadow-lg transition-all group cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    onClick={() => cloneTemplate(t)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-stone-100 text-stone-500 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase">
                        {t.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-indigo-600">{t.name}</h3>
                    <p className="text-sm text-stone-500 font-mono mb-4">{t.desc}</p>
                    <span className="text-xs font-bold font-mono uppercase border-b-2 border-stone-200 pb-0.5 group-hover:border-indigo-500">
                      Clone Template
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'settings' && renderSettings()}

          {view === 'builder' && (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              <div className="w-full md:w-[450px] bg-white border-r border-stone-200 flex flex-col z-10 shadow-xl">
                <div className="p-4 border-b border-stone-200 bg-stone-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-xs font-bold text-stone-500">LEVEL {step}/6</span>
                    <input
                      value={state.name}
                      onChange={(e) => setState({ ...state, name: e.target.value })}
                      className="text-right bg-transparent font-mono text-xs font-bold text-stone-800 focus:bg-white rounded px-1 outline-none"
                    />
                  </div>
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          step >= i ? 'bg-indigo-600' : 'bg-stone-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">{renderWizardStep()}</div>

                <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-between">
                  <button
                    onClick={() => setStep(Math.max(1, step - 1))}
                    disabled={step === 1}
                    className="px-4 py-2 font-mono font-bold text-stone-500 hover:text-stone-900 disabled:opacity-30"
                  >
                    BACK
                  </button>
                  {step < 6 ? (
                    <div className="flex items-center gap-3">
                      {!isStepValid() && (
                        <span className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1 animate-pulse">
                          <Lock size={10} /> Locked
                        </span>
                      )}
                      <button
                        onClick={() => setStep(step + 1)}
                        disabled={!isStepValid()}
                        className="px-6 py-2 bg-stone-900 text-white font-mono font-bold rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-[2px] active:shadow-none hover:bg-stone-800 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                      >
                        NEXT
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={saveProject}
                      className="px-6 py-2 bg-indigo-600 text-white font-mono font-bold rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-[2px] active:shadow-none hover:bg-indigo-500"
                    >
                      FINISH
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-stone-100 flex flex-col relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.05] pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)',
                    backgroundSize: '12px 12px'
                  }}
                />

                <div className="p-4 border-b border-stone-200/50 flex justify-between items-center z-10">
                  <div className="flex bg-white/50 backdrop-blur p-1 rounded-lg">
                    {['prompt', 'system', 'agent'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`px-4 py-1.5 rounded-md text-xs font-mono font-bold uppercase transition-all ${
                          activeTab === t
                            ? 'bg-white shadow-sm text-indigo-600'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="p-2 bg-white rounded shadow-sm text-stone-500 hover:text-indigo-600 transition-colors"
                      aria-label="Copy to clipboard"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-8 overflow-y-auto z-10">
                  <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-stone-200 min-h-[500px] p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap text-stone-700">
                    {activeTab === 'prompt'
                      ? output.userPrompt
                      : activeTab === 'system'
                        ? output.systemInstruction
                        : output.agentsMd}
                  </div>
                </div>

                <div className="bg-white border-t border-stone-200 p-4 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase">
                        Power Level
                      </div>
                      <div
                        className={`text-2xl font-black font-mono ${
                          score.score < 50 ? 'text-red-500' : 'text-indigo-600'
                        }`}
                      >
                        {score.score}%
                      </div>
                    </div>
                    <div className="h-8 w-[1px] bg-stone-200" />
                    <div className="flex flex-col gap-1">
                      {score.issues.length > 0 ? (
                        <div className="text-xs font-bold text-red-500 flex items-center gap-1">
                          <AlertTriangle size={12} /> {score.issues[0]}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-green-600 flex items-center gap-1">
                          <Zap size={12} /> OPTIMIZED
                        </div>
                      )}
                      <div className="text-[10px] text-stone-400 font-mono">
                        Run quality check to improve
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={remixPrompt}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold font-mono text-xs rounded border border-stone-200 flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> REMIX
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return <PromptForgeApp />;
}
