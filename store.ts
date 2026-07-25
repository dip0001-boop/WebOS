import { create } from 'zustand';
import type { AppId, Preferences, Theme, WebtopWindow } from './types';

const defaults: Record<AppId, Omit<WebtopWindow, 'id' | 'appId' | 'zIndex' | 'minimized' | 'maximized'>> = {
  finder: { title: 'Finder', x: 90, y: 92, width: 760, height: 500 },
  notes: { title: 'Notes', x: 150, y: 116, width: 720, height: 520 },
  editor: { title: 'Editor', x: 210, y: 136, width: 720, height: 540 },
  settings: { title: 'Settings', x: 260, y: 156, width: 620, height: 430 },
};

interface WebtopState {
  windows: WebtopWindow[]; focusedId?: string; zSeed: number;
  preferences: Preferences | null;
  openApp: (appId: AppId, nodeId?: string, title?: string) => WebtopWindow;
  closeWindow: (id: string) => void; minimizeWindow: (id: string) => void; toggleMaximize: (id: string) => void;
  focusWindow: (id: string) => void; updateWindow: (id: string, patch: Partial<WebtopWindow>) => void;
  restoreWindows: (windows: WebtopWindow[]) => void; setPreferences: (prefs: Preferences | null) => void; setTheme: (theme: Theme) => void; setWallpaper: (wallpaper: string) => void;
}

export const useWebtop = create<WebtopState>((set, get) => ({
  windows: [], zSeed: 10, preferences: null,
  openApp: (appId, nodeId, title) => {
    const existing = get().windows.find(w => w.appId === appId && (!nodeId || w.nodeId === nodeId));
    if (existing) { get().focusWindow(existing.id); get().updateWindow(existing.id, { minimized: false }); return { ...existing, minimized: false }; }
    const nextZ = get().zSeed + 1;
    const spec = defaults[appId];
    const win: WebtopWindow = { ...spec, id: nodeId ? `${appId}-${nodeId}` : `${appId}-${Date.now()}`, appId, nodeId, title: title ?? spec.title, zIndex: nextZ, minimized: false, maximized: false };
    set(s => ({ windows: [...s.windows, win], focusedId: win.id, zSeed: nextZ }));
    return win;
  },
  closeWindow: id => set(s => ({ windows: s.windows.filter(w => w.id !== id), focusedId: s.focusedId === id ? undefined : s.focusedId })),
  minimizeWindow: id => set(s => ({ windows: s.windows.map(w => w.id === id ? { ...w, minimized: true } : w), focusedId: s.focusedId === id ? undefined : s.focusedId })),
  toggleMaximize: id => set(s => ({ windows: s.windows.map(w => w.id === id ? { ...w, maximized: !w.maximized, minimized: false } : w) })),
  focusWindow: id => set(s => ({ windows: s.windows.map(w => w.id === id ? { ...w, zIndex: s.zSeed + 1, minimized: false } : w), focusedId: id, zSeed: s.zSeed + 1 })),
  updateWindow: (id, patch) => set(s => ({ windows: s.windows.map(w => w.id === id ? { ...w, ...patch } : w) })),
  restoreWindows: windows => set({ windows, zSeed: Math.max(10, ...windows.map(w => w.zIndex)), focusedId: windows.sort((a,b)=>b.zIndex-a.zIndex)[0]?.id }),
  setPreferences: preferences => set({ preferences }),
  setTheme: theme => set(s => ({ preferences: s.preferences ? { ...s.preferences, theme } : s.preferences })),
  setWallpaper: wallpaper => set(s => ({ preferences: s.preferences ? { ...s.preferences, wallpaper } : s.preferences })),
}));
