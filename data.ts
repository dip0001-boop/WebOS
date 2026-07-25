import type { FsNode, Preferences, WebtopWindow } from './types';
import { supabase } from './supabase';

const localNodes: FsNode[] = [
  {
    id: 'folder-docs',
    owner_id: 'local',
    parent_id: null,
    name: 'Documents',
    type: 'folder',
    content: null,
  },
  {
    id: 'note-welcome',
    owner_id: 'local',
    parent_id: 'folder-docs',
    name: 'Welcome Note',
    type: 'note',
    content: 'Welcome to Webtop. Open Finder, Notes, Editor, and Settings from the Dock.',
  },
];

const defaultPrefs = (userId: string): Preferences => ({
  user_id: userId,
  wallpaper: 'default',
  theme: 'light',
  activeSpaceId: 'space-1',
});

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
};

export async function ensureDefaults(userId: string) {
  if (!supabase) return;

  await supabase
    .from('preferences')
    .upsert(defaultPrefs(userId), { onConflict: 'user_id', ignoreDuplicates: true });

  const { count } = await supabase
    .from('fs_nodes')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (!count) {
    const { data: folder } = await supabase
      .from('fs_nodes')
      .insert({ owner_id: userId, name: 'Documents', type: 'folder' })
      .select()
      .single();

    await supabase.from('fs_nodes').insert({
      owner_id: userId,
      parent_id: folder?.id,
      name: 'Welcome Note',
      type: 'note',
      content: 'Welcome to Webtop. Use Finder to organize notes and Settings to personalize your desktop.',
    });
  }
}

export async function getPreferences(userId: string): Promise<Preferences> {
  if (!supabase) return readJson('webtop:prefs', defaultPrefs(userId));

  const { data } = await supabase.from('preferences').select('*').eq('user_id', userId).single();
  return (data as Preferences) ?? defaultPrefs(userId);
}

export async function savePreferences(prefs: Preferences) {
  const next = { ...prefs, updated_at: new Date().toISOString() };
  if (!supabase) localStorage.setItem('webtop:prefs', JSON.stringify(next));
  else await supabase.from('preferences').upsert(next);
}

export async function getNodes(userId: string): Promise<FsNode[]> {
  if (!supabase) return readJson('webtop:nodes', localNodes);

  const { data } = await supabase
    .from('fs_nodes')
    .select('*')
    .eq('owner_id', userId)
    .order('type')
    .order('name');
  return (data as FsNode[]) ?? [];
}

export async function upsertNode(
  node: Partial<FsNode> & { owner_id: string; name: string; type: FsType }
) {
  const payload = { ...node, updated_at: new Date().toISOString() };

  if (!supabase) {
    const nodes = await getNodes('local');
    const saved = {
      id: node.id || crypto.randomUUID(),
      parent_id: node.parent_id ?? null,
      content: node.content ?? null,
      ...payload,
    } as FsNode;
    localStorage.setItem('webtop:nodes', JSON.stringify([...nodes.filter((n) => n.id !== saved.id), saved]));
    return saved;
  }

  const { data } = await supabase.from('fs_nodes').upsert(payload).select().single();
  return data as FsNode;
}

export async function deleteNode(id: string) {
  if (!supabase) {
    const nodes = await getNodes('local');
    localStorage.setItem('webtop:nodes', JSON.stringify(nodes.filter((n) => n.id !== id && n.parent_id !== id)));
    return;
  }

  await supabase.from('fs_nodes').delete().eq('id', id);
}

export async function saveWindow(userId: string, w: WebtopWindow) {
  if (!supabase) {
    const windows = readJson<WebtopWindow[]>('webtop:wins', []);
    localStorage.setItem('webtop:wins', JSON.stringify([...windows.filter((x) => x.id !== w.id), w]));
    return;
  }

  await supabase.from('window_sessions').upsert({
    user_id: userId,
    window_id: w.id,
    app_id: w.appId,
    x: w.x,
    y: w.y,
    width: w.width,
    height: w.height,
    z_index: w.zIndex,
    minimized: w.minimized,
    maximized: w.maximized,
  });
}

export async function deleteWindowSession(userId: string, id: string) {
  if (!supabase) {
    const windows = readJson<WebtopWindow[]>('webtop:wins', []);
    localStorage.setItem('webtop:wins', JSON.stringify(windows.filter((w) => w.id !== id)));
    return;
  }

  await supabase.from('window_sessions').delete().eq('user_id', userId).eq('window_id', id);
}

export async function loadWindows(userId: string): Promise<WebtopWindow[]> {
  if (!supabase) return readJson('webtop:wins', []);

  const { data } = await supabase.from('window_sessions').select('*').eq('user_id', userId);
  return (data || []).map((r: any) => ({
    id: r.window_id,
    appId: r.app_id,
    title: r.app_id[0].toUpperCase() + r.app_id.slice(1),
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    zIndex: r.z_index,
    minimized: r.minimized,
    maximized: r.maximized,
    fullscreen: false,
    spaceId: r.space_id || 'space-1',
    snapped: null,
  }));
}
