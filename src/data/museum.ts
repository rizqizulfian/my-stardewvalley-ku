// The museum's collection: what each plaque says. Most artists are villagers
// of the valley (all made up); the east room holds copies of Van Gogh.

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
  // The Van Gogh room. Copies of real paintings, all public domain.
  selfportrait: { title: 'Self-Portrait (1889)', artist: 'Vincent van Gogh, oil on canvas', text: 'Painted in Saint-Remy in September 1889, in his blue suit against a sea of swirls. He painted more than 35 self-portraits, often because he could not pay a model.' },
  starrynight: { title: 'The Starry Night (1889)', artist: 'Vincent van Gogh, oil on canvas', text: 'The view from his window at the asylum in Saint-Remy, before sunrise, with an imagined village and a cypress like a dark flame. The original hangs in New York.' },
  sunflowers: { title: 'Sunflowers (1888)', artist: 'Vincent van Gogh, oil on canvas', text: 'Painted in Arles to brighten the room of his friend Gauguin. Some flowers are in full bloom, some already gone to seed. He signed it on the vase: Vincent.' },
  bedroom: { title: 'The Bedroom (1888)', artist: 'Vincent van Gogh, oil on canvas', text: 'His own room in the Yellow House in Arles. He wrote to his brother Theo that just looking at it should rest the mind. He liked it so much he painted it three times.' },
  cafe: { title: 'Cafe Terrace at Night (1888)', artist: 'Vincent van Gogh, oil on canvas', text: 'A cafe on the Place du Forum in Arles under a starry sky, painted on the spot at night. His first painting of a starry sky, and there is no black in it at all.' },
  wheatfield: { title: 'Wheat Field with Cypresses (1889)', artist: 'Vincent van Gogh, oil on canvas', text: 'Ripe wheat, olive bushes, violet hills and two cypresses near Saint-Remy, in the summer wind. Ask any farmer here: that is what July looks like.' },
};
