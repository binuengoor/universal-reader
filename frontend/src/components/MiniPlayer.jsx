import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Loader2, 
  Maximize2, 
  X, 
  Volume2, 
  Moon 
} from 'lucide-react';
import { getTheme } from '../utils/theme';

export default function MiniPlayer({
  docTitle,
  currentBlock = 0,
  totalBlocks = 0,
  isPlaying,
  isLoadingAudio,
  playbackSpeed = 1.0,
  sleepTimerRemaining = null,
  onTogglePlay,
  onPrevBlock,
  onNextBlock,
  onSpeedChange,
  onOpenReader,
  onDismiss,
  theme = 'dark',
}) {
  const t = getTheme(theme);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const formatTimer = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] ${t.playerShell} rounded-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200`}>
      {/* Left: Document info */}
      <div 
        onClick={onOpenReader}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
        title="Click to open reader view"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-600/30 transition">
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-3.5">
              <span className="w-0.5 h-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
              <span className="w-0.5 h-2/3 bg-indigo-500 dark:bg-indigo-400 animate-pulse delay-75" />
              <span className="w-0.5 h-4/5 bg-indigo-500 dark:bg-indigo-400 animate-pulse delay-150" />
            </div>
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold truncate ${t.cardTitle} transition`}>
            {docTitle || 'Reading Document'}
          </p>
          <div className={`flex items-center gap-1.5 text-[10px] ${t.cardMeta}`}>
            <span>Block {currentBlock + 1} of {totalBlocks || 1}</span>
            {sleepTimerRemaining !== null && sleepTimerRemaining > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  <Moon className="w-2.5 h-2.5" />
                  {formatTimer(sleepTimerRemaining)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Playback controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onPrevBlock}
          disabled={currentBlock <= 0}
          className={`p-1.5 ${t.playerBtn} disabled:opacity-30 rounded-lg transition cursor-pointer`}
          title="Previous block"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-md shadow-indigo-600/20 cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onNextBlock}
          disabled={currentBlock >= totalBlocks - 1}
          className={`p-1.5 ${t.playerBtn} disabled:opacity-30 rounded-lg transition cursor-pointer`}
          title="Next block"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Speed, Expand & Dismiss */}
      <div className={`flex items-center gap-1 shrink-0 border-l ${t.divider} pl-2`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className={`text-[11px] font-mono font-medium px-2 py-1 rounded transition cursor-pointer border ${t.btnSecondary}`}
            title="Playback speed"
          >
            {playbackSpeed}x
          </button>

          {showSpeedMenu && (
            <div className={`absolute bottom-full mb-2 right-0 ${t.playerPopover} rounded-xl p-1 shadow-xl flex flex-col gap-0.5 z-50 min-w-16`}>
              {speedOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (onSpeedChange) onSpeedChange(s);
                    setShowSpeedMenu(false);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg text-left transition font-mono ${
                    playbackSpeed === s
                      ? 'bg-indigo-600 text-white font-semibold'
                      : `${t.playerPopoverItem}`
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenReader}
          className={`p-1.5 ${t.iconMuted} hover:text-indigo-500 transition cursor-pointer`}
          title="Open in Reader"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className={`p-1.5 ${t.iconMuted} hover:opacity-100 transition cursor-pointer`}
          title="Dismiss player"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
