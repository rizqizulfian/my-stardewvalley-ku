// The people of the valley: how they look, where they are through the day,
// what they say and what they like. Colours are palette names (see
// art/characters.ts for the ramp slots). Lines are in Indonesian; each page is
// one text box.
//
// Jotaro and Pak Prabowo are fan/tribute characters Zulfian asked for. Each has
// its own entry so they are easy to swap out before publishing.

import type { CharacterLook, Facing } from '../art/characters';
import type { ColorName } from '../art/palette';

export type NpcActivity = 'stand' | 'wander' | 'sit' | 'dance' | 'fish';

/** Where an NPC is from a given time. map 'home' means indoors (not on any map). */
export interface NpcStop {
  from: number;
  map: string;
  x: number;
  y: number;
  do: NpcActivity;
  face?: Facing;
  /** Wander radius in cells. */
  radius?: number;
}

export interface NpcDef {
  id: string;
  name: string;
  look: CharacterLook;
  /** Talk blip pitch ratio. */
  voice: number;
  /** Walking speed, px/s. */
  speed?: number;
  /** Portrait background. */
  portraitBg: [ColorName, ColorName];
  schedule: NpcStop[];
  /** First meeting. */
  intro: string[];
  /** Everyday lines by friendship: [0-2 hearts, 3-5 hearts, 6+ hearts]. Higher tiers also use lower lines. */
  lines: [string[], string[], string[]];
  rain?: string[];
  /** Gift tastes (item ids). Anything else is neutral. */
  loves: string[];
  likes: string[];
  dislikes: string[];
  /** Opens this shop from a "Shop" choice. */
  shop?: string;
  /** Something handed over once, the first time you talk. */
  gift?: { item: string; flag: string; pages: string[] };
  /** Extra layers: a Stand behind them and a coloured aura. */
  stand?: 'starPlatinum';
  aura?: boolean;
}

const h = (n: number) => n * 60;

const SKIN: CharacterLook['skin'] = ['umber', 'skinShade', 'skin', 'peach'];
const TAN_SKIN: CharacterLook['skin'] = ['bark', 'umber', 'skinShade', 'skin'];
const BLACK_HAIR: CharacterLook['hair'] = ['ink', 'night', 'plum'];
const GREY_HAIR: CharacterLook['hair'] = ['plum', 'mauve', 'haze'];

export const NPCS: NpcDef[] = [
  {
    id: 'sari',
    name: 'Bu Sari',
    voice: 1.15,
    portraitBg: ['peach', 'coral'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['bark', 'umber'],
      outfit: 'dress',
      hat: { style: 'hijab', ramp: ['night', 'violet', 'lilac', 'rose'] },
    },
    schedule: [
      { from: h(7), map: 'town', x: 14, y: 24, do: 'stand', face: 'down' },
      { from: h(22), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    shop: 'warung',
    intro: [
      'Eh, wajah baru! Kamu yang meneruskan kebun almarhumah Nek Lastri, ya? Saya Sari, yang punya warung ini.',
      'Kalau lapar atau haus, mampir saja. Nasi goreng saya paling enak se-lembah. Katanya sih, hehe.',
    ],
    lines: [
      [
        'Sudah makan belum? Jangan kerja dengan perut kosong, nanti pusing.',
        'Es teh manis paling cocok siang-siang begini.',
        'Kalau kamu dapat ikan, jual ke sini saja. Saya butuh buat soto.',
      ],
      ['Kamu makin rajin saja. Nanti saya bungkuskan pisang goreng, ya.', 'Warung ini dulu punya ibu saya. Resep sotonya belum berubah dari dulu.'],
      ['Kamu sudah seperti keluarga sendiri di sini. Jangan sungkan minta tambah nasi!'],
    ],
    rain: ['Hujan begini enaknya makan soto panas-panas. Mau satu mangkuk?'],
    loves: ['kakap', 'gurame', 'mawar'],
    likes: ['cabai', 'terong', 'padi', 'ikanMas', 'nila', 'lele', 'jagung'],
    dislikes: ['rumputLaut', 'fiber', 'stone'],
  },
  {
    id: 'ujang',
    name: 'Pak Ujang',
    voice: 0.85,
    portraitBg: ['lime', 'grass'],
    look: {
      hair: BLACK_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['pine', 'moss', 'leaf', 'grass'],
      pants: ['night', 'plum', 'mauve'],
      shoes: ['bark', 'umber'],
      hat: { style: 'caping', ramp: ['umber', 'clay', 'tan', 'sand'] },
    },
    schedule: [
      { from: h(8), map: 'town', x: 33, y: 24, do: 'stand', face: 'down' },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    shop: 'buah',
    intro: ['Buah, buah! Segar dari kebun! Oh, kamu orang baru? Saya Ujang. Pisang, mangga, jeruk, semangka, semua ada.'],
    lines: [
      [
        'Pisang itu buah paling jujur. Manisnya tidak pernah bohong.',
        'Pohon pisang di kebunmu rawat baik-baik. Tiga hari sekali sudah bisa dipetik lagi.',
        'Semangka ini dari kampung sebelah. Coba satu, dijamin segar.',
      ],
      ['Hei, langganan! Hari ini mangganya lagi manis-manisnya.'],
      ['Dulu saya juga petani, lho. Sekarang jualan, tapi hati saya tetap di sawah.'],
    ],
    loves: ['semangka', 'matahari'],
    likes: ['pisang', 'mangga', 'jeruk', 'jambu', 'kelapa'],
    dislikes: ['rumputLaut'],
  },
  {
    id: 'budi',
    name: 'Koh Budi',
    voice: 0.95,
    portraitBg: ['foam', 'sky'],
    look: {
      hair: BLACK_HAIR,
      skin: ['umber', 'skinShade', 'skin', 'cream'],
      eye: 'night',
      shirt: ['mauve', 'haze', 'mist', 'cream'],
      pants: ['deep', 'sea', 'sky'],
      shoes: ['night', 'plum'],
      hairStyle: 'short',
    },
    schedule: [
      { from: h(8) + 30, map: 'town', x: 12, y: 10, do: 'wander', radius: 2 },
      { from: h(17) + 30, map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    shop: 'toko',
    intro: ['Selamat datang di Toko Tani! Saya Budi. Bibit, pupuk, cerita, semua ada di sini.'],
    lines: [
      [
        'Tanam sesuai musimnya, ya. Jangan paksa padi tumbuh di musim dingin.',
        'Kotak kiriman di kebunmu bayar harga penuh. Jual ke toko cuma dapat setengahnya.',
        'Bunga mawar laku keras di kota. Coba tanam beberapa.',
      ],
      ['Kamu salah satu petani paling rajin yang pernah belanja di sini.'],
      ['Kalau butuh saran, tanya saja. Saya sudah tiga puluh tahun jualan bibit.'],
    ],
    loves: ['mawar', 'matahari'],
    likes: ['padi', 'jagung', 'wood', 'kopi'],
    dislikes: ['rumputLaut'],
  },
  {
    id: 'sinta',
    name: 'Sinta',
    voice: 1.3,
    portraitBg: ['rose', 'lilac'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['clay', 'amber', 'gold'],
      shoes: ['bark', 'umber'],
      hairStyle: 'bun',
      outfit: 'dress',
      scarf: 'gold',
    },
    schedule: [
      { from: h(9), map: 'town', x: 22, y: 14, do: 'wander', radius: 4 },
      { from: h(14), map: 'town', x: 24, y: 20, do: 'dance', face: 'down' },
      { from: h(21), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Halo! Saya Sinta. Tiap sore saya latihan menari di depan air mancur. Musiknya ada di hati saya, hehe.'],
    lines: [
      [
        'Tari ini namanya tari selendang. Gerakannya pelan, tapi harus dari hati.',
        'Kalau kamu senang, ikut goyang saja. Tidak ada yang menilai!',
        'Air mancur ini seperti panggung kecil buat saya.',
      ],
      ['Kemarin ada anak-anak ikut menari. Senang sekali rasanya.'],
      ['Suatu hari saya ingin tampil di festival panen. Kamu harus datang, ya!'],
    ],
    rain: ['Hujan! Saya istirahat dulu, nanti selendang saya basah.'],
    loves: ['melati', 'mutiara'],
    likes: ['mawar', 'esTeh', 'jambu', 'semangka'],
    dislikes: ['lele', 'fiber'],
  },
  {
    id: 'harun',
    name: 'Pak Harun',
    voice: 0.8,
    portraitBg: ['lime', 'leaf'],
    look: {
      hair: GREY_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['umber', 'clay', 'tan', 'sand'],
      pants: ['ink', 'night', 'plum'],
      shoes: ['ink', 'night'],
      hat: { style: 'peci', ramp: ['ink', 'night', 'night', 'plum'] },
    },
    schedule: [
      { from: h(8), map: 'town', x: 30, y: 11, do: 'stand', face: 'down' },
      { from: h(12), map: 'village', x: 22, y: 16, do: 'wander', radius: 3 },
      { from: h(16), map: 'town', x: 30, y: 11, do: 'stand', face: 'down' },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: [
      'Selamat datang di Lembah Padi, Nak. Saya Harun, kepala desa di sini.',
      'Nenekmu, Bu Lastri, orang yang sangat kami hormati. Kebunnya pasti senang ada yang merawat lagi.',
    ],
    lines: [
      [
        'Papan pengumuman di kota selalu saya perbarui. Rajin-rajin dibaca, ya.',
        'Desa ini kecil, tapi warganya saling menjaga.',
        'Musim berganti setiap dua puluh delapan hari. Siapkan bibitmu.',
      ],
      ['Hasil panenmu sudah jadi bahan obrolan di warung, lho.'],
      ['Bu Lastri pasti bangga melihat kebunnya sekarang.'],
    ],
    loves: ['gurame', 'soto'],
    likes: ['kopi', 'padi', 'nasiGoreng'],
    dislikes: ['rumputLaut'],
  },
  {
    // Tribute character at Zulfian's request: warm farming small talk only, no politics.
    id: 'prabowo',
    name: 'Pak Prabowo',
    voice: 0.75,
    portraitBg: ['sand', 'tan'],
    look: {
      hair: GREY_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['umber', 'clay', 'tan', 'sand'],
      pants: ['umber', 'clay', 'tan'],
      shoes: ['bark', 'umber'],
      outfit: 'safari',
      hat: { style: 'peci', ramp: ['ink', 'night', 'night', 'plum'] },
    },
    schedule: [
      { from: h(6) + 30, map: 'village', x: 10, y: 9, do: 'wander', radius: 3 },
      { from: h(11), map: 'town', x: 26, y: 13, do: 'wander', radius: 3 },
      { from: h(16), map: 'town', x: 19, y: 19, do: 'sit' },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: [
      'Wah, petani muda! Saya Prabowo. Saya suka jalan pagi melihat sawah di lembah ini.',
      'Bertani itu pekerjaan mulia. Dari tanganmu, banyak orang bisa makan.',
    ],
    lines: [
      [
        'Lihat padi yang menguning itu. Makin berisi, makin merunduk.',
        'Pagi-pagi jalan kaki lihat sawah. Badan sehat, pikiran tenang.',
        'Jangan lupa minum air putih. Kerja di ladang itu menguras tenaga.',
        'Kalau panen jagung, sisihkan sedikit buat dibakar sore-sore. Nikmat sekali.',
      ],
      ['Kebunmu makin rapi saja. Saya senang ada anak muda mau pulang ke desa.'],
      ['Kamu sudah jadi bagian penting dari lembah ini. Terus semangat, ya!'],
    ],
    rain: ['Hujan begini bagus buat sawah. Tanamanmu tidak perlu disiram hari ini.'],
    loves: ['nasiGoreng', 'kelapa'],
    likes: ['jagung', 'padi', 'kopi', 'pisang'],
    dislikes: ['rumputLaut'],
  },
  {
    id: 'ijah',
    name: 'Nek Ijah',
    voice: 1.05,
    speed: 26,
    portraitBg: ['mist', 'haze'],
    look: {
      hair: GREY_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['plum', 'mauve', 'haze', 'mist'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['bark', 'umber'],
      outfit: 'dress',
      hat: { style: 'hijab', ramp: ['mauve', 'haze', 'mist', 'cream'] },
    },
    schedule: [
      { from: h(7), map: 'village', x: 9, y: 24, do: 'wander', radius: 2 },
      { from: h(9), map: 'village', x: 17, y: 20, do: 'sit' },
      { from: h(17), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: [
      'Oh... kamu cucunya Lastri? Ya ampun, sudah besar sekali. Nenek ini Ijah, teman Lastri sejak kecil.',
      'Duduk sini sebentar kalau capek. Bangku ini nyaman.',
    ],
    lines: [
      [
        'Dulu Lastri dan Nenek suka menanam melati bersama. Wanginya sampai ke jalan.',
        'Anak muda jangan lupa istirahat. Badan itu bukan mesin.',
        'Kalau kakimu pegal, duduklah di bangku. Tenaga cepat kembali.',
      ],
      ['Kamu mirip Lastri waktu muda. Keras kepala, tapi baik hati.'],
      ['Nenek tenang sekarang. Kebun Lastri ada di tangan yang tepat.'],
    ],
    loves: ['pisangGoreng', 'melati'],
    likes: ['pisang', 'esTeh', 'jambu', 'kopi'],
    dislikes: ['cabai'],
  },
  {
    id: 'siti',
    name: 'Siti',
    voice: 1.25,
    portraitBg: ['lime', 'gold'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['deep', 'sea', 'sky', 'foam'],
      pants: ['wine', 'brick', 'coral'],
      shoes: ['bark', 'umber'],
      outfit: 'dress',
      hat: { style: 'hijab', ramp: ['pine', 'moss', 'leaf', 'grass'] },
    },
    schedule: [
      { from: h(8), map: 'village', x: 6, y: 16, do: 'stand', face: 'up' },
      { from: h(12), map: 'town', x: 25, y: 26, do: 'wander', radius: 2 },
      { from: h(16), map: 'village', x: 6, y: 16, do: 'stand', face: 'up' },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Hai! Aku Siti. Aku yang merawat bunga-bunga di kampung ini. Kamu suka bunga?'],
    lines: [
      [
        'Bunga matahari selalu menghadap matahari. Aku juga mau seceria itu.',
        'Kembang sepatu ini mekar terus. Kuat sekali, ya.',
        'Kalau kamu menanam melati, wanginya bikin tidur nyenyak.',
      ],
      ['Aku lagi belajar merangkai bunga. Nanti kamu yang pertama aku kasih!'],
      ['Kebunmu indah sekali sekarang. Boleh aku main ke sana?'],
    ],
    loves: ['mawar'],
    likes: ['matahari', 'melati', 'jambu', 'pakis'],
    dislikes: ['lele', 'stone'],
  },
  {
    id: 'dimas',
    name: 'Dimas',
    voice: 1.5,
    speed: 58,
    portraitBg: ['gold', 'amber'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['deep', 'sea', 'sky'],
      shoes: ['night', 'plum'],
      hairStyle: 'short',
      small: true,
    },
    schedule: [
      { from: h(7), map: 'village', x: 22, y: 17, do: 'wander', radius: 5 },
      { from: h(12), map: 'town', x: 21, y: 14, do: 'wander', radius: 6 },
      { from: h(16), map: 'beach', x: 18, y: 11, do: 'wander', radius: 5 },
      { from: h(18) + 30, map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Kak! Kakak orang baru, ya? Aku Dimas! Aku paling cepat lari di kampung ini!'],
    lines: [
      [
        'Kejar aku kalau bisa! Hehe.',
        'Aku pernah lihat ikan besar sekali di kolam kampung. Sebesar ini!',
        'Kak, tahu nggak? Di pantai ada kakak yang pakai topi terus. Katanya kuat sekali.',
        'Nanti kalau sudah besar aku mau jadi nelayan kayak Pak Darto!',
      ],
      ['Kakak keren! Ajarin aku mancing, dong.'],
      ['Kakak sahabat terbaikku!'],
    ],
    loves: ['bintangLaut'],
    likes: ['pisangGoreng', 'semangka', 'kerang', 'jeruk'],
    dislikes: ['terong', 'kopi'],
  },
  {
    id: 'darto',
    name: 'Pak Darto',
    voice: 0.7,
    portraitBg: ['foam', 'sea'],
    look: {
      hair: GREY_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['deep', 'sea', 'sky', 'foam'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['bark', 'umber'],
      hat: { style: 'caping', ramp: ['clay', 'amber', 'gold', 'cream'] },
    },
    schedule: [
      { from: h(5), map: 'beach', x: 30, y: 26, do: 'fish', face: 'down' },
      { from: h(12), map: 'beach', x: 11, y: 15, do: 'wander', radius: 3 },
      { from: h(16), map: 'beach', x: 30, y: 26, do: 'fish', face: 'down' },
      { from: h(21), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Hei, kamu yang baru pindah ke kebun Lastri? Saya Darto. Sudah empat puluh tahun saya memancing di dermaga ini.'],
    gift: {
      item: 'rod',
      flag: 'rodGiven',
      pages: [
        'Ini, ambil joran lama saya. Saya sudah punya yang baru.',
        'Hadapkan badan ke air, lempar kail. Tunggu tanda seru, lalu tekan cepat.',
        'Terus tekan saat tanda merah ada di area hijau. Tiga kali kena, ikannya naik!',
      ],
    },
    lines: [
      [
        'Ikan laut suka pagi dan sore. Cumi keluar malam hari.',
        'Di kolam kampung ada ikan mas dan nila. Kalau malam, lele ikut keluar.',
        'Kerapu itu ikan paling susah. Biasanya muncul waktu hujan.',
      ],
      ['Tanganmu sudah mulai luwes pegang joran.'],
      ['Kamu sudah jadi nelayan sejati. Saya bangga.'],
    ],
    rain: ['Hujan begini, ikan-ikan lebih rakus. Ayo mancing!'],
    loves: ['kerapu'],
    likes: ['kakap', 'tongkol', 'kopi', 'cumi', 'nasiGoreng'],
    dislikes: ['rumputLaut'],
  },
  {
    // Fan character at Zulfian's request (their own JoJo tribute): Star Platinum behind him and a purple aura.
    id: 'jotaro',
    name: 'Jotaro',
    voice: 0.6,
    portraitBg: ['lilac', 'violet'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'deep',
      shirt: ['ink', 'night', 'night', 'plum'],
      inner: ['violet', 'lilac'],
      trim: 'gold',
      pants: ['ink', 'night', 'plum'],
      shoes: ['ink', 'night'],
      outfit: 'coat',
      hat: { style: 'cap', ramp: ['ink', 'night', 'night', 'plum'] },
    },
    stand: 'starPlatinum',
    aura: true,
    schedule: [
      { from: h(9), map: 'beach', x: 38, y: 12, do: 'stand', face: 'down' },
      { from: h(22), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['......', 'Yare yare daze. Kamu lihat sesuatu di belakangku? ...Bukan apa-apa.'],
    lines: [
      ['Yare yare daze.', 'Laut di sini tenang. Cocok buat berpikir.', 'Aku sedang mencari bintang laut. ...Jangan tanya kenapa.', 'Hmph. Kebunmu lumayan juga.'],
      ['Kamu tidak takut padaku? ...Menarik.'],
      ['Kalau ada yang mengganggumu, bilang saja padaku.'],
    ],
    loves: ['bintangLaut'],
    likes: ['kopi', 'kerang', 'tongkol'],
    dislikes: ['jambu'],
  },
];

export const NPCS_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

export const FRIENDSHIP = {
  /** Points per heart, and the most hearts. */
  perHeart: 100,
  maxHearts: 10,
  chat: 20,
  gift: { love: 80, like: 45, neutral: 20, dislike: -20 },
} as const;

/** Generic gift reactions by taste. */
export const GIFT_LINES: Record<'love' | 'like' | 'neutral' | 'dislike', string> = {
  love: 'Wah! Ini kesukaanku! Terima kasih banyak, ya!',
  like: 'Terima kasih, aku suka ini.',
  neutral: 'Oh, untukku? Terima kasih.',
  dislike: 'Hmm... terima kasih. Mungkin.',
};

/** Where an NPC should be at this time (null when indoors or before their day starts). */
export function stopAt(def: NpcDef, minute: number): NpcStop | null {
  let cur: NpcStop | null = null;
  for (const s of def.schedule) if (minute >= s.from) cur = s;
  return cur && cur.map !== 'home' ? cur : null;
}
