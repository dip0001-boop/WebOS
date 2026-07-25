import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Folder, LogOut, Monitor, Settings as SettingsIcon, StickyNote, User } from 'lucide-react';
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

const wallpapers = ['default', 'aurora', 'sunset', 'ocean', 'graphite'];
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

    const result = mode === 'login'
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
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" />
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
  const { focusWindow, closeWindow, minimizeWindow, toggleMaximize, updateWindow } = useWebtop();
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
    const next = { ...win, maximized: !win.maximized, minimized: false };
    toggleMaximize(win.id);
    persist(next);
  };

  return (
    <Rnd
      className="rnd"
      bounds="parent"
      size={win.maximized ? { width: '100%', height: 'calc(100% - 78px)' } : { width: win.width, height: win.height }}
      position={win.maximized ? { x: 0, y: 30 } : { x: win.x, y: win.y }}
      style={{ zIndex: win.zIndex }}
      dragHandleClassName="titlebar"
      onMouseDown={() => focusWindow(win.id)}
      onDragStop={(_, d) => {
        const patch = { x: d.x, y: d.y };
        updateWindow(win.id, patch);
        persist({ ...win, ...patch });
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        const patch = { width: ref.offsetWidth, height: ref.offsetHeight, x: pos.x, y: pos.y };
        updateWindow(win.id, patch);
        persist({ ...win, ...patch });
      }}
      minWidth={360}
      minHeight={240}
    >
      <motion.section className="window" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
        <div className="titlebar">
          <div className="lights">
            <button className="red" aria-label="Close" onClick={close} />
            <button className="yellow" aria-label="Minimize" onClick={minimize} />
            <button className="green" aria-label="Maximize" onClick={maximize} />
          </div>
          <strong>{win.title}</strong>
        </div>
        <div className="window-body">{children}</div>
      </motion.section>
    </Rnd>
  );
}

function Finder({ userId }: { userId: string }) {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const openApp = useWebtop(s => s.openApp);
  const refresh = () => getNodes(userId).then(setNodes);

  useEffect(() => {
    void refresh();
  }, [userId]);

  const folders = nodes.filter(n => n.type === 'folder');
  const items = nodes.filter(n => selectedFolder ? n.parent_id === selectedFolder : !n.parent_id);

  async function create(type: 'folder' | 'note') {
    const name = prompt(`New ${type} name`);
    if (!name) return;
    await upsertNode({ owner_id: userId, parent_id: selectedFolder, name, type, content: type === 'note' ? '' : null });
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
        <button className={!selectedFolder ? 'active' : ''} onClick={() => setSelectedFolder(null)}><Monitor size={16} /> Desktop</button>
        {folders.map(f => <button className={selectedFolder === f.id ? 'active' : ''} key={f.id} onClick={() => setSelectedFolder(f.id)}><Folder size={16} />{f.name}</button>)}
      </aside>
      <main>
        <div className="toolbar"><button onClick={() => create('folder')}>New Folder</button><button onClick={() => create('note')}>New Note</button></div>
        <div className="grid">
          {items.map(n => (
            <div className="item" key={n.id} onDoubleClick={() => n.type === 'note' && openApp('editor', n.id, n.name)}>
              <span>{n.type === 'folder' ? <Folder /> : <FileText />}</span>
              <b>{n.name}</b>
              <div><button onClick={() => rename(n)}>Rename</button><button onClick={async () => { await deleteNode(n.id); refresh(); }}>Delete</button></div>
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
  const note = nodes.find(n => n.id === selectedId) || nodes.find(n => n.type === 'note');
  const save = useMemo(() => debounce(async (n: FsNode, content: string) => upsertNode({ ...n, content, owner_id: userId }), 1000), [userId]);

  useEffect(() => {
    getNodes(userId).then(ns => {
      setNodes(ns);
      if (!selectedId) setSelectedId(ns.find(n => n.type === 'note')?.id);
    });
  }, [userId]);

  return (
    <div className={full ? 'notes full' : 'notes'}>
      {!full && <aside>{nodes.filter(n => n.type === 'note').map(n => <button className={n.id === note?.id ? 'active' : ''} onClick={() => setSelectedId(n.id)} key={n.id}>{n.name}</button>)}</aside>}
      <textarea value={note?.content || ''} placeholder="Select a note" onChange={e => { if (!note) return; const content = e.target.value; setNodes(ns => ns.map(n => n.id === note.id ? { ...n, content } : n)); save(note, content); }} />
    </div>
  );
}

function Settings({ userId }: { userId: string }) {
  const prefs = useWebtop(s => s.preferences)!;
  const setTheme = useWebtop(s => s.setTheme);
  const setWallpaper = useWebtop(s => s.setWallpaper);
  const save = (patch: Partial<typeof prefs>) => savePreferences({ ...prefs, ...patch, user_id: userId });

  return (
    <div className="settings">
      <h2>Appearance</h2>
      <label>Theme <select value={prefs.theme} onChange={e => { const theme = e.target.value as 'light' | 'dark'; setTheme(theme); save({ theme }); }}><option>light</option><option>dark</option></select></label>
      <div className="wallpapers">{wallpapers.map(w => <button key={w} className={`wallpaper ${w} ${prefs.wallpaper === w ? 'active' : ''}`} onClick={() => { setWallpaper(w); save({ wallpaper: w }); }}>{w}</button>)}</div>
    </div>
  );
}

function Dock() {
  const { windows, openApp } = useWebtop();
  return <div className="dock">{apps.map(app => <button key={app.id} onClick={() => openApp(app.id)} title={app.name}>{app.icon}{windows.some(w => w.appId === app.id) && <i />}</button>)}</div>;
}

function Spotlight({ open, onClose, nodes }: { open: boolean; onClose: () => void; nodes: FsNode[] }) {
  const openApp = useWebtop(s => s.openApp);
  if (!open) return null;
  return (
    <div className="spotdrop">
      <Command className="spotlight" onKeyDown={e => e.key === 'Escape' && onClose()}>
        <Command.Input autoFocus placeholder="Search apps and files..." />
        <Command.List>
          {apps.map(app => <Command.Item key={app.id} onSelect={() => { openApp(app.id); onClose(); }}>{app.name}</Command.Item>)}
          {nodes.map(n => <Command.Item key={n.id} onSelect={() => { openApp(n.type === 'note' ? 'editor' : 'finder', n.type === 'note' ? n.id : undefined, n.name); onClose(); }}>{n.name}</Command.Item>)}
        </Command.List>
      </Command>
    </div>
  );
}

export default function App() {
  const [userId, setUserId] = useState<string>();
  const [clock, setClock] = useState(new Date());
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const { windows, focusedId, preferences, setPreferences, restoreWindows } = useWebtop();

  useEffect(() => { supabase?.auth.getUser().then(r => r.data.user && setUserId(r.data.user.id)); }, []);
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
    };
    addEventListener('keydown', keydown);
    return () => { clearInterval(tick); removeEventListener('keydown', keydown); };
  }, []);

  if (!userId) return <Login onUser={setUserId} />;
  const focused = windows.find(w => w.id === focusedId);

  return (
    <div className={`desktop ${preferences?.theme || 'light'} ${preferences?.wallpaper || 'default'}`}>
      <div className="menubar"><b>{focused?.title || 'Webtop'}</b><span><User size={14} /> {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<button className="logout" onClick={() => supabase?.auth.signOut().finally(() => setUserId(undefined))}><LogOut size={14} /></button></span></div>
      <AnimatePresence>{windows.map(w => <WindowFrame key={w.id} win={w} userId={userId}>{w.appId === 'finder' && <Finder userId={userId} />}{w.appId === 'notes' && <Notes userId={userId} />}{w.appId === 'editor' && <Notes userId={userId} nodeId={w.nodeId} full />}{w.appId === 'settings' && <Settings userId={userId} />}</WindowFrame>)}</AnimatePresence>
      <Dock />
      <Spotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} nodes={nodes} />
    </div>
  );
}
