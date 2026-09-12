import React from 'react';
import { X, Sun, Moon, Coffee, Type, Minus, Plus } from 'lucide-react';
import { getTheme } from '../utils/theme';

export default function DisplaySettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) {
  if (!isOpen) return null;
  const t = getTheme(settings.theme);

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
    <div className={`fixed inset-0 z-50 flex justify-end ${t.modalBackdrop} transition-opacity`}>
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className={`relative w-full max-w-sm h-full ${t.modalSurface} border-l p-6 shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-200`}>
        <div className="space-y-6">
          {/* Header */}
          <div className={`flex items-center justify-between border-b ${t.divider} pb-4`}>
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-indigo-500" />
              <h2 className={`font-semibold text-base ${t.cardTitle}`}>Display Options</h2>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg ${t.iconMuted} hover:opacity-100 transition cursor-pointer`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Theme Selector */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider ${t.cardMeta} mb-3`}>
              Color Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((th) => {
                const Icon = th.icon;
                const isSelected = settings.theme === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => onUpdateSettings({ ...settings, theme: th.id })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition cursor-pointer ${
                      th.bg
                    } ${th.text} ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 font-semibold shadow-md'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{th.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider ${t.cardMeta} mb-2`}>
              Typography
            </label>
            <div className="space-y-1.5">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ ...settings, fontFamily: f.id })}
                  style={{ fontFamily: f.family }}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm text-left border transition flex items-center justify-between cursor-pointer ${
                    settings.fontFamily === f.id
                      ? 'bg-indigo-600/20 border-indigo-500 font-semibold text-indigo-500 dark:text-indigo-300'
                      : `${t.btnSecondary} opacity-80 hover:opacity-100`
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
              <label className={`text-xs font-semibold uppercase tracking-wider ${t.cardMeta}`}>
                Font Size
              </label>
              <span className={`text-xs font-mono ${t.cardMeta}`}>{settings.fontSize || 18}px</span>
            </div>
            <div className={`flex items-center gap-3 border rounded-xl p-1.5 ${t.btnSecondary}`}>
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    fontSize: Math.max(14, (settings.fontSize || 18) - 1),
                  })
                }
                disabled={(settings.fontSize || 18) <= 14}
                className={`p-2 rounded-lg hover:opacity-80 disabled:opacity-30 transition flex-1 flex items-center justify-center cursor-pointer`}
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
                className={`p-2 rounded-lg hover:opacity-80 disabled:opacity-30 transition flex-1 flex items-center justify-center cursor-pointer`}
                title="Increase font size"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Line Spacing */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider ${t.cardMeta} mb-2`}>
              Line Spacing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {lineHeights.map((lh) => (
                <button
                  key={lh.value}
                  onClick={() => onUpdateSettings({ ...settings, lineHeight: lh.value })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                    settings.lineHeight === lh.value
                      ? 'bg-indigo-600/20 border-indigo-500 font-semibold text-indigo-500 dark:text-indigo-300'
                      : `${t.btnSecondary} opacity-80 hover:opacity-100`
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column Width */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider ${t.cardMeta} mb-2`}>
              Column Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {contentWidths.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onUpdateSettings({ ...settings, contentWidth: w.value })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                    (settings.contentWidth || 'max-w-3xl') === w.value
                      ? 'bg-indigo-600/20 border-indigo-500 font-semibold text-indigo-500 dark:text-indigo-300'
                      : `${t.btnSecondary} opacity-80 hover:opacity-100`
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className={`pt-6 border-t ${t.divider} text-center text-xs ${t.cardMeta}`}>
          Preferences saved locally
        </div>
      </div>
    </div>
  );
}
