// The little tour after the opening story: the camera visits the places the
// player can walk to, with its name and one line about what is there. The
// dancing dog's house is left out on purpose: it is a surprise.
// Points are map cells; the camera glides from `from` to `to` during a stop.

export interface TourStop {
  map: string;
  title: string;
  caption: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export const TOUR_STOPS: TourStop[] = [
  {
    map: 'farm',
    title: 'Kebun Lembah Padi',
    caption: 'Kebun warisan Nek Lastri. Bersihkan lahan, tanam benih, siram, lalu panen.',
    from: { x: 12, y: 11 },
    to: { x: 22, y: 22 },
  },
  {
    map: 'farm',
    title: 'Padang dan Kandang',
    caption: 'Sapi, ayam, bebek, dan sarang lebah. Malam hari hewan pulang ke kandang.',
    from: { x: 30, y: 21 },
    to: { x: 38, y: 25 },
  },
  {
    map: 'house',
    title: 'Rumahmu',
    caption: 'Tidur di kasur untuk menyimpan permainan dan memulai hari baru.',
    from: { x: 6, y: 5 },
    to: { x: 6, y: 5 },
  },
  {
    map: 'village',
    title: 'Kampung Padi',
    caption: 'Rumah para tetangga. Sapa mereka tiap hari supaya makin akrab.',
    from: { x: 10, y: 12 },
    to: { x: 32, y: 14 },
  },
  {
    map: 'town',
    title: 'Pasar Lembah',
    caption: 'Toko benih, warung, dan alun-alun kota. Belanja dan ngobrol di sini.',
    // Kept on the east side, away from the dog's house in the west corner.
    from: { x: 30, y: 10 },
    to: { x: 34, y: 16 },
  },
  {
    map: 'park',
    title: 'Taman Lembah',
    caption: 'Air mancur besar dan bangku teduh untuk melepas lelah.',
    from: { x: 14, y: 16 },
    to: { x: 24, y: 13 },
  },
  {
    map: 'museum',
    title: 'Museum Seni',
    caption: 'Lukisan seniman lembah dan ruang Van Gogh. Baca plakat di bawah tiap lukisan.',
    from: { x: 13, y: 6 },
    to: { x: 13, y: 6 },
  },
  {
    map: 'beach',
    title: 'Pantai Senja',
    caption: 'Memancing, mencari kerang, dan menikmati matahari terbenam.',
    from: { x: 22, y: 8 },
    to: { x: 22, y: 20 },
  },
];

/** Shown over the farm when the tour ends. */
export const TOUR_OUTRO = { title: 'Selamat menjelajah!', caption: 'Semua tempat ini menunggumu. Mulai dari kebunmu sendiri.' };
