import React, { useState, useRef, useEffect } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import AudioPlayer from './components/AudioPlayer';
import MiniPlayer from './components/MiniPlayer';
import DocumentEditor from './components/DocumentEditor';
import SettingsModal from './components/SettingsModal';
import { priorityAudioQueue } from './utils/priorityAudioQueue';

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Persistent active audio session state
  const [audioDoc, setAudioDoc] = useState(null); // { id: string, title: string, totalBlocks: number }
  const [activeBlockId, setActiveBlockId] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);

  // Sleep Timer state
  const [sleepTimer, setSleepTimer] = useState(null); // null | 15 | 30 | 45 | 60 | 'end_of_doc'
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null); // seconds

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentAudioSrc, setCurrentAudioSrc] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Default voice & model - initialized from localStorage if available, or backend default
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try {
      return localStorage.getItem('universal_reader_voice') || 'en-US-ChristopherNeural';
    } catch {
      return 'en-US-ChristopherNeural';
    }
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      return localStorage.getItem('universal_reader_model') || 'edge-tts';
    } catch {
      return 'edge-tts';
    }
  });

  const audioRef = useRef(null);

  // Fetch backend settings on mount to ensure user's configured default model and voice are picked up
  useEffect(() => {
    let ignore = false;
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data) {
          const model = data.tts_default_model || data.default_model;
          const voice = data.tts_default_voice || data.default_voice;
          if (model) {
            setSelectedModel(() => {
              return localStorage.getItem('universal_reader_model') || model;
            });
          }
          if (voice) {
            setSelectedVoice(() => {
              return localStorage.getItem('universal_reader_voice') || voice;
            });
          }

        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

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


  // Fetch document summary (e.g. block count) when selectedDocId changes
  useEffect(() => {
    let ignore = false;
    if (selectedDocId) {
      fetch(`/api/documents/${selectedDocId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data) {
            const count = data.chunks?.length || 0;
            const title = data.meta?.title || 'Document';
            setTotalBlocks(count);
            setAudioDoc((prev) => {
              if (prev && prev.id === selectedDocId) {
                return { ...prev, title, totalBlocks: count };
              }
              return { id: selectedDocId, title, totalBlocks: count };
            });
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [selectedDocId]);

  // Sleep Timer countdown effect
  useEffect(() => {
    if (!sleepTimer || sleepTimer === 'end_of_doc' || !isPlaying) return;
    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null) return sleepTimer * 60;
        if (prev <= 1) {
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();
          setSleepTimer(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimer, isPlaying]);

  const handleSetSleepTimer = (val) => {
    setSleepTimer(val);
    if (typeof val === 'number') {
      setSleepTimerRemaining(val * 60);
    } else {
      setSleepTimerRemaining(null);
    }
  };

  // Sync reading/listening progress to backend
  useEffect(() => {
    const docIdToSync = audioDoc?.id || selectedDocId;
    if (docIdToSync && activeBlockId !== null) {
      fetch(`/api/documents/${docIdToSync}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_block_index: activeBlockId })
      }).catch(() => {});
    }
  }, [audioDoc?.id, selectedDocId, activeBlockId]);

  // When activeBlockId, voice, model, or speed changes, update audio source ONLY if playing or already loaded
  useEffect(() => {
    const targetDocId = audioDoc?.id || selectedDocId;
    if (!targetDocId || activeBlockId === null) return;
    if (!isPlaying && !currentAudioSrc) return; // Do not fetch until user initiates playback

    const audioEl = audioRef.current;
    if (!audioEl) return;

    const src = `/api/documents/${targetDocId}/blocks/${activeBlockId}/audio?voice=${selectedVoice}&model=${selectedModel}&speed=${playbackSpeed}`;
    setCurrentAudioSrc(src);
    setIsLoadingAudio(true);
    audioEl.src = src;
    audioEl.playbackRate = playbackSpeed;
    audioEl.load();

    if (isPlaying) {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, [selectedDocId, audioDoc?.id, activeBlockId, selectedVoice, selectedModel, playbackSpeed, isPlaying, currentAudioSrc]);

  // Lookahead sliding window prefetch for blocks N+1 and N+2 (priority 5)
  useEffect(() => {
    const targetDocId = audioDoc?.id || selectedDocId;
    if (!targetDocId || activeBlockId === null) return;

    // Save reading progress in localStorage
    try {
      localStorage.setItem(`read_progress_${targetDocId}`, activeBlockId.toString());
    } catch {
      // ignore
    }

    if (!isPlaying) return;

    const next1 = activeBlockId + 1;
    const next2 = activeBlockId + 2;

    if (next1 < totalBlocks) {
      priorityAudioQueue.enqueue({
        docId: targetDocId,
        blockId: next1,
        voice: selectedVoice,
        model: selectedModel,
        speed: playbackSpeed,
        priority: 5,
      });
    }
    if (next2 < totalBlocks) {
      priorityAudioQueue.enqueue({
        docId: targetDocId,
        blockId: next2,
        voice: selectedVoice,
        model: selectedModel,
        speed: playbackSpeed,
        priority: 5,
      });
    }
  }, [selectedDocId, audioDoc?.id, activeBlockId, isPlaying, totalBlocks, selectedVoice, selectedModel, playbackSpeed]);

  const handleTogglePlay = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      const targetDocId = selectedDocId || audioDoc?.id;
      // If audio element doesn't have src yet, assign it now
      if (!currentAudioSrc && targetDocId) {
        const src = `/api/documents/${targetDocId}/blocks/${activeBlockId}/audio?voice=${selectedVoice}&model=${selectedModel}&speed=${playbackSpeed}`;
        setCurrentAudioSrc(src);
        setIsLoadingAudio(true);
        audioEl.src = src;
        audioEl.playbackRate = playbackSpeed;
        audioEl.load();
      }
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
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
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

  const handleOpenDocument = async (id) => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const defModel = data.tts_default_model || data.default_model || 'edge-tts';
        const defVoice = data.tts_default_voice || data.default_voice || 'en-US-ChristopherNeural';
        setSelectedModel(defModel);
        setSelectedVoice(defVoice);
      }
    } catch {
      // keep current defaults
    }

    setSelectedDocId(id);

    // If opening a different document than active audio session, load its details and resume position
    if (!audioDoc || audioDoc.id !== id) {
      try {
        const docRes = await fetch(`/api/documents/${id}`);
        if (docRes.ok) {
          const docData = await docRes.json();
          const docTitle = docData.meta?.title || 'Document';
          const blocksCount = docData.chunks?.length || 0;
          const resumeIndex = docData.meta?.last_block_index || 0;
          setAudioDoc({ id, title: docTitle, totalBlocks: blocksCount });
          setTotalBlocks(blocksCount);
          setActiveBlockId(resumeIndex);
        }
      } catch {
        // fallback
      }
      setIsPlaying(false);
      setCurrentAudioSrc('');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  };

  const handleBackToLibrary = () => {
    // Return to library while preserving background audio session and mini player
    setSelectedDocId(null);
  };

  const handleDismissMiniPlayer = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioDoc(null);
    setCurrentAudioSrc('');
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
          // Handled in onEnded or user toggle
        }}
        onEnded={() => {
          if (sleepTimer === 'end_of_doc' && activeBlockId >= totalBlocks - 1) {
            setIsPlaying(false);
            setSleepTimer(null);
            setSleepTimerRemaining(null);
            return;
          }
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
            handleOpenDocument(docId);
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
                // Assign src if first time
                if (!currentAudioSrc && audioRef.current) {
                  const src = `/api/documents/${selectedDocId}/blocks/${id}/audio?voice=${selectedVoice}&model=${selectedModel}&speed=${playbackSpeed}`;
                  setCurrentAudioSrc(src);
                  setIsLoadingAudio(true);
                  audioRef.current.src = src;
                  audioRef.current.playbackRate = playbackSpeed;
                  audioRef.current.load();
                }
                setIsPlaying(true);
              }
            }}
            settings={readerSettings}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* Sticky Bottom Audio Player: Always mounted & ready on document open */}
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
            sleepTimer={sleepTimer}
            onSetSleepTimer={handleSetSleepTimer}
            sleepTimerRemaining={sleepTimerRemaining}
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
          onSelectDocument={handleOpenDocument}
          onEditDocument={(id) => setEditingDocId(id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Persistent Global Floating Mini-Player when browsing library or editing */}
      {!selectedDocId && audioDoc && (currentAudioSrc || isPlaying) && (
        <MiniPlayer
          docTitle={audioDoc.title}
          currentBlock={activeBlockId}
          totalBlocks={totalBlocks}
          isPlaying={isPlaying}
          isLoadingAudio={isLoadingAudio}
          playbackSpeed={playbackSpeed}
          sleepTimerRemaining={sleepTimerRemaining}
          onTogglePlay={handleTogglePlay}
          onPrevBlock={handlePrevBlock}
          onNextBlock={handleNextBlock}
          onSpeedChange={handleSpeedChange}
          onOpenReader={() => setSelectedDocId(audioDoc.id)}
          onDismiss={handleDismissMiniPlayer}
        />
      )}

      {/* In-App Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={(settings) => {
          if (settings && settings.tts_default_model) {
            setSelectedModel(settings.tts_default_model);
          }
          if (settings && settings.tts_default_voice) {
            setSelectedVoice(settings.tts_default_voice);
          }
        }}
      />
    </div>
  );
}
