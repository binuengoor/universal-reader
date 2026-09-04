import React from 'react';
import { X, Sun, Moon, Coffee, Type, Minus, Plus } from 'lucide-react';

export default function DisplaySettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) {
  if (!isOpen) return null;

  const themes = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      bg: 'bg-white',
      text: 'text-zinc-900',
      border: 'border-zinc-300',
    },
    {
      id: 'sepia',
      label: 'Sepia',
      icon: Coffee,
      bg: 'bg-[#fbf0d9]',
      text: 'text-[#433422]',
      border: 'border-[#dfcaa3]',
    },
    {
      id: 'dark',
      label: 'OLED Dark',
      icon: Moon,
      bg: 'bg-black',
      text: 'text-zinc-100',
      border: 'border-zinc-800',
    },
  ];

  const fonts = [
    { id: 'serif', label: 'Bookerly / Serif', family: 'Georgia, serif' },
    { id: 'sans', label: 'Modern Sans', family: 'system-ui, sans-serif' },
    { id: 'mono', label: 'Technical Mono', family: 'monospace' },
  ];

  const lineHeights = [
    { value: 1.4, label: 'Compact' },
    { value: 1.7, label: 'Normal' },
    { value: 2.1, label: 'Relaxed' },
  ];

  const contentWidths = [
    { id: 'narrow', label: 'Narrow', value: 'max-w-xl' },
    { id: 'standard', label: 'Standard', value: 'max-w-3xl' },
    { id: 'wide', label: 'Wide', value: 'max-w-4xl' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm h-full bg-zinc-900 border-l border-zinc-800 text-zinc-100 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-200">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-base">Display Options</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Color Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const Icon = t.icon;
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onUpdateSettings({ ...settings, theme: t.id })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition cursor-pointer ${
                      t.bg
                    } ${t.text} ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 font-semibold shadow-md'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Typography
            </label>
            <div className="space-y-1.5">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ ...settings, fontFamily: f.id })}
                  style={{ fontFamily: f.family }}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm text-left border transition flex items-center justify-between ${
                    settings.fontFamily === f.id
                      ? 'bg-zinc-800 border-indigo-500/80 text-indigo-300 font-medium'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/50 text-zinc-300'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-xs opacity-50">Aa</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Stepper */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Font Size
              </label>
              <span className="text-xs font-mono text-zinc-400">{settings.fontSize || 18}px</span>
            </div>
            <div className="flex items-center gap-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl p-1.5">
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    fontSize: Math.max(14, (settings.fontSize || 18) - 1),
                  })
                }
                disabled={(settings.fontSize || 18) <= 14}
                className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 transition flex-1 flex items-center justify-center"
                title="Decrease font size"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium w-10 text-center select-none">
                {settings.fontSize || 18}
              </span>
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    fontSize: Math.min(32, (settings.fontSize || 18) + 1),
                  })
                }
                disabled={(settings.fontSize || 18) >= 32}
                className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 transition flex-1 flex items-center justify-center"
                title="Increase font size"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Line Spacing */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Line Spacing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {lineHeights.map((lh) => (
                <button
                  key={lh.value}
                  onClick={() => onUpdateSettings({ ...settings, lineHeight: lh.value })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                    settings.lineHeight === lh.value
                      ? 'bg-zinc-800 border-indigo-500 text-indigo-300'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column Width */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Column Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {contentWidths.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onUpdateSettings({ ...settings, contentWidth: w.value })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                    (settings.contentWidth || 'max-w-3xl') === w.value
                      ? 'bg-zinc-800 border-indigo-500 text-indigo-300'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">
          Preferences saved locally
        </div>
      </div>
    </div>
  );
}
