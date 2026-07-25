export type AppId = 'finder' | 'notes' | 'editor' | 'settings' | 'preview' | 'launchpad';

export type Theme = 'light' | 'dark';
export type FsType = 'folder' | 'note' | 'image' | 'file';

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
  fullscreen: boolean;
  spaceId: string;          // which desktop this window belongs to
  nodeId?: string;
  snapped?: 'left' | 'right' | 'top' | 'bottom' | null;
}

export interface Space {
  id: string;
  name: string;
  wallpaper?: string;
}

export interface FsNode {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  type: FsType;
  content: string | null;
  tags?: string[];          // for Finder tags
  created_at?: string;
  updated_at?: string;
}

export interface Preferences {
  user_id: string;
  wallpaper: string;
  theme: Theme;
  activeSpaceId: string;
  updated_at?: string;
}
