export type AppId = 'finder' | 'notes' | 'editor' | 'settings';
export type Theme = 'light' | 'dark';
export type FsType = 'folder' | 'note';

export interface WebtopWindow {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  nodeId?: string;
}

export interface FsNode {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  type: FsType;
  content: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Preferences {
  user_id: string;
  wallpaper: string;
  theme: Theme;
  updated_at?: string;
}
