import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Check,
  Globe2,
  Sparkles,
  Download,
  Star
} from 'lucide-react';
import { priorityAudioQueue } from '../utils/priorityAudioQueue';


export default function AudioPlayer({
  docId,
  currentBlock = 0,
  totalBlocks = 0,
  isPlaying,
  isLoadingAudio,
  audioSrc,
  playbackSpeed = 1.0,
  selectedVoice = 'en-US-ChristopherNeural',
  selectedModel = 'edge-tts',
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
  const [voices, setVoices] = useState([]);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  
  // Multi-select engine filter toggles
  const [selectedEngines, setSelectedEngines] = useState(['edge-tts', 'kokoro', 'piper', 'google-cloud']);
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  // Scoped Voices & Favorites
  const [scopedVoices, setScopedVoices] = useState([]);
  const [onlyShowFavorites, setOnlyShowFavorites] = useState(false);


  // Full note audio generation state
  const [queueStatus, setQueueStatus] = useState(() => priorityAudioQueue.getStatus());
  const [isExporting, setIsExporting] = useState(false);

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  useEffect(() => {
    const unsubscribe = priorityAudioQueue.subscribe((status) => {
      setQueueStatus(status);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let ignore = false;
    const fetchVoicesAndSettings = async () => {
      try {
        const [voicesRes, settingsRes] = await Promise.all([
          fetch('/api/voices'),
          fetch('/api/settings')
        ]);

        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          if (!ignore) {
            const list = Array.isArray(sData.scoped_voices) ? sData.scoped_voices : [];
            const enabled = Boolean(sData.scoped_voices_enabled);
            setScopedVoices(list);
            setScopedVoicesEnabled(enabled);
            if (enabled && list.length > 0) {
              setOnlyShowFavorites(true);
            }
          }
        }

        if (voicesRes.ok) {
          const data = await voicesRes.json();
          if (!ignore && data.voices && data.voices.length > 0) {
            const formatted = data.voices.map((v) => ({
              id: v.id,
              label: v.name || v.id,
              engine: v.engine || 'edge-tts',
              language: v.language || '',
              gender: v.gender || '',
            }));
            setVoices(formatted);

            // Dynamically pre-select all discovered engines
            const fetchedEngines = Array.from(new Set(formatted.map((v) => v.engine).filter(Boolean)));
            if (fetchedEngines.length > 0) {
              setSelectedEngines(fetchedEngines);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    fetchVoicesAndSettings();
    return () => {
      ignore = true;
    };
  }, []);


  const availableEngines = useMemo(() => {
    const set = new Set(voices.map((v) => v.engine).filter(Boolean));
    return Array.from(set).length > 0 ? Array.from(set) : ['edge-tts', 'kokoro', 'piper'];
  }, [voices]);

  const availableLanguages = useMemo(() => {
    const map = new Map();
    voices.forEach((v) => {
      if (v.language) {
        const lang = v.language;
        map.set(lang, (map.get(lang) || 0) + 1);
      }
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return sorted;
  }, [voices]);

  const toggleEngine = (engine) => {
    setSelectedEngines((prev) => {
      if (prev.includes(engine)) {
        if (prev.length === 1) return prev;
        return prev.filter((e) => e !== engine);
      } else {
        return [...prev, engine];
      }
    });
  };

  const allEnginesSelected = availableEngines.length > 0 && selectedEngines.length === availableEngines.length;

  const toggleAllEngines = () => {
    if (allEnginesSelected) {
      setSelectedEngines([]);
    } else {
      setSelectedEngines(availableEngines);
    }
  };

  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      if (onlyShowFavorites && scopedVoices.length > 0 && !scopedVoices.includes(v.id)) {
        return false;
      }
      if (selectedEngines.length > 0 && !selectedEngines.includes(v.engine)) {
        return false;
      }
      if (selectedLanguage !== 'all' && v.language.toLowerCase() !== selectedLanguage.toLowerCase()) {
        return false;
      }
      if (voiceSearchQuery.trim()) {
        const q = voiceSearchQuery.toLowerCase();
        const id = (v.id || '').toLowerCase();
        const label = (v.label || '').toLowerCase();
        const lang = (v.language || '').toLowerCase();
        const eng = (v.engine || '').toLowerCase();
        return id.includes(q) || label.includes(q) || lang.includes(q) || eng.includes(q);
      }
      return true;
    });
  }, [voices, selectedEngines, selectedLanguage, voiceSearchQuery, onlyShowFavorites, scopedVoices]);


  const currentVoiceObj = useMemo(() => {
    return voices.find((v) => v.id === selectedVoice);
  }, [voices, selectedVoice]);

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

  const handleSelectVoice = (voiceItem) => {
    if (onVoiceChange) onVoiceChange(voiceItem.id);
    if (voiceItem.engine && onModelChange) {
      onModelChange(voiceItem.engine);
    }
  };

  // Trigger background generation for all blocks
  const handleGenerateFullAudio = () => {
    if (!docId || totalBlocks <= 0) return;
    priorityAudioQueue.enqueueFullDocument(docId, totalBlocks, selectedVoice, selectedModel, playbackSpeed);
  };

  const handleCancelFullAudio = () => {
    if (!docId) return;
    priorityAudioQueue.cancelFullDocument(docId);
  };

  // Download entire concatenated audio
  const handleDownloadFullAudio = () => {
    if (!docId) return;
    setIsExporting(true);
    const url = `/api/documents/${docId}/export-audio?voice=${encodeURIComponent(
      selectedVoice
    )}&model=${encodeURIComponent(selectedModel)}&speed=${playbackSpeed}`;
    
    // Direct browser navigation triggers file download
    window.location.href = url;
    setTimeout(() => {
      setIsExporting(false);
    }, 2000);
  };

  const displayBlockIndex = currentBlock !== null && currentBlock !== undefined ? currentBlock : 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isReadyToPlay = Boolean(docId && totalBlocks > 0);

  const fullTask = queueStatus.fullDocTask;
  const isThisDocGenerating = fullTask && fullTask.docId === docId && !fullTask.cancelled;
  const fullPercent = isThisDocGenerating && fullTask.total > 0 
    ? Math.round((fullTask.completed / fullTask.total) * 100) 
    : 0;

  return (
    <>
      <div className="fixed bottom-2 sm:bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-4xl z-40 transition-all duration-200 pb-safe">
        <div className="bg-zinc-950/95 sm:bg-zinc-950/90 hover:bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 rounded-2xl p-2.5 sm:p-4 shadow-2xl text-zinc-100 flex flex-col gap-2 sm:gap-2.5">
          {/* Top Progress / Background Generation Banner */}
          {isThisDocGenerating && (
            <div className="flex items-center justify-between text-[11px] bg-indigo-950/50 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-indigo-300">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0" />
                <span className="truncate">
                  Generating full note audio: {fullTask.completed} / {fullTask.total} blocks ({fullPercent}%)
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelFullAudio}
                className="text-xs text-zinc-400 hover:text-red-400 transition cursor-pointer ml-2 flex-shrink-0"
              >
                Cancel
              </button>
            </div>
          )}


          {/* Audio Track Progress Bar */}
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
                Block {totalBlocks > 0 ? displayBlockIndex + 1 : 0} / {totalBlocks}
              </div>
              <span className="text-xs font-mono text-zinc-400 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={onPrevBlock}
                disabled={!isReadyToPlay || displayBlockIndex <= 0}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition cursor-pointer"
                title="Previous Block"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleJump(-10)}
                disabled={!audioSrc}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition flex items-center justify-center relative cursor-pointer"
                title="Jump back 10s"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px] font-bold absolute top-2.5">10</span>
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!isReadyToPlay || (isLoadingAudio && !audioSrc)}
                className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                type="button"
                onClick={() => handleJump(10)}
                disabled={!audioSrc}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition flex items-center justify-center relative cursor-pointer"
                title="Jump forward 10s"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[9px] font-bold absolute top-2.5">10</span>
              </button>

              <button
                type="button"
                onClick={onNextBlock}
                disabled={!isReadyToPlay || displayBlockIndex >= totalBlocks - 1}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition cursor-pointer"
                title="Next Block"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Actions, Speed & Voice / Model settings */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Generate Full Audio button */}
              <button
                type="button"
                onClick={isThisDocGenerating ? handleCancelFullAudio : handleGenerateFullAudio}
                disabled={!isReadyToPlay}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-indigo-300 transition cursor-pointer"
                title="Pre-generate audio for all blocks in background"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isThisDocGenerating ? 'Stop Full Gen' : 'Gen All'}</span>
              </button>

              {/* Download MP3 button */}
              <button
                type="button"
                onClick={handleDownloadFullAudio}
                disabled={!isReadyToPlay || isExporting}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
                title="Download full document as single MP3"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">MP3</span>
              </button>

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
                type="button"
                onClick={() => setShowModelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition cursor-pointer max-w-[190px]"
                title="Voice & Engine Configuration"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="truncate">
                  {currentVoiceObj ? (currentVoiceObj.label.split(' - ')[0] || currentVoiceObj.id) : selectedVoice}
                </span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-indigo-300 flex-shrink-0">
                  {selectedModel}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Model & Voice Selection Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-zinc-100 max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowModelModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold">TTS Engine & Voice Selection</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Toggle engine buttons to filter voices across Edge TTS, Kokoro (neural), Piper, and Google Cloud.
            </p>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Push-on Push-off Engine Filter Buttons */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Filter by Engine
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    {scopedVoices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOnlyShowFavorites((prev) => !prev)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition cursor-pointer font-medium ${
                          onlyShowFavorites
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${onlyShowFavorites ? 'fill-amber-400 text-amber-400' : ''}`} />
                        <span>Favorites ({scopedVoices.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleAllEngines}
                      className="text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
                    >
                      {allEnginesSelected ? 'Unselect All' : 'Select All'}
                    </button>
                  </div>
                </div>


                <div className="flex flex-wrap items-center gap-2">
                  {availableEngines.map((engine) => {
                    const isToggled = selectedEngines.includes(engine);
                    const engineCount = voices.filter((v) => v.engine === engine).length;
                    return (
                      <button
                        key={engine}
                        type="button"
                        onClick={() => toggleEngine(engine)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition cursor-pointer ${
                          isToggled
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/40'
                            : 'bg-zinc-800/50 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                          isToggled ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-zinc-600'
                        }`}>
                          {isToggled && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="capitalize font-semibold">{engine}</span>
                        <span className="text-[10px] opacity-60">({engineCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Selector & Voice Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                    <Globe2 className="w-3.5 h-3.5 text-zinc-500" />
                    Language / Region
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Languages ({voices.length})</option>
                    {availableLanguages.map(([lang, count]) => (
                      <option key={lang} value={lang}>
                        {lang} ({count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Search Voices ({filteredVoices.length} found)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search voice by name or ID..."
                      value={voiceSearchQuery}
                      onChange={(e) => setVoiceSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Voice Cards / List */}
              <div>
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800 rounded-xl p-2 bg-zinc-950/40">
                  {filteredVoices.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVoice(v)}
                        className={`w-full px-3 py-2 rounded-lg text-left text-xs transition flex items-center justify-between cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                            : 'border-transparent text-zinc-300 hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{v.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                              {v.engine}
                            </span>
                            {v.language && (
                              <span className="text-[10px] opacity-60 font-mono">
                                {v.language}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono opacity-50 truncate mt-0.5">
                            {v.id}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold flex-shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredVoices.length === 0 && (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      No voices match your filters. Try selecting more engines or clearing search.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                Selected: <span className="font-semibold text-zinc-200">{selectedVoice}</span> <span className="opacity-60 font-mono">({selectedModel})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowModelModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
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
