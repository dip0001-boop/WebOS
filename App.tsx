import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  Folder,
  Grid3X3,
  LogOut,
  Monitor,
  Settings as SettingsIcon,
  StickyNote,
  User,
  Layers,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { Rnd } from 'react-rnd';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import type { AppId, FsNode, WebtopWindow } from './types';
import { useWebtop } from './store';
import {
  deleteNode,
  deleteWindowSession,
  ensureDefaults,
  getNodes,
  getPreferences,
  loadWindows,
  savePreferences,
  saveWindow,
  upsertNode,
} from './data';
import { hasSupabase, supabase } from './supabase';
import './styles.css';

const apps: { id: AppId; name: string; icon: ReactNode }[] = [
  { id: 'finder', name: 'Finder', icon: <Folder /> },
  { id: 'notes', name: 'Notes', icon: <StickyNote /> },
  { id: 'editor', name: 'Editor', icon: <FileText /> },
  { id: 'settings', name: 'Settings', icon: <SettingsIcon /> },
];

// 15 macOS-inspired wallpapers (gradients that closely match real macOS looks)
const wallpapers = [
  { id: 'sonoma-day', name: 'Sonoma Day', css: 'linear-gradient(135deg, #a8d8ff 0%, #e8f4ff 40%, #f7e8c8 100%)' },
  { id: 'sonoma-evening', name: 'Sonoma Evening', css: 'linear-gradient(135deg, #1a2a4a 0%, #3d5a80 40%, #ee6c4d 100%)' },
  { id: 'sequoia', name: 'Sequoia', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'ventura', name: 'Ventura', css: 'linear-gradient(135deg, #0b132b 0%, #1c2541 40%, #3a506b 100%)' },
  { id: 'monterey', name: 'Monterey', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'big-sur', name: 'Big Sur', css: 'linear-gradient(135deg, #37ecba 0%, #72afd3 50%, #37ecba 100%)' },
  { id: 'catalina', name: 'Catalina', css: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
  { id: 'mojave-day', name: 'Mojave Day', css: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { id: 'mojave-night', name: 'Mojave Night', css: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'high-sierra', name: 'High Sierra', css: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
  { id: 'sierra', name: 'Sierra', css: 'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)' },
  { id: 'el-capitan', name: 'El Capitan', css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
  { id: 'yosemite', name: 'Yosemite', css: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { id: 'mavericks', name: 'Mavericks', css: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)' },
  { id: 'graphite', name: 'Graphite', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
];

const debounce = <T extends (...args: any[]) => void>(fn: T, ms: number) => {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), ms);
  };
};

function Login({ onUser }: { onUser: (id: string) => void }) {
  const [email, setEmail] = useState('demo@webtop.local');
  const [password, setPassword] = useState('password123');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!supabase) {
      onUser('local');
      return;
    }

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) setError(result.error.message);
    else onUser(result.data.user?.id || '');
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="login-card">
        <Monitor size={46} />
        <h1>Webtop</h1>
        <p>A browser desktop for notes, files, and focused work.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />
        <button>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <a onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </a>
        {!hasSupabase && <small>Supabase env vars not set; using local demo storage.</small>}
        {error && <small className="error">{error}</small>}
      </form>
    </main>
  );
}

function WindowFrame({ win, userId, children }: { win: WebtopWindow; userId: string; children: ReactNode }) {
  const { focusWindow, closeWindow, minimizeWindow, toggleMaximize, toggleFullscreen, updateWindow, snapWindow } =
    useWebtop();
  const [persist] = useState(() => debounce((w: WebtopWindow) => saveWindow(userId, w), 500));

  if (win.minimized) return null;

  const close = async () => {
    closeWindow(win.id);
    await deleteWindowSession(userId, win.id);
  };

  const minimize = () => {
    const next = { ...win, minimized: true };
    minimizeWindow(win.id);
    persist(next);
  };

  const maximize = () => {
    toggleMaximize(win.id);
    persist({ ...win, maximized: !win.maximized, fullscreen: false, snapped: null });
  };

  const fullscreen = () => {
    toggleFullscreen(win.id);
    persist({ ...win, fullscreen: !win.fullscreen, maximized: false, snapped: null });
  };

  const isFull = win.fullscreen || win.maximized;

  return (
    <Rnd
      className="rnd"
      bounds="parent"
      size={
        win.fullscreen
          ? { width: '100%', height: '100%' }
          : win.maximized
          ? { width: '100%', height: 'calc(100% - 78px)' }
          : { width: win.width, height: win.height }
      }
      position={
        win.fullscreen
          ? { x: 0, y: 0 }
          : win.maximized
          ? { x: 0, y: 30 }
          : { x: win.x, y: win.y }
      }
      style={{ zIndex: win.zIndex }}
      dragHandleClassName="titlebar"
      disableDragging={isFull}
      enableResizing={!isFull}
      onMouseDown={() => focusWindow(win.id)}
      onDragStop={(_, d) => {
        const patch = { x: d.x, y: d.y, snapped: null };
        updateWindow(win.id, patch);
        persist({ ...win, ...patch });
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        const patch = {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: pos.x,
          y: pos.y,
          snapped: null,
        };
        updateWindow(win.id, patch);
        persist({ ...win, ...patch });
      }}
      minWidth={360}
      minHeight={240}
    >
      <motion.section
        className={`window ${win.fullscreen ? 'fullscreen' : ''}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <div className="titlebar">
          <div className="lights">
            <button className="red" aria-label="Close" onClick={close} />
            <button className="yellow" aria-label="Minimize" onClick={minimize} />
            <button className="green" aria-label="Maximize" onClick={maximize} />
          </div>
          <strong>{win.title}</strong>
          <div className="titlebar-actions">
            <button title="Tile Left" onClick={() => snapWindow(win.id, 'left')}>
              ◧
            </button>
            <button title="Tile Right" onClick={() => snapWindow(win.id, 'right')}>
              ◨
            </button>
            <button title="Fullscreen" onClick={fullscreen}>
              {win.fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
        <div className="window-body">{children}</div>
      </motion.section>
    </Rnd>
  );
}

function Finder({ userId }: { userId: string }) {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const openApp = useWebtop((s) => s.openApp);
  const refresh = () => getNodes(userId).then(setNodes);

  useEffect(() => {
    void refresh();
  }, [userId]);

  const folders = nodes.filter((n) => n.type === 'folder');
  const items = nodes.filter((n) => (selectedFolder ? n.parent_id === selectedFolder : !n.parent_id));

  async function create(type: 'folder' | 'note') {
    const name = prompt(`New ${type} name`);
    if (!name) return;
    await upsertNode({
      owner_id: userId,
      parent_id: selectedFolder,
      name,
      type,
      content: type === 'note' ? '' : null,
    });
    refresh();
  }

  async function rename(n: FsNode) {
    const name = prompt('Rename', n.name);
    if (!name) return;
    await upsertNode({ ...n, name, owner_id: userId });
    refresh();
  }

  return (
    <div className="finder">
      <aside>
        <button className={!selectedFolder ? 'active' : ''} onClick={() => setSelectedFolder(null)}>
          <Monitor size={16} /> Desktop
        </button>
        {folders.map((f) => (
          <button
            className={selectedFolder === f.id ? 'active' : ''}
            key={f.id}
            onClick={() => setSelectedFolder(f.id)}
          >
            <Folder size={16} />
            {f.name}
          </button>
        ))}
      </aside>
      <main>
        <div className="toolbar">
          <button onClick={() => create('folder')}>New Folder</button>
          <button onClick={() => create('note')}>New Note</button>
        </div>
        <div className="grid">
          {items.map((n) => (
            <div
              className="item"
              key={n.id}
              onDoubleClick={() => n.type === 'note' && openApp('editor', n.id, n.name)}
            >
              <span>{n.type === 'folder' ? <Folder /> : <FileText />}</span>
              <b>{n.name}</b>
              <div>
                <button onClick={() => rename(n)}>Rename</button>
                <button
                  onClick={async () => {
                    await deleteNode(n.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Notes({ userId, nodeId, full = false }: { userId: string; nodeId?: string; full?: boolean }) {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(nodeId);
  const note = nodes.find((n) => n.id === selectedId) || nodes.find((n) => n.type === 'note');
  const save = useMemo(
    () => debounce(async (n: FsNode, content: string) => upsertNode({ ...n, content, owner_id: userId }), 1000),
    [userId]
  );

  useEffect(() => {
    getNodes(userId).then((ns) => {
      setNodes(ns);
      if (!selectedId) setSelectedId(ns.find((n) => n.type === 'note')?.id);
    });
  }, [userId]);

  return (
    <div className={full ? 'notes full' : 'notes'}>
      {!full && (
        <aside>
          {nodes
            .filter((n) => n.type === 'note')
            .map((n) => (
              <button
                className={n.id === note?.id ? 'active' : ''}
                onClick={() => setSelectedId(n.id)}
                key={n.id}
              >
                {n.name}
              </button>
            ))}
        </aside>
      )}
      <textarea
        value={note?.content || ''}
        placeholder="Select a note"
        onChange={(e) => {
          if (!note) return;
          const content = e.target.value;
          setNodes((ns) => ns.map((n) => (n.id === note.id ? { ...n, content } : n)));
          save(note, content);
        }}
      />
    </div>
  );
}

function Settings({ userId }: { userId: string }) {
  const prefs = useWebtop((s) => s.preferences)!;
  const setTheme = useWebtop((s) => s.setTheme);
  const setWallpaper = useWebtop((s) => s.setWallpaper);
  const save = (patch: Partial<typeof prefs>) => savePreferences({ ...prefs, ...patch, user_id: userId });

  return (
    <div className="settings">
      <h2>Appearance</h2>
      <label>
        Theme{' '}
        <select
          value={prefs.theme}
          onChange={(e) => {
            const theme = e.target.value as 'light' | 'dark';
            setTheme(theme);
            save({ theme });
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>Wallpapers</h3>
      <div className="wallpapers">
        {wallpapers.map((w) => (
          <button
            key={w.id}
            className={`wallpaper ${prefs.wallpaper === w.id ? 'active' : ''}`}
            style={{ background: w.css }}
            onClick={() => {
              setWallpaper(w.id);
              save({ wallpaper: w.id });
            }}
            title={w.name}
          >
            <span>{w.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Dock() {
  const { windows, openApp, setLaunchpad, setMissionControl } = useWebtop();

  return (
    <div className="dock">
      {apps.map((app) => (
        <button key={app.id} onClick={() => openApp(app.id)} title={app.name}>
          {app.icon}
          {windows.some((w) => w.appId === app.id && !w.minimized) && <i />}
        </button>
      ))}
      <div className="dock-separator" />
      <button title="Launchpad" onClick={() => setLaunchpad(true)}>
        <Grid3X3 />
      </button>
      <button title="Mission Control" onClick={() => setMissionControl(true)}>
        <Layers />
      </button>
    </div>
  );
}

function Spotlight({ open, onClose, nodes }: { open: boolean; onClose: () => void; nodes: FsNode[] }) {
  const openApp = useWebtop((s) => s.openApp);
  if (!open) return null;

  return (
    <div className="spotdrop">
      <Command className="spotlight" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <Command.Input autoFocus placeholder="Search apps and files..." />
        <Command.List>
          {apps.map((app) => (
            <Command.Item
              key={app.id}
              onSelect={() => {
                openApp(app.id);
                onClose();
              }}
            >
              {app.name}
            </Command.Item>
          ))}
          {nodes.map((n) => (
            <Command.Item
              key={n.id}
              onSelect={() => {
                openApp(n.type === 'note' ? 'editor' : 'finder', n.type === 'note' ? n.id : undefined, n.name);
                onClose();
              }}
            >
              {n.name}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function MissionControl() {
  const {
    windows,
    spaces,
    activeSpaceId,
    missionControlOpen,
    setMissionControl,
    switchSpace,
    addSpace,
    focusWindow,
  } = useWebtop();

  if (!missionControlOpen) return null;

  return (
    <div className="mission-control" onClick={() => setMissionControl(false)}>
      <div className="mc-spaces" onClick={(e) => e.stopPropagation()}>
        {spaces.map((space) => {
          const spaceWindows = windows.filter((w) => w.spaceId === space.id && !w.minimized);
          return (
            <div
              key={space.id}
              className={`mc-space ${space.id === activeSpaceId ? 'active' : ''}`}
              onClick={() => switchSpace(space.id)}
            >
              <div className="mc-space-label">{space.name}</div>
              <div className="mc-space-preview">
                {spaceWindows.slice(0, 6).map((w) => (
                  <div key={w.id} className="mc-window-thumb" style={{ zIndex: w.zIndex }}>
                    {w.title}
                  </div>
                ))}
                {spaceWindows.length === 0 && <div className="mc-empty">Empty</div>}
              </div>
            </div>
          );
        })}
        <button className="mc-add-space" onClick={() => addSpace()}>
          +
        </button>
      </div>

      <div className="mc-windows" onClick={(e) => e.stopPropagation()}>
        {windows
          .filter((w) => w.spaceId === activeSpaceId && !w.minimized)
          .map((w) => (
            <div
              key={w.id}
              className="mc-window"
              onClick={() => {
                focusWindow(w.id);
                setMissionControl(false);
              }}
            >
              <div className="mc-window-title">{w.title}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Launchpad() {
  const { launchpadOpen, setLaunchpad, openApp } = useWebtop();

  if (!launchpadOpen) return null;

  return (
    <div className="launchpad" onClick={() => setLaunchpad(false)}>
      <div className="launchpad-grid" onClick={(e) => e.stopPropagation()}>
        {apps.map((app) => (
          <button
            key={app.id}
            className="launchpad-item"
            onClick={() => {
              openApp(app.id);
              setLaunchpad(false);
            }}
          >
            <div className="launchpad-icon">{app.icon}</div>
            <span>{app.name}</span>
          </button>
        ))}
      </div>
      <button className="launchpad-close" onClick={() => setLaunchpad(false)}>
        <X size={20} />
      </button>
    </div>
  );
}

export default function App() {
  const [userId, setUserId] = useState<string>();
  const [clock, setClock] = useState(new Date());
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [nodes, setNodes] = useState<FsNode[]>([]);

  const {
    windows,
    focusedId,
    preferences,
    activeSpaceId,
    setPreferences,
    restoreWindows,
    setMissionControl,
    setLaunchpad,
  } = useWebtop();

  useEffect(() => {
    supabase?.auth.getUser().then((r) => r.data.user && setUserId(r.data.user.id));
  }, []);

  useEffect(() => {
    if (!userId) return;
    ensureDefaults(userId).then(async () => {
      setPreferences(await getPreferences(userId));
      setNodes(await getNodes(userId));
      restoreWindows(await loadWindows(userId));
    });
  }, [userId]);

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000);

    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen(true);
      }
      // Mission Control – F3 or Ctrl+Up
      if (e.key === 'F3' || ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp')) {
        e.preventDefault();
        setMissionControl(true);
      }
      // Launchpad – F4 or Ctrl+L
      if (e.key === 'F4' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        setLaunchpad(true);
      }
      if (e.key === 'Escape') {
        setMissionControl(false);
        setLaunchpad(false);
        setSpotlightOpen(false);
      }
    };

    addEventListener('keydown', keydown);
    return () => {
      clearInterval(tick);
      removeEventListener('keydown', keydown);
    };
  }, []);

  if (!userId) return <Login onUser={setUserId} />;

  const focused = windows.find((w) => w.id === focusedId);
  const currentWallpaper = wallpapers.find((w) => w.id === preferences?.wallpaper) || wallpapers[0];
  const visibleWindows = windows.filter((w) => w.spaceId === activeSpaceId);

  return (
    <div
      className={`desktop ${preferences?.theme || 'light'}`}
      style={{ background: currentWallpaper.css }}
    >
      <div className="menubar">
        <b>{focused?.title || 'Webtop'}</b>
        <span>
          <User size={14} /> {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          <button
            className="logout"
            onClick={() => supabase?.auth.signOut().finally(() => setUserId(undefined))}
          >
            <LogOut size={14} />
          </button>
        </span>
      </div>

      <AnimatePresence>
        {visibleWindows.map((w) => (
          <WindowFrame key={w.id} win={w} userId={userId}>
            {w.appId === 'finder' && <Finder userId={userId} />}
            {w.appId === 'notes' && <Notes userId={userId} />}
            {w.appId === 'editor' && <Notes userId={userId} nodeId={w.nodeId} full />}
            {w.appId === 'settings' && <Settings userId={userId} />}
          </WindowFrame>
        ))}
      </AnimatePresence>

      <Dock />
      <Spotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} nodes={nodes} />
      <MissionControl />
      <Launchpad />
    </div>
  );
}
