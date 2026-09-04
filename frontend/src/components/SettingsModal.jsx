import React, { useState, useEffect } from 'react';
import { X, Server, Key, Mic, Layers, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('edge-tts');
  const [defaultVoice, setDefaultVoice] = useState('en-US-ChristopherNeural');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        setTestResult(null);
        setSaveSuccess(false);

        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        if (!ignore) {
          setBaseUrl(data.tts_base_url || '');
          setApiKey(data.tts_api_key || '');
          setDefaultModel(data.tts_default_model || 'edge-tts');
          setDefaultVoice(data.tts_default_voice || 'en-US-ChristopherNeural');
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading settings');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchSettings();
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
        success: true,
        message: `Connected successfully! Found ${data.models?.length || 0} models and ${data.voice_count || 0} voices.`,
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save settings');
      }

      setSaveSuccess(true);
      // Also sync to localStorage so current player can update
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

        <div className="flex items-center gap-2.5 mb-1">
          <Server className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold">TTS Engine & Settings</h3>
        </div>
        <p className="text-xs text-zinc-400 mb-5">
          Configure the upstream Universal TTS endpoint (compatible with OpenAI Speech API), default synthesis engine, and voices.
        </p>

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

            {saveSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Settings saved successfully!</span>
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

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !baseUrl}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium rounded-lg text-zinc-300 transition"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Test Connection
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded-lg text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !baseUrl}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition shadow-sm"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Settings
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
