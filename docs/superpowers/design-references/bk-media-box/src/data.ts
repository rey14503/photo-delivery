import { Album } from './types';

export const INITIAL_ALBUMS: Album[] = [
  {
    id: 'wedding-duykhoa',
    title: 'Duy Khoa & Khanh Huyen Wedding',
    date: 'July 05, 2026',
    location: 'InterContinental Danang Sun Peninsula Resort',
    coverUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
    photosCount: 6,
    downloadEnabled: true,
    clientName: 'Duy Khoa Nguyễn',
    clientEmail: 'duykhoa@gmail.com',
    shareToken: 'wedding-2026',
    photos: [
      {
        id: 'photo-1',
        url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&auto=format&fit=crop&q=80',
        title: 'The Elegant Entrance',
        version: 1,
        suggestedByPhotographer: true,
        likedByClient: true,
        clientLikers: ['Duy Khoa Nguyễn', 'Khanh Huyền'],
        aspectRatio: 'landscape',
        comments: [
          {
            id: 'c1',
            author: 'BK Media (Admin)',
            role: 'photographer',
            text: 'I highly suggest this shot for the album cover. Perfect lighting!',
            timestamp: 'July 06, 2026, 09:30 AM'
          },
          {
            id: 'c2',
            author: 'Duy Khoa Nguyễn',
            role: 'client',
            text: 'Absolutely! We love how the dress details are captured here.',
            timestamp: 'July 06, 2026, 11:15 AM'
          }
        ]
      },
      {
        id: 'photo-2',
        url: 'https://images.unsplash.com/photo-1519225495810-7517c29a2e2d?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1519225495810-7517c29a2e2d?w=400&auto=format&fit=crop&q=80',
        title: 'Groom Waiting',
        version: 2, // version 2 indicates a version-bumped replacement
        suggestedByPhotographer: false,
        likedByClient: true,
        clientLikers: ['Duy Khoa Nguyễn'],
        aspectRatio: 'portrait',
        comments: [
          {
            id: 'c3',
            author: 'BK Media (Admin)',
            role: 'photographer',
            text: 'Updated version v2 with enhanced shadow correction and warm tones.',
            timestamp: 'July 07, 2026, 04:20 PM'
          }
        ]
      },
      {
        id: 'photo-3',
        url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&auto=format&fit=crop&q=80',
        title: 'The Ceremony Arch',
        version: 1,
        suggestedByPhotographer: true,
        likedByClient: false,
        clientLikers: [],
        aspectRatio: 'landscape',
        comments: []
      },
      {
        id: 'photo-4',
        url: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=400&auto=format&fit=crop&q=80',
        title: 'Golden Rings Detail',
        version: 3, // replaced twice!
        suggestedByPhotographer: true,
        likedByClient: true,
        clientLikers: ['Khanh Huyền'],
        aspectRatio: 'square',
        comments: [
          {
            id: 'c4',
            author: 'Khanh Huyền',
            role: 'client',
            text: 'Can we crop it slightly closer to the engravings?',
            timestamp: 'July 06, 2026, 02:45 PM'
          },
          {
            id: 'c5',
            author: 'BK Media (Admin)',
            role: 'photographer',
            text: 'Here is v3 with the requested close crop and noise reduction.',
            timestamp: 'July 07, 2026, 05:00 PM'
          }
        ]
      },
      {
        id: 'photo-5',
        url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400&auto=format&fit=crop&q=80',
        title: 'Reception Decor & Lights',
        version: 1,
        suggestedByPhotographer: false,
        likedByClient: false,
        clientLikers: [],
        aspectRatio: 'landscape',
        comments: []
      },
      {
        id: 'photo-6',
        url: 'https://images.unsplash.com/photo-1507504038482-7621ee58e2d4?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507504038482-7621ee58e2d4?w=400&auto=format&fit=crop&q=80',
        title: 'First Dance Romance',
        version: 1,
        suggestedByPhotographer: false,
        likedByClient: true,
        clientLikers: ['Duy Khoa Nguyễn', 'Khanh Huyền'],
        aspectRatio: 'portrait',
        comments: [
          {
            id: 'c6',
            author: 'Duy Khoa Nguyễn',
            role: 'client',
            text: 'This is gorgeous! Absolute favorite.',
            timestamp: 'July 07, 2026, 08:30 PM'
          }
        ]
      }
    ]
  },
  {
    id: 'fashion-urban',
    title: 'Summer Editorial fashion shoot',
    date: 'June 28, 2026',
    location: 'District 1 Urban Streets, HCMC',
    coverUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
    photosCount: 3,
    downloadEnabled: false,
    clientName: 'Hoàng Lương Ninh',
    clientEmail: 'ninhhl@fashionco.vn',
    shareToken: 'fashion-2026',
    photos: [
      {
        id: 'f-1',
        url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&auto=format&fit=crop&q=80',
        title: 'Urban Portrait Strut',
        version: 1,
        suggestedByPhotographer: true,
        likedByClient: true,
        clientLikers: ['Hoàng Lương Ninh'],
        aspectRatio: 'portrait',
        comments: []
      },
      {
        id: 'f-2',
        url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&auto=format&fit=crop&q=80',
        title: 'Shopping Bags Walk',
        version: 2,
        suggestedByPhotographer: false,
        likedByClient: false,
        clientLikers: [],
        aspectRatio: 'landscape',
        comments: []
      },
      {
        id: 'f-3',
        url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&auto=format&fit=crop&q=80',
        title: 'Neon Evening Dress',
        version: 1,
        suggestedByPhotographer: true,
        likedByClient: true,
        clientLikers: ['Hoàng Lương Ninh'],
        aspectRatio: 'portrait',
        comments: []
      }
    ]
  },
  {
    id: 'corp-summit',
    title: 'Tech Summit Keynote 2026',
    date: 'May 14, 2026',
    location: 'GEM Center, HCMC',
    coverUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
    photosCount: 2,
    downloadEnabled: true,
    clientName: 'TechCorp HR',
    clientEmail: 'contact@techcorp.vn',
    shareToken: 'techcorp-2026',
    photos: [
      {
        id: 'c-1',
        url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&auto=format&fit=crop&q=80',
        title: 'Keynote Panel Panelists',
        version: 1,
        suggestedByPhotographer: true,
        likedByClient: false,
        clientLikers: [],
        aspectRatio: 'landscape',
        comments: []
      }
    ]
  }
];

export const MOCK_REPLACE_POOL = [
  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1520854221256-17451cc35d53?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=1200&auto=format&fit=crop&q=80'
];
