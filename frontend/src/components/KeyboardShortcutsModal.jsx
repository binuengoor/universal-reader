import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { getTheme } from '../utils/theme';

export default function KeyboardShortcutsModal({ isOpen, onClose, theme = 'dark' }) {
  if (!isOpen) return null;
  const t = getTheme(theme);

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
      className={`fixed inset-0 z-50 ${t.modalBackdrop} flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <div
        className={`${t.modalSurface} border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-4 border-b ${t.divider}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-500">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-semibold ${t.cardTitle}`}>Keyboard Shortcuts</h2>
              <p className={`text-xs ${t.cardMeta}`}>Control reading & playback without a mouse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 ${t.iconMuted} hover:opacity-100 rounded-lg transition cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-5">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${t.cardMeta} mb-2.5`}>
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg border text-xs ${t.card}`}
                  >
                    <span className={t.cardSnippet}>{item.desc}</span>
                    <kbd className={`px-2 py-1 rounded text-[11px] font-mono font-medium shadow-2xs border ${t.badge} text-indigo-500 font-semibold`}>
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`pt-3 border-t ${t.divider} flex justify-end`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition cursor-pointer ${t.btnSecondary}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
