// Photo data store — all CDN URLs and dump/pool mappings
// Design: V4 exact — #0a0a0a bg, #c8a96e accent, Inter font, scroll-snap strips
// IMPORTANT: NO template literals — plain string concat for Safari compatibility

export interface Photo {
  id: string;
  url: string;
  alt: string;
  isHuji: boolean;
  category: string;
  role?: string;
}

export interface Dump {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  photos: Photo[];
}

// CDN base — plain string, no template literal
var CDN_BASE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663373215716/mQthSgftBhhpNNbz94sY8A";

// V4 new pool photos CDN base (same bucket)
var CDN_V4 = "https://d2xsxph8kpxj0f.cloudfront.net/310519663373215716/mQthSgftBhhpNNbz94sY8A";

function url(filename: string): string {
  return CDN_BASE + "/" + filename;
}

function urlV4(filename: string): string {
  return CDN_V4 + "/" + filename;
}

export const INITIAL_DUMPS: Dump[] = [
  {
    id: "dump-1",
    number: 1,
    title: "The Creative's Saturday",
    subtitle: "City / Cars / Studio / Night",
    photos: [
      {
        id: "AQAEDGsb0HQoRnw",
        url: url("photo_AQAEDGsb0HQoRnw_49d719a5.jpg"),
        alt: "Rooftop portrait, city skyline, golden hour",
        isHuji: false,
        category: "Portrait · Hook",
        role: "The Hook",
      },
      {
        id: "AQAD7QtrG9B0KEZ8",
        url: url("photo_AQAD7QtrG9B0KEZ8_634c3f35.jpg"),
        alt: "Yellow Lamborghini, Red G-Wagon, exotic cars",
        isHuji: false,
        category: "Automotive · Scene",
        role: "The Contrast",
      },
      {
        id: "AQADBAxrG9B0KEZ-",
        url: url("photo_AQADBAxrG9B0KEZ-_bceece8c.jpg"),
        alt: "Porsche badge macro on red paint",
        isHuji: false,
        category: "Automotive · Macro Detail",
        role: "The Detail Reward",
      },
      {
        id: "AQAD-AtrG9B0KEZ8",
        url: url("photo_AQAD-AtrG9B0KEZ8_19310c6a.jpg"),
        alt: "SSL mixing console, recording studio",
        isHuji: false,
        category: "Studio · Creative Identity",
        role: "The Identity Beat",
      },
      {
        id: "AQAD8wtrG9B0KEZ8",
        url: url("photo_AQAD8wtrG9B0KEZ8_5622fe63.jpg"),
        alt: "Club interior, glowing LED cube ceiling",
        isHuji: false,
        category: "Nightlife · Abstract Architecture",
        role: "The Closer",
      },
    ],
  },
  {
    id: "dump-2",
    number: 2,
    title: "Miami Day",
    subtitle: "Beach / Art / Luxury Retail / Carbone Night",
    photos: [
      {
        id: "AQAD-gtrG9B0KEZ8",
        url: url("photo_AQAD-gtrG9B0KEZ8_80acee0e.jpg"),
        alt: "Nikki Beach entrance, palm trees, vivid sky",
        isHuji: false,
        category: "Scene · Travel · Hook",
        role: "The Hook",
      },
      {
        id: "AQADBwxrG9B0KEZ8",
        url: url("photo_AQADBwxrG9B0KEZ8_c223987c.jpg"),
        alt: "Nikki Beach cocktail cheers POV, watch, palm trees",
        isHuji: false,
        category: "Lifestyle · POV Detail",
        role: "The Intimate Detail",
      },
      {
        id: "AQAD_QtrG9B0KEZ8",
        url: url("photo_AQAD_QtrG9B0KEZ8_6cef0f84.jpg"),
        alt: "David Yurman store, Great Wave of Kanagawa mural",
        isHuji: false,
        category: "Art · Luxury Retail · Hero",
        role: "The Creative Eye",
      },
      {
        id: "AQADAwxrG9B0KEZ8",
        url: url("photo_AQADAwxrG9B0KEZ8_d869653c.jpg"),
        alt: "Balenciaga store, curved white sculptural walls",
        isHuji: false,
        category: "Architecture · Brand",
        role: "The Architecture Beat",
      },
      {
        id: "AQADBgxrG9B0KEZ8",
        url: url("photo_AQADBgxrG9B0KEZ8_74334293.jpg"),
        alt: "Carbone Miami neon sign at night, palm trees",
        isHuji: false,
        category: "Nightlife · Scene · Closer",
        role: "The Closer",
      },
    ],
  },
  {
    id: "dump-3",
    number: 3,
    title: "The Artist's Eye",
    subtitle: "Abstract / Museum / Gym / Waldorf / Club Floor",
    photos: [
      {
        id: "AQADBQxrG9B0KEZ8",
        url: url("photo_AQADBQxrG9B0KEZ8_3ff27901.jpg"),
        alt: "Long exposure light trails selfie, abstract gold and green streaks",
        isHuji: false,
        category: "Abstract · Artistic · Hook",
        role: "The Hook",
      },
      {
        id: "AQAD9AtrG9B0KEZ8",
        url: url("photo_AQAD9AtrG9B0KEZ8_e8af4c04.jpg"),
        alt: "User in art museum, classical oil paintings",
        isHuji: false,
        category: "Art · Portrait",
        role: "The Landing",
      },
      {
        id: "AQADAgxrG9B0KEZ-",
        url: url("photo_AQADAgxrG9B0KEZ-_90ac792d.jpg"),
        alt: "Gym mirror flex, Calvin Klein, Peloton",
        isHuji: false,
        category: "Fitness · Body",
        role: "The Pivot",
      },
      {
        id: "AQAD-QtrG9B0KEZ8",
        url: url("photo_AQAD-QtrG9B0KEZ8_aecf0cf6.jpg"),
        alt: "Waldorf Astoria poolside dining, marble columns, indoor pool",
        isHuji: false,
        category: "Food · Dining · Architecture",
        role: "The Luxury Beat",
      },
      {
        id: "AQAD_gtrG9B0KEZ8",
        url: url("photo_AQAD_gtrG9B0KEZ8_177e87cf.jpg"),
        alt: "Dollar bills on club floor, pink purple lighting, heels and sneakers",
        isHuji: false,
        category: "Nightlife · Abstract · Closer",
        role: "The Closer",
      },
    ],
  },
];

export const INITIAL_POOL: Photo[] = [
  // ── Original zip photos (18) ──────────────────────────────────────────────
  {
    id: "AQAD5wtrG9B0KEZ-",
    url: url("photo_AQAD5wtrG9B0KEZ-_3c1615ec.jpg"),
    alt: "Pool hand with cup and watch",
    isHuji: true,
    category: "Lifestyle · POV",
  },
  {
    id: "AQAD6AtrG9B0KEZ8",
    url: url("photo_AQAD6AtrG9B0KEZ8_d898d9b6.jpg"),
    alt: "Buddhist monk at event",
    isHuji: false,
    category: "Culture · Portrait",
  },
  {
    id: "AQAD6QtrG9B0KEZ8",
    url: url("photo_AQAD6QtrG9B0KEZ8_48fab9b1.jpg"),
    alt: "Dark hallway with bonsai",
    isHuji: false,
    category: "Architecture · Moody",
  },
  {
    id: "AQAD6gtrG9B0KEZ8",
    url: url("photo_AQAD6gtrG9B0KEZ8_bbba0b2c.jpg"),
    alt: "Mirror selfie in luxury store",
    isHuji: false,
    category: "Fashion · Portrait",
  },
  {
    id: "AQAD6wtrG9B0KEZ8",
    url: url("photo_AQAD6wtrG9B0KEZ8_39df386b.jpg"),
    alt: "Waldorf Astoria tower exterior",
    isHuji: false,
    category: "Architecture · Luxury",
  },
  {
    id: "AQAD7AtrG9B0KEZ8",
    url: url("photo_AQAD7AtrG9B0KEZ8_3c71a2fe.jpg"),
    alt: "Roulette table at casino",
    isHuji: false,
    category: "Nightlife · Detail",
  },
  {
    id: "AQAD7gtrG9B0KEZ8",
    url: url("photo_AQAD7gtrG9B0KEZ8_b58560d0.jpg"),
    alt: "Red G-Wagon AMG side profile",
    isHuji: false,
    category: "Automotive",
  },
  {
    id: "AQAD7wtrG9B0KEZ8",
    url: url("photo_AQAD7wtrG9B0KEZ8_b6f2512b.jpg"),
    alt: "Yellow Lamborghini, Red G-Wagon, Black Maybach at Waldorf",
    isHuji: false,
    category: "Automotive · Scene",
  },
  {
    id: "AQAD8AtrG9B0KEZ8",
    url: url("photo_AQAD8AtrG9B0KEZ8_17cab205.jpg"),
    alt: "Mirror selfie in dark restaurant",
    isHuji: false,
    category: "Fashion · Moody",
  },
  {
    id: "AQAD8QtrG9B0KEZ-",
    url: url("photo_AQAD8QtrG9B0KEZ-_3a75b0db.jpg"),
    alt: "Rooftop party, Don Julio bottles, red solo cups",
    isHuji: false,
    category: "Lifestyle · Party",
  },
  {
    id: "AQAD8gtrG9B0KEZ8",
    url: url("photo_AQAD8gtrG9B0KEZ8_87a2e400.jpg"),
    alt: "Bathroom mirror selfie, grey sweatshirt, watch",
    isHuji: false,
    category: "Fashion · Portrait",
  },
  {
    id: "AQAD9QtrG9B0KEZ8",
    url: url("photo_AQAD9QtrG9B0KEZ8_48e298e9.jpg"),
    alt: "Man in museum, Gucci belt, gold chain, motion blur",
    isHuji: false,
    category: "Art · Fashion",
  },
  {
    id: "AQAD9gtrG9B0KEZ8",
    url: url("photo_AQAD9gtrG9B0KEZ8_f9e7dff1.jpg"),
    alt: "Man in art museum, black silk shirt, Gucci belt, classical paintings",
    isHuji: false,
    category: "Art · Portrait",
  },
  {
    id: "AQAD9wtrG9B0KEZ8",
    url: url("photo_AQAD9wtrG9B0KEZ8_6a94d15c.jpg"),
    alt: "Black Infiniti G37",
    isHuji: false,
    category: "Automotive",
  },
  {
    id: "AQAD_wtrG9B0KEZ8",
    url: url("photo_AQAD_wtrG9B0KEZ8_75b993ee.jpg"),
    alt: "Rooftop terrace women lounging",
    isHuji: true,
    category: "Lifestyle · Scene",
  },
  {
    id: "AQADAQxrG9B0KEZ8",
    url: url("photo_AQADAQxrG9B0KEZ8_99c1e20b.jpg"),
    alt: "Rooftop with Bape cap and watch",
    isHuji: true,
    category: "Lifestyle · POV",
  },
  {
    id: "AQAD-wtrG9B0KEZ8",
    url: url("photo_AQAD-wtrG9B0KEZ8_624247cf.jpg"),
    alt: "Car sunroof selfie",
    isHuji: true,
    category: "Automotive · Portrait",
  },
  {
    id: "AQAD_AtrG9B0KEZ8",
    url: url("photo_AQAD_AtrG9B0KEZ8_273b8fd2.jpg"),
    alt: "David Yurman store clean interior",
    isHuji: false,
    category: "Architecture · Luxury Retail",
  },
  // ── V4 additional photos (12) ─────────────────────────────────────────────
  {
    id: "v4_p01",
    url: urlV4("v4_p01_f50d9717.jpg"),
    alt: "Red G-Wagon framed by Waldorf Astoria stone archway",
    isHuji: false,
    category: "Automotive · Architecture",
  },
  {
    id: "v4_p02",
    url: urlV4("v4_p02_38dbf085.jpg"),
    alt: "Lamborghini Urus wheel, bronze rim, yellow brake caliper, cobblestone",
    isHuji: false,
    category: "Automotive · Macro Detail",
  },
  {
    id: "v4_p03",
    url: urlV4("v4_p03_2092e8f4.jpg"),
    alt: "Recording studio booth selfie, red lighting, mic stand, BTF shirt",
    isHuji: false,
    category: "Studio · Portrait",
  },
  {
    id: "v4_p04",
    url: urlV4("v4_p04_691c1490.jpg"),
    alt: "SSL mixing console, studio monitors, recording session",
    isHuji: false,
    category: "Studio · Creative",
  },
  {
    id: "v4_p05",
    url: urlV4("v4_p05_325b61be.jpg"),
    alt: "Dark restaurant interior, red spiral staircase, leopard print columns",
    isHuji: false,
    category: "Nightlife · Architecture",
  },
  {
    id: "v4_p09",
    url: urlV4("v4_p09_9cc51651.jpg"),
    alt: "Carbone neon sign at night, palm trees, warm glow",
    isHuji: false,
    category: "Nightlife · Scene",
  },
  {
    id: "v4_p10",
    url: urlV4("v4_p10_bf0d9a6f.jpg"),
    alt: "Upscale bar interior, red pendant lamp, green walls, gold bar stools",
    isHuji: false,
    category: "Nightlife · Bar",
  },
  {
    id: "v4_p11",
    url: urlV4("v4_p11_ef86eb5d.jpg"),
    alt: "Elevator mirror selfie, grey silk shirt, gold chain, sunglasses",
    isHuji: false,
    category: "Fashion · Portrait",
  },
  {
    id: "v4_p12",
    url: urlV4("v4_p12_96b78ca5.jpg"),
    alt: "Hotel atrium looking up, symmetrical architecture, escalators, warm light",
    isHuji: false,
    category: "Architecture · Luxury",
  },
  {
    id: "v4_p13",
    url: urlV4("v4_p13_ec7400b3.jpg"),
    alt: "Hotel room view of snowy Mercedes-Benz Stadium, laptop on couch",
    isHuji: false,
    category: "Travel · Scene",
  },
  {
    id: "v4_p14",
    url: urlV4("v4_p14_91fff452.jpg"),
    alt: "Close-up portrait, face mask, knit cap, marble background",
    isHuji: true,
    category: "Portrait · Streetwear",
  },
  {
    id: "v4_p15",
    url: urlV4("v4_p15_746eb90c.jpg"),
    alt: "Masked portrait, gold chain, marble background, film grain",
    isHuji: true,
    category: "Portrait · Night",
  },
];
