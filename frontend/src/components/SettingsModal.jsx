import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Server, 
  Key, 
  Mic, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Star, 
  Bot, 
  Search,
  Sparkles,
  Play,
  Tag,
  RefreshCw,
  BookOpen,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';
import { getTheme } from '../utils/theme';


export default function SettingsModal({ isOpen, onClose, onSettingsUpdated, theme = 'dark' }) {
  const t = getTheme(theme);
  const [activeTab, setActiveTab] = useState('tts'); // 'tts' | 'scoped' | 'llm'

  // TTS Settings
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('edge-tts');
  const [defaultVoice, setDefaultVoice] = useState('en-US-ChristopherNeural');
  const [availableModels, setAvailableModels] = useState([]);

  // Scoped Voices
  const [scopedVoices, setScopedVoices] = useState([]);
  const [scopedVoicesEnabled, setScopedVoicesEnabled] = useState(false);
  const [interBlockPauseMs, setInterBlockPauseMs] = useState(300);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceFilterSearch, setVoiceFilterSearch] = useState('');

  // LLM Engine Settings
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmCleanEnabled, setLlmCleanEnabled] = useState(false);

  // Pronunciation Glossary
  const [glossary, setGlossary] = useState([]);
  const [newFind, setNewFind] = useState('');
  const [newReplace, setNewReplace] = useState('');

  // LLM Tasks & Batch Jobs
  const [activeJob, setActiveJob] = useState(null); // 'title' | 'tags' | 'clean_text' | 'all'
  const [jobOverwrite, setJobOverwrite] = useState(false);
  const [jobRunning, setJobRunning] = useState(false);
  const [jobResult, setJobResult] = useState(null);

  // Tags Health & Consolidation
  const [libraryTags, setLibraryTags] = useState([]);
  const [tagsStats, setTagsStats] = useState({ total_tags: 0, max_tags: 50, remaining_capacity: 50 });
  const [renameOldTag, setRenameOldTag] = useState('');
  const [renameNewTag, setRenameNewTag] = useState('');
  const [isRenamingTag, setIsRenamingTag] = useState(false);
  const [tagOpMessage, setTagOpMessage] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Computed models for TTS dropdown
  const modelOptions = useMemo(() => {
    const defaultList = [
      { id: 'edge-tts', name: 'edge-tts (Zero CPU, Recommended)' },
      { id: 'kokoro', name: 'kokoro (High Quality Neural)' },
      { id: 'piper', name: 'piper (Local Fast)' },
      { id: 'google-cloud', name: 'google-cloud (Google Cloud TTS)' },
      { id: 'tts-1', name: 'tts-1 (OpenAI standard)' },
      { id: 'tts-1-hd', name: 'tts-1-hd (OpenAI HD)' },
    ];

    if (!availableModels || availableModels.length === 0) {
      return defaultList;
    }

    const fetchedIds = new Set();
    const result = [];

    availableModels.forEach((m) => {
      const id = typeof m === 'string' ? m : m.id;
      const name = typeof m === 'string' ? m : (m.name || m.id);
      if (id && !fetchedIds.has(id)) {
        fetchedIds.add(id);
        result.push({ id, name });
      }
    });

    // Ensure common baseline options exist in the list
    defaultList.forEach((m) => {
      if (!fetchedIds.has(m.id)) {
        fetchedIds.add(m.id);
        result.push(m);
      }
    });

    return result;
  }, [availableModels]);

  // Computed voices for TTS voice dropdown: only populate when a model is selected, strictly filtering by that model
  const voiceOptions = useMemo(() => {
    if (!defaultModel || !defaultModel.trim()) {
      return [];
    }

    const fallbackVoices = [
      { id: 'en-US-ChristopherNeural', name: 'Christopher (Edge TTS)', engine: 'edge-tts', language: 'en-US' },
      { id: 'en-US-JennyNeural', name: 'Jenny (Edge TTS)', engine: 'edge-tts', language: 'en-US' },
      { id: 'en-US-GuyNeural', name: 'Guy (Edge TTS)', engine: 'edge-tts', language: 'en-US' },
      { id: 'en-US-AriaNeural', name: 'Aria (Edge TTS)', engine: 'edge-tts', language: 'en-US' },
      { id: 'af_heart', name: 'Kokoro af_heart', engine: 'kokoro', language: 'en-US' },
      { id: 'af_alloy', name: 'Kokoro af_alloy', engine: 'kokoro', language: 'en-US' },
      { id: 'af_bella', name: 'Kokoro af_bella', engine: 'kokoro', language: 'en-US' },
      { id: 'am_echo', name: 'Kokoro am_echo', engine: 'kokoro', language: 'en-US' },
      { id: 'am_onyx', name: 'Kokoro am_onyx', engine: 'kokoro', language: 'en-US' },
      { id: 'bf_emma', name: 'Kokoro bf_emma', engine: 'kokoro', language: 'en-GB' },
      { id: 'en_US-lessac-medium', name: 'Lessac (Piper)', engine: 'piper', language: 'en-US' },
      { id: 'alloy', name: 'Alloy (OpenAI standard)', engine: 'tts-1', language: 'en' },
      { id: 'echo', name: 'Echo (OpenAI standard)', engine: 'tts-1', language: 'en' },
      { id: 'fable', name: 'Fable (OpenAI standard)', engine: 'tts-1', language: 'en' },
      { id: 'onyx', name: 'Onyx (OpenAI standard)', engine: 'tts-1', language: 'en' },
      { id: 'nova', name: 'Nova (OpenAI standard)', engine: 'tts-1', language: 'en' },
      { id: 'shimmer', name: 'Shimmer (OpenAI standard)', engine: 'tts-1', language: 'en' },
    ];

    const allVoices = (availableVoices && availableVoices.length > 0) ? availableVoices : fallbackVoices;
    const modLower = defaultModel.trim().toLowerCase();

    // Map common model names to engine IDs if applicable
    const normalizeEngine = (eng, mod) => {
      const e = (eng || '').toLowerCase();
      const m = (mod || '').toLowerCase();
      if (e === m) return true;
      if (m.startsWith('tts-1') && (e === 'tts-1' || e === 'openai')) return true;
      if (m === 'google-tts' && e === 'google-cloud') return true;
      if (m === 'google-cloud' && e === 'google-tts') return true;
      return false;
    };

    // Filter strictly by matching selected model/engine
    let filtered = allVoices.filter((v) => normalizeEngine(v.engine, modLower));

    // If still empty (e.g. custom upstream model id without explicit engine match), show voices matching model id substring
    if (filtered.length === 0) {
      filtered = allVoices.filter((v) => (v.engine || '').toLowerCase().includes(modLower) || (v.id || '').toLowerCase().includes(modLower));
    }

    // Always include current defaultVoice if already assigned to this model
    if (defaultVoice && !filtered.some((v) => v.id === defaultVoice)) {
      filtered = [{ id: defaultVoice, name: `${defaultVoice} (Current)`, engine: defaultModel }, ...filtered];
    }

    return filtered;
  }, [availableVoices, defaultModel, defaultVoice]);

  const fetchTagsData = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setLibraryTags(data.tags || []);
        setTagsStats({
          total_tags: data.total_tags || 0,
          max_tags: data.max_tags || 50,
          remaining_capacity: data.remaining_capacity !== undefined ? data.remaining_capacity : 50,
          total_docs: data.total_docs || 0
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    const fetchSettingsAndVoices = async () => {
      try {
        setLoading(true);
        setError(null);
        setTestResult(null);
        setLlmTestResult(null);
        setSaveSuccess(false);
        setJobResult(null);
        setTagOpMessage(null);

        const [settingsRes, voicesRes, modelsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/voices'),
          fetch('/api/models').catch(() => null)
        ]);

        if (!settingsRes.ok) throw new Error('Failed to load settings');
        const data = await settingsRes.json();
        
        let voicesList = [];
        if (voicesRes.ok) {
          const vData = await voicesRes.json();
          voicesList = vData.voices || [];
        }

        let modelsList = [];
        if (modelsRes && modelsRes.ok) {
          try {
            const mData = await modelsRes.json();
            modelsList = Array.isArray(mData.data) ? mData.data : (Array.isArray(mData) ? mData : []);
          } catch {
            // ignore
          }
        }

        if (!ignore) {
          setBaseUrl(data.tts_base_url || '');
          setApiKey(data.tts_api_key || '');
          setDefaultModel(data.tts_default_model || 'edge-tts');
          setDefaultVoice(data.tts_default_voice || 'en-US-ChristopherNeural');
          setScopedVoices(Array.isArray(data.scoped_voices) ? data.scoped_voices : []);
          setScopedVoicesEnabled(Boolean(data.scoped_voices_enabled));
          setInterBlockPauseMs(data.inter_block_pause_ms !== undefined ? Number(data.inter_block_pause_ms) : 300);

          setLlmBaseUrl(data.llm_base_url || '');
          setLlmApiKey(data.llm_api_key || '');
          setLlmModel(data.llm_model || 'gpt-4o-mini');
          setLlmPrompt(data.llm_prompt || '');
          setLlmCleanEnabled(Boolean(data.llm_clean_enabled));
          setGlossary(Array.isArray(data.glossary) ? data.glossary : []);

          setAvailableVoices(voicesList);
          setAvailableModels(modelsList);
        }

        await fetchTagsData();
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading settings');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchSettingsAndVoices();
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const handleRunBatchJob = async (jobType) => {
    try {
      setJobRunning(true);
      setActiveJob(jobType);
      setJobResult(null);
      setError(null);

      const res = await fetch('/api/documents/batch-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_type: jobType,
          overwrite: jobOverwrite
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Batch job failed');

      const skipped = data.skipped_count || 0;
      setJobResult({
        success: true,
        message: `Batch job '${jobType}' finished: ${data.processed_count} updated, ${skipped} skipped (already up to date) out of ${data.total_evaluated} documents evaluated.`,
        data: data.results,
        processed_count: data.processed_count,
        skipped_count: skipped,
        total: data.total_evaluated
      });

      await fetchTagsData();
      if (onSettingsUpdated) onSettingsUpdated(settings);
    } catch (err) {
      setJobResult({
        success: false,
        message: err.message || 'Batch job execution error'
      });
    } finally {
      setJobRunning(false);
      setActiveJob(null);
    }
  };

  const handleRenameTag = async (e) => {
    e.preventDefault();
    if (!renameOldTag.trim() || !renameNewTag.trim()) return;

    try {
      setIsRenamingTag(true);
      setTagOpMessage(null);

      const res = await fetch('/api/tags/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_tag: renameOldTag.trim(),
          new_tag: renameNewTag.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to rename tag');

      setTagOpMessage({
        success: true,
        message: `Merged #${data.old_tag} into #${data.new_tag} across ${data.updated_documents} document(s).`
      });

      setRenameOldTag('');
      setRenameNewTag('');
      await fetchTagsData();
      if (onSettingsUpdated) onSettingsUpdated(settings);
    } catch (err) {
      setTagOpMessage({
        success: false,
        message: err.message || 'Error renaming tag'
      });
    } finally {
      setIsRenamingTag(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);

      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: baseUrl.trim(),
          api_key: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Connection test failed');
      }

      setTestResult({
        success: data.ok !== false,
        message: data.message || `Found ${data.models?.length || 0} models and ${data.voice_count || 0} voices.`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestLlm = async () => {
    try {
      setTestingLlm(true);
      setLlmTestResult(null);
      setError(null);

      const res = await fetch('/api/settings/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_base_url: llmBaseUrl.trim(),
          llm_api_key: llmApiKey.trim(),
          llm_model: llmModel.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || data.detail || 'LLM connection test failed');
      }

      setLlmTestResult({
        success: true,
        message: data.message || 'LLM endpoint verified successfully!',
      });
    } catch (err) {
      setLlmTestResult({
        success: false,
        message: err.message || 'LLM connection failed',
      });
    } finally {
      setTestingLlm(false);
    }
  };

  const toggleVoiceInScope = (voiceId) => {
    setScopedVoices((prev) => {
      if (prev.includes(voiceId)) {
        return prev.filter((id) => id !== voiceId);
      } else {
        return [...prev, voiceId];
      }
    });
  };

  const handleAddGlossaryItem = (e) => {
    e.preventDefault();
    const findTrimmed = newFind.trim();
    if (!findTrimmed) return;
    setGlossary((prev) => [
      ...prev.filter((item) => item.find.toLowerCase() !== findTrimmed.toLowerCase()),
      { find: findTrimmed, replace: newReplace.trim() }
    ]);
    setNewFind('');
    setNewReplace('');
  };

  const handleRemoveGlossaryItem = (findToRemove) => {
    setGlossary((prev) => prev.filter((item) => item.find !== findToRemove));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tts_base_url: baseUrl.trim(),
          tts_api_key: apiKey.trim(),
          tts_default_model: defaultModel,
          tts_default_voice: defaultVoice,
          scoped_voices: scopedVoices,
          scoped_voices_enabled: scopedVoicesEnabled,
          inter_block_pause_ms: interBlockPauseMs,
          llm_base_url: llmBaseUrl.trim(),
          llm_api_key: llmApiKey.trim(),
          llm_model: llmModel.trim(),
          llm_prompt: llmPrompt.trim(),
          llm_clean_enabled: llmCleanEnabled,
          glossary: glossary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save settings');
      }

      setSaveSuccess(true);
      // Also sync to localStorage
      try {
        localStorage.setItem('universal_reader_model', defaultModel);
        localStorage.setItem('universal_reader_voice', defaultVoice);
      } catch {
        // ignore
      }

      if (onSettingsUpdated) {
        onSettingsUpdated(data);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-zinc-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <Server className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold">Preferences & Settings</h3>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-zinc-800 mb-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('tts')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'tts'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            TTS Engine
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scoped')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'scoped'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorite Voices {scopedVoices.length > 0 && `(${scopedVoices.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pronunciation')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'pronunciation'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Pronunciation {glossary.length > 0 && `(${glossary.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('llm')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'llm'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            LLM Engine
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tasks & Batch Jobs
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Loading settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} noValidate className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Settings saved successfully!</span>
              </div>
            )}

            {/* TAB 1: TTS Engine */}
            {activeTab === 'tts' && (
              <div className="space-y-3">
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-red-950/40 border-red-800/60 text-red-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-zinc-400" />
                    Universal TTS Base URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://kokoro.askbp.win"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    API Key (Bearer Token)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      Default Model
                    </label>
                    <select
                      value={defaultModel}
                      onChange={(e) => {
                        const newMod = e.target.value;
                        setDefaultModel(newMod);
                        // Auto-select a recommended voice for the chosen engine if available
                        if (newMod === 'edge-tts') {
                          setDefaultVoice('en-US-ChristopherNeural');
                        } else if (newMod === 'kokoro') {
                          setDefaultVoice('af_heart');
                        } else if (newMod === 'piper') {
                          setDefaultVoice('en_US-lessac-medium');
                        } else if (newMod.startsWith('tts-1')) {
                          setDefaultVoice('alloy');
                        } else {
                          setDefaultVoice('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Select a model --</option>
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-zinc-400" />
                      Default Voice
                    </label>
                    <select
                      value={defaultVoice}
                      onChange={(e) => setDefaultVoice(e.target.value)}
                      disabled={!defaultModel || voiceOptions.length === 0}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!defaultModel ? (
                        <option value="">Select a model first</option>
                      ) : voiceOptions.length === 0 ? (
                        <option value="">No voices available for {defaultModel}</option>
                      ) : (
                        voiceOptions.map((v) => {
                          const langSuffix = v.language ? ` (${v.language})` : '';
                          const engSuffix = v.engine ? ` • ${v.engine}` : '';
                          const labelText = (v.name && v.name !== v.id) ? `${v.name}${engSuffix}` : `${v.id}${langSuffix}${engSuffix}`;
                          return (
                            <option key={v.id} value={v.id}>
                              {labelText}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                {/* Inter-block Natural Pause Slider */}
                <div className={`p-3 rounded-xl border ${t.card}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-xs font-medium flex items-center gap-1.5 ${t.cardTitle}`}>
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Inter-Block Natural Pause
                    </label>
                    <span className="text-xs font-mono font-semibold text-indigo-500 dark:text-indigo-400">
                      {interBlockPauseMs} ms ({interBlockPauseMs === 0 ? 'Instant' : `${(interBlockPauseMs / 1000).toFixed(1)}s`})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1500"
                      step="100"
                      value={interBlockPauseMs}
                      onChange={(e) => setInterBlockPauseMs(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[0, 200, 400, 800].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setInterBlockPauseMs(preset)}
                          className={`px-1.5 py-0.5 text-[10px] rounded border transition cursor-pointer ${
                            interBlockPauseMs === preset
                              ? 'bg-indigo-600 border-indigo-500 text-white font-medium'
                              : `${t.btnSecondary}`
                          }`}
                        >
                          {preset}ms
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className={`text-[11px] ${t.cardMeta} mt-1.5 leading-normal`}>
                    Silence buffer inserted between blocks during continuous playback for a natural conversational cadence.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !baseUrl}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium rounded-lg text-zinc-300 transition"
                  >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Test TTS Connection
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Scoped Voices */}
            {activeTab === 'scoped' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">Enable Scoped Voices</h4>
                    <p className="text-[11px] text-zinc-400">
                      When active, the player voice picker will only show your selected favorite voices.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={scopedVoicesEnabled}
                    onChange={(e) => setScopedVoicesEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search voices to add to favorites..."
                    value={voiceFilterSearch}
                    onChange={(e) => setVoiceFilterSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800 rounded-xl p-2 bg-black/20">
                  {availableVoices
                    .filter((v) => {
                      if (!voiceFilterSearch.trim()) return true;
                      const q = voiceFilterSearch.toLowerCase();
                      return (
                        (v.id || '').toLowerCase().includes(q) ||
                        (v.name || '').toLowerCase().includes(q) ||
                        (v.language || '').toLowerCase().includes(q) ||
                        (v.engine || '').toLowerCase().includes(q)
                      );
                    })
                    .map((v) => {
                      const isChecked = scopedVoices.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => toggleVoiceInScope(v.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-indigo-950/40 border border-indigo-700/50 text-indigo-200'
                              : 'hover:bg-zinc-800/70 text-zinc-300'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium truncate">{v.name || v.id}</p>
                            <p className="text-[10px] opacity-60 font-mono truncate">
                              {v.engine} • {v.language || 'generic'}
                            </p>
                          </div>
                          <Star
                            className={`w-4 h-4 flex-shrink-0 ${
                              isChecked ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* TAB: Pronunciation Glossary */}
            {activeTab === 'pronunciation' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Pronunciation & Acronym Glossary</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Define phonetic substitutions for acronyms, technical jargon, or names so the voice synthesizer pronounces them accurately.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Word (e.g. k8s)"
                    value={newFind}
                    onChange={(e) => setNewFind(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Spoken as (e.g. Kubernetes)"
                    value={newReplace}
                    onChange={(e) => setNewReplace(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddGlossaryItem}
                    disabled={!newFind.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800/60 max-h-52 overflow-y-auto bg-zinc-800/30">
                  {glossary.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      No pronunciation rules defined yet. Add pairs like <code className="text-zinc-400">FastAPI</code> → <code className="text-zinc-400">Fast A-P-I</code>.
                    </div>
                  ) : (
                    glossary.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] truncate">{item.find}</span>
                          <span className="text-zinc-500 shrink-0">→</span>
                          <span className="text-indigo-300 font-medium truncate">{item.replace}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGlossaryItem(item.find)}
                          className="text-zinc-500 hover:text-red-400 transition p-1 shrink-0 cursor-pointer"
                          title="Remove rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LLM Cleaner */}
            {activeTab === 'llm' && (
              <div className="space-y-3">
                {llmTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      llmTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-red-950/40 border-red-800/60 text-red-300'
                    }`}
                  >
                    {llmTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{llmTestResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">Enable AI Text Cleaning</h4>
                    <p className="text-[11px] text-zinc-400">
                      Use an LLM (OpenAI-compatible) to rewrite text for smoother, natural speech before TTS synthesis.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={llmCleanEnabled}
                    onChange={(e) => setLlmCleanEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-zinc-400" />
                    OpenAI-Compatible LLM Base URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-zinc-400" />
                      LLM API Key
                    </label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-zinc-400" />
                      Model Name
                    </label>
                    <input
                      type="text"
                      list="llm-models-list"
                      placeholder="e.g. llama-3.3-70b-versatile or gpt-4o-mini"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                    />
                    <datalist id="llm-models-list">
                      <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Groq / Ultra Fast - Recommended)</option>
                      <option value="groq/compound">groq/compound (Groq Multi-Agent)</option>
                      <option value="groq/compound-mini">groq/compound-mini (Groq Fast)</option>
                      <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Groq High Quality)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (OpenAI)</option>
                      <option value="gpt-4o">gpt-4o (OpenAI Flagship)</option>
                      <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Anthropic)</option>
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Instructions for cleaning & normalizing speech text..."
                    value={llmPrompt}
                    onChange={(e) => setLlmPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestLlm}
                    disabled={testingLlm || !llmBaseUrl}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium rounded-lg text-zinc-300 transition"
                  >
                    {testingLlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Test LLM Connection
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: Tasks & Batch Jobs */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                {jobResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      jobResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-red-950/40 border-red-800/60 text-red-300'
                    }`}
                  >
                    {jobResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{jobResult.message}</span>
                  </div>
                )}

                {/* Batch Job Trigger Actions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-200">Library Batch Jobs</h4>
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={jobOverwrite}
                        onChange={(e) => setJobOverwrite(e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded"
                      />
                      <span>Overwrite existing</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunBatchJob('title')}
                      disabled={jobRunning || !llmBaseUrl}
                      className="p-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-left transition disabled:opacity-50 flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">Re-evaluate Titles</span>
                        {jobRunning && activeJob === 'title' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">Generate descriptive titles for untitled notes.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunBatchJob('tags')}
                      disabled={jobRunning || !llmBaseUrl}
                      className="p-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-left transition disabled:opacity-50 flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">Re-generate Tags</span>
                        {jobRunning && activeJob === 'tags' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Tag className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">Classify documents under 50 global categories.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunBatchJob('synopsis')}
                      disabled={jobRunning || !llmBaseUrl}
                      className="p-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-left transition disabled:opacity-50 flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">Card Synopses</span>
                        {jobRunning && activeJob === 'synopsis' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">Generate punchy 1-2 sentence card previews.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunBatchJob('clean_text')}
                      disabled={jobRunning || !llmBaseUrl}
                      className="p-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-left transition disabled:opacity-50 flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">Re-clean Speech Text</span>
                        {jobRunning && activeJob === 'clean_text' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">Normalize chunk texts for natural pronunciation.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunBatchJob('all')}
                      disabled={jobRunning || !llmBaseUrl}
                      className="p-3 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-700/60 rounded-xl text-left transition disabled:opacity-50 flex flex-col gap-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-200">Run Full Pass</span>
                        {jobRunning && activeJob === 'all' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-indigo-300/70">Execute all enhancement tasks across library.</p>
                    </button>
                  </div>
                </div>

                {/* Category Capacity & Consolidation */}
                <div className="p-3.5 bg-zinc-800/40 border border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-zinc-200">Tag Capacity & Consolidation</span>
                    </div>
                    <span className="text-xs font-mono font-medium text-indigo-300">
                      {tagsStats.total_tags} / {tagsStats.max_tags} used
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        tagsStats.total_tags >= 50
                          ? 'bg-amber-500'
                          : tagsStats.total_tags > 40
                          ? 'bg-indigo-400'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (tagsStats.total_tags / tagsStats.max_tags) * 100)}%` }}
                    />
                  </div>

                  {tagOpMessage && (
                    <div
                      className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                        tagOpMessage.success
                          ? 'bg-emerald-950/40 text-emerald-300'
                          : 'bg-red-950/40 text-red-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{tagOpMessage.message}</span>
                    </div>
                  )}

                  {/* Merge / Rename Form */}
                  <div className="pt-1">
                    <p className="text-[11px] text-zinc-400 mb-1.5">
                      Merge redundant tags to free up global slots:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Old tag (e.g. ai)"
                        value={renameOldTag}
                        onChange={(e) => setRenameOldTag(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-zinc-500">→</span>
                      <input
                        type="text"
                        placeholder="New tag (e.g. artificial-intelligence)"
                        value={renameNewTag}
                        onChange={(e) => setRenameNewTag(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleRenameTag}
                        disabled={isRenamingTag || !renameOldTag.trim() || !renameNewTag.trim()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold rounded-lg text-zinc-200 transition cursor-pointer flex-shrink-0"
                      >
                        {isRenamingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Merge'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded-lg text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition shadow-sm"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Settings
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
