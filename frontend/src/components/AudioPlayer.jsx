import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  SkipBack, 
  SkipForward, 
  Loader2, 
  Search, 
  Sliders, 
  ChevronDown,
  X
} from 'lucide-react';

const DEFAULT_POPULAR_VOICES = [
  { id: 'af_heart', label: 'Heart (Kokoro Warm)', engine: 'kokoro' },
  { id: 'af_alloy', label: 'Alloy (Kokoro Neutral)', engine: 'kokoro' },
  { id: 'af_bella', label: 'Bella (Kokoro Soft)', engine: 'kokoro' },
  { id: 'af_nova', label: 'Nova (Kokoro Bright)', engine: 'kokoro' },
  { id: 'am_echo', label: 'Echo (Kokoro Male)', engine: 'kokoro' },
  { id: 'am_onyx', label: 'Onyx (Kokoro Deep)', engine: 'kokoro' },
  { id: 'bf_emma', label: 'Emma (British Female)', engine: 'kokoro' },
  { id: 'bm_george', label: 'George (British Male)', engine: 'kokoro' },
  { id: 'alloy', label: 'Standard Alloy', engine: 'openai' },
  { id: 'echo', label: 'Standard Echo', engine: 'openai' },
];

export default function AudioPlayer({
  docId,
  currentBlock,
  totalBlocks = 0,
  isPlaying,
  isLoadingAudio,
  audioSrc,
  playbackSpeed = 1.0,
  selectedVoice = 'af_alloy',
  selectedModel = 'kokoro',
  onTogglePlay,
  onSeek,
  onSpeedChange,
  onVoiceChange,
  onModelChange,
  onNextBlock,
  onPrevBlock,
  currentTime = 0,
  duration = 0,
}) {
  const [showModelModal, setShowModelModal] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [voices, setVoices] = useState(DEFAULT_POPULAR_VOICES);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  useEffect(() => {
    let ignore = false;
    const fetchModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch('/api/models');
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        if (!ignore) {
          setModels(data.data || []);
        }
      } catch {
        if (!ignore) {
          setModels([
            { id: 'kokoro', name: 'Kokoro (Neural TTS)' },
            { id: 'tts-1', name: 'TTS 1 (Standard)' },
            { id: 'tts-1-hd', name: 'TTS 1 HD (High Quality)' },
            { id: 'edge-tts', name: 'Edge-TTS' },
            { id: 'piper', name: 'Piper' },
          ]);
        }
      } finally {
        if (!ignore) setLoadingModels(false);
      }
    };

    const fetchVoices = async () => {
      try {
        const res = await fetch('/api/voices');
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data.voices && data.voices.length > 0) {
          const formatted = data.voices.map((v) => ({
            id: v.id,
            label: v.name || v.id,
            engine: v.engine || 'tts',
            language: v.language || '',
          }));
          setVoices(formatted);
        }
      } catch {
        // Keep default popular voices
      }
    };

    fetchModels();
    fetchVoices();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredModels = models;

  const filteredVoices = voices.filter((v) => {
    const q = voiceSearchQuery.toLowerCase();
    const id = (v.id || '').toLowerCase();
    const label = (v.label || '').toLowerCase();
    const engine = (v.engine || '').toLowerCase();
    return id.includes(q) || label.includes(q) || engine.includes(q);
  });

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleProgressClick = (e) => {
    if (!duration || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    onSeek(pos * duration);
  };

  const handleJump = (delta) => {
    if (!onSeek) return;
    const nextTime = Math.max(0, Math.min(duration, currentTime + delta));
    onSeek(nextTime);
  };

  if (!docId || currentBlock === null || currentBlock === undefined) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-40 transition-all duration-200">
        <div className="bg-zinc-950/90 hover:bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl text-zinc-100 flex flex-col gap-2.5">
          {/* Progress bar */}
          <div
            onClick={handleProgressClick}
            className="w-full h-1.5 bg-zinc-800 hover:h-2 rounded-full overflow-hidden cursor-pointer transition-all relative group"
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Main Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Block info & Times */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md text-xs font-mono font-medium">
                Block {currentBlock + 1} / {totalBlocks}
              </div>
              <span className="text-xs font-mono text-zinc-400 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={onPrevBlock}
                disabled={currentBlock <= 0}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition"
                title="Previous Block"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleJump(-10)}
                disabled={!audioSrc}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition flex items-center justify-center relative"
                title="Jump back 10s"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px] font-bold absolute top-2.5">10</span>
              </button>

              <button
                onClick={onTogglePlay}
                disabled={isLoadingAudio && !audioSrc}
                className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => handleJump(10)}
                disabled={!audioSrc}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition flex items-center justify-center relative"
                title="Jump forward 10s"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[9px] font-bold absolute top-2.5">10</span>
              </button>

              <button
                onClick={onNextBlock}
                disabled={currentBlock >= totalBlocks - 1}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition"
                title="Next Block"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Speed & Voice / Model settings */}
            <div className="flex items-center gap-2">
              {/* Speed selector */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <select
                  value={playbackSpeed}
                  onChange={(e) => onSpeedChange && onSpeedChange(parseFloat(e.target.value))}
                  className="bg-transparent text-xs font-semibold px-2 py-1 text-zinc-300 focus:outline-none cursor-pointer"
                  title="Playback Speed"
                >
                  {speedOptions.map((s) => (
                    <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                      {s}x
                    </option>
                  ))}
                </select>
              </div>

              {/* Model & Voice Dropdown Trigger */}
              <button
                onClick={() => setShowModelModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition"
                title="Voice and Model Settings"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline capitalize">{selectedVoice.replace('af_', '').replace('am_', '')}</span>
                <span className="opacity-50 text-[10px]">({selectedModel})</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Model & Voice Selection Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-zinc-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowModelModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              TTS Engine & Voice Configuration
            </h3>

            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {/* Model selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Model / Engine
                  </label>
                  {loadingModels && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredModels.map((m) => {
                    const mId = m.id || m;
                    const mName = m.name || mId;
                    const isSelected = selectedModel === mId;
                    return (
                      <button
                        key={mId}
                        onClick={() => onModelChange && onModelChange(mId)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                            : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="truncate font-semibold">{mId}</div>
                        <div className="text-[10px] opacity-60 truncate">{mName}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Searchable Voice Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Voice ({filteredVoices.length} available)
                  </label>
                </div>

                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search voices by name, language, or engine..."
                    value={voiceSearchQuery}
                    onChange={(e) => setVoiceSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800 rounded-lg p-1.5 bg-zinc-950/40">
                  {filteredVoices.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => onVoiceChange && onVoiceChange(v.id)}
                        className={`w-full px-3 py-2 rounded-md text-left text-xs transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-semibold">{v.label}</span>
                          {v.engine && (
                            <span className="ml-2 text-[10px] opacity-60 uppercase font-mono px-1 py-0.5 rounded bg-black/20">
                              {v.engine}
                            </span>
                          )}
                        </div>
                        {isSelected && <span className="text-[10px] opacity-90 ml-2">Selected</span>}
                      </button>
                    );
                  })}
                  {filteredVoices.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-4">No matching voices found.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowModelModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
