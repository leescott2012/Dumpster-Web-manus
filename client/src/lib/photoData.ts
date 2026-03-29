// Photo data store — all CDN URLs and dump/pool mappings
// Design: V4 exact — #0a0a0a bg, #c8a96e accent, Inter font, scroll-snap strips

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

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663373215716/mQthSgftBhhpNNbz94sY8A";

export const INITIAL_DUMPS: Dump[] = [
  {
    id: "dump-1",
    number: 1,
    title: "The Creative's Saturday",
    subtitle: "City / Cars / Studio / Night",
    photos: [
      {
        id: "AQAEDGsb0HQoRnw",
        url: `${CDN}/photo_AQAEDGsb0HQoRnw_49d719a5.jpg`,
        alt: "Rooftop portrait, city skyline, golden hour",
        isHuji: false,
        category: "Portrait · Hook",
        role: "The Hook",
      },
      {
        id: "AQAD7QtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD7QtrG9B0KEZ8_634c3f35.jpg`,
        alt: "Yellow Lamborghini, Red G-Wagon, exotic cars",
        isHuji: false,
        category: "Automotive · Scene",
        role: "The Contrast",
      },
      {
        id: "AQADBAxrG9B0KEZ-",
        url: `${CDN}/photo_AQADBAxrG9B0KEZ-_bceece8c.jpg`,
        alt: "Porsche badge macro on red paint",
        isHuji: false,
        category: "Automotive · Macro Detail",
        role: "The Detail Reward",
      },
      {
        id: "AQAD-AtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD-AtrG9B0KEZ8_19310c6a.jpg`,
        alt: "SSL mixing console, recording studio",
        isHuji: false,
        category: "Studio · Creative Identity",
        role: "The Identity Beat",
      },
      {
        id: "AQAD8wtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD8wtrG9B0KEZ8_5622fe63.jpg`,
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
        url: `${CDN}/photo_AQAD-gtrG9B0KEZ8_80acee0e.jpg`,
        alt: "Nikki Beach entrance, palm trees, vivid sky",
        isHuji: false,
        category: "Scene · Travel · Hook",
        role: "The Hook",
      },
      {
        id: "AQADBwxrG9B0KEZ8",
        url: `${CDN}/photo_AQADBwxrG9B0KEZ8_c223987c.jpg`,
        alt: "Nikki Beach cocktail cheers POV, watch, palm trees",
        isHuji: false,
        category: "Lifestyle · POV Detail",
        role: "The Intimate Detail",
      },
      {
        id: "AQAD_QtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD_QtrG9B0KEZ8_6cef0f84.jpg`,
        alt: "David Yurman store, Great Wave of Kanagawa mural",
        isHuji: false,
        category: "Art · Luxury Retail · Hero",
        role: "The Creative Eye",
      },
      {
        id: "AQADAwxrG9B0KEZ8",
        url: `${CDN}/photo_AQADAwxrG9B0KEZ8_d869653c.jpg`,
        alt: "Balenciaga store, curved white sculptural walls",
        isHuji: false,
        category: "Architecture · Brand",
        role: "The Architecture Beat",
      },
      {
        id: "AQADBgxrG9B0KEZ8",
        url: `${CDN}/photo_AQADBgxrG9B0KEZ8_74334293.jpg`,
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
        url: `${CDN}/photo_AQADBQxrG9B0KEZ8_3ff27901.jpg`,
        alt: "Long exposure light trails selfie, abstract gold and green streaks",
        isHuji: false,
        category: "Abstract · Artistic · Hook",
        role: "The Hook",
      },
      {
        id: "AQAD9AtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD9AtrG9B0KEZ8_e8af4c04.jpg`,
        alt: "User in art museum, classical oil paintings",
        isHuji: false,
        category: "Art · Portrait",
        role: "The Landing",
      },
      {
        id: "AQADAgxrG9B0KEZ-",
        url: `${CDN}/photo_AQADAgxrG9B0KEZ-_90ac792d.jpg`,
        alt: "Gym mirror flex, Calvin Klein, Peloton",
        isHuji: false,
        category: "Fitness · Body",
        role: "The Pivot",
      },
      {
        id: "AQAD-QtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD-QtrG9B0KEZ8_aecf0cf6.jpg`,
        alt: "Waldorf Astoria poolside dining, marble columns, indoor pool",
        isHuji: false,
        category: "Food · Dining · Architecture",
        role: "The Luxury Beat",
      },
      {
        id: "AQAD_gtrG9B0KEZ8",
        url: `${CDN}/photo_AQAD_gtrG9B0KEZ8_177e87cf.jpg`,
        alt: "Dollar bills on club floor, pink purple lighting, heels and sneakers",
        isHuji: false,
        category: "Nightlife · Abstract · Closer",
        role: "The Closer",
      },
    ],
  },
];

export const INITIAL_POOL: Photo[] = [
  {
    id: "AQAD5wtrG9B0KEZ-",
    url: `${CDN}/photo_AQAD5wtrG9B0KEZ-_3c1615ec.jpg`,
    alt: "Pool hand with cup and watch",
    isHuji: true,
    category: "Lifestyle · POV",
  },
  {
    id: "AQAD6AtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD6AtrG9B0KEZ8_d898d9b6.jpg`,
    alt: "Buddhist monk at event",
    isHuji: false,
    category: "Culture · Portrait",
  },
  {
    id: "AQAD6QtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD6QtrG9B0KEZ8_48fab9b1.jpg`,
    alt: "Dark hallway with bonsai",
    isHuji: false,
    category: "Architecture · Moody",
  },
  {
    id: "AQAD6gtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD6gtrG9B0KEZ8_bbba0b2c.jpg`,
    alt: "Mirror selfie in luxury store",
    isHuji: false,
    category: "Fashion · Portrait",
  },
  {
    id: "AQAD6wtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD6wtrG9B0KEZ8_39df386b.jpg`,
    alt: "Waldorf Astoria tower exterior",
    isHuji: false,
    category: "Architecture · Luxury",
  },
  {
    id: "AQAD7AtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD7AtrG9B0KEZ8_3c71a2fe.jpg`,
    alt: "Roulette table at casino",
    isHuji: false,
    category: "Nightlife · Detail",
  },
  {
    id: "AQAD7gtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD7gtrG9B0KEZ8_b58560d0.jpg`,
    alt: "Red G-Wagon AMG side profile",
    isHuji: false,
    category: "Automotive",
  },
  {
    id: "AQAD8AtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD8AtrG9B0KEZ8_17cab205.jpg`,
    alt: "Mirror selfie in dark restaurant",
    isHuji: false,
    category: "Fashion · Moody",
  },
  {
    id: "AQAD9wtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD9wtrG9B0KEZ8_6a94d15c.jpg`,
    alt: "Black Infiniti G37",
    isHuji: false,
    category: "Automotive",
  },
  {
    id: "AQAD_wtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD_wtrG9B0KEZ8_75b993ee.jpg`,
    alt: "Rooftop terrace women lounging",
    isHuji: true,
    category: "Lifestyle · Scene",
  },
  {
    id: "AQADAQxrG9B0KEZ8",
    url: `${CDN}/photo_AQADAQxrG9B0KEZ8_99c1e20b.jpg`,
    alt: "Rooftop with Bape cap and watch",
    isHuji: true,
    category: "Lifestyle · POV",
  },
  {
    id: "AQAD-wtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD-wtrG9B0KEZ8_624247cf.jpg`,
    alt: "Car sunroof selfie",
    isHuji: true,
    category: "Automotive · Portrait",
  },
  {
    id: "AQAD_AtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD_AtrG9B0KEZ8_273b8fd2.jpg`,
    alt: "David Yurman store clean interior",
    isHuji: false,
    category: "Architecture · Luxury Retail",
  },
  // 5 additional photos not in V3 unused list but in the zip
  {
    id: "AQAD7wtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD7wtrG9B0KEZ8_b6f2512b.jpg`,
    alt: "Night scene",
    isHuji: false,
    category: "Scene",
  },
  {
    id: "AQAD8QtrG9B0KEZ-",
    url: `${CDN}/photo_AQAD8QtrG9B0KEZ-_3a75b0db.jpg`,
    alt: "Portrait or scene",
    isHuji: false,
    category: "Portrait",
  },
  {
    id: "AQAD8gtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD8gtrG9B0KEZ8_87a2e400.jpg`,
    alt: "Scene or detail",
    isHuji: false,
    category: "Scene",
  },
  {
    id: "AQAD9QtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD9QtrG9B0KEZ8_48e298e9.jpg`,
    alt: "Scene or portrait",
    isHuji: false,
    category: "Scene",
  },
  {
    id: "AQAD9gtrG9B0KEZ8",
    url: `${CDN}/photo_AQAD9gtrG9B0KEZ8_f9e7dff1.jpg`,
    alt: "Scene or detail",
    isHuji: false,
    category: "Scene",
  },
];
