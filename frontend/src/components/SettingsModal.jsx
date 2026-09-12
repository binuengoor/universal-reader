import React, { useState, useEffect } from 'react';
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
  Search
} from 'lucide-react';


export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('tts'); // 'tts' | 'scoped' | 'llm'

  // TTS Settings
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('edge-tts');
  const [defaultVoice, setDefaultVoice] = useState('en-US-ChristopherNeural');

  // Scoped Voices
  const [scopedVoices, setScopedVoices] = useState([]);
  const [scopedVoicesEnabled, setScopedVoicesEnabled] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceFilterSearch, setVoiceFilterSearch] = useState('');

  // LLM Cleaner Settings
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmCleanEnabled, setLlmCleanEnabled] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

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

        const [settingsRes, voicesRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/voices')
        ]);

        if (!settingsRes.ok) throw new Error('Failed to load settings');
        const data = await settingsRes.json();
        
        let voicesList = [];
        if (voicesRes.ok) {
          const vData = await voicesRes.json();
          voicesList = vData.voices || [];
        }

        if (!ignore) {
          setBaseUrl(data.tts_base_url || '');
          setApiKey(data.tts_api_key || '');
          setDefaultModel(data.tts_default_model || 'edge-tts');
          setDefaultVoice(data.tts_default_voice || 'en-US-ChristopherNeural');
          setScopedVoices(Array.isArray(data.scoped_voices) ? data.scoped_voices : []);
          setScopedVoicesEnabled(Boolean(data.scoped_voices_enabled));

          setLlmBaseUrl(data.llm_base_url || '');
          setLlmApiKey(data.llm_api_key || '');
          setLlmModel(data.llm_model || 'gpt-4o-mini');
          setLlmPrompt(data.llm_prompt || '');
          setLlmCleanEnabled(Boolean(data.llm_clean_enabled));

          setAvailableVoices(voicesList);
        }
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
          llm_base_url: llmBaseUrl.trim(),
          llm_api_key: llmApiKey.trim(),
          llm_model: llmModel.trim(),
          llm_prompt: llmPrompt.trim(),
          llm_clean_enabled: llmCleanEnabled,
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
            onClick={() => setActiveTab('llm')}
            className={`px-3 py-2 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'llm'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI Text Cleaner
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Loading settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
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
                    required
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
                        if (newMod === 'edge-tts') {
                          setDefaultVoice('en-US-ChristopherNeural');
                        } else if (newMod === 'kokoro') {
                          setDefaultVoice('af_alloy');
                        }
                      }}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="edge-tts">edge-tts (Zero CPU, Recommended)</option>
                      <option value="google-cloud">google-cloud (Google Cloud TTS)</option>
                      <option value="kokoro">kokoro (High Quality Neural)</option>
                      <option value="piper">piper (Local Fast)</option>
                      <option value="tts-1">tts-1 (OpenAI standard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-zinc-400" />
                      Default Voice
                    </label>
                    <input
                      type="text"
                      value={defaultVoice}
                      onChange={(e) => setDefaultVoice(e.target.value)}
                      placeholder="e.g. af_alloy or en-US-ChristopherNeural"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
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
                      placeholder="gpt-4o-mini"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
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
