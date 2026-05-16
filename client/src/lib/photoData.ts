// Photo data store — NO template literals for Safari compatibility
export interface Photo {
  id: string;
  url: string;
  alt: string;
  isFavorite: boolean;
  category: string;
}

export interface Dump {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  photos: Photo[];
  captions?: string[];
  vibe?: string;
}

var C = "https://d2xsxph8kpxj0f.cloudfront.net/310519663373215716/mQthSgftBhhpNNbz94sY8A";
function u(f: string): string { return C + "/" + f; }

function p(id: string, file: string, alt: string, _huji: boolean, cat: string): Photo {
  return { id: id, url: u(file), alt: alt, isFavorite: false, category: cat };
}

export var INITIAL_DUMPS: Dump[] = [
  {
    id: "dump-1", number: 1,
    title: "The Creative's Saturday",
    subtitle: "City / Cars / Studio / Night",
    photos: [
      p("AQAEDGsb0HQoRnw", "photo_AQAEDGsb0HQoRnw_49d719a5.jpg", "Rooftop portrait, city skyline, golden hour", false, "Portrait"),
      p("AQAD7QtrG9B0KEZ8", "photo_AQAD7QtrG9B0KEZ8_634c3f35.jpg", "Yellow Lamborghini, Red G-Wagon, exotic cars", false, "Automotive"),
      p("AQADBAxrG9B0KEZ-", "photo_AQADBAxrG9B0KEZ-_bceece8c.jpg", "Porsche badge macro on red paint", false, "Automotive"),
      p("AQAD-AtrG9B0KEZ8", "photo_AQAD-AtrG9B0KEZ8_19310c6a.jpg", "SSL mixing console, recording studio", false, "Studio"),
      p("AQAD8wtrG9B0KEZ8", "photo_AQAD8wtrG9B0KEZ8_5622fe63.jpg", "Club interior, glowing LED cube ceiling", false, "Nightlife"),
    ],
  },
  {
    id: "dump-2", number: 2,
    title: "Miami Day",
    subtitle: "Beach / Art / Luxury Retail / Carbone Night",
    photos: [
      p("AQAD-gtrG9B0KEZ8", "photo_AQAD-gtrG9B0KEZ8_80acee0e.jpg", "Nikki Beach entrance, palm trees", false, "Travel"),
      p("AQADBwxrG9B0KEZ8", "photo_AQADBwxrG9B0KEZ8_c223987c.jpg", "Nikki Beach cocktail cheers POV", false, "Lifestyle"),
      p("AQAD_QtrG9B0KEZ8", "photo_AQAD_QtrG9B0KEZ8_6cef0f84.jpg", "David Yurman store, Great Wave mural", false, "Art"),
      p("AQADAwxrG9B0KEZ8", "photo_AQADAwxrG9B0KEZ8_d869653c.jpg", "Balenciaga store, sculptural walls", false, "Architecture"),
      p("AQADBgxrG9B0KEZ8", "photo_AQADBgxrG9B0KEZ8_74334293.jpg", "Carbone Miami neon sign at night", false, "Nightlife"),
    ],
  },
  {
    id: "dump-3", number: 3,
    title: "The Artist's Eye",
    subtitle: "Abstract / Museum / Gym / Waldorf / Club Floor",
    photos: [
      p("AQADBQxrG9B0KEZ8", "photo_AQADBQxrG9B0KEZ8_3ff27901.jpg", "Long exposure light trails selfie", false, "Abstract"),
      p("AQAD9AtrG9B0KEZ8", "photo_AQAD9AtrG9B0KEZ8_e8af4c04.jpg", "User in art museum, classical paintings", false, "Art"),
      p("AQADAgxrG9B0KEZ-", "photo_AQADAgxrG9B0KEZ-_90ac792d.jpg", "Gym mirror flex, Calvin Klein", false, "Fitness"),
      p("AQAD-QtrG9B0KEZ8", "photo_AQAD-QtrG9B0KEZ8_aecf0cf6.jpg", "Waldorf Astoria poolside dining", false, "Dining"),
      p("AQAD_gtrG9B0KEZ8", "photo_AQAD_gtrG9B0KEZ8_177e87cf.jpg", "Dollar bills on club floor", false, "Nightlife"),
    ],
  },
];

export var INITIAL_POOL: Photo[] = [
  p("AQAD5wtrG9B0KEZ-", "photo_AQAD5wtrG9B0KEZ-_3c1615ec.jpg", "Pool hand with cup and watch", true, "Lifestyle"),
  p("AQAD6AtrG9B0KEZ8", "photo_AQAD6AtrG9B0KEZ8_d898d9b6.jpg", "Buddhist monk at event", false, "Culture"),
  p("AQAD6QtrG9B0KEZ8", "photo_AQAD6QtrG9B0KEZ8_48fab9b1.jpg", "Dark hallway with bonsai", false, "Architecture"),
  p("AQAD6gtrG9B0KEZ8", "photo_AQAD6gtrG9B0KEZ8_bbba0b2c.jpg", "Mirror selfie in luxury store", false, "Fashion"),
  p("AQAD6wtrG9B0KEZ8", "photo_AQAD6wtrG9B0KEZ8_39df386b.jpg", "Waldorf Astoria tower exterior", false, "Architecture"),
  p("AQAD7AtrG9B0KEZ8", "photo_AQAD7AtrG9B0KEZ8_3c71a2fe.jpg", "Roulette table at casino", false, "Nightlife"),
  p("AQAD7gtrG9B0KEZ8", "photo_AQAD7gtrG9B0KEZ8_b58560d0.jpg", "Red G-Wagon AMG side profile", false, "Automotive"),
  p("AQAD7wtrG9B0KEZ8", "photo_AQAD7wtrG9B0KEZ8_b6f2512b.jpg", "Yellow Lambo, Red G-Wagon, Black Maybach", false, "Automotive"),
  p("AQAD8AtrG9B0KEZ8", "photo_AQAD8AtrG9B0KEZ8_17cab205.jpg", "Mirror selfie in dark restaurant", false, "Fashion"),
  p("AQAD8QtrG9B0KEZ-", "photo_AQAD8QtrG9B0KEZ-_3a75b0db.jpg", "Rooftop party, Don Julio bottles", false, "Lifestyle"),
  p("AQAD8gtrG9B0KEZ8", "photo_AQAD8gtrG9B0KEZ8_87a2e400.jpg", "Bathroom mirror selfie, watch", false, "Fashion"),
  p("AQAD9QtrG9B0KEZ8", "photo_AQAD9QtrG9B0KEZ8_48e298e9.jpg", "Man in museum, Gucci belt, motion blur", false, "Art"),
  p("AQAD9gtrG9B0KEZ8", "photo_AQAD9gtrG9B0KEZ8_f9e7dff1.jpg", "Man in art museum, silk shirt", false, "Art"),
  p("AQAD9wtrG9B0KEZ8", "photo_AQAD9wtrG9B0KEZ8_6a94d15c.jpg", "Black Infiniti G37", false, "Automotive"),
  p("AQAD_wtrG9B0KEZ8", "photo_AQAD_wtrG9B0KEZ8_75b993ee.jpg", "Rooftop terrace women lounging", true, "Lifestyle"),
  p("AQADAQxrG9B0KEZ8", "photo_AQADAQxrG9B0KEZ8_99c1e20b.jpg", "Rooftop with Bape cap and watch", true, "Lifestyle"),
  p("AQAD-wtrG9B0KEZ8", "photo_AQAD-wtrG9B0KEZ8_624247cf.jpg", "Car sunroof selfie", true, "Automotive"),
  p("AQAD_AtrG9B0KEZ8", "photo_AQAD_AtrG9B0KEZ8_273b8fd2.jpg", "David Yurman store clean interior", false, "Architecture"),
  p("v4_p01", "v4_p01_f50d9717.jpg", "Red G-Wagon framed by stone archway", false, "Automotive"),
  p("v4_p02", "v4_p02_38dbf085.jpg", "Lamborghini wheel, bronze rim, yellow caliper", false, "Automotive"),
  p("v4_p03", "v4_p03_2092e8f4.jpg", "Recording studio booth selfie, red lighting", false, "Studio"),
  p("v4_p04", "v4_p04_691c1490.jpg", "SSL mixing console, studio monitors", false, "Studio"),
  p("v4_p05", "v4_p05_325b61be.jpg", "Dark restaurant, red spiral staircase", false, "Nightlife"),
  p("v4_p09", "v4_p09_9cc51651.jpg", "Carbone neon sign at night, palm trees", false, "Nightlife"),
  p("v4_p10", "v4_p10_bf0d9a6f.jpg", "Upscale bar interior, red pendant lamp", false, "Nightlife"),
  p("v4_p11", "v4_p11_ef86eb5d.jpg", "Elevator mirror selfie, grey silk shirt", false, "Fashion"),
  p("v4_p12", "v4_p12_96b78ca5.jpg", "Hotel atrium, symmetrical architecture", false, "Architecture"),
  p("v4_p13", "v4_p13_ec7400b3.jpg", "Hotel room view of snowy stadium", false, "Travel"),
  p("v4_p14", "v4_p14_91fff452.jpg", "Close-up portrait, face mask and cap", true, "Portrait"),
  p("v4_p15", "v4_p15_746eb90c.jpg", "Masked portrait, gold chain, film grain", true, "Portrait"),
];
