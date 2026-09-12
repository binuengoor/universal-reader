/**
 * Standardized semantic theme palette helper.
 * Provides consistent, high-contrast, accessible styling across:
 * - LibraryView (Home)
 * - AudioPlayer & MiniPlayer
 * - Drawers & Modals
 * - ReaderView
 */

export const themes = {
  light: {
    id: 'light',
    label: 'Light',
    // Root & Header
    page: 'bg-zinc-50 text-zinc-900',
    header: 'bg-white/90 backdrop-blur-md border-b border-zinc-200',
    headerBrand: 'text-zinc-900',
    headerSub: 'text-zinc-500',

    // Surfaces & Cards
    card: 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900 shadow-xs',
    cardBorder: 'border-zinc-200',
    cardTitle: 'text-zinc-900 group-hover:text-indigo-600',
    cardSnippet: 'text-zinc-600',
    cardMeta: 'text-zinc-500',
    cardIconDefault: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    progressBarBg: 'bg-zinc-100',

    // Interactive & Inputs
    input: 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
    btnSecondary: 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 shadow-2xs',
    btnSecondaryActive: 'bg-zinc-100 text-zinc-900 border-zinc-400',
    btnGhost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
    iconMuted: 'text-zinc-400',

    // Navigation & Tabs
    tabsContainer: 'bg-zinc-200/70 border border-zinc-300/70',
    tabActive: 'bg-white text-zinc-900 font-semibold shadow-xs',
    tabInactive: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/60',

    // Tags & Badges
    tag: 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 shadow-2xs font-medium',
    tagActive: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold',
    tagHeaderBadge: 'bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium',
    badge: 'bg-slate-100 text-slate-700 border border-slate-300',

    // Audio Players
    playerShell: 'bg-white/95 backdrop-blur-xl border border-zinc-200 text-zinc-900 shadow-xl',
    playerTrack: 'bg-zinc-200 hover:bg-zinc-300',
    playerTrackFill: 'bg-indigo-600',
    playerBtn: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
    playerBtnDisabled: 'text-zinc-300',
    playerBadge: 'bg-indigo-50 border border-indigo-200 text-indigo-700',
    playerPopover: 'bg-white border border-zinc-200 text-zinc-900 shadow-xl',
    playerPopoverItem: 'hover:bg-zinc-100 text-zinc-800',
    playerPopoverItemActive: 'bg-indigo-50 text-indigo-700 font-semibold',

    // Modals & Overlays
    modalBackdrop: 'bg-black/40 backdrop-blur-xs',
    modalSurface: 'bg-white border-zinc-200 text-zinc-900 shadow-2xl',
    modalHeader: 'border-b border-zinc-200',
    modalFooter: 'border-t border-zinc-200 bg-zinc-50/50',
    divider: 'border-zinc-200',
  },

  sepia: {
    id: 'sepia',
    label: 'Sepia',
    // Root & Header (warm parchment matching reader #fbf0d9)
    page: 'bg-[#fbf0d9] text-[#433422]',
    header: 'bg-[#f4e4c3]/90 backdrop-blur-md border-b border-[#dfcaa3]',
    headerBrand: 'text-[#2e2013]',
    headerSub: 'text-[#846b50]',

    // Surfaces & Cards
    card: 'bg-[#f5e7ce] border-[#e2cca4] hover:border-[#cbaf80] text-[#3b2a1a] shadow-xs',
    cardBorder: 'border-[#e2cca4]',
    cardTitle: 'text-[#2e2013] group-hover:text-[#8c5a21]',
    cardSnippet: 'text-[#6e543c]',
    cardMeta: 'text-[#8f7457]',
    cardIconDefault: 'bg-[#ecdcc2] text-[#785b3b] border-[#dec49d]',
    progressBarBg: 'bg-[#ecdcc2]',

    // Interactive & Inputs
    input: 'bg-[#fffaf0] border-[#d8c09c] text-[#3b2a1a] placeholder-[#9f8569] focus:border-[#936e39] focus:ring-1 focus:ring-[#936e39]',
    btnSecondary: 'bg-[#eee0c7] hover:bg-[#e4d4b7] text-[#3b2a1a] border-[#d8c29e] shadow-2xs',
    btnSecondaryActive: 'bg-[#e4d4b7] text-[#24170b] border-[#cbaf80]',
    btnGhost: 'text-[#6e543c] hover:text-[#2e2013] hover:bg-[#eee0c7]',
    iconMuted: 'text-[#9f8569]',

    // Navigation & Tabs
    tabsContainer: 'bg-[#ebdcc2] border border-[#dac29e]',
    tabActive: 'bg-[#fffaf0] text-[#2e2013] font-semibold border border-[#d8c29e] shadow-xs',
    tabInactive: 'text-[#7d654a] hover:text-[#2e2013] hover:bg-[#f2e5cf]',

    // Tags & Badges
    tag: 'bg-[#ebd6b2] text-[#42290d] border border-[#d2b68c] hover:bg-[#e0c89f] shadow-2xs font-medium',
    tagActive: 'bg-[#8f551c] text-white border-[#8f551c] shadow-xs font-semibold',
    tagHeaderBadge: 'bg-[#edd8b6] text-[#42290d] border border-[#cfad7a] font-medium',
    badge: 'bg-[#edd8b6] text-[#4a3014] border border-[#d2b68c]',

    // Audio Players
    playerShell: 'bg-[#fbf0d9]/95 backdrop-blur-xl border border-[#dfcaa3] text-[#433422] shadow-xl',
    playerTrack: 'bg-[#e3d0ab] hover:bg-[#d8c196]',
    playerTrackFill: 'bg-[#936e39]',
    playerBtn: 'text-[#5c462e] hover:text-[#2b1d0e] hover:bg-[#eee0c7]',
    playerBtnDisabled: 'text-[#c6b08e]',
    playerBadge: 'bg-[#eedcc0] border border-[#dfcaa3] text-[#6d4c21]',
    playerPopover: 'bg-[#f6ebd5] border border-[#dfcaa3] text-[#3b2a1a] shadow-xl',
    playerPopoverItem: 'hover:bg-[#eee0c7] text-[#3b2a1a]',
    playerPopoverItemActive: 'bg-[#eedcc0] text-[#5c462e] font-semibold',

    // Modals & Overlays
    modalBackdrop: 'bg-black/50 backdrop-blur-xs',
    modalSurface: 'bg-[#fbf0d9] border-[#dfcaa3] text-[#433422] shadow-2xl',
    modalHeader: 'border-b border-[#dfcaa3]',
    modalFooter: 'border-t border-[#dfcaa3] bg-[#f4e4c3]/50',
    divider: 'border-[#dfcaa3]',
  },

  dark: {
    id: 'dark',
    label: 'OLED Dark',
    // Root & Header
    page: 'bg-zinc-950 text-zinc-100',
    header: 'bg-zinc-900/70 backdrop-blur-md border-b border-zinc-800',
    headerBrand: 'text-zinc-100',
    headerSub: 'text-zinc-400',

    // Surfaces & Cards
    card: 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-100 shadow-xs',
    cardBorder: 'border-zinc-800',
    cardTitle: 'text-zinc-100 group-hover:text-indigo-400',
    cardSnippet: 'text-zinc-400',
    cardMeta: 'text-zinc-500',
    cardIconDefault: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    progressBarBg: 'bg-zinc-800',

    // Interactive & Inputs
    input: 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
    btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 shadow-2xs',
    btnSecondaryActive: 'bg-zinc-700 text-white border-zinc-600',
    btnGhost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80',
    iconMuted: 'text-zinc-500',

    // Navigation & Tabs
    tabsContainer: 'bg-zinc-900 border border-zinc-800',
    tabActive: 'bg-zinc-800 text-white font-semibold shadow-xs',
    tabInactive: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',

    // Tags & Badges
    tag: 'bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 shadow-2xs font-medium',
    tagActive: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold',
    tagHeaderBadge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-medium',
    badge: 'bg-zinc-800 text-zinc-300 border border-zinc-700',

    // Audio Players
    playerShell: 'bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 text-zinc-100 shadow-2xl',
    playerTrack: 'bg-zinc-800 hover:bg-zinc-700',
    playerTrackFill: 'bg-indigo-500',
    playerBtn: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
    playerBtnDisabled: 'text-zinc-600',
    playerBadge: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
    playerPopover: 'bg-zinc-900 border border-zinc-800 text-zinc-200 shadow-2xl',
    playerPopoverItem: 'hover:bg-zinc-800 text-zinc-200',
    playerPopoverItemActive: 'bg-indigo-600/20 text-indigo-300 font-semibold',

    // Modals & Overlays
    modalBackdrop: 'bg-black/70 backdrop-blur-xs',
    modalSurface: 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl',
    modalHeader: 'border-b border-zinc-800',
    modalFooter: 'border-t border-zinc-800 bg-zinc-950/50',
    divider: 'border-zinc-800',
  },
};

/**
 * Returns the theme object with fallbacks to dark theme.
 */
export function getTheme(themeName) {
  return themes[themeName] || themes.dark;
}
