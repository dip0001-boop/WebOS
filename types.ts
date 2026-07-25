export type AppId =
  | 'finder'
  | 'notes'
  | 'editor'
  | 'settings'
  | 'preview'
  | 'launchpad'
  | 'search'
  | 'calendar'
  | 'reminders';

export type Theme = 'light' | 'dark';
export type FsType = 'folder' | 'note';
export type FocusMode = 'off' | 'do-not-disturb' | 'work' | 'personal';

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
  spaceId: string;
  nodeId?: string;
  snapped?: 'left' | 'right' | null;
  stageGroup?: string | null;
}

export interface Space {
  id: string;
  name: string;
}

export interface FsNode {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  type: FsType;
  content: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Preferences {
  user_id: string;
  wallpaper: string;
  theme: Theme;
  activeSpaceId: string;
  focusMode: FocusMode;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}
