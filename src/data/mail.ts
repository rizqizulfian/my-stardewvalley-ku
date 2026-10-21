// Letters that arrive in the farm mailbox overnight. Each is sent once (its
// flag is `mail:<id>`) when its condition holds; some carry a small present.

import { isWet, type GameState } from '../systems/GameState';

export interface Letter {
  id: string;
  from: string;
  pages: string[];
  /** A present tucked inside: [item id, qty]. */
  item?: [string, number];
  /** Whether it should be sent this morning. */
  when: (s: GameState, ctx: { newSeason: boolean; hearts: (npc: string) => number }) => boolean;
  /** Sent again whenever the condition holds (not just once). */
  repeat?: boolean;
}

export const LETTERS: Letter[] = [
  {
    id: 'welcome',
    from: 'Pak Harun',
    when: (s) => s.daysPlayed >= 2,
    pages: [
      'Selamat datang di Lembah Padi! Saya Harun, kepala desa.',
      'Kebun nenekmu, Bu Lastri, sudah lama sepi. Senang sekali ada yang merawatnya lagi.',
      'Mampirlah ke desa dan kota. Warga di sini ramah, kok. Ini sedikit bibit untuk permulaan.',
    ],
    item: ['seedJagung', 5],
  },
  {
    id: 'darto',
    from: 'Pak Darto',
    when: (s) => s.daysPlayed >= 3 && !s.flags.rodGiven,
    pages: [
      'Halo, anak muda. Saya Darto, nelayan di pantai selatan.',
      'Kalau sempat, mampir ke dermaga. Ada joran lama nganggur, sayang kalau tidak dipakai.',
    ],
  },
  {
    id: 'rain',
    from: 'Siti',
    when: (s) => isWet(s.weather),
    pages: [
      'Hujan! Kata Bapak, kalau hujan tanaman tidak perlu disiram. Hemat tenaga, kan?',
      'Tapi jangan lupa bawa caping. Hehe.',
    ],
  },
  {
    id: 'season',
    from: 'Pak Harun',
    repeat: true,
    when: (_s, c) => c.newSeason,
    pages: [
      'Musim sudah berganti! Tanaman musim lalu yang belum dipanen sudah layu.',
      'Cek toko Koh Budi untuk bibit musim ini. Semoga panennya melimpah!',
    ],
  },
  {
    id: 'sari',
    from: 'Bu Sari',
    when: (_s, c) => c.hearts('sari') >= 2,
    pages: ['Terima kasih sudah sering mampir ke warung. Ini pisang goreng hangat, khusus buat kamu!'],
    item: ['pisangGoreng', 3],
  },
  {
    id: 'prabowo',
    from: 'Pak Prabowo',
    when: (_s, c) => c.hearts('prabowo') >= 2,
    pages: [
      'Saya senang ngobrol soal padi denganmu. Petani muda itu harapan bangsa!',
      'Ini bibit padi pilihan. Tanam yang rapi, ya. Tegas!',
    ],
    item: ['seedPadi', 10],
  },
  {
    id: 'jotaro',
    from: 'Jotaro',
    when: (_s, c) => c.hearts('jotaro') >= 3,
    pages: ['Yare yare daze. ...Terima kasih sudah tidak bertanya macam-macam.', 'Ikan ini kebanyakan buatku. Ambil saja.'],
    item: ['kerapu', 1],
  },
];

export function letter(id: string): Letter | undefined {
  return LETTERS.find((l) => l.id === id);
}
