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
      'Eh, wajah baru! Kamu {name}, cucu almarhumah Nek Lastri yang meneruskan kebunnya, ya? Saya Sari, yang punya warung ini.',
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
  // Phase 6: the museum curator and the people who make town and park busy.
  {
    id: 'ratna',
    name: 'Bu Ratna',
    voice: 1.1,
    portraitBg: ['lilac', 'violet'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['night', 'violet', 'lilac', 'rose'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['ink', 'night'],
      outfit: 'dress',
      hairStyle: 'bun',
      scarf: 'gold',
    },
    schedule: [
      { from: h(9), map: 'museum', x: 12, y: 7, do: 'wander', radius: 5 },
      { from: h(18), map: 'town', x: 38, y: 11, do: 'stand', face: 'down' },
      { from: h(18) + 40, map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: [
      'Selamat datang di Museum Seni! Saya Ratna, kuratornya. Saya juga melukis sedikit-sedikit.',
      'Silakan lihat-lihat. Tekan X di depan lukisan atau patung untuk membaca keterangannya.',
    ],
    lines: [
      ['Lukisan "Senja di Sawah" itu favorit pengunjung. Coba lihat warnanya.', 'Jangan sentuh patungnya, ya. Kecuali topi Pak Petani. Katanya bawa untung.', 'Seni itu seperti bertani: sabar, dirawat setiap hari.', 'Sudah lihat ruang Van Gogh di ujung timur? Enam lukisannya saya salin, pelan-pelan, titik demi titik.', '"Sunflowers" cocok sekali di lembah ini. Bunga matahari, sawah emas... Van Gogh pasti betah di sini.'],
      ['Potret nenek di dinding itu saya yang lukis. Mirip seseorang yang kamu kenal?', 'Semasa hidupnya Van Gogh hampir tidak pernah menjual lukisan. Sekarang semua orang mengenalnya. Teruslah berkarya, ya.'],
      ['Kalau kamu menemukan mutiara di pantai, saya ingin sekali melukisnya.'],
    ],
    loves: ['mutiara', 'mawar'],
    likes: ['melati', 'bintangLaut', 'kerang', 'jambu'],
    dislikes: ['lele', 'fiber'],
  },
  {
    id: 'wayan',
    name: 'Pak Wayan',
    voice: 0.85,
    portraitBg: ['peach', 'amber'],
    look: {
      hair: GREY_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['umber', 'clay', 'tan', 'sand'],
      pants: ['night', 'plum', 'mauve'],
      shoes: ['bark', 'umber'],
      hat: { style: 'cap', ramp: ['wine', 'brick', 'coral', 'peach'] },
    },
    schedule: [
      { from: h(8), map: 'park', x: 27, y: 6, do: 'stand', face: 'up' },
      { from: h(12), map: 'town', x: 16, y: 18, do: 'wander', radius: 3 },
      { from: h(14), map: 'park', x: 27, y: 6, do: 'stand', face: 'up' },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Ssst, saya sedang menangkap cahaya. Saya Wayan, pelukis. Dua lukisan saya ada di museum.'],
    lines: [
      ['Cahaya jam sembilan pagi paling jujur.', 'Air mancur itu susah dilukis. Airnya tidak mau diam.', 'Lukisan bulan purnama itu? Jendela yang menyala itu... rahasia.'],
      ['Kebunmu dari bukit kelihatan cantik. Boleh saya lukis?'],
      ['Ini lukisan kebunmu. Belum selesai. Lukisan tidak pernah selesai, cuma berhenti.'],
    ],
    loves: ['mangga', 'kopi'],
    likes: ['matahari', 'pisang', 'kelapa'],
    dislikes: ['stone'],
  },
  {
    id: 'ayu',
    name: 'Ayu',
    voice: 1.3,
    portraitBg: ['sky', 'foam'],
    look: {
      hair: ['bark', 'umber', 'clay'],
      skin: SKIN,
      eye: 'night',
      shirt: ['deep', 'sea', 'sky', 'foam'],
      pants: ['night', 'plum', 'mauve'],
      shoes: ['wine', 'brick'],
      hairStyle: 'long',
    },
    schedule: [
      { from: h(10), map: 'museum', x: 8, y: 6, do: 'wander', radius: 3 },
      { from: h(14), map: 'park', x: 26, y: 17, do: 'wander', radius: 3 },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Halo! Aku Ayu, mahasiswi seni. Patung telur biru di museum itu karyaku. Lucu, kan?'],
    lines: [
      ['Aku suka gamelan. Lukisanku "Bunyi Gamelan" itu suara yang jadi warna.', 'Taman ini tempat favoritku buat menggambar orang.', 'Belum ada yang tahu apa yang menetas dari telur biru itu. Termasuk aku.'],
      ['Kamu mau aku gambar? Diam sebentar, ya... Hehe, bercanda.'],
      ['Kamu teman pertama yang datang ke pameranku. Terima kasih!'],
    ],
    loves: ['bintangLaut', 'mutiara'],
    likes: ['jambu', 'kelapa', 'melati'],
    dislikes: ['jamur'],
  },
  {
    id: 'joko',
    name: 'Pak Joko',
    voice: 0.8,
    portraitBg: ['haze', 'mauve'],
    look: {
      hair: BLACK_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['night', 'plum', 'mauve', 'haze'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['ink', 'night'],
      outfit: 'safari',
    },
    schedule: [
      { from: h(8), map: 'town', x: 30, y: 20, do: 'wander', radius: 4 },
      { from: h(13), map: 'park', x: 19, y: 4, do: 'stand', face: 'up' },
      { from: h(15), map: 'town', x: 30, y: 20, do: 'wander', radius: 4 },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Saya Joko, pemahat. Patung petani di taman dan di museum itu saya yang buat.'],
    lines: [
      ['Perunggu itu dingin di pagi hari, hangat di siang hari. Seperti orang.', 'Kerbau di lukisan itu juga saya. Eh, maksudnya saya yang melukis.', 'Batu yang bagus itu sabar menunggu dipahat.'],
      ['Kalau kamu menemukan batu besar yang cantik, kabari saya.'],
      ['Saya sedang memahat sesuatu untukmu. Jangan intip!'],
    ],
    loves: ['stone', 'kopi'],
    likes: ['nasiGoreng', 'soto', 'tongkol'],
    dislikes: ['mawar'],
  },
  {
    id: 'nah',
    name: 'Mbok Nah',
    voice: 0.95,
    speed: 28,
    portraitBg: ['gold', 'amber'],
    look: {
      hair: GREY_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['pine', 'moss', 'leaf', 'grass'],
      pants: ['umber', 'clay', 'tan'],
      shoes: ['bark', 'umber'],
      outfit: 'dress',
      hairStyle: 'bun',
    },
    schedule: [
      { from: h(6) + 30, map: 'town', x: 17, y: 12, do: 'stand', face: 'down' },
      { from: h(16), map: 'park', x: 10, y: 14, do: 'stand', face: 'right' },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Jamu, jamu! Kunyit asam, beras kencur! Mbok Nah sudah jualan jamu di sini sejak kakekmu masih muda.'],
    lines: [
      ['Capek? Minum jamu, nanti segar lagi.', 'Kunyit itu obat segala obat, Nak.', 'Nenekmu dulu langganan beras kencur Mbok.'],
      ['Kamu kerja keras sekali. Mbok bangga.'],
      ['Mbok kasih resep rahasia: jahe, gula aren, sedikit doa.'],
    ],
    loves: ['pisang', 'jamur'],
    likes: ['kelapa', 'cabai', 'terong'],
    dislikes: ['esTeh'],
  },
  {
    id: 'liem',
    name: 'Koh Liem',
    voice: 0.9,
    speed: 30,
    portraitBg: ['wine', 'brick'],
    look: {
      hair: GREY_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['night', 'plum', 'mauve'],
      shoes: ['ink', 'night'],
    },
    schedule: [
      { from: h(9), map: 'park', x: 15, y: 8, do: 'sit', face: 'down' },
      { from: h(16), map: 'town', x: 12, y: 12, do: 'wander', radius: 2 },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Ah, anak muda. Saya Liem, kakaknya Budi. Dulu saya melukis buah. Sekarang saya memakannya.'],
    lines: [
      ['Bangku ini sudah tahu bentuk punggung saya.', 'Lukisan buah di museum itu punya saya. Buahnya sudah lama saya makan.', 'Budi itu adik saya. Dia pintar dagang, saya pintar duduk.'],
      ['Main catur? Ah, saya lupa bawa papannya. Lagi.'],
      ['Kamu mengingatkan saya waktu muda. Rajin, tapi suka lupa makan.'],
    ],
    loves: ['mangga', 'jeruk'],
    likes: ['pisang', 'jambu', 'kopi'],
    dislikes: ['lele'],
  },
  {
    id: 'rina',
    name: 'Rina',
    voice: 1.2,
    speed: 54,
    portraitBg: ['lime', 'grass'],
    look: {
      hair: BLACK_HAIR,
      skin: SKIN,
      eye: 'night',
      shirt: ['wine', 'brick', 'coral', 'peach'],
      pants: ['night', 'plum', 'mauve'],
      shoes: ['foam', 'sky'],
      hairStyle: 'long',
      hat: { style: 'cap', ramp: ['deep', 'sea', 'sky', 'foam'] },
    },
    schedule: [
      { from: h(6), map: 'park', x: 20, y: 9, do: 'wander', radius: 9 },
      { from: h(9), map: 'home', x: 0, y: 0, do: 'stand' },
      { from: h(16), map: 'park', x: 20, y: 9, do: 'wander', radius: 9 },
      { from: h(19), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Hah, hah... Halo! Aku Rina. Sepuluh putaran taman tiap pagi dan sore. Mau ikut?'],
    lines: [
      ['Satu putaran taman kira-kira lima ratus langkah. Aku hitung!', 'Minum air yang banyak, ya. Haus itu musuh.', 'Air mancurnya segar. Kadang aku cuci muka di situ. Ssst.'],
      ['Larimu sudah lebih cepat dari minggu lalu, kan?'],
      ['Kalau ada lomba lari di festival, kita satu tim!'],
    ],
    loves: ['kelapa', 'esTeh'],
    likes: ['pisang', 'jambu', 'semangka'],
    dislikes: ['kopi'],
  },
  {
    id: 'bayu',
    name: 'Bayu',
    voice: 1.55,
    speed: 60,
    portraitBg: ['sky', 'sea'],
    look: {
      hair: BLACK_HAIR,
      skin: TAN_SKIN,
      eye: 'night',
      shirt: ['pine', 'moss', 'leaf', 'grass'],
      pants: ['deep', 'sea', 'sky'],
      shoes: ['wine', 'brick'],
      small: true,
    },
    schedule: [
      { from: h(13), map: 'park', x: 9, y: 22, do: 'wander', radius: 5 },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Kamu bukan dari sini, ya? Aku Bayu! Aku penguasa taman ini. Kata Dimas sih.'],
    lines: [
      ['Kamu tahu ada katak di kolam? Namanya Pak Kodok.', 'Tono selalu kalah main kejar-kejaran.', 'Air mancurnya bisa bikin pelangi kalau sore!'],
      ['Nanti ajari aku mancing, ya!'],
      ['Kamu teman paling keren di Lembah Padi!'],
    ],
    loves: ['bintangLaut', 'pisangGoreng'],
    likes: ['pisang', 'jambu', 'kerang'],
    dislikes: ['terong', 'jamur'],
  },
  {
    id: 'tono',
    name: 'Tono',
    voice: 1.6,
    speed: 56,
    portraitBg: ['peach', 'rose'],
    look: {
      hair: ['bark', 'umber', 'clay'],
      skin: SKIN,
      eye: 'night',
      shirt: ['gold', 'amber', 'gold', 'cream'],
      pants: ['bark', 'umber', 'clay'],
      shoes: ['deep', 'sea'],
      small: true,
    },
    schedule: [
      { from: h(13), map: 'park', x: 12, y: 21, do: 'wander', radius: 5 },
      { from: h(18), map: 'home', x: 0, y: 0, do: 'stand' },
    ],
    intro: ['Aku Tono. Aku nggak selalu kalah kok! Bayu bohong.'],
    lines: [
      ['Aku mau jadi pemahat kayak Pak Joko.', 'Bayu curang, dia lari duluan.', 'Kalau besar aku mau punya kebun pisang.'],
      ['Ini batu bulat yang aku temukan. Buat kamu... eh, jangan, buat aku saja.'],
      ['Kamu boleh masuk geng taman kami!'],
    ],
    loves: ['pisangGoreng', 'jambu'],
    likes: ['pisang', 'kerang', 'kelapa'],
    dislikes: ['cabai'],
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
