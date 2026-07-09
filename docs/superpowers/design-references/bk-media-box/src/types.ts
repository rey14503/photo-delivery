export interface Comment {
  id: string;
  author: string;
  role: 'photographer' | 'client';
  text: string;
  timestamp: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  version: number;
  suggestedByPhotographer: boolean;
  likedByClient: boolean;
  clientLikers: string[]; // List of client names who liked it
  comments: Comment[];
  aspectRatio?: 'landscape' | 'portrait' | 'square';
}

export interface Album {
  id: string;
  title: string;
  date: string;
  coverUrl: string;
  photosCount: number;
  downloadEnabled: boolean;
  clientName: string;
  clientEmail: string;
  shareToken: string;
  photos: Photo[];
  location?: string;
  googleDriveLink?: string;
  refreshTime?: string;
  commentsEnabled?: boolean;
  passwordProtected?: boolean;
  password?: string;
  maxSelectedLimit?: boolean;
  maxSelectedCount?: number;
}

export type ViewRole = 'photographer' | 'client';

export type ActiveTab = 'dashboard' | 'album-detail' | 'client-gallery';
