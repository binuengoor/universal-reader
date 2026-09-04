import React, { useState, useRef, useEffect } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import AudioPlayer from './components/AudioPlayer';
import DocumentEditor from './components/DocumentEditor';
import SettingsModal from './components/SettingsModal';
import { prefetchBlockAudio } from './utils/audioPrefetch';

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentAudioSrc, setCurrentAudioSrc] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Default voice & model - synchronized with backend settings
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem('universal_reader_voice') || 'en-US-ChristopherNeural';
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('universal_reader_model') || 'edge-tts';
  });

  const audioRef = useRef(null);

  const [readerSettings, setReaderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('universal_reader_settings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.7,
      fontFamily: 'serif',
      contentWidth: 'max-w-3xl',
    };
  });

  // Sync initial defaults from /api/settings on mount if not customized in localStorage
  useEffect(() => {
    let ignore = false;
    const fetchDefaultSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;
        const storedModel = localStorage.getItem('universal_reader_model');
        const storedVoice = localStorage.getItem('universal_reader_voice');
        if (!storedModel && (data.tts_default_model || data.default_model)) {
          setSelectedModel(data.tts_default_model || data.default_model);
        }
        if (!storedVoice && (data.tts_default_voice || data.default_voice)) {
          setSelectedVoice(data.tts_default_voice || data.default_voice);
        }
      } catch {
        // ignore
      }
    };
    fetchDefaultSettings();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch document summary (e.g. block count) when selectedDocId changes
  useEffect(() => {
    let ignore = false;
    if (selectedDocId) {
      fetch(`/api/documents/${selectedDocId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.chunks) {
            setTotalBlocks(data.chunks.length);
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [selectedDocId]);

  // When activeBlockId, voice, model, or speed changes, update audio source
  useEffect(() => {
    if (!selectedDocId || activeBlockId === null) return;

    const audioEl = audioRef.current;
    if (!audioEl) return;

    const src = `/api/documents/${selectedDocId}/blocks/${activeBlockId}/audio?voice=${selectedVoice}&model=${selectedModel}&speed=${playbackSpeed}`;
    setCurrentAudioSrc(src);
    setIsLoadingAudio(true);
    audioEl.src = src;
    audioEl.playbackRate = playbackSpeed;
    audioEl.load();

    if (isPlaying) {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Play request may fail if user has not interacted or network error
        });
      }
    }
  }, [selectedDocId, activeBlockId, selectedVoice, selectedModel, playbackSpeed, isPlaying]);

  // Lookahead sliding window prefetch for blocks N+1 and N+2
  useEffect(() => {
    if (!selectedDocId || activeBlockId === null || !isPlaying) return;

    const next1 = activeBlockId + 1;
    const next2 = activeBlockId + 2;

    if (next1 < totalBlocks) {
      prefetchBlockAudio(selectedDocId, next1, selectedVoice, selectedModel, playbackSpeed);
    }
    if (next2 < totalBlocks) {
      prefetchBlockAudio(selectedDocId, next2, selectedVoice, selectedModel, playbackSpeed);
    }
  }, [selectedDocId, activeBlockId, isPlaying, totalBlocks, selectedVoice, selectedModel, playbackSpeed]);

  const handleTogglePlay = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (activeBlockId === null && totalBlocks > 0) {
      setActiveBlockId(0);
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      audioEl.play().catch(() => {});
    }
  };

  const handleSeek = (newTime) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleVoiceChange = (voice) => {
    setSelectedVoice(voice);
    try {
      localStorage.setItem('universal_reader_voice', voice);
    } catch {
      // ignore
    }
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
    try {
      localStorage.setItem('universal_reader_model', model);
    } catch {
      // ignore
    }
  };

  const handleNextBlock = () => {
    if (activeBlockId !== null && activeBlockId < totalBlocks - 1) {
      setActiveBlockId((prev) => prev + 1);
    }
  };

  const handlePrevBlock = () => {
    if (activeBlockId !== null && activeBlockId > 0) {
      setActiveBlockId((prev) => prev - 1);
    }
  };

  const handleUpdateSettings = (newSettings) => {
    setReaderSettings(newSettings);
    try {
      localStorage.setItem('universal_reader_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
  };

  const handleBackToLibrary = () => {
    setSelectedDocId(null);
    setActiveBlockId(0);
    setTotalBlocks(0);
    setIsPlaying(false);
    setCurrentAudioSrc('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setIsLoadingAudio(false);
        }}
        onWaiting={() => setIsLoadingAudio(true)}
        onPlaying={() => {
          setIsLoadingAudio(false);
          setIsPlaying(true);
        }}
        onPause={() => {
          // Only sync pause if audio actually ended or stopped
          if (audioRef.current && audioRef.current.ended) {
            // Handled in onEnded
          }
        }}
        onEnded={() => {
          if (activeBlockId !== null && activeBlockId < totalBlocks - 1) {
            setActiveBlockId((prev) => prev + 1);
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
        }}
      />

      {editingDocId ? (
        <DocumentEditor
          docId={editingDocId}
          onBack={() => setEditingDocId(null)}
          onSaved={(docId) => {
            setEditingDocId(null);
            setSelectedDocId(docId);
            setActiveBlockId(0);
            setIsPlaying(false);
          }}
        />
      ) : selectedDocId ? (
        <>
          <ReaderView
            docId={selectedDocId}
            onBack={handleBackToLibrary}
            onEdit={() => setEditingDocId(selectedDocId)}
            activeBlockId={activeBlockId}
            isPlaying={isPlaying}
            onSelectBlock={(id) => {
              if (activeBlockId === id) {
                handleTogglePlay();
              } else {
                setActiveBlockId(id);
                setIsPlaying(true);
              }
            }}
            settings={readerSettings}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* Sticky Bottom Audio Player: Always mounted & visible during reading session */}
          <AudioPlayer
            docId={selectedDocId}
            currentBlock={activeBlockId}
            totalBlocks={totalBlocks}
            isPlaying={isPlaying}
            isLoadingAudio={isLoadingAudio}
            audioSrc={currentAudioSrc}
            playbackSpeed={playbackSpeed}
            selectedVoice={selectedVoice}
            selectedModel={selectedModel}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onSpeedChange={handleSpeedChange}
            onVoiceChange={handleVoiceChange}
            onModelChange={handleModelChange}
            onNextBlock={handleNextBlock}
            onPrevBlock={handlePrevBlock}
            currentTime={currentTime}
            duration={duration}
          />
        </>
      ) : (
        <LibraryView
          onSelectDocument={(id) => {
            setSelectedDocId(id);
            setActiveBlockId(0);
            setIsPlaying(false);
          }}
          onEditDocument={(id) => setEditingDocId(id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* In-App Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={(settings) => {
          if (settings.tts_default_model) {
            setSelectedModel(settings.tts_default_model);
          }
          if (settings.tts_default_voice) {
            setSelectedVoice(settings.tts_default_voice);
          }
        }}
      />
    </div>
  );
}
