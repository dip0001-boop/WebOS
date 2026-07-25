import { create } from 'zustand';
import type { AppId, Preferences, Theme, WebtopWindow, Space } from './types';

const defaults: Record<
  AppId,
  Omit<WebtopWindow, 'id' | 'appId' | 'zIndex' | 'minimized' | 'maximized' | 'fullscreen' | 'spaceId' | 'snapped'>
> = {
  finder: { title: 'Finder', x: 90, y: 92, width: 760, height: 500 },
  notes: { title: 'Notes', x: 150, y: 116, width: 720, height: 520 },
  editor: { title: 'Editor', x: 210, y: 136, width: 720, height: 540 },
  settings: { title: 'Settings', x: 260, y: 156, width: 620, height: 430 },
  preview: { title: 'Preview', x: 180, y: 100, width: 680, height: 520 },
  launchpad: { title: 'Launchpad', x: 0, y: 0, width: 0, height: 0 },
};

interface WebtopState {
  windows: WebtopWindow[];
  spaces: Space[];
  activeSpaceId: string;
  focusedId?: string;
  zSeed: number;
  preferences: Preferences | null;
  missionControlOpen: boolean;
  launchpadOpen: boolean;
  stageManagerEnabled: boolean;

  openApp: (appId: AppId, nodeId?: string, title?: string) => WebtopWindow;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  toggleFullscreen: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, patch: Partial<WebtopWindow>) => void;
  snapWindow: (id: string, edge: 'left' | 'right' | null) => void;
  restoreWindows: (windows: WebtopWindow[]) => void;

  addSpace: (name?: string) => void;
  removeSpace: (id: string) => void;
  switchSpace: (id: string) => void;
  moveWindowToSpace: (windowId: string, spaceId: string) => void;

  setMissionControl: (open: boolean) => void;
  setLaunchpad: (open: boolean) => void;
  toggleStageManager: () => void;

  setPreferences: (prefs: Preferences | null) => void;
  setTheme: (theme: Theme) => void;
  setWallpaper: (wallpaper: string) => void;
}

const createDefaultSpaces = (): Space[] => [
  { id: 'space-1', name: 'Desktop 1' },
  { id: 'space-2', name: 'Desktop 2' },
];

export const useWebtop = create<WebtopState>((set, get) => ({
  windows: [],
  spaces: createDefaultSpaces(),
  activeSpaceId: 'space-1',
  zSeed: 10,
  preferences: null,
  missionControlOpen: false,
  launchpadOpen: false,
  stageManagerEnabled: false,

  openApp: (appId, nodeId, title) => {
    if (appId === 'launchpad') {
      set({ launchpadOpen: true, missionControlOpen: false });
      return {} as WebtopWindow;
    }

    const existing = get().windows.find(
      (w) => w.appId === appId && (!nodeId || w.nodeId === nodeId) && w.spaceId === get().activeSpaceId
    );

    if (existing) {
      get().focusWindow(existing.id);
      get().updateWindow(existing.id, { minimized: false, fullscreen: false });
      return { ...existing, minimized: false };
    }

    const nextZ = get().zSeed + 1;
    const spec = defaults[appId];
    const win: WebtopWindow = {
      ...spec,
      id: nodeId ? `${appId}-${nodeId}` : `${appId}-${Date.now()}`,
      appId,
      nodeId,
      title: title ?? spec.title,
      zIndex: nextZ,
      minimized: false,
      maximized: false,
      fullscreen: false,
      spaceId: get().activeSpaceId,
      snapped: null,
    };

    set((s) => ({
      windows: [...s.windows, win],
      focusedId: win.id,
      zSeed: nextZ,
      launchpadOpen: false,
    }));

    return win;
  },

  closeWindow: (id) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
      focusedId: s.focusedId === id ? undefined : s.focusedId,
    })),

  minimizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true, fullscreen: false } : w
      ),
      focusedId: s.focusedId === id ? undefined : s.focusedId,
    })),

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, maximized: !w.maximized, minimized: false, fullscreen: false, snapped: null }
          : w
      ),
    })),

  toggleFullscreen: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, fullscreen: !w.fullscreen, maximized: false, minimized: false, snapped: null }
          : w
      ),
    })),

  focusWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, zIndex: s.zSeed + 1, minimized: false } : w
      ),
      focusedId: id,
      zSeed: s.zSeed + 1,
    })),

  updateWindow: (id, patch) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  snapWindow: (id, edge) => {
    const win = get().windows.find((w) => w.id === id);
    if (!win) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 78;

    if (edge === 'left') {
      get().updateWindow(id, {
        x: 0,
        y: 30,
        width: Math.floor(screenW / 2),
        height: screenH,
        maximized: false,
        fullscreen: false,
        snapped: 'left',
      });
    } else if (edge === 'right') {
      get().updateWindow(id, {
        x: Math.floor(screenW / 2),
        y: 30,
        width: Math.floor(screenW / 2),
        height: screenH,
        maximized: false,
        fullscreen: false,
        snapped: 'right',
      });
    } else {
      get().updateWindow(id, { snapped: null });
    }
  },

  restoreWindows: (windows) =>
    set({
      windows,
      zSeed: Math.max(10, ...windows.map((w) => w.zIndex), 10),
      focusedId: windows.sort((a, b) => b.zIndex - a.zIndex)[0]?.id,
    }),

  addSpace: (name) => {
    const id = `space-${Date.now()}`;
    set((s) => ({
      spaces: [...s.spaces, { id, name: name || `Desktop ${s.spaces.length + 1}` }],
    }));
  },

  removeSpace: (id) => {
    const { spaces, activeSpaceId, windows } = get();
    if (spaces.length <= 1) return;

    const remaining = spaces.filter((s) => s.id !== id);
    const newActive = activeSpaceId === id ? remaining[0].id : activeSpaceId;

    set({
      spaces: remaining,
      activeSpaceId: newActive,
      windows: windows.map((w) => (w.spaceId === id ? { ...w, spaceId: newActive } : w)),
    });
  },

  switchSpace: (id) => {
    set({ activeSpaceId: id, missionControlOpen: false });
  },

  moveWindowToSpace: (windowId, spaceId) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.id === windowId ? { ...w, spaceId } : w)),
    }));
  },

  setMissionControl: (open) => set({ missionControlOpen: open, launchpadOpen: false }),
  setLaunchpad: (open) => set({ launchpadOpen: open, missionControlOpen: false }),
  toggleStageManager: () => set((s) => ({ stageManagerEnabled: !s.stageManagerEnabled })),

  setPreferences: (preferences) => set({ preferences }),
  setTheme: (theme) =>
    set((s) => ({
      preferences: s.preferences ? { ...s.preferences, theme } : s.preferences,
    })),
  setWallpaper: (wallpaper) =>
    set((s) => ({
      preferences: s.preferences ? { ...s.preferences, wallpaper } : s.preferences,
    })),
}));
