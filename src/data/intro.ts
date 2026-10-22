// The opening story, shown once on a new farm: picture panels with a few
// lines of narration each. Indonesian, like the villagers' talk.

export type IntroPanel = 'porch' | 'office' | 'letter' | 'bus' | 'arrival';

export interface IntroShot {
  panel: IntroPanel;
  /** Place and time, shown in the corner of the picture. */
  caption?: string;
  music: string;
  lines: string[];
}

export const INTRO_SHOTS: IntroShot[] = [
  {
    panel: 'porch',
    caption: 'Lembah Padi, dua puluh tahun lalu',
    music: 'farm-evening',
    lines: [
      'Dulu, setiap libur sekolah, kamu tinggal di rumah Nek Lastri di Lembah Padi.',
      'Kalian menanam padi, memetik jambu, lalu menunggu matahari terbenam di beranda.',
      'Sore itu, sebelum kamu pulang ke kota, Nek Lastri menyelipkan sepucuk surat ke tanganmu.',
      '"Simpan baik-baik, ya. Bukalah kalau suatu hari hidupmu terasa terlalu bising."',
    ],
  },
  {
    panel: 'office',
    caption: 'Kota, bertahun-tahun kemudian',
    music: 'farm-night',
    lines: [
      'Nek Lastri sudah lama tiada. Kamu kini bekerja di kantor besar di tengah kota.',
      'Lembur lagi. Laporan lagi. Lampu kantor seperti tidak pernah padam.',
      'Malam itu, saat mencari pulpen di laci, kamu menemukan surat lama itu.',
    ],
  },
  {
    panel: 'letter',
    music: 'home',
    lines: [
      '"{name}, cucuku sayang, kalau kamu membaca surat ini, mungkin kamu sedang lelah."',
      '"Rumah dan kebun Nenek di Lembah Padi sekarang milikmu. Tanahnya subur, tetangganya baik hati."',
      '"Tanamlah sesuatu, lalu rawat pelan-pelan. Kamu akan ikut tumbuh bersamanya."',
      '"Peluk dari jauh, Nek Lastri."',
    ],
  },
  {
    panel: 'bus',
    caption: 'Seminggu kemudian',
    music: 'farm-morning',
    lines: [
      'Kamu mengundurkan diri, mengemas tas, dan naik bus pertama ke Lembah Padi.',
      'Sawah bertingkat, kabut pagi, bau tanah basah. Semuanya masih seperti dulu.',
    ],
  },
  {
    panel: 'arrival',
    caption: 'Kebun Nek Lastri',
    music: 'farm-morning',
    lines: [
      'Kebunnya penuh rumput liar, tapi rumah Nenek masih berdiri di tempatnya.',
      'Selamat datang di rumah barumu, {name}.',
    ],
  },
];
