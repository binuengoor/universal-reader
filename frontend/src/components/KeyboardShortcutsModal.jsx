import React from 'react';
import { X, Keyboard } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Playback & Audio',
      items: [
        { key: 'Space', desc: 'Toggle Play / Pause audio' },
        { key: 'J / K', desc: 'Jump to Next / Previous block' },
        { key: '[ / ]', desc: 'Decrease / Increase playback speed (±0.1x)' },
        { key: '0', desc: 'Reset playback speed to 1.0x' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { key: 'Esc', desc: 'Close modals / Return to Library' },
        { key: '?', desc: 'Toggle this Keyboard Shortcuts HUD' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Keyboard Shortcuts</h2>
              <p className="text-xs text-zinc-400">Control reading & playback without a mouse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-5">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-xs"
                  >
                    <span className="text-zinc-300">{item.desc}</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] font-mono font-medium text-indigo-300 shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 rounded-xl transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
