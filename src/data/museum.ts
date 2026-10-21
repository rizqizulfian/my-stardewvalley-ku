// The museum's collection: what each plaque says. Artists are villagers of
// the valley (all made up).

export interface Artwork {
  title: string;
  artist: string;
  text: string;
}

export const ARTWORKS: Record<string, Artwork> = {
  terraces: { title: 'Senja di Sawah', artist: 'Wayan Sukra, oil on canvas', text: 'The terraces above Lembah Padi at harvest time, painted from the same hill every evening for a month.' },
  grandma: { title: 'Nenek di Beranda', artist: 'Ratna Dewi, oil on canvas', text: 'A portrait of a farmer of the valley in her lilac scarf. The painter says she always had sweets in her pocket.' },
  fruit: { title: 'Buah Pasar', artist: 'Koh Liem, gouache', text: 'Mangosteen, rambutan and bananas from the Saturday market. Painted, then eaten.' },
  circles: { title: 'Bunyi Gamelan', artist: 'Ayu Lestari, acrylic', text: 'What a gamelan sounds like, if sound had colours. Stand back and listen.' },
  harbour: { title: 'Perahu Pagi', artist: 'Darto (yes, that Darto), watercolour', text: 'The fishing boats leaving the dock at dawn. Pak Darto painted it in his one year of art classes.' },
  night: { title: 'Bulan Purnama', artist: 'Wayan Sukra, oil on canvas', text: 'The full moon over the valley, with one window still lit. Whose house is it? The painter will not say.' },
  buffalo: { title: 'Kerbau Istirahat', artist: 'Joko Santoso, oil on board', text: 'A water buffalo resting after ploughing. The longest anyone has ever seen one stand still.' },
  lotus: { title: 'Teratai', artist: 'Ratna Dewi, watercolour', text: 'Lotus flowers on the pond in the park, at the hour when the frogs start singing.' },
  swirl: { title: 'Angin', artist: 'Ayu Lestari, bent copper', text: 'The wind over the rice fields, caught in copper wire.' },
  bust: { title: 'Kepala Desa Pertama', artist: 'unknown, carved stone', text: 'The first head of the village, carved about a hundred years ago. Pak Harun swears it looks like him.' },
  farmer: { title: 'Petani', artist: 'Joko Santoso, bronze', text: 'A farmer in a caping hat with a hoe on the shoulder. Polished bright where children touch the hat for luck.' },
  egg: { title: 'Telur Langit', artist: 'Ayu Lestari, glazed clay', text: 'A sky-blue egg as tall as a child. Nobody knows what will hatch from it.' },
};
