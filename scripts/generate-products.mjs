/**
 * TRAPO seed catalog generator.
 *
 * Deterministic, dependency-free Node 18+ ESM script. Re-running it regenerates
 * the catalog JSON, all placeholder product artwork, and the brand mascot copy.
 * No Math.random is used: every stochastic decision comes from a seeded PRNG.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED = 0x54524150; // "TRAP"
const VERIFY_ONLY = process.argv.includes('--verify');

const PATHS = {
  clientProducts: path.join(ROOT, 'client/src/data/seedProducts.json'),
  serverProducts: path.join(ROOT, 'server/src/data/seedProducts.json'),
  clientCollections: path.join(ROOT, 'client/src/data/seedCollections.json'),
  serverCollections: path.join(ROOT, 'server/src/data/seedCollections.json'),
  productsDir: path.join(ROOT, 'client/public/products'),
  brandDir: path.join(ROOT, 'client/public/brand'),
  mascotDest: path.join(ROOT, 'client/public/brand/trapo-mascot.jpeg'),
  serverUploadDir: path.join(ROOT, 'server/data/trapo/uploads'),
  serverMascotDest: path.join(ROOT, 'server/data/trapo/uploads/trapo-mascot.jpeg'),
  mascotSource:
    process.env.TRAPO_MASCOT_SOURCE || 'C:\\Users\\majba\\Downloads\\IMG_9810.jpeg',
};

const ACCENT = '#C7AD72';
const INK = '#2E2A26';
const CREAM = '#FBF8F2';
const MAX_SVG_BYTES = 12 * 1024;

const CATEGORIES = [
  'Clothing',
  'Shoes',
  'Gaming',
  'Electronics',
  'Watches',
  'Accessories',
  'Bags',
  'Lifestyle',
  'Sports Products',
];

const CATEGORY_PREFIX = {
  Clothing: 'CL',
  Shoes: 'SH',
  Gaming: 'GM',
  Electronics: 'EL',
  Watches: 'WT',
  Accessories: 'AC',
  Bags: 'BG',
  Lifestyle: 'LF',
  'Sports Products': 'SP',
};

const COLLECTION_DEFS = [
  ['col-studio-edit', 'The Studio Edit', 'the-studio-edit', 'Considered layers and quiet details for days spent making things.'],
  ['col-weekend-uniform', 'Weekend Uniform', 'weekend-uniform', 'Relaxed pieces built for slow mornings and unplanned plans.'],
  ['col-modern-desk', 'The Modern Desk', 'the-modern-desk', 'Tools and accessories that bring intention to the workspace.'],
  ['col-golden-hour', 'Golden Hour', 'golden-hour', 'Warm tones and soft textures for the end of the day.'],
  ['col-city-explorer', 'City Explorer', 'city-explorer', 'Practical, polished essentials for moving through the city.'],
  ['col-performance-lab', 'Performance Lab', 'performance-lab', 'Technical pieces tested for movement, recovery, and routine.'],
];

const PRODUCT_KEYS = [
  'id', 'name', 'category', 'brand', 'price', 'compareAtPrice', 'discountPercent',
  'description', 'shortDescription', 'images', 'colors', 'sizes', 'specifications',
  'stock', 'inStock', 'isDemo', 'isNew', 'isBestseller', 'isTrending', 'featured',
  'rating', 'reviewCount', 'tags', 'createdAt', 'collection',
];

const COLLECTION_KEYS = ['id', 'name', 'slug', 'description', 'image', 'productIds', 'isDemo'];

// ---------- deterministic randomness ----------
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle(rng, arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function money(value) {
  return Math.round(value * 100) / 100;
}

function num(value) {
  return Math.round(value * 10) / 10;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- curated product blueprints: name / silhouette / base tags / material ----------
const B = (n, s, t, m) => ({ n, s, t, m });

const BLUEPRINTS = {
  Clothing: [
    B('Atelier Wool Overcoat', 'overcoat', ['outerwear', 'wool'], '80% wool, 20% cashmere'),
    B('Draper Cashmere Blazer', 'blazer', ['tailoring', 'cashmere'], 'brushed cashmere blend'),
    B('Merino Ribbed Sweater', 'sweater', ['knitwear', 'merino'], 'extra-fine merino wool'),
    B('Oxford Poplin Shirt', 'shirt', ['shirting', 'cotton'], 'long-staple cotton poplin'),
    B('Tailored Trench Coat', 'trench', ['outerwear', 'trench'], 'cotton-gabardine with storm flap'),
    B('Studio Relaxed Hoodie', 'hoodie', ['knitwear', 'hoodie'], 'heavyweight loopback cotton'),
    B('Pleated Wool Trousers', 'trousers', ['tailoring', 'trousers'], 'virgin wool with a soft drape'),
    B('Silk Charmeuse Blouse', 'blouse', ['shirting', 'silk'], 'silk charmeuse with a matte sheen'),
    B('Heritage Quilted Jacket', 'quilted', ['outerwear', 'quilted'], 'waxed cotton with diamond quilting'),
    B('Novak Merino Cardigan', 'cardigan', ['knitwear', 'cardigan'], 'merino wool with ribbed trim'),
    B('Sculpted Midi Dress', 'dress', ['dresses', 'tailored'], 'compact wool-viscose crepe'),
    B('Linen Camp Shirt', 'camp', ['shirting', 'linen'], 'washed European linen'),
    B('Technical Shell Anorak', 'anorak', ['outerwear', 'technical'], 'recycled nylon ripstop'),
    B('Alpaca Knit Vest', 'vest', ['knitwear', 'sleeveless'], 'brushed baby alpaca blend'),
  ],
  Shoes: [
    B('Corsica Leather Sneaker', 'sneaker', ['sneakers', 'leather'], 'full-grain Italian leather'),
    B('Atelier Chelsea Boot', 'chelsea', ['boots', 'leather'], 'calfskin with elastic gores'),
    B('Porto Suede Loafer', 'loafer', ['loafers', 'suede'], 'soft suede with a leather lining'),
    B('Meridian Derby Shoe', 'derby', ['dress', 'leather'], 'burnished calf leather'),
    B('Studio Runner', 'runner', ['sneakers', 'technical'], 'engineered mesh and suede'),
    B('Terra Leather Sandal', 'sandal', ['sandals', 'leather'], 'vegetable-tanned leather'),
    B('Nocturne Heeled Ankle Boot', 'heelboot', ['boots', 'heeled'], 'smooth calfskin with a leather sole'),
    B('Court Classic Tennis Shoe', 'tennis', ['sneakers', 'classic'], 'soft-grain leather and canvas'),
    B('Alpine Suede Chukka', 'chukka', ['boots', 'suede'], 'water-resistant suede'),
    B('Verve Leather Mule', 'mule', ['mules', 'leather'], 'lambskin with a covered footbed'),
    B('Drift Canvas Espadrille', 'espadrille', ['casual', 'canvas'], 'cotton canvas with a jute sole'),
    B('Signal Trail Sneaker', 'trail', ['sneakers', 'technical'], 'ripstop nylon with a rubber lug sole'),
    B('Heritage Brogue Oxford', 'oxford', ['dress', 'leather'], 'hand-finished calf leather'),
    B('Forma Minimal Slipper', 'slipper', ['slippers', 'suede'], 'suede with a cushioned insole'),
  ],
  Gaming: [
    B('Arcade Pro Controller', 'controller', ['controllers', 'wireless'], 'textured polymer grips'),
    B('Studio Wireless Headset', 'headset', ['audio', 'wireless'], 'memory-foam ear cushions'),
    B('Nova Compact Keyboard', 'keyboard', ['keyboards', 'mechanical'], 'hot-swappable mechanical switches'),
    B('Vector Gaming Mouse', 'mouse', ['mice', 'wireless'], 'matte magnesium shell'),
    B('Apex Console Edition', 'console', ['consoles', 'home'], 'anodized aluminium chassis'),
    B('Pixel Mechanical Keypad', 'keypad', ['keyboards', 'compact'], 'low-profile mechanical keys'),
    B('Orbit Racing Wheel', 'wheel', ['racing', 'sim'], 'brushed aluminium spokes'),
    B('Rift VR Headset', 'vr', ['vr', 'immersive'], 'soft-touch polymer and foam'),
    B('Titan Docking Station', 'dock', ['accessories', 'docking'], 'aluminium housing with passive cooling'),
    B('Shadow Controller Pad', 'controller2', ['controllers', 'bluetooth'], 'soft-touch wireless shell'),
    B('Spectrum RGB Mousepad', 'mousepad', ['accessories', 'desk'], 'micro-woven cloth with stitched edges'),
    B('Echo Chat Microphone', 'microphone', ['audio', 'streaming'], 'metal body with a shock mount'),
    B('Forge Travel Case', 'case', ['storage', 'travel'], 'moulded shell with a felt interior'),
    B('Grid Streaming Device', 'streamer', ['streaming', 'desk'], 'compact aluminium enclosure'),
  ],
  Electronics: [
    B('Lumen 14 Laptop', 'laptop', ['computers', 'portable'], 'recycled aluminium unibody'),
    B('Forma Smartphone', 'phone', ['mobile', 'smartphone'], 'glass and brushed steel'),
    B('Aura Studio Headphones', 'headphones', ['audio', 'over-ear'], 'anodised aluminium and leather'),
    B('Aperture Mirrorless Camera', 'camera', ['photography', 'mirrorless'], 'magnesium alloy body'),
    B('Solo Bluetooth Speaker', 'speaker', ['audio', 'portable'], 'woven grille and silicone base'),
    B('Slate Wireless Earbuds', 'earbuds', ['audio', 'wireless'], 'matte charging case'),
    B('Frame 27 Monitor', 'monitor', ['displays', 'desk'], 'slim aluminium frame'),
    B('Arc Portable Projector', 'projector', ['video', 'portable'], 'textured polycarbonate shell'),
    B('Pixel Action Camera', 'actioncam', ['photography', 'rugged'], 'waterproof polymer housing'),
    B('Echo Desk Microphone', 'microphone', ['audio', 'studio'], 'brass capsule and steel body'),
    B('Flux Power Bank', 'powerbank', ['power', 'portable'], 'recycled aluminium casing'),
    B('Nimbus Portable SSD', 'ssd', ['storage', 'portable'], 'anodised aluminium enclosure'),
    B('Halo Ring Light', 'ringlight', ['lighting', 'desk'], 'powder-coated steel frame'),
    B('Cove Desk Lamp', 'lamp', ['lighting', 'desk'], 'matte metal with a linen shade'),
  ],
  Watches: [
    B('Meridian Automatic Watch', 'dresswatch', ['automatic', 'dress'], 'self-winding mechanical movement'),
    B('Mariner Dive Watch', 'dive', ['dive', 'sport'], '200m water-resistant case'),
    B('Chrono Field Watch', 'chrono', ['chronograph', 'field'], 'quartz chronograph movement'),
    B('Atelier Skeleton Watch', 'skeleton', ['skeleton', 'automatic'], 'openworked mechanical movement'),
    B('Heritage Pocket Watch', 'pocket', ['heritage', 'pocket'], 'mechanical pocket movement'),
    B('Studio Minimal Watch', 'minimal', ['minimal', 'dress'], 'slim Swiss quartz movement'),
    B('Aviator GMT Watch', 'gmt', ['gmt', 'travel'], 'dual-time automatic movement'),
    B('Nocturne Moonphase Watch', 'moonphase', ['moonphase', 'dress'], 'moonphase automatic movement'),
    B('Vector Sport Watch', 'sportwatch', ['sport', 'rubber'], 'shock-resistant quartz movement'),
    B('Solstice Solar Watch', 'solar', ['solar', 'eco'], 'light-powered quartz movement'),
    B('Vintage Rectangular Watch', 'rectangular', ['vintage', 'dress'], 'rectangular quartz movement'),
    B('Terra Chronograph Watch', 'chrono2', ['chronograph', 'heritage'], 'column-wheel chronograph'),
    B('Echo Smart Watch', 'smartwatch', ['smart', 'digital'], 'AMOLED display with sensor array'),
    B('Eclipse Ceramic Watch', 'ceramic', ['ceramic', 'automatic'], 'scratch-resistant ceramic case'),
  ],
  Accessories: [
    B('Solstice Sunglasses', 'sunglasses', ['eyewear', 'sunglasses'], 'Italian acetate frame'),
    B('Atelier Leather Belt', 'belt', ['belts', 'leather'], 'full-grain bridle leather'),
    B('Cashmere Silk Scarf', 'scarf', ['scarves', 'cashmere'], 'cashmere-silk weave'),
    B('Field Wool Cap', 'cap', ['headwear', 'wool'], 'melton wool with a cotton lining'),
    B('Slim Card Wallet', 'wallet', ['wallets', 'leather'], 'vegetable-tanned card slots'),
    B('Studio Silk Tie', 'tie', ['ties', 'silk'], 'woven mulberry silk'),
    B('Heritage Gloves', 'gloves', ['gloves', 'leather'], 'supple lambskin with cashmere lining'),
    B('Vista Aviator Sunglasses', 'aviator', ['eyewear', 'metal'], 'thin metal frame with glass lenses'),
    B('Orbit Bracelet', 'bracelet', ['jewellery', 'metal'], 'brushed recycled sterling silver'),
    B('Linen Pocket Square', 'square', ['ties', 'linen'], 'hand-rolled linen hem'),
    B('Ridge Beanie', 'beanie', ['headwear', 'knit'], 'ribbed lambswool'),
    B('Flex Reading Glasses', 'glasses', ['eyewear', 'optical'], 'lightweight acetate frame'),
    B('Cove Leather Keyring', 'keyring', ['leather', 'hardware'], 'bridle leather and antique brass'),
    B('Noir Bow Tie', 'bowtie', ['ties', 'silk'], 'self-tie silk faille'),
  ],
  Bags: [
    B('City Tote Bag', 'tote', ['totes', 'leather'], 'structured full-grain leather'),
    B('Atlas Leather Backpack', 'backpack', ['backpacks', 'leather'], 'waxed leather with canvas lining'),
    B('Crossbody Studio Bag', 'crossbody', ['crossbody', 'leather'], 'soft-grained calf leather'),
    B('Weekender Duffel', 'duffel', ['travel', 'duffel'], 'waxed canvas and leather trim'),
    B('Atelier Briefcase', 'briefcase', ['work', 'leather'], 'double-face calf leather'),
    B('Market Canvas Tote', 'totecanvas', ['totes', 'canvas'], 'heavyweight organic canvas'),
    B('Orbit Sling Bag', 'sling', ['crossbody', 'technical'], 'recycled nylon with a leather strap'),
    B('Alpine Rolltop Backpack', 'rolltop', ['backpacks', 'technical'], 'weatherproof recycled fabric'),
    B('Porto Leather Satchel', 'satchel', ['work', 'leather'], 'vegetable-tanned leather'),
    B('Transit Messenger Bag', 'messenger', ['work', 'canvas'], 'waxed canvas with leather binding'),
    B('Cove Bucket Bag', 'bucket', ['handbags', 'leather'], 'soft calfskin with a suede lining'),
    B('Field Utility Belt Bag', 'beltbag', ['utility', 'technical'], 'ripstop nylon with a leather patch'),
    B('Luxe Clutch', 'clutch', ['handbags', 'suede'], 'suede with a silk lining'),
    B('Trail Hiking Pack', 'hiking', ['backpacks', 'outdoor'], 'reinforced ripstop with a rain cover'),
  ],
  Lifestyle: [
    B('Ember Soy Candle', 'candle', ['home', 'fragrance'], 'soy wax with a cotton wick'),
    B('Atelier Ceramic Mug', 'mug', ['kitchen', 'ceramic'], 'stoneware with a matte glaze'),
    B('Still Reed Diffuser', 'diffuser', ['home', 'fragrance'], 'glass vessel with natural reeds'),
    B('Weave Merino Throw', 'throw', ['home', 'textile'], 'brushed merino wool'),
    B('Linen Guest Notebook', 'notebook', ['stationery', 'paper'], 'linen-wrapped cover with cream pages'),
    B('Ritual Tea Set', 'teaset', ['kitchen', 'ceramic'], 'hand-thrown stoneware'),
    B('Forma Ceramic Vase', 'vase', ['home', 'ceramic'], 'wheel-thrown earthenware'),
    B('Studio Scented Candle', 'candle2', ['home', 'fragrance'], 'coconut-soy wax blend'),
    B('Terra Stoneware Bowl', 'bowl', ['kitchen', 'ceramic'], 'reactive-glaze stoneware'),
    B('Archive Leather Journal', 'journal', ['stationery', 'leather'], 'refillable leather cover'),
    B('Linen Table Runner', 'runner', ['home', 'linen'], 'washed Belgian linen'),
    B('Grove Botanical Print', 'print', ['art', 'paper'], 'archival pigment on cotton paper'),
    B('Daily Ritual Tumbler', 'tumbler', ['kitchen', 'steel'], 'double-wall stainless steel'),
    B('Cashmere Eye Mask', 'mask', ['travel', 'cashmere'], 'cashmere facing with a silk backing'),
  ],
  'Sports Products': [
    B('Forge Adjustable Dumbbell', 'dumbbell', ['strength', 'training'], 'cast iron with a rubberised coating'),
    B('Flow Yoga Mat', 'yamat', ['yoga', 'recovery'], 'natural rubber with a microfibre top'),
    B('Apex Training Ball', 'ball', ['training', 'fitness'], 'textured rubber shell'),
    B('Hydro Insulated Bottle', 'bottle', ['hydration', 'outdoor'], 'double-wall vacuum stainless steel'),
    B('Velocity Training Shoe', 'trainingshoe', ['footwear', 'training'], 'engineered mesh with a stable base'),
    B('Studio Resistance Bands', 'bands', ['strength', 'recovery'], 'natural latex with textile sleeves'),
    B('Ridge Trail Shorts', 'shorts', ['apparel', 'outdoor'], 'four-way stretch recycled nylon'),
    B('Pulse Jump Rope', 'rope', ['cardio', 'training'], 'braided cotton rope with aluminium handles'),
    B('Core Kettlebell', 'kettlebell', ['strength', 'training'], 'cast iron with a powder coat'),
    B('Terra Foam Roller', 'roller', ['recovery', 'mobility'], 'high-density EVA foam'),
    B('Grip Weight Plate', 'plate', ['strength', 'training'], 'rubber-coated cast iron'),
    B('Balance Stability Pad', 'pad', ['recovery', 'balance'], 'anti-burst PVC with a non-slip base'),
    B('Motion Compression Tee', 'tee', ['apparel', 'training'], 'moisture-wicking recycled polyester'),
    B('Summit Chalk Bag', 'chalkbag', ['outdoor', 'climbing'], 'waxed canvas with a fleece lining'),
  ],
};

const PALETTES = {
  Clothing: [['Camel', '#B08D57'], ['Charcoal', '#3C3A38'], ['Ivory', '#E8DFD0'], ['Forest', '#3F5B4C'], ['Navy', '#24344A'], ['Ochre', '#B57B36'], ['Slate', '#6E7379'], ['Oxblood', '#6B2F33']],
  Shoes: [['Espresso', '#4A3427'], ['Sand', '#C9AE86'], ['Black', '#242424'], ['Olive', '#4F5D3F'], ['Navy', '#26364A'], ['Cognac', '#A56232'], ['Cream', '#E6DCC8']],
  Gaming: [['Graphite', '#34373B'], ['Midnight', '#1E2430'], ['Silver', '#B8BCC2'], ['Ember', '#B4573A'], ['Cobalt', '#3457A6'], ['Sand', '#D8C6A8']],
  Electronics: [['Graphite', '#3A3D42'], ['Silver', '#C9CDD2'], ['Champagne', '#D9C7A4'], ['Midnight', '#1F2733'], ['Sage', '#7F9485'], ['Sand', '#E4D8C6']],
  Watches: [['Gold', '#C7AD72'], ['Steel', '#B9C0C6'], ['Onyx', '#23262A'], ['Navy', '#263A55'], ['Cognac', '#8A4F2E'], ['Green', '#33513F'], ['Rose', '#B98578']],
  Accessories: [['Tortoise', '#6B4426'], ['Black', '#202124'], ['Camel', '#B08D57'], ['Ivory', '#EDE4D3'], ['Olive', '#566148'], ['Navy', '#26354B'], ['Rose', '#C08C7C']],
  Bags: [['Cognac', '#9B5B31'], ['Black', '#242424'], ['Canvas', '#C6B493'], ['Olive', '#4E5A42'], ['Navy', '#253449'], ['Sand', '#DCCCB0'], ['Taupe', '#8C7B6B']],
  Lifestyle: [['Ivory', '#EAE1D1'], ['Clay', '#B97056'], ['Sage', '#8FA08B'], ['Charcoal', '#3D3B39'], ['Oat', '#D9C9A8'], ['Terracotta', '#B45E43'], ['Ink', '#2C3340']],
  'Sports Products': [['Cobalt', '#2F5AA8'], ['Lime', '#A8B84A'], ['Charcoal', '#33383E'], ['Coral', '#C45F4A'], ['Teal', '#2F7A78'], ['Black', '#222629'], ['Grey', '#8D949B']],
};

const TAG_POOLS = {
  Clothing: ['tailored', 'everyday', 'layer', 'heritage', 'studio', 'soft', 'seasonal'],
  Shoes: ['comfort', 'handcrafted', 'classic', 'city', 'versatile', 'leather'],
  Gaming: ['wireless', 'desk', 'immersive', 'precision', 'compact', 'streaming'],
  Electronics: ['portable', 'minimal', 'wireless', 'studio', 'smart', 'desk'],
  Watches: ['automatic', 'heritage', 'dress', 'water-resistant', 'mechanical', 'everyday'],
  Accessories: ['finishing', 'everyday', 'craft', 'classic', 'soft', 'handmade'],
  Bags: ['carry', 'commute', 'travel', 'structured', 'utility', 'everyday'],
  Lifestyle: ['home', 'ritual', 'gift', 'texture', 'calm', 'artisan'],
  'Sports Products': ['training', 'recovery', 'outdoor', 'movement', 'grip', 'endurance'],
};

const PRICE_RANGES = {
  Clothing: [120, 890],
  Shoes: [95, 540],
  Gaming: [45, 900],
  Electronics: [59, 1200],
  Watches: [180, 1200],
  Accessories: [28, 320],
  Bags: [65, 680],
  Lifestyle: [18, 240],
  'Sports Products': [35, 420],
};

const BRANDS = [
  'TRAPO Atelier', 'TRAPO Atelier', 'TRAPO Studio', 'TRAPO Studio',
  'TRAPO Sport', 'TRAPO Labs', 'TRAPO Heritage',
];

// ---------- editorial copy and specifications ----------
const COPY = {
  Clothing: { unit: 'piece', short: ['a quietly tailored layer', 'an easy everyday essential', 'a considered wardrobe staple'],
    details: ['hand-finished seams', 'a softly structured drape', 'precise topstitching', 'a refined natural hand feel'],
    occasions: ['studio days', 'long evenings out', 'layered weekends', 'the commute'],
    qualities: ['quiet refinement', 'effortless polish', 'understated presence'],
    fits: ['an easy fit', 'a precise cut', 'a relaxed silhouette'] },
  Shoes: { unit: 'pair', short: ['a refined everyday step', 'a quietly polished profile', 'a versatile wardrobe companion'],
    details: ['a cushioned footbed', 'clean welt stitching', 'a softly burnished finish', 'a flexible sole'],
    occasions: ['city days', 'dinner plans', 'slow weekends', 'daily wear'],
    qualities: ['all-day comfort', 'considered craft', 'quiet character'],
    fits: ['a true-to-size fit', 'a generous toe box', 'a streamlined shape'] },
  Gaming: { unit: 'tool', short: ['a precision-built companion', 'a responsive desk essential', 'a considered gaming upgrade'],
    details: ['low-latency response', 'a tactile finish', 'thoughtful cable management', 'a balanced weight'],
    occasions: ['long sessions', 'competitive play', 'a streamlined setup', 'late-night runs'],
    qualities: ['reliable precision', 'immersive control', 'quiet performance'],
    fits: ['a comfortable grip', 'a compact footprint', 'an intuitive layout'] },
  Electronics: { unit: 'device', short: ['a refined daily companion', 'a cleanly designed essential', 'a thoughtful desk upgrade'],
    details: ['a precision-machined housing', 'a softly matte finish', 'carefully tuned acoustics', 'a crisp, detailed display'],
    occasions: ['focused work', 'daily commuting', 'creative sessions', 'quiet evenings'],
    qualities: ['everyday clarity', 'considered engineering', 'effortless reliability'],
    fits: ['a slim profile', 'a balanced form', 'an intuitive interface'] },
  Watches: { unit: 'timepiece', short: ['a refined wrist presence', 'a quietly precise companion', 'a modern heirloom'],
    details: ['a sunbrushed dial', 'polished applied markers', 'a comfortable woven strap', 'a sapphire crystal'],
    occasions: ['everyday wear', 'evening occasions', 'weekend travel', 'the office'],
    qualities: ['timeless precision', 'quiet confidence', 'mechanical character'],
    fits: ['a balanced case', 'a slim wrist profile', 'a secure fit'] },
  Accessories: { unit: 'piece', short: ['a considered finishing touch', 'an everyday detail', 'a quietly refined accent'],
    details: ['a hand-finished edge', 'a soft tactile finish', 'understated hardware', 'a neatly stitched detail'],
    occasions: ['daily wear', 'weekend plans', 'the office', 'evening plans'],
    qualities: ['subtle character', 'practical elegance', 'quiet craft'],
    fits: ['an easy fit', 'a comfortable shape', 'a versatile proportion'] },
  Bags: { unit: 'bag', short: ['a refined everyday carry', 'a beautifully practical shape', 'a polished travel companion'],
    details: ['reinforced seams', 'a soft suede lining', 'a structured base', 'carefully finished hardware'],
    occasions: ['the daily commute', 'weekend trips', 'studio days', 'city exploring'],
    qualities: ['quiet utility', 'considered organisation', 'everyday resilience'],
    fits: ['a roomy interior', 'a balanced silhouette', 'a comfortable strap drop'] },
  Lifestyle: { unit: 'object', short: ['a calm daily ritual', 'a warm home accent', 'a thoughtful little luxury'],
    details: ['a softly textured surface', 'a hand-poured finish', 'a subtle natural fragrance', 'a warm matte glaze'],
    occasions: ['slow mornings', 'quiet evenings', 'a well-set table', 'unhurried weekends'],
    qualities: ['everyday warmth', 'quiet beauty', 'considered simplicity'],
    fits: ['a gentle presence', 'a practical size', 'a balanced proportion'] },
  'Sports Products': { unit: 'essential', short: ['a reliable training partner', 'a considered movement essential', 'a purposeful piece of kit'],
    details: ['a secure, balanced grip', 'a supportive construction', 'a lightweight feel', 'a hard-wearing finish'],
    occasions: ['morning sessions', 'recovery days', 'outdoor training', 'daily movement'],
    qualities: ['steady performance', 'quiet durability', 'thoughtful support'],
    fits: ['a comfortable hold', 'a natural range of motion', 'a secure feel'] },
};

function makeDescription(category, bp, brand, colorName, rng) {
  const c = COPY[category];
  const detail = pick(rng, c.details);
  const occasion = pick(rng, c.occasions);
  const quality = pick(rng, c.qualities);
  const fit = pick(rng, c.fits);
  const tone = colorName.toLowerCase();
  const templates = [
    `The ${bp.n} brings ${bp.m} to ${occasion} with ${detail}. Finished by ${brand} in ${tone}, it pairs ${quality} with ${fit}.`,
    `Designed for ${occasion}, the ${bp.n} uses ${bp.m} and ${detail} to create a ${quality} ${c.unit}. ${brand} adds ${fit} and a ${tone} palette that stays in rotation.`,
    `${brand} crafted the ${bp.n} from ${bp.m} with ${detail}. The result is a ${quality} ${c.unit} for ${occasion}, finished with ${fit} and ${tone} tones.`,
  ];
  return pick(rng, templates);
}

function makeSpecs(category, bp, rng) {
  const material = () => ({ label: 'Material', value: bp.m });
  const origin = () => ({ label: 'Origin', value: pick(rng, ['Made in Portugal', 'Made in Italy', 'Made in Japan', 'Designed in London']) });
  const care = () => ({ label: 'Care', value: pick(rng, ['Spot clean with a soft cloth', 'Hand wash cold, dry flat', 'Professional care recommended', 'Wipe clean with warm water']) });
  const finish = () => ({ label: 'Finish', value: pick(rng, ['Matte', 'Soft-brushed', 'Polished', 'Natural']) });
  const table = {
    Clothing: [material, () => ({ label: 'Fit', value: pick(rng, ['Tailored', 'Relaxed', 'Regular', 'Oversized']) }),
      () => ({ label: 'Closure', value: pick(rng, ['Button front', 'Zip front', 'Pullover', 'Open front']) }),
      () => ({ label: 'Season', value: pick(rng, ['All season', 'Autumn / Winter', 'Spring / Summer']) }), origin],
    Shoes: [material, () => ({ label: 'Outsole', value: pick(rng, ['Leather sole', 'Rubber lug sole', 'Cushioned rubber', 'Jute and rubber']) }),
      () => ({ label: 'Lining', value: pick(rng, ['Full leather', 'Breathable mesh', 'Cotton twill']) }),
      () => ({ label: 'Heel', value: pick(rng, ['10mm flat', '25mm block', '45mm heel', 'Flat']) }), origin],
    Gaming: [material, () => ({ label: 'Connectivity', value: pick(rng, ['Bluetooth 5.2', 'USB-C wired', '2.4GHz wireless', 'USB-A + Bluetooth']) }),
      () => ({ label: 'Battery Life', value: pick(rng, ['Up to 20 hours', 'Up to 30 hours', 'Up to 12 hours', 'Wired power']) }),
      () => ({ label: 'Compatibility', value: pick(rng, ['PC / Console', 'PC / Mobile', 'Multi-platform', 'Windows / macOS']) }),
      () => ({ label: 'Warranty', value: '2 years' })],
    Electronics: [material, () => ({ label: 'Connectivity', value: pick(rng, ['Bluetooth 5.3', 'USB-C', 'Wi-Fi 6 / USB-C', 'Wired 3.5mm']) }),
      () => ({ label: 'Power', value: pick(rng, ['Rechargeable lithium-ion', 'USB-C powered', 'Up to 18 hours', 'Mains powered']) }),
      finish, () => ({ label: 'Warranty', value: '2 years' })],
    Watches: [() => ({ label: 'Movement', value: bp.m }),
      () => ({ label: 'Case', value: pick(rng, ['316L stainless steel', 'Ceramic', 'Brushed titanium', 'Polished steel']) }),
      () => ({ label: 'Diameter', value: pick(rng, ['36mm', '38mm', '40mm', '42mm']) }),
      () => ({ label: 'Water Resistance', value: pick(rng, ['30 metres', '50 metres', '100 metres', '200 metres']) }),
      () => ({ label: 'Crystal', value: 'Sapphire with anti-reflective coating' })],
    Accessories: [material, finish,
      () => ({ label: 'Dimensions', value: pick(rng, ['One size', 'Adjustable', '180 x 30 mm', '210 x 95 mm']) }),
      () => ({ label: 'Hardware', value: pick(rng, ['Antique brass', 'Brushed steel', 'Matte black', 'Polished gold']) }), origin],
    Bags: [material, () => ({ label: 'Capacity', value: pick(rng, ['8 litres', '14 litres', '22 litres', '30 litres']) }),
      () => ({ label: 'Closure', value: pick(rng, ['Zip top', 'Magnetic flap', 'Drawstring', 'Buckle strap']) }),
      () => ({ label: 'Strap', value: pick(rng, ['Adjustable shoulder strap', 'Twin leather handles', 'Padded backpack straps', 'Crossbody webbing']) }),
      () => ({ label: 'Lining', value: pick(rng, ['Cotton twill', 'Suede', 'Recycled nylon', 'None']) })],
    Lifestyle: [material, () => ({ label: 'Scent / Finish', value: pick(rng, ['Cedar & Amber', 'Fig & Moss', 'Unscented', 'Bergamot & Vetiver']) }),
      () => ({ label: 'Dimensions', value: pick(rng, ['95 x 95 x 110 mm', '120 x 180 mm', '250 x 300 mm', 'One size']) }),
      care, origin],
    'Sports Products': [material, () => ({ label: 'Weight', value: pick(rng, ['180 g', '450 g', '1.2 kg', '2.5 kg']) }),
      () => ({ label: 'Intensity', value: pick(rng, ['Light', 'Moderate', 'High', 'Adjustable']) }),
      () => ({ label: 'Grip', value: pick(rng, ['Textured', 'Soft-touch', 'Non-slip', 'Ribbed']) }),
      care],
  };
  return table[category].map((fn) => fn());
}

function sizesFor(category, bp, rng) {
  if (category === 'Clothing') return rng() < 0.25 ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'] : ['XS', 'S', 'M', 'L', 'XL'];
  if (category === 'Shoes') {
    const start = randInt(rng, 38, 41);
    return Array.from({ length: 6 }, (_, k) => String(start + k));
  }
  if (category === 'Gaming' || category === 'Electronics') return rng() < 0.55 ? ['One Size'] : [];
  if (category === 'Watches') return ['One Size'];
  if (category === 'Accessories') {
    return ['belt', 'gloves'].includes(bp.s) ? ['S', 'M', 'L'] : rng() < 0.8 ? ['One Size'] : [];
  }
  if (category === 'Bags') return rng() < 0.75 ? ['One Size'] : [];
  if (category === 'Lifestyle') return rng() < 0.35 ? ['One Size'] : [];
  if (['trainingshoe', 'shorts', 'tee'].includes(bp.s)) {
    return bp.s === 'trainingshoe' ? ['39', '40', '41', '42', '43', '44'] : ['XS', 'S', 'M', 'L', 'XL'];
  }
  return ['One Size'];
}

function makeTags(category, bp, colorName, rng) {
  const materialTag = bp.m.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] || 'craft';
  const extra = pick(rng, TAG_POOLS[category]);
  const all = [...bp.t, extra, materialTag, colorName.toLowerCase().replace(/[^a-z0-9]+/g, '')];
  const unique = [];
  for (const tag of all) {
    const clean = tag.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18);
    if (clean && !unique.includes(clean)) unique.push(clean);
  }
  return unique.slice(0, randInt(rng, 3, Math.min(5, unique.length)));
}

function makeColors(category, rng) {
  return shuffle(rng, PALETTES[category].map(([name, hex]) => ({ name, hex })))
    .slice(0, randInt(rng, 2, 4));
}

// ---------- catalog assembly ----------
function generateProducts() {
  const products = [];
  let globalIndex = 0;
  const anchor = Date.UTC(2026, 10, 20, 12, 0, 0);

  for (const category of CATEGORIES) {
    BLUEPRINTS[category].forEach((bp, index) => {
      const id = `TRP-${CATEGORY_PREFIX[category]}-${String(index + 1).padStart(3, '0')}`;
      const rng = makeRng(SEED ^ hashString(id));
      const brand = pick(rng, BRANDS);
      const colors = makeColors(category, rng);
      const [min, max] = PRICE_RANGES[category];
      const raw = min + rng() * (max - min);
      let price = money(Math.floor(raw) + pick(rng, [0, 0, 0, 0.5, 0.95]));
      price = money(Math.min(max, Math.max(min, price)));

      let compareAtPrice = null;
      if (rng() < 0.35) {
        compareAtPrice = money(price * (1.16 + rng() * 0.42));
        if (compareAtPrice <= price) compareAtPrice = money(price + 25);
      }
      const discountPercent = compareAtPrice === null
        ? 0
        : Math.round((1 - price / compareAtPrice) * 100);

      const gi = globalIndex++;
      const stock = gi % 29 === 0 ? 0 : randInt(rng, 4, 120);
      const created = new Date(anchor - (1 + Math.floor(rng() * 540)) * 86400000 - randInt(rng, 0, 23) * 3600000);

      products.push({
        id,
        name: bp.n,
        category,
        brand,
        price,
        compareAtPrice,
        discountPercent,
        description: makeDescription(category, bp, brand, colors[0].name, rng),
        shortDescription: `${bp.n}: ${pick(rng, COPY[category].short)} in ${colors[0].name.toLowerCase()}.`,
        images: [0, 1, 2].map((v) => `/products/${id}-${['main', 'detail', 'lifestyle'][v]}.svg`),
        colors,
        sizes: sizesFor(category, bp, rng),
        specifications: makeSpecs(category, bp, rng),
        stock,
        inStock: stock > 0,
        isDemo: true,
        isNew: false,
        isBestseller: false,
        isTrending: false,
        featured: false,
        rating: Math.round((3.8 + rng() * 1.2) * 10) / 10,
        reviewCount: randInt(rng, 0, 900),
        tags: makeTags(category, bp, colors[0].name, rng),
        createdAt: created.toISOString(),
        collection: null,
      });
    });
  }

  const flagRng = makeRng(SEED ^ 0x464c47);
  function assignFlag(key, ratio) {
    const count = Math.round(products.length * ratio);
    for (const index of shuffle(flagRng, products.map((_, i) => i)).slice(0, count)) {
      products[index][key] = true;
    }
  }
  assignFlag('isNew', 0.2);
  assignFlag('isBestseller', 0.15);
  assignFlag('isTrending', 0.15);
  assignFlag('featured', 0.15);

  const rng = makeRng(SEED ^ 0x434f4c);
  let assigned = 0;
  for (const product of products) {
    if (rng() < 0.16) continue;
    product.collection = COLLECTION_DEFS[assigned % COLLECTION_DEFS.length][1];
    assigned += 1;
  }
  return products;
}

function buildCollections(products) {
  return COLLECTION_DEFS.map(([id, name, slug, description]) => {
    const productIds = products.filter((p) => p.collection === name).map((p) => p.id);
    return {
      id,
      name,
      slug,
      description,
      image: `/products/${productIds[0]}-main.svg`,
      productIds,
      isDemo: true,
    };
  });
}

// ---------- color helpers ----------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function mix(hexA, hexB, amount) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const p = Math.max(0, Math.min(1, amount));
  const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${toHex(a.r + (b.r - a.r) * p)}${toHex(a.g + (b.g - a.g) * p)}${toHex(a.b + (b.b - a.b) * p)}`;
}

function shade(hex, amount) {
  return amount >= 0 ? mix(hex, '#FFFFFF', amount) : mix(hex, '#000000', -amount);
}

function shadesFor(hex) {
  return {
    base: hex,
    light: shade(hex, 0.26),
    lighter: shade(hex, 0.5),
    dark: shade(hex, -0.25),
    darker: shade(hex, -0.45),
    accent: ACCENT,
    ink: INK,
  };
}

// ---------- tiny SVG shape helpers ----------
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const R = (x, y, w, h, fill, rx = 0, extra = '') =>
  `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${rx ? ` rx="${num(rx)}"` : ''} fill="${fill}" ${extra}/>`;
const C = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill}" ${extra}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="${fill}" ${extra}/>`;
const L = (x1, y1, x2, y2, stroke, width = 3, extra = '') =>
  `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${num(width)}" stroke-linecap="round" ${extra}/>`;
const POLY = (points, fill, extra = '') => `<polygon points="${points}" fill="${fill}" ${extra}/>`;

// ---------- silhouettes: clothing ----------
function clothingSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  const options = {
    overcoat: { len: 760, neck: 'lapel', sleeves: 'long', buttons: 4, pockets: 2, flare: 16 },
    blazer: { len: 646, neck: 'lapel', sleeves: 'long', buttons: 2, pockets: 2, flare: 6 },
    sweater: { len: 626, neck: 'crew', sleeves: 'long', ribs: true, flare: 0 },
    shirt: { len: 652, neck: 'collar', sleeves: 'long', buttons: 6, pockets: 1, flare: 2 },
    trench: { len: 772, neck: 'lapel', sleeves: 'long', buttons: 6, pockets: 2, belt: true, flare: 22 },
    hoodie: { len: 654, neck: 'hood', sleeves: 'long', ribs: true, pockets: 1, flare: 4 },
    blouse: { len: 632, neck: 'tie', sleeves: 'long', buttons: 5, flare: 10 },
    quilted: { len: 646, neck: 'collar', sleeves: 'long', quilt: true, pockets: 2, flare: 8 },
    cardigan: { len: 660, neck: 'v', sleeves: 'long', buttons: 5, pockets: 2, flare: 8 },
    dress: { len: 790, neck: 'collar', sleeves: 'short', buttons: 4, belt: true, flare: 82 },
    camp: { len: 620, neck: 'camp', sleeves: 'short', buttons: 4, pockets: 2, flare: 4 },
    anorak: { len: 692, neck: 'hood', sleeves: 'long', pockets: 1, flare: 10 },
    vest: { len: 610, neck: 'v', sleeves: null, buttons: 5, pockets: 2, flare: 4 },
  };
  const o = options[kind] || options.blazer;
  const hanger = P('M400 166 v20 M400 186 c-22 0 -30 17 -15 28 c9 7 21 3 21 -7', 'none', `stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"`) +
    L(338, 214, 462, 214, ink, 4, 'opacity=".45"');
  let out = hanger;
  if (o.neck === 'hood') {
    out += P('M328 264 Q328 166 400 164 Q472 166 472 264 Q438 236 400 236 Q362 236 328 264 Z', dark);
    out += P('M346 252 Q350 190 400 188 Q450 190 454 252 Q428 230 400 230 Q372 230 346 252 Z', light, 'opacity=".5"');
  }

  const neckW = o.neck === 'v' ? 46 : o.neck === 'camp' ? 58 : 34;
  const shoulderY = 258;
  const hemY = o.len;
  const halfHem = 104 + (o.flare || 0);
  const longSleeve = o.sleeves === 'long';
  const shortSleeve = o.sleeves === 'short';
  const sleeveEndY = longSleeve ? 452 : 352;
  const outerL = !o.sleeves ? 318 : longSleeve ? 232 : 266;
  const outerR = !o.sleeves ? 482 : longSleeve ? 568 : 534;
  const innerL = 302;
  const innerR = 498;
  const bodyPath = !o.sleeves
    ? `M${400 - neckW} ${shoulderY - 6} L318 ${shoulderY} L${400 - halfHem} ${hemY} Q400 ${hemY + 18} ${400 + halfHem} ${hemY} L482 ${shoulderY} L${400 + neckW} ${shoulderY - 6} Q400 ${shoulderY + 38} ${400 - neckW} ${shoulderY - 6} Z`
    : `M${400 - neckW} ${shoulderY - 6} L318 ${shoulderY} L${outerL} ${sleeveEndY} L${outerL + 30} ${sleeveEndY + 24} L${innerL} 420 L${400 - halfHem} ${hemY} Q400 ${hemY + 18} ${400 + halfHem} ${hemY} L${innerR} 420 L${outerR - 30} ${sleeveEndY + 24} L${outerR} ${sleeveEndY} L482 ${shoulderY} L${400 + neckW} ${shoulderY - 6} Q400 ${shoulderY + 38} ${400 - neckW} ${shoulderY - 6} Z`;

  out += P(bodyPath, base, `stroke="${darker}" stroke-width="2"`);
  out += P(`M318 ${shoulderY} L${400 - halfHem} ${hemY} Q400 ${hemY + 18} 400 ${hemY + 9} L400 ${shoulderY + 30} Z`, light, 'opacity=".32"');
  out += P(`M482 ${shoulderY} L${400 + halfHem} ${hemY} Q400 ${hemY + 18} 400 ${hemY + 9} L400 ${shoulderY + 30} Z`, dark, 'opacity=".18"');

  if (o.neck === 'crew') {
    out += P(`M${400 - neckW} ${shoulderY - 6} Q400 ${shoulderY + 42} ${400 + neckW} ${shoulderY - 6}`, 'none', `stroke="${dark}" stroke-width="9"`);
  } else if (o.neck === 'v') {
    out += POLY(`${400 - neckW},${shoulderY - 8} 400,${shoulderY + 78} ${400 + neckW},${shoulderY - 8}`, dark);
    out += POLY(`${400 - neckW + 10},${shoulderY - 4} 400,${shoulderY + 60} ${400 + neckW - 10},${shoulderY - 4}`, lighter, 'opacity=".75"');
  } else if (o.neck === 'lapel') {
    out += POLY(`${400 - neckW},${shoulderY - 8} 338,${shoulderY + 14} 400,${shoulderY + 154} 400,${shoulderY + 40}`, light);
    out += POLY(`${400 + neckW},${shoulderY - 8} 462,${shoulderY + 14} 400,${shoulderY + 154} 400,${shoulderY + 40}`, darker, 'opacity=".85"');
  } else if (o.neck === 'collar' || o.neck === 'camp') {
    out += POLY(`${400 - neckW},${shoulderY - 6} 348,${shoulderY + 16} 398,${shoulderY + 46}`, lighter);
    out += POLY(`${400 + neckW},${shoulderY - 6} 452,${shoulderY + 16} 402,${shoulderY + 46}`, light);
    out += P(`M${400 - neckW} ${shoulderY - 6} Q400 ${shoulderY + 34} ${400 + neckW} ${shoulderY - 6}`, 'none', `stroke="${dark}" stroke-width="6"`);
  } else if (o.neck === 'hood' || o.neck === 'tie') {
    out += P(`M${400 - neckW} ${shoulderY - 6} Q400 ${shoulderY + 40} ${400 + neckW} ${shoulderY - 6}`, 'none', `stroke="${dark}" stroke-width="7"`);
    if (o.neck === 'hood') {
      out += L(372, 296, 364, 420, accent, 4);
      out += L(428, 296, 436, 420, accent, 4);
    }
  }

  if (o.buttons) {
    out += L(400, shoulderY + 72, 400, hemY - 36, darker, 2, 'opacity=".45"');
    for (let i = 0; i < o.buttons; i += 1) {
      const y = shoulderY + 118 + i * Math.min(80, (hemY - shoulderY - 190) / o.buttons);
      if (y < hemY - 44) out += C(408, y, 6, accent, `stroke="${darker}" stroke-width="1"`);
    }
  }
  if (o.pockets) {
    const ys = hemY - 158;
    out += R(326, ys, 58, 46, darker, 4, 'opacity=".3"');
    out += L(322, ys, 388, ys, darker, 3, 'opacity=".5"');
    if (o.pockets > 1) {
      out += R(416, ys, 58, 46, darker, 4, 'opacity=".3"');
      out += L(412, ys, 478, ys, darker, 3, 'opacity=".5"');
    }
  }
  if (o.belt) {
    out += R(300, hemY - 190, 200, 28, dark, 4);
    out += R(386, hemY - 194, 30, 36, accent, 4);
    out += R(394, hemY - 186, 14, 20, dark, 2);
  }
  if (o.quilt) {
    for (let y = shoulderY + 84; y < hemY - 36; y += 52) {
      out += L(316, y, 484, y, darker, 2, 'opacity=".22"');
    }
  }
  if (o.ribs) {
    out += R(400 - halfHem, hemY - 22, halfHem * 2, 26, darker, 4, 'opacity=".55"');
    for (let x = 400 - halfHem + 10; x < 400 + halfHem; x += 14) out += L(x, hemY - 20, x, hemY + 2, dark, 2, 'opacity=".5"');
    for (let x = outerL + 6; x < innerL; x += 14) out += L(x, sleeveEndY + 2, x, sleeveEndY + 22, dark, 2, 'opacity=".5"');
    for (let x = innerR; x < outerR - 4; x += 14) out += L(x, sleeveEndY + 2, x, sleeveEndY + 22, dark, 2, 'opacity=".5"');
  }
  if (kind === 'trousers') {
    out = P('M310 280 L490 280 L474 786 L410 786 L400 470 L390 786 L326 786 Z', base, `stroke="${darker}" stroke-width="2"`);
    out += R(308, 272, 184, 42, dark, 6);
    out += L(400, 318, 400, 470, darker, 2, 'opacity=".55"');
    out += L(352, 330, 342, 770, light, 3, 'opacity=".5"');
    out += L(448, 330, 458, 770, dark, 3, 'opacity=".35"');
    out += R(382, 284, 36, 18, accent, 3);
  }
  return out;
}

// ---------- silhouettes: shoes ----------
function shoeSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  const sole = 'M206 648 Q200 688 242 700 L556 700 Q596 692 588 650 L566 632 L232 632 Z';
  const lowUpper = 'M232 636 Q240 548 322 520 L464 508 Q540 518 568 636 Z';
  let out = '';
  if (['chelsea', 'heelboot', 'chukka', 'trail'].includes(kind)) {
    out += P(sole, dark);
    out += P(`M232 636 Q240 520 306 486 Q330 452 372 452 L424 452 Q462 490 476 530 Q538 552 568 636 Z`, base, `stroke="${darker}" stroke-width="2"`);
    out += P('M306 486 Q330 452 372 452 L424 452 Q462 490 476 530 L444 542 Q420 496 380 492 Q340 500 318 540 Z', light, 'opacity=".4"');
    if (kind === 'chelsea') {
      out += P('M312 496 Q350 476 388 500 L372 590 L316 590 Z', dark, 'opacity=".85"');
      out += P('M444 510 Q468 530 476 560 L446 578 Q438 540 420 522 Z', dark, 'opacity=".7"');
      out += R(352, 440, 26, 22, accent, 8);
    } else if (kind === 'heelboot') {
      out += P('M300 636 L306 470 L344 470 L340 636 Z', darker, 'opacity=".55"');
      out += P('M522 636 Q556 640 578 660 L556 686 Q534 660 506 654 Z', darker);
      out += R(232, 680, 46, 56, dark, 6);
      out += P('M420 468 L436 468 L432 560 L418 560 Z', accent);
    } else if (kind === 'chukka') {
      out += P('M318 510 Q356 492 392 508 L380 580 L320 582 Z', light);
      out += C(342, 526, 6, accent); out += C(372, 522, 6, accent);
      out += L(342, 532, 344, 566, ink, 3); out += L(372, 528, 372, 562, ink, 3);
    } else {
      out += P('M214 654 L232 632 L250 654 L268 632 L286 654 L304 632 L322 654 L340 632 L358 654 L376 632 L394 654 L412 632 L430 654 L448 632 L466 654 L484 632 L502 654 L520 632 L538 654 L556 632 L574 654 L590 648 L588 692 L206 692 Z', darker);
      out += P('M300 490 Q340 460 382 472 L426 486 Q456 510 470 544 L440 556 Q416 512 374 506 Q336 508 318 546 Z', light, 'opacity=".5"');
      out += L(324, 540, 350, 590, accent, 5); out += L(360, 532, 386, 584, accent, 5);
    }
  } else if (kind === 'sandal') {
    out += P('M208 668 Q220 694 258 698 L548 698 Q590 692 584 666 L562 652 L232 652 Z', darker);
    out += P('M236 660 Q242 626 292 620 L520 620 Q558 630 566 660 Z', base, `stroke="${darker}" stroke-width="2"`);
    out += P('M286 624 Q320 566 366 574 L382 624 Z', light, `stroke="${darker}" stroke-width="2"`);
    out += P('M430 622 Q462 580 504 588 L520 632 L492 638 Q470 612 446 632 Z', light, `stroke="${darker}" stroke-width="2"`);
    out += R(322, 646, 74, 16, accent, 6);
  } else if (kind === 'espadrille') {
    out += P('M206 656 Q204 692 248 700 L552 700 Q594 692 586 656 Z', light);
    for (let x = 220; x < 574; x += 22) out += L(x, 662, x + 10, 694, accent, 3, 'opacity=".7"');
    out += P(lowUpper, base, `stroke="${darker}" stroke-width="2"`);
    out += P('M470 580 Q532 596 566 636 L522 640 Q500 604 468 596 Z', lighter, 'opacity=".6"');
    out += L(300, 566, 402, 576, darker, 4); out += L(304, 586, 406, 596, darker, 4);
  } else if (kind === 'slipper' || kind === 'mule') {
    out += P(sole, dark);
    out += P(kind === 'mule'
      ? 'M244 630 Q244 548 330 528 L462 520 Q538 536 566 632 Q470 656 356 652 Q282 650 244 630 Z'
      : 'M228 640 Q236 570 318 548 L468 540 Q540 562 570 640 Q470 668 344 662 Q268 658 228 640 Z', base, `stroke="${darker}" stroke-width="2"`);
    out += P('M452 546 Q520 566 566 632 Q520 646 474 646 Q494 592 452 546 Z', lighter, 'opacity=".55"');
    out += R(330, 560, 96, 26, accent, 12, 'opacity=".85"');
    if (kind === 'slipper') out += C(288, 582, 14, light);
  } else {
    out += P(sole, dark);
    out += P(lowUpper, base, `stroke="${darker}" stroke-width="2"`);
    const isDress = ['derby', 'oxford'].includes(kind);
    if (isDress) {
      out += P('M462 548 Q528 566 566 636 L510 638 Q486 588 452 574 Z', lighter, 'opacity=".5"');
      out += P('M330 528 L420 534 L400 610 L310 604 Z', light, 'opacity=".85"');
      for (let i = 0; i < 4; i += 1) {
        const y = 548 + i * 16;
        out += L(336 + i * 3, y, 404 - i * 2, y + 8, ink, 3);
        out += C(334 + i * 3, y, 3, accent); out += C(406 - i * 2, y + 8, 3, accent);
      }
      if (kind === 'oxford') out += L(330, 622, 486, 628, darker, 2, 'opacity=".45"');
    } else if (kind === 'loafer') {
      out += P('M450 548 Q522 568 566 636 L516 640 Q492 592 450 580 Z', lighter, 'opacity=".55"');
      out += P('M330 540 L410 548 L398 610 L318 600 Z', dark, 'opacity=".85"');
      out += L(344, 568, 392, 574, accent, 4);
      out += P('M262 604 Q356 620 462 616 L460 634 Q352 640 260 622 Z', 'none', `stroke="${darker}" stroke-width="2" opacity=".5"`);
    } else {
      out += P('M470 578 Q532 594 566 636 L518 640 Q496 602 466 594 Z', lighter, 'opacity=".6"');
      out += P(kind === 'runner' || kind === 'trail' || kind === 'tennis' ? 'M312 528 L414 536 L392 616 L296 606 Z' : 'M324 534 L408 542 L390 612 L306 602 Z', light, 'opacity=".9"');
      const laceCount = kind === 'runner' ? 5 : 4;
      for (let i = 0; i < laceCount; i += 1) {
        const y = 548 + i * 15;
        out += L(316 + i * 2, y, 398 - i * 3, y + 9, ink, 4);
      }
      out += P(kind === 'runner'
        ? 'M296 624 Q374 582 520 606 L510 626 Q384 606 302 642 Z'
        : 'M292 618 Q372 580 520 604 L512 622 Q382 602 298 638 Z', accent, 'opacity=".9"');
      if (kind === 'runner') {
        for (let x = 232; x < 566; x += 26) out += L(x, 658, x + 8, 690, darker, 2, 'opacity=".5"');
        out += P('M496 520 Q538 542 560 596 L530 606 Q512 558 482 542 Z', dark, 'opacity=".8"');
      }
      if (kind === 'tennis') out += P('M470 592 Q526 606 562 638 L528 642 Q504 614 466 608 Z', creamSafe(base, lighter), 'opacity=".7"');
    }
  }
  out += E(400, 710, 190, 18, ink, 'opacity=".1"');
  return out;
}

function creamSafe(base, lighter) {
  return lighter;
}

// ---------- silhouettes: gaming ----------
function gamingSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'controller' || kind === 'controller2') {
    const flip = kind === 'controller2';
    out += P(flip
      ? 'M300 360 Q400 330 500 360 Q560 380 556 470 Q552 560 500 620 Q468 656 436 610 Q400 566 364 610 Q332 656 300 620 Q248 560 244 470 Q240 380 300 360 Z'
      : 'M286 380 Q400 340 514 380 Q570 400 566 490 Q562 580 508 630 Q474 662 442 612 Q400 552 358 612 Q326 662 292 630 Q238 580 234 490 Q230 400 286 380 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += E(400, 470, 116, 74, light, 'opacity=".35"');
    out += C(322, 470, 24, dark); out += C(322, 470, 12, lighter);
    out += C(478, 494, 24, dark); out += C(478, 494, 12, lighter);
    out += P('M370 404 L382 404 L382 436 L414 436 L414 448 L382 448 L382 480 L370 480 L370 448 L338 448 L338 436 L370 436 Z', ink);
    out += C(452, 416, 12, accent); out += C(476, 440, 12, accent);
    out += C(428, 440, 12, accent); out += C(452, 464, 12, accent);
    out += C(380, 516, 9, dark); out += C(420, 516, 9, dark);
    out += R(364, 548, 72, 14, darker, 7);
  } else if (kind === 'headset') {
    out += P('M264 500 Q264 288 400 288 Q536 288 536 500 L500 500 Q500 330 400 330 Q300 330 300 500 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(248, 476, 76, 150, dark, 28);
    out += R(476, 476, 76, 150, dark, 28);
    out += R(262, 490, 48, 122, light, 20, 'opacity=".55"');
    out += R(490, 490, 48, 122, light, 20, 'opacity=".55"');
    out += P('M286 610 Q300 690 392 692 L392 668 Q320 662 310 604 Z', 'none', `stroke="${accent}" stroke-width="7"`);
    out += C(396, 690, 14, accent);
  } else if (kind === 'keyboard' || kind === 'keypad') {
    const kx = kind === 'keypad' ? 300 : 208;
    const kw = kind === 'keypad' ? 200 : 384;
    const rows = kind === 'keypad' ? 4 : 5;
    const cols = kind === 'keypad' ? 4 : 14;
    out += R(kx - 16, 404, kw + 32, 264, base, 18, `stroke="${darker}" stroke-width="3"`);
    out += R(kx - 8, 412, kw + 16, 248, light, 12, 'opacity=".35"');
    const gapX = kw / cols;
    const gapY = 244 / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const wide = row === rows - 1 && col === Math.floor(cols / 2);
        out += R(kx + col * gapX + 4, 420 + row * gapY, gapX - 8, gapY - 10, (row + col) % 7 === 0 ? accent : darker, 5, 'opacity=".9"');
        if (wide) out += R(kx + col * gapX + 4, 420 + row * gapY, gapX * 2 - 8, gapY - 10, dark, 5);
      }
    }
    if (kind === 'keyboard') out += R(300, 676, 200, 20, light, 8, 'opacity=".6"');
  } else if (kind === 'mouse') {
    out += E(400, 500, 112, 156, base, `stroke="${darker}" stroke-width="3"`);
    out += L(400, 352, 400, 470, darker, 3, 'opacity=".6"');
    out += R(390, 388, 20, 44, dark, 10);
    out += P('M296 462 Q284 500 300 544 L322 536 Q310 500 320 466 Z', dark, 'opacity=".8"');
    out += P('M400 356 Q446 384 458 452 L404 448 Z', light, 'opacity=".4"');
    out += L(400, 634, 400, 662, accent, 4);
  } else if (kind === 'console') {
    out += R(268, 300, 264, 400, base, 20, `stroke="${darker}" stroke-width="3"`);
    out += R(288, 320, 224, 176, dark, 12);
    out += L(316, 408, 484, 408, accent, 4);
    out += R(302, 528, 196, 14, darker, 6);
    out += C(352, 596, 18, light); out += C(400, 596, 18, light);
    out += R(382, 646, 36, 8, accent, 4);
  } else if (kind === 'wheel') {
    out += C(400, 500, 186, 'none', `stroke="${base}" stroke-width="42"`);
    out += C(400, 500, 186, 'none', `stroke="${darker}" stroke-width="4" opacity=".5"`);
    out += P('M400 500 L244 448 L262 424 L400 474 L538 424 L556 448 Z', base);
    out += P('M372 512 L428 512 L448 654 L352 654 Z', dark);
    out += C(400, 500, 58, dark);
    out += C(400, 500, 30, accent);
    out += R(370, 612, 60, 18, lighter, 6);
  } else if (kind === 'vr') {
    out += R(240, 380, 320, 180, base, 48, `stroke="${darker}" stroke-width="3"`);
    out += R(266, 404, 268, 132, dark, 38);
    out += E(334, 470, 62, 46, light, 'opacity=".5"');
    out += E(466, 470, 62, 46, light, 'opacity=".5"');
    out += P('M244 412 Q180 380 156 428 L182 448 Q204 418 248 442 Z', dark);
    out += P('M556 412 Q620 380 644 428 L618 448 Q596 418 552 442 Z', dark);
    out += L(400, 562, 400, 594, accent, 6);
  } else if (kind === 'soundbar') {
    out += R(176, 452, 448, 118, base, 32, `stroke="${darker}" stroke-width="3"`);
    for (let x = 204; x < 600; x += 16) out += C(x, 500, 3, darker, 'opacity=".45"');
    out += R(360, 570, 80, 16, dark, 6);
    out += L(400, 586, 400, 632, accent, 6);
    out += E(400, 640, 86, 12, dark, 'opacity=".5"');
  } else if (kind === 'dock' || kind === 'streamer') {
    out += R(242, 412, 316, 186, base, 18, `stroke="${darker}" stroke-width="3"`);
    out += R(266, 436, 268, 92, dark, 10);
    out += L(288, 482, 512, 482, accent, 3, 'opacity=".8"');
    out += R(288, 552, 42, 16, lighter, 4);
    out += R(344, 552, 42, 16, lighter, 4);
    out += C(492, 560, 10, accent);
    out += R(360, 598, 80, 16, dark, 6);
  } else if (kind === 'mousepad') {
    out += R(176, 372, 448, 300, base, 24, `stroke="${accent}" stroke-width="3"`);
    out += R(192, 388, 416, 268, dark, 18, 'opacity=".85"');
    for (let x = 210; x < 590; x += 20) out += L(x, 392, x, 652, light, 1, 'opacity=".12"');
    out += E(430, 514, 64, 92, lighter, 'opacity=".28"');
    out += L(430, 448, 430, 494, accent, 3);
  } else if (kind === 'microphone') {
    out += R(352, 314, 96, 214, base, 44, `stroke="${darker}" stroke-width="3"`);
    for (let y = 334; y < 514; y += 14) out += L(364, y, 436, y, darker, 2, 'opacity=".5"');
    out += R(336, 442, 128, 18, accent, 8);
    out += L(400, 528, 400, 664, dark, 10);
    out += E(400, 676, 92, 18, dark);
  } else if (kind === 'case') {
    out += R(224, 408, 352, 216, base, 30, `stroke="${darker}" stroke-width="3"`);
    out += R(240, 424, 320, 184, dark, 22, 'opacity=".9"');
    out += P('M364 408 Q400 372 436 408 L436 430 L364 430 Z', 'none', `stroke="${accent}" stroke-width="9"`);
    out += L(248, 520, 552, 520, accent, 3, 'opacity=".8"');
    out += R(374, 434, 52, 18, lighter, 6);
  }
  out += E(400, 706, 180, 16, ink, 'opacity=".1"');
  return out;
}

// ---------- silhouettes: electronics ----------
function electronicsSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'laptop') {
    out += P('M236 300 L564 300 L584 612 L216 612 Z', dark, `stroke="${darker}" stroke-width="3"`);
    out += P('M250 316 L550 316 L566 588 L234 588 Z', light);
    out += P('M274 342 L526 342 L536 562 L264 562 Z', mix(light, '#27405A', 0.45), 'opacity=".9"');
    out += P('M216 612 L584 612 L626 670 Q400 690 174 670 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(344, 626, 112, 12, darker, 4);
    out += L(324, 650, 476, 650, lighter, 2, 'opacity=".5"');
  } else if (kind === 'phone') {
    out += R(298, 226, 204, 508, base, 34, `stroke="${darker}" stroke-width="3"`);
    out += R(312, 240, 176, 480, dark, 26);
    out += P('M312 272 Q312 240 344 240 L456 240 Q488 240 488 272 Z', mix(dark, '#31506B', 0.5));
    out += R(376, 248, 48, 10, ink, 5);
    out += C(346, 304, 18, darker); out += C(346, 304, 9, accent);
    out += C(346, 348, 18, darker); out += C(346, 348, 9, light);
    out += R(336, 620, 128, 8, light, 4, 'opacity=".6"');
  } else if (kind === 'headphones') {
    out += P('M248 526 Q248 260 400 260 Q552 260 552 526 L508 526 Q508 314 400 314 Q292 314 292 526 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(238, 480, 88, 168, dark, 34);
    out += R(474, 480, 88, 168, dark, 34);
    out += R(252, 496, 60, 136, light, 26, 'opacity=".6"');
    out += R(488, 496, 60, 136, light, 26, 'opacity=".6"');
    out += L(282, 526, 282, 602, accent, 3, 'opacity=".7"');
    out += L(518, 526, 518, 602, accent, 3, 'opacity=".7"');
  } else if (kind === 'camera' || kind === 'actioncam') {
    const small = kind === 'actioncam';
    const x = small ? 272 : 216;
    const w = small ? 256 : 368;
    out += R(x, small ? 400 : 372, w, small ? 208 : 270, base, 22, `stroke="${darker}" stroke-width="3"`);
    out += R(x + 20, small ? 420 : 392, w - 40, 54, dark, 10);
    out += R(x + 40, small ? 574 : 596, 80, 22, lighter, 6);
    if (small) {
      out += C(432, 504, 78, dark); out += C(432, 504, 58, accent);
      out += C(432, 504, 40, '#253E55');
    } else {
      out += C(400, 510, 112, dark); out += C(400, 510, 90, accent);
      out += C(400, 510, 70, '#263F57'); out += C(400, 510, 42, darker);
      out += C(400, 510, 18, light, 'opacity=".8"');
      out += R(488, 404, 60, 28, lighter, 6);
    }
  } else if (kind === 'speaker') {
    out += R(270, 356, 260, 324, base, 46, `stroke="${darker}" stroke-width="3"`);
    out += R(288, 376, 224, 284, dark, 36);
    for (let y = 404; y < 644; y += 24) {
      for (let x = 312; x < 500; x += 24) out += C(x, y, 3, lighter, 'opacity=".45"');
    }
    out += C(400, 462, 46, dark); out += C(400, 462, 28, accent);
    out += R(348, 600, 104, 12, accent, 6);
  } else if (kind === 'earbuds') {
    out += R(298, 470, 204, 154, base, 30, `stroke="${darker}" stroke-width="3"`);
    out += L(400, 474, 400, 620, darker, 2, 'opacity=".5"');
    out += R(382, 520, 36, 10, accent, 5);
    out += C(318, 396, 44, base); out += R(300, 390, 36, 66, base, 18);
    out += C(482, 396, 44, base); out += R(464, 390, 36, 66, base, 18);
    out += C(318, 396, 18, dark); out += C(482, 396, 18, dark);
  } else if (kind === 'monitor') {
    out += R(184, 270, 432, 300, base, 16, `stroke="${darker}" stroke-width="3"`);
    out += R(202, 288, 396, 264, dark, 8);
    out += P('M216 318 L576 318 L560 522 L232 522 Z', mix(dark, '#3C6180', 0.5));
    out += L(400, 570, 400, 646, dark, 16);
    out += P('M328 662 L472 662 L496 684 L304 684 Z', dark);
    out += C(400, 556, 6, accent);
  } else if (kind === 'projector') {
    out += R(236, 400, 328, 210, base, 22, `stroke="${darker}" stroke-width="3"`);
    out += C(466, 504, 62, dark); out += C(466, 504, 42, accent); out += C(466, 504, 26, '#29415C');
    out += R(266, 430, 96, 16, lighter, 6);
    out += P('M236 470 L120 400 L120 620 L236 548 Z', light, 'opacity=".16"');
    out += R(284, 570, 72, 12, darker, 5);
  } else if (kind === 'microphone') {
    out += C(400, 420, 96, base, `stroke="${darker}" stroke-width="3"`);
    for (let x = 336; x < 468; x += 12) out += L(x, 350, x, 490, dark, 2, 'opacity=".35"');
    out += R(360, 500, 80, 34, dark, 10);
    out += L(400, 534, 400, 660, dark, 12);
    out += P('M320 660 Q400 630 480 660 L480 684 L320 684 Z', base, `stroke="${darker}" stroke-width="2"`);
    out += R(372, 360, 56, 12, accent, 6);
  } else if (kind === 'powerbank') {
    out += R(288, 330, 224, 340, base, 28, `stroke="${darker}" stroke-width="3"`);
    out += R(308, 352, 184, 296, light, 18, 'opacity=".5"');
    out += L(400, 400, 400, 604, darker, 3, 'opacity=".5"');
    for (let i = 0; i < 4; i += 1) out += R(330 + i * 38, 584, 26, 8, i < 3 ? accent : darker, 4);
    out += R(368, 338, 64, 10, dark, 4);
  } else if (kind === 'ssd') {
    out += R(244, 432, 312, 146, base, 14, `stroke="${darker}" stroke-width="3"`);
    out += R(262, 450, 276, 110, light, 8, 'opacity=".45"');
    out += R(244, 486, 42, 38, darker, 4);
    out += R(556, 486, 42, 38, darker, 4);
    out += L(300, 518, 500, 518, accent, 3);
    out += C(322, 480, 8, dark);
  } else if (kind === 'ringlight') {
    out += C(400, 424, 158, 'none', `stroke="${base}" stroke-width="48"`);
    out += C(400, 424, 158, 'none', `stroke="${accent}" stroke-width="4" opacity=".6"`);
    out += C(400, 424, 104, 'none', `stroke="${light}" stroke-width="8" opacity=".7"`);
    out += L(400, 584, 400, 700, dark, 12);
    out += E(400, 708, 92, 18, dark);
    out += R(376, 288, 48, 72, dark, 8);
  } else if (kind === 'lamp') {
    out += E(400, 700, 112, 18, dark);
    out += L(400, 694, 400, 520, dark, 14);
    out += L(400, 540, 470, 390, dark, 12);
    out += L(470, 390, 522, 424, dark, 10);
    out += P('M486 400 L586 356 L626 452 L514 470 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += E(554, 464, 66, 16, light, 'opacity=".6"');
    out += C(400, 700, 18, accent);
  }
  out += E(400, 724, 176, 16, ink, 'opacity=".09"');
  return out;
}

// ---------- silhouettes: watches ----------
function watchSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'pocket') {
    out += P('M400 320 Q320 240 246 286 Q188 322 210 388', 'none', `stroke="${accent}" stroke-width="5"`);
    out += C(400, 520, 142, dark, `stroke="${accent}" stroke-width="5"`);
    out += C(400, 520, 116, lighter);
    out += R(382, 346, 36, 42, dark, 8);
    out += C(400, 344, 18, accent);
  } else {
    const strapW = ['sportwatch', 'smartwatch', 'dive'].includes(kind) ? 104 : 82;
    out += R(400 - strapW / 2, 178, strapW, 230, base, 14, `stroke="${darker}" stroke-width="2"`);
    out += R(400 - strapW / 2, 580, strapW, 224, base, 14, `stroke="${darker}" stroke-width="2"`);
    for (let y = 206; y < 400; y += 26) out += L(400 - strapW / 2 + 8, y, 400 + strapW / 2 - 8, y, darker, 1.5, 'opacity=".35"');
    for (let y = 610; y < 790; y += 26) out += L(400 - strapW / 2 + 8, y, 400 + strapW / 2 - 8, y, darker, 1.5, 'opacity=".35"');
    if (kind === 'rectangular') {
      out += R(314, 386, 172, 172, dark, 22, `stroke="${accent}" stroke-width="3"`);
      out += R(332, 404, 136, 136, lighter, 14);
    } else {
      out += C(400, 472, 126, dark, `stroke="${accent}" stroke-width="4"`);
      out += C(400, 472, 106, lighter);
    }
    out += R(520, 452, 22, 38, dark, 6);
    out += L(522, 462, 538, 462, accent, 2);
    out += L(522, 472, 538, 472, accent, 2);
    out += L(522, 482, 538, 482, accent, 2);
  }

  const cx = 400;
  const cy = kind === 'pocket' ? 520 : 472;
  if (kind !== 'smartwatch') {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const r1 = kind === 'rectangular' ? 62 : 88;
      const r2 = r1 - 12;
      out += L(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1,
        cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2,
        i % 3 === 0 ? accent : dark, i % 3 === 0 ? 5 : 3);
    }
    out += L(cx, cy, cx + 42, cy - 48, ink, 5);
    out += L(cx, cy, cx - 34, cy + 30, ink, 6);
    out += C(cx, cy, 7, accent);
  } else {
    out += R(342, 414, 116, 116, '#1C2733', 16);
    out += C(372, 446, 12, accent); out += C(428, 446, 12, light);
    out += R(364, 486, 72, 16, light, 6);
    out += L(400, 402, 400, 386, accent, 3);
  }
  if (kind === 'chrono' || kind === 'chrono2') {
    out += C(cx - 44, cy + 16, 24, darker, `stroke="${accent}" stroke-width="2"`);
    out += C(cx + 44, cy + 16, 24, darker, `stroke="${accent}" stroke-width="2"`);
    out += L(cx - 44, cy + 16, cx - 52, cy + 4, light, 2);
    out += L(cx + 44, cy + 16, cx + 52, cy + 6, light, 2);
  }
  if (kind === 'skeleton') {
    out += C(cx - 40, cy - 18, 26, 'none', `stroke="${dark}" stroke-width="5"`);
    out += C(cx + 42, cy + 24, 20, 'none', `stroke="${dark}" stroke-width="5"`);
    out += C(cx + 18, cy - 46, 14, 'none', `stroke="${dark}" stroke-width="4"`);
  }
  if (kind === 'moonphase') {
    out += P(`M${cx - 36} ${cy + 54} Q${cx} ${cy + 22} ${cx + 36} ${cy + 54} Z`, '#26324B');
    out += C(cx, cy + 48, 11, accent);
  }
  if (kind === 'gmt') {
    out += L(cx, cy, cx - 56, cy - 36, accent, 3);
    out += C(cx - 62, cy - 40, 6, accent);
  }
  if (kind === 'solar' || kind === 'eclipse') {
    out += C(cx, cy, 66, 'none', `stroke="${accent}" stroke-width="2" opacity=".55"`);
    out += C(cx, cy, 46, 'none', `stroke="${accent}" stroke-width="2" opacity=".4"`);
  }
  if (kind === 'dive') {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      out += R(cx + Math.cos(a) * 116 - 5, cy + Math.sin(a) * 116 - 5, 10, 10, i === 0 ? accent : light, 2);
    }
  }
  out += E(400, 816, 150, 14, ink, 'opacity=".08"');
  return out;
}

// ---------- silhouettes: accessories ----------
function accessorySilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'sunglasses' || kind === 'aviator' || kind === 'glasses') {
    const aviator = kind === 'aviator';
    const round = kind === 'glasses';
    const lens = aviator
      ? 'M292 430 Q300 418 344 420 Q378 426 380 470 Q378 536 336 552 Q296 552 288 500 Q284 458 292 430 Z'
      : round
        ? 'M288 466 A68 68 0 1 1 384 466 A68 68 0 1 1 288 466 Z'
        : 'M282 440 Q284 424 306 422 L372 422 Q392 426 390 448 Q386 508 342 516 Q296 512 288 466 Q280 448 282 440 Z';
    const lens2 = lens.replace(/2\d\d|3\d\d|4\d\d/g, (m) => String(Number(m) + 116));
    out += P(lens, dark, `stroke="${base}" stroke-width="8"`);
    out += P(lens2, dark, `stroke="${base}" stroke-width="8"`);
    out += P(lens, mix(dark, '#3E6B83', 0.45), 'opacity=".7"');
    out += P(lens2, mix(dark, '#3E6B83', 0.45), 'opacity=".7"');
    out += P('M390 444 Q400 432 410 444', 'none', `stroke="${base}" stroke-width="8"`);
    out += L(282, 436, 218, 412, base, 10);
    out += L(518, 436, 582, 412, base, 10);
    out += L(300, 440, 334, 434, light, 4, 'opacity=".6"');
  } else if (kind === 'belt') {
    out += P('M214 520 Q400 478 586 520 L586 570 Q400 530 214 570 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M214 520 Q400 478 586 520 L586 532 Q400 492 214 532 Z', light, 'opacity=".45"');
    out += R(352, 496, 96, 96, 'none', `stroke="${accent}" stroke-width="14"`);
    out += L(400, 496, 400, 592, accent, 8);
    for (let x = 236; x < 340; x += 22) out += C(x, 546, 6, darker);
  } else if (kind === 'scarf') {
    out += P('M286 280 Q340 256 400 282 Q462 308 514 280 L544 626 Q470 664 400 632 Q330 664 256 626 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M330 306 Q362 320 400 310 Q440 300 476 312 L492 600 Q446 620 400 606 Q354 620 308 600 Z', light, 'opacity=".4"');
    for (let x = 268; x < 540; x += 16) out += L(x, 622, x - 6, 666, base, 4);
    out += L(320, 380, 480, 380, accent, 3, 'opacity=".7"');
    out += L(316, 560, 484, 560, accent, 3, 'opacity=".7"');
  } else if (kind === 'cap') {
    out += P('M272 500 Q272 322 400 318 Q528 322 528 500 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M272 500 Q400 470 528 500 Q552 506 570 536 Q452 574 306 548 Q272 540 272 500 Z', dark, `stroke="${darker}" stroke-width="2"`);
    out += P('M330 350 Q400 330 470 350 Q452 392 400 398 Q348 392 330 350 Z', light, 'opacity=".5"');
    out += C(400, 316, 14, accent);
    out += L(288, 488, 512, 488, accent, 2, 'opacity=".5"');
  } else if (kind === 'wallet') {
    out += R(268, 398, 264, 240, base, 18, `stroke="${darker}" stroke-width="3"`);
    out += R(284, 414, 232, 208, light, 12, 'opacity=".45"');
    out += P('M268 398 Q400 372 532 398 L532 430 Q400 406 268 430 Z', dark);
    for (let i = 0; i < 4; i += 1) out += R(298 + i * 52, 456, 42, 66, darker, 6, 'opacity=".55"');
    out += R(362, 548, 76, 16, accent, 6);
  } else if (kind === 'tie') {
    out += POLY('366,296 434,296 420,356 400,372 380,356', base, `stroke="${darker}" stroke-width="2"`);
    out += P('M380 360 L420 360 L460 660 L400 704 L340 660 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M400 372 L420 360 L460 660 L400 700 Z', dark, 'opacity=".28"');
    for (let y = 430; y < 640; y += 52) out += L(372 + (y - 430) * 0.12, y, 428 - (y - 430) * 0.12, y, accent, 3, 'opacity=".6"');
  } else if (kind === 'gloves') {
    out += P('M282 640 Q264 520 288 452 Q302 414 322 424 Q336 434 332 468 L334 372 Q336 350 354 352 Q372 354 370 376 L370 456 L376 360 Q380 340 398 342 Q414 344 412 366 L408 470 L420 388 Q426 368 442 372 Q458 378 450 400 L432 504 Q428 622 400 660 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M420 656 Q414 536 442 470 Q456 438 476 448 Q490 458 486 492 L488 396 Q490 376 506 378 Q522 380 520 400 L520 480 L526 384 Q530 364 546 366 Q562 368 560 390 L556 494 L568 412 Q574 394 588 398 Q602 404 596 424 L578 528 Q574 646 546 672 Z', light, `stroke="${darker}" stroke-width="3"`);
    out += R(296, 626, 92, 24, darker, 8);
  } else if (kind === 'bracelet') {
    out += C(400, 500, 142, 'none', `stroke="${base}" stroke-width="30"`);
    out += C(400, 500, 142, 'none', `stroke="${accent}" stroke-width="4" opacity=".7"`);
    out += C(400, 356, 22, accent); out += R(386, 350, 28, 52, lighter, 8);
    out += C(538, 500, 18, light); out += C(400, 642, 14, dark);
  } else if (kind === 'square') {
    out += P('M300 420 L500 420 L480 612 L320 612 Z', base, `stroke="${darker}" stroke-width="2"`);
    out += POLY('300,420 400,498 500,420', light);
    out += POLY('320,612 400,498 480,612', lighter, 'opacity=".7"');
    out += L(300, 420, 500, 420, accent, 3);
  } else if (kind === 'beanie') {
    out += P('M282 510 Q282 318 400 314 Q518 318 518 510 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(278, 496, 244, 96, dark, 16);
    for (let x = 292; x < 516; x += 16) out += L(x, 502, x, 586, lighter, 2, 'opacity=".45"');
    out += C(400, 322, 14, accent);
  } else if (kind === 'keyring') {
    out += C(330, 360, 62, 'none', `stroke="${accent}" stroke-width="12"`);
    out += P('M370 400 L404 434 L388 450 L354 416 Z', lighter);
    out += R(392, 446, 24, 172, base, 8);
    out += R(380, 610, 52, 18, dark, 6);
    out += P('M452 520 L558 520 L558 618 L506 650 L452 618 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += L(470, 552, 540, 552, accent, 4);
  } else if (kind === 'bowtie') {
    out += P('M400 500 L280 430 L280 570 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M400 500 L520 430 L520 570 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M400 500 L296 452 L296 548 Z', dark, 'opacity=".3"');
    out += P('M400 500 L504 452 L504 548 Z', dark, 'opacity=".3"');
    out += R(378, 466, 44, 68, accent, 10);
  }
  out += E(400, 716, 172, 14, ink, 'opacity=".08"');
  return out;
}

// ---------- silhouettes: bags ----------
function bagSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (['tote', 'totecanvas'].includes(kind)) {
    out += P('M262 396 L538 396 L574 686 Q400 716 226 686 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P(kind === 'tote'
      ? 'M330 400 Q330 296 400 296 Q470 296 470 400 L446 400 Q446 324 400 324 Q354 324 354 400 Z'
      : 'M326 400 Q326 288 400 288 Q474 288 474 400 L452 400 Q452 316 400 316 Q348 316 348 400 Z', 'none', `stroke="${dark}" stroke-width="20"`);
    out += P('M262 396 L538 396 L532 428 L268 428 Z', dark, 'opacity=".7"');
    out += R(370, 552, 60, 20, accent, 6);
    if (kind === 'totecanvas') {
      for (let x = 276; x < 528; x += 24) out += L(x, 452, x + 8, 670, lighter, 2, 'opacity=".25"');
    }
  } else if (['backpack', 'rolltop', 'hiking'].includes(kind)) {
    const tall = kind === 'hiking' ? 570 : kind === 'rolltop' ? 540 : 520;
    out += P(`M278 ${700 - tall} Q278 ${210 - (tall - 520)} 400 ${200 - (tall - 520)} Q522 ${210 - (tall - 520)} 522 ${700 - tall} L534 682 Q400 716 266 682 Z`, base, `stroke="${darker}" stroke-width="3"`);
    out += P('M310 520 Q310 356 400 350 Q490 356 490 520 L490 616 Q400 644 310 616 Z', dark, 'opacity=".22"');
    out += R(320, 540, 160, 112, light, 14, `stroke="${darker}" stroke-width="2"`);
    out += L(340, 584, 460, 584, accent, 4);
    out += P('M336 300 Q336 220 400 220 Q464 220 464 300 L444 302 Q444 244 400 244 Q356 244 356 302 Z', 'none', `stroke="${dark}" stroke-width="14"`);
    if (kind === 'rolltop') {
      out += R(284, 258, 232, 46, dark, 16);
      out += R(330, 296, 28, 30, accent, 5); out += R(442, 296, 28, 30, accent, 5);
    }
    if (kind === 'hiking') {
      out += R(290, 400, 46, 180, darker, 14); out += R(464, 400, 46, 180, darker, 14);
      out += R(336, 660, 128, 26, accent, 8);
    }
  } else if (['duffel', 'beltbag'].includes(kind)) {
    const duffel = kind === 'duffel';
    const y = duffel ? 440 : 520;
    const h = duffel ? 230 : 130;
    out += P(`M228 ${y + h / 2} Q230 ${y} 400 ${y} Q570 ${y} 572 ${y + h / 2} Q570 ${y + h} 400 ${y + h} Q230 ${y + h} 228 ${y + h / 2} Z`, base, `stroke="${darker}" stroke-width="3"`);
    out += P(`M320 ${y} Q320 ${y - 76} 400 ${y - 76} Q480 ${y - 76} 480 ${y} L456 ${y} Q456 ${y - 50} 400 ${y - 50} Q344 ${y - 50} 344 ${y} Z`, 'none', `stroke="${dark}" stroke-width="14"`);
    out += L(240, y + h / 2, 560, y + h / 2, dark, 8, 'opacity=".7"');
    out += R(372, y + h / 2 - 18, 56, 36, accent, 6);
    if (duffel) out += R(264, y + 40, 272, 12, lighter, 5, 'opacity=".6"');
  } else if (['crossbody', 'sling', 'messenger', 'satchel'].includes(kind)) {
    const y = kind === 'satchel' ? 430 : 452;
    const h = kind === 'satchel' ? 210 : 190;
    out += P(`M360 ${y} L440 ${y} L440 ${y + 30} L560 ${kind === 'sling' ? 500 : 620} L542 ${kind === 'sling' ? 526 : 640} L440 ${y + h} L360 ${y + h} L258 ${kind === 'sling' ? 526 : 640} L240 ${kind === 'sling' ? 500 : 620} L360 ${y + 30} Z`, 'none', `stroke="${dark}" stroke-width="18"`);
    out += R(242, y, 316, h, base, 18, `stroke="${darker}" stroke-width="3"`);
    out += P(`M242 ${y} Q400 ${y - 38} 558 ${y} L558 ${y + 62} Q400 ${y + 100} 242 ${y + 62} Z`, dark, 'opacity=".85"');
    out += R(374, y + 58, 52, 32, accent, 6);
    if (kind === 'messenger') out += R(268, y + 122, 264, 10, lighter, 4, 'opacity=".6"');
  } else if (['briefcase', 'clutch'].includes(kind)) {
    const y = kind === 'briefcase' ? 420 : 480;
    const h = kind === 'briefcase' ? 230 : 150;
    out += R(238, y, 324, h, base, 14, `stroke="${darker}" stroke-width="3"`);
    out += R(256, y + 18, 288, h - 36, light, 8, 'opacity=".4"');
    if (kind === 'briefcase') {
      out += P('M356 420 Q356 358 400 358 Q444 358 444 420 L424 420 Q424 382 400 382 Q376 382 376 420 Z', 'none', `stroke="${dark}" stroke-width="14"`);
      out += R(300, 448, 40, 22, accent, 5); out += R(460, 448, 40, 22, accent, 5);
    } else {
      out += P(`M238 ${y} L400 ${y + 74} L562 ${y} L562 ${y + 22} L400 ${y + 96} L238 ${y + 22} Z`, dark, 'opacity=".8"');
      out += C(400, y + 74, 9, accent);
    }
  } else if (kind === 'bucket') {
    out += P('M300 390 L500 390 L548 682 Q400 716 252 682 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += L(300, 390, 500, 390, dark, 12);
    out += P('M330 390 Q330 286 400 286 Q470 286 470 390 L448 390 Q448 312 400 312 Q352 312 352 390 Z', 'none', `stroke="${accent}" stroke-width="10"`);
    out += R(372, 520, 56, 20, dark, 8);
    out += P('M276 560 Q400 596 524 560 L520 586 Q400 620 280 586 Z', light, 'opacity=".4"');
  }
  out += E(400, 716, 178, 16, ink, 'opacity=".09"');
  return out;
}

// ---------- silhouettes: lifestyle ----------
function lifestyleSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'candle' || kind === 'candle2') {
    out += R(300, 430, 200, 244, base, 20, `stroke="${darker}" stroke-width="3"`);
    out += R(314, 444, 172, 92, lighter, 12);
    out += R(314, 536, 172, 122, light, 4, 'opacity=".7"');
    out += L(400, 444, 400, 408, ink, 5);
    out += P('M400 408 Q372 374 400 336 Q428 374 400 408 Z', accent);
    out += R(336, 600, 128, 34, dark, 6, 'opacity=".7"');
    out += R(356, 448, 88, 22, 'none', `stroke="${dark}" stroke-width="2" opacity=".45"`);
  } else if (kind === 'mug' || kind === 'tumbler') {
    const tumbler = kind === 'tumbler';
    out += tumbler ? R(322, 372, 156, 306, base, 22, `stroke="${darker}" stroke-width="3"`)
      : P('M306 420 L494 420 L476 670 Q400 694 324 670 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(322, 388, 156, 26, dark, 10);
    if (tumbler) {
      out += L(434, 336, 458, 246, accent, 10);
      out += R(316, 374, 168, 20, darker, 8);
    } else {
      out += P('M494 466 Q562 452 560 522 Q558 586 488 582 L488 552 Q528 556 530 520 Q532 488 494 496 Z', 'none', `stroke="${base}" stroke-width="18"`);
      out += P('M356 350 Q336 318 360 286 Q380 260 366 230', 'none', `stroke="${accent}" stroke-width="4" opacity=".6"`);
      out += P('M418 348 Q398 316 422 284 Q442 258 428 228', 'none', `stroke="${accent}" stroke-width="4" opacity=".5"`);
    }
    out += R(344, 540, 112, 12, lighter, 5, 'opacity=".6"');
  } else if (kind === 'diffuser') {
    out += R(340, 490, 120, 184, base, 16, `stroke="${darker}" stroke-width="3"`);
    out += R(356, 508, 88, 148, light, 10, 'opacity=".55"');
    out += R(364, 462, 72, 34, dark, 8);
    for (let i = 0; i < 7; i += 1) {
      const x = 356 + i * 15;
      out += L(x, 464, x - 24 + i * 8, 300 + (i % 3) * 18, accent, 4);
    }
    out += R(360, 636, 80, 14, darker, 6);
  } else if (kind === 'throw' || kind === 'runner') {
    out += P('M240 400 Q400 362 560 400 L578 662 Q400 700 222 662 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M240 400 Q400 448 560 400 L562 452 Q400 500 238 452 Z', light, 'opacity=".5"');
    for (let x = 250; x < 560; x += 26) out += L(x, 462, x + 4, 656, darker, 2, 'opacity=".2"');
    for (let x = 232; x < 576; x += 14) out += L(x, 662, x - 4, 700, base, 4);
    out += L(268, 544, 532, 544, accent, 3, 'opacity=".7"');
  } else if (['notebook', 'journal', 'print'].includes(kind)) {
    out += R(258, 356, 284, 324, base, 10, `stroke="${darker}" stroke-width="3"`);
    out += R(274, 372, 252, 292, light, 6, 'opacity=".45"');
    if (kind === 'notebook' || kind === 'journal') {
      out += R(250, 356, 16, 324, dark, 4);
      out += R(374, 356, 14, 324, accent, 3);
      out += L(300, 456, 500, 456, darker, 3, 'opacity=".5"');
      out += L(300, 500, 470, 500, darker, 3, 'opacity=".5"');
    } else {
      out += R(276, 374, 248, 288, lighter, 4, `stroke="${dark}" stroke-width="3"`);
    }
    out += R(292, 594, 216, 12, dark, 6, 'opacity=".55"');
  } else if (kind === 'teaset') {
    out += P('M300 500 Q300 418 400 416 Q500 418 500 500 L500 590 Q400 618 300 590 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M500 478 Q566 462 560 528 Q554 578 506 570 L506 544 Q534 548 536 522 Q538 500 500 506 Z', 'none', `stroke="${base}" stroke-width="16"`);
    out += P('M300 470 Q254 434 286 404 Q312 380 332 420', 'none', `stroke="${base}" stroke-width="16"`);
    out += C(400, 410, 20, dark);
    out += R(316, 598, 168, 34, dark, 10);
    out += C(336, 636, 26, lighter); out += C(400, 640, 26, lighter); out += C(464, 636, 26, lighter);
  } else if (kind === 'vase' || kind === 'bowl') {
    if (kind === 'vase') {
      out += P('M356 416 L444 416 Q444 470 486 520 Q526 570 500 654 Q400 692 300 654 Q274 570 314 520 Q356 470 356 416 Z', base, `stroke="${darker}" stroke-width="3"`);
      out += R(350, 396, 100, 26, dark, 8);
      out += L(400, 396, 400, 300, accent, 4);
      out += P('M400 348 Q356 306 350 260', 'none', `stroke="${dark}" stroke-width="4"`);
      out += E(344, 258, 18, 34, light);
      out += P('M400 330 Q444 292 460 250', 'none', `stroke="${dark}" stroke-width="4"`);
      out += E(466, 248, 18, 34, light);
    } else {
      out += P('M254 500 Q266 630 400 652 Q534 630 546 500 Z', base, `stroke="${darker}" stroke-width="3"`);
      out += E(400, 500, 146, 42, lighter, `stroke="${darker}" stroke-width="2"`);
      out += E(400, 500, 108, 26, dark, 'opacity=".35"');
    }
  } else if (kind === 'mask') {
    out += P('M262 440 Q334 400 400 430 Q466 400 538 440 Q528 552 466 578 Q432 592 400 566 Q368 592 334 578 Q272 552 262 440 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += L(262, 452, 214, 432, dark, 10); out += L(538, 452, 586, 432, dark, 10);
    out += P('M300 466 Q338 448 372 466 Q334 486 300 466 Z', dark);
    out += P('M428 466 Q462 448 500 466 Q466 486 428 466 Z', dark);
  }
  out += E(400, 716, 170, 14, ink, 'opacity=".08"');
  return out;
}

// ---------- silhouettes: sports products ----------
function sportSilhouette(kind, c) {
  const { base, light, lighter, dark, darker, accent, ink } = c;
  let out = '';
  if (kind === 'dumbbell' || kind === 'plate') {
    if (kind === 'dumbbell') {
      out += R(300, 476, 200, 48, lighter, 10);
      out += R(232, 416, 72, 168, dark, 14); out += R(496, 416, 72, 168, dark, 14);
      out += R(210, 440, 34, 120, base, 12); out += R(556, 440, 34, 120, base, 12);
      out += L(324, 492, 476, 492, accent, 4);
    } else {
      out += C(400, 500, 168, dark);
      out += C(400, 500, 142, base);
      out += C(400, 500, 52, dark);
      out += C(400, 500, 34, lighter);
      out += C(400, 500, 122, 'none', `stroke="${accent}" stroke-width="3" opacity=".6"`);
    }
  } else if (kind === 'yamat') {
    out += P('M268 420 L552 420 Q574 420 574 444 L574 628 Q574 652 552 652 L268 652 Q246 652 246 628 L246 444 Q246 420 268 420 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += E(552, 536, 46, 116, dark);
    out += E(552, 536, 30, 98, base);
    out += L(280, 470, 520, 470, accent, 4, 'opacity=".7"');
    out += R(320, 570, 160, 16, dark, 8);
  } else if (kind === 'ball') {
    out += C(400, 500, 158, base, `stroke="${darker}" stroke-width="3"`);
    out += P('M400 342 Q340 440 400 658', 'none', `stroke="${dark}" stroke-width="5"`);
    out += P('M400 342 Q460 440 400 658', 'none', `stroke="${dark}" stroke-width="5"`);
    out += E(400, 500, 158, 54, 'none', `stroke="${dark}" stroke-width="4"`);
    out += E(400, 500, 52, 158, 'none', `stroke="${dark}" stroke-width="4"`);
    out += C(400, 500, 22, accent);
  } else if (kind === 'bottle') {
    out += R(354, 316, 92, 64, dark, 12);
    out += R(348, 372, 104, 34, lighter, 8);
    out += P('M348 406 L452 406 Q470 406 470 432 L470 652 Q400 680 330 652 L330 432 Q330 406 348 406 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(346, 476, 108, 96, light, 8, 'opacity=".5"');
    out += L(368, 522, 432, 522, accent, 5);
  } else if (kind === 'trainingshoe') {
    out += shoeSilhouette('runner', c);
  } else if (kind === 'bands') {
    out += C(318, 500, 90, 'none', `stroke="${base}" stroke-width="24"`);
    out += C(482, 500, 90, 'none', `stroke="${light}" stroke-width="24"`);
    out += C(400, 626, 66, 'none', `stroke="${dark}" stroke-width="20"`);
    out += L(318, 590, 318, 624, accent, 4);
  } else if (kind === 'shorts' || kind === 'tee') {
    out += clothingSilhouette(kind === 'tee' ? 'camp' : 'camp', c);
    if (kind === 'shorts') {
      out = P('M304 330 L496 330 L486 520 L416 520 L400 430 L384 520 L314 520 Z', base, `stroke="${darker}" stroke-width="3"`);
      out += R(302, 322, 196, 36, dark, 8);
      out += L(400, 362, 400, 430, accent, 3);
    }
  } else if (kind === 'rope') {
    out += P('M288 396 Q400 590 512 396', 'none', `stroke="${accent}" stroke-width="9"`);
    out += R(258, 300, 54, 152, base, 18);
    out += R(488, 300, 54, 152, base, 18);
    out += R(266, 316, 38, 16, dark, 6); out += R(496, 316, 38, 16, dark, 6);
    out += E(400, 612, 122, 16, ink, 'opacity=".08"');
  } else if (kind === 'kettlebell') {
    out += P('M344 420 Q344 344 400 344 Q456 344 456 420 L440 428 Q432 372 400 372 Q368 372 360 428 Z', 'none', `stroke="${dark}" stroke-width="20"`);
    out += P('M312 452 Q312 416 400 416 Q488 416 488 452 Q512 540 492 622 Q400 660 308 622 Q288 540 312 452 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += R(356, 596, 88, 22, dark, 8);
    out += L(400, 452, 400, 590, accent, 4, 'opacity=".7"');
  } else if (kind === 'roller') {
    out += E(400, 500, 160, 104, base, `stroke="${darker}" stroke-width="3"`);
    out += E(240, 500, 38, 104, dark);
    out += E(560, 500, 38, 104, dark);
    out += E(560, 500, 22, 78, lighter, 'opacity=".7"');
    for (let x = 280; x < 540; x += 24) out += L(x, 430, x + 8, 570, darker, 2, 'opacity=".25"');
  } else if (kind === 'pad') {
    out += E(400, 632, 166, 34, dark);
    out += P('M254 632 Q262 438 400 438 Q538 438 546 632 Q400 666 254 632 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += E(400, 472, 82, 30, light, 'opacity=".5"');
    out += C(400, 560, 16, accent);
  } else if (kind === 'chalkbag') {
    out += P('M308 444 Q400 414 492 444 L512 640 Q400 680 288 640 Z', base, `stroke="${darker}" stroke-width="3"`);
    out += P('M308 444 Q400 402 492 444 L486 470 Q400 440 314 470 Z', dark);
    out += R(376, 552, 48, 22, accent, 8);
    out += L(476, 470, 518, 610, dark, 8);
    out += P('M512 604 L534 600 L540 660 L518 664 Z', lighter);
  }
  out += E(400, 716, 170, 14, ink, 'opacity=".08"');
  return out;
}

// ---------- artwork assembly ----------
function blueprintFor(product) {
  const index = Number(product.id.slice(-3)) - 1;
  return BLUEPRINTS[product.category][index];
}

function silhouetteFor(product) {
  const kind = blueprintFor(product).s;
  const c = shadesFor(product.colors[0].hex);
  if (product.category === 'Clothing') return clothingSilhouette(kind, c);
  if (product.category === 'Shoes') return shoeSilhouette(kind, c);
  if (product.category === 'Gaming') return gamingSilhouette(kind, c);
  if (product.category === 'Electronics') return electronicsSilhouette(kind, c);
  if (product.category === 'Watches') return watchSilhouette(kind, c);
  if (product.category === 'Accessories') return accessorySilhouette(kind, c);
  if (product.category === 'Bags') return bagSilhouette(kind, c);
  if (product.category === 'Lifestyle') return lifestyleSilhouette(kind, c);
  return sportSilhouette(kind, c);
}

function makeSvg(product, view, silhouette) {
  const rng = makeRng(SEED ^ hashString(`${product.id}:${view}`));
  const color = product.colors[0].hex;
  const uid = `${product.id}-${view}`.toLowerCase();
  const isDetail = view === 'detail';
  const isLifestyle = view === 'lifestyle';
  const bgA = mix(color, CREAM, isDetail ? 0.78 : isLifestyle ? 0.9 : 0.86);
  const bgB = mix(color, '#E6DCCB', isDetail ? 0.68 : isLifestyle ? 0.88 : 0.74);
  const spotX = 340 + Math.round(rng() * 120);
  const spotY = 360 + Math.round(rng() * 100);
  const accent = ACCENT;

  let transform;
  if (isDetail) {
    const scale = 1.46 + rng() * 0.14;
    const tx = 400 - 400 * scale + (rng() * 30 - 15);
    const ty = 500 - 500 * scale + (rng() * 24 - 12);
    transform = `translate(${num(tx)} ${num(ty)}) scale(${scale.toFixed(3)})`;
  } else if (isLifestyle) {
    const scale = 0.68 + rng() * 0.1;
    const tx = 400 - 400 * scale + 54 + rng() * 28;
    const ty = 500 - 500 * scale + 30 + rng() * 22;
    transform = `translate(${num(tx)} ${num(ty)}) scale(${scale.toFixed(3)})`;
  } else {
    transform = `rotate(${(rng() * 4 - 2).toFixed(1)} 400 520)`;
  }

  let decor = '';
  if (isDetail) {
    decor += `<path d="M0 830 L800 190 L800 1000 L0 1000 Z" fill="${accent}" opacity=".055"/>`;
    decor += C(694, 206, 96, 'none', `stroke="${accent}" stroke-width="2" opacity=".35"`);
    decor += L(84, 790, 716, 790, INK, 1, 'opacity=".12"');
  } else if (isLifestyle) {
    const word = product.category.toUpperCase();
    const fontSize = word.length > 12 ? 74 : 104;
    decor += `<text x="400" y="556" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" letter-spacing="4" fill="${INK}" opacity=".055">${esc(word)}</text>`;
    decor += `<path d="M96 820 A304 304 0 0 1 704 820" fill="none" stroke="${accent}" stroke-width="2" opacity=".4"/>`;
    decor += `<path d="M150 820 A250 250 0 0 1 650 820" fill="none" stroke="${accent}" stroke-width="1.5" opacity=".3"/>`;
    decor += C(160, 300, 58, 'none', `stroke="${accent}" stroke-width="2" opacity=".35"`);
    decor += C(660, 250, 34, 'none', `stroke="${INK}" stroke-width="2" opacity=".15"`);
    decor += L(96, 690, 250, 690, accent, 2, 'opacity=".45"');
    decor += L(550, 730, 704, 730, accent, 2, 'opacity=".45"');
  } else {
    decor += `<path d="M132 826 A268 268 0 0 1 668 826" fill="none" stroke="${accent}" stroke-width="2" opacity=".22"/>`;
    decor += L(84, 160, 84, 840, INK, 1, 'opacity=".09"');
    decor += L(716, 160, 716, 840, INK, 1, 'opacity=".09"');
    decor += C(690, 780, 12, accent, 'opacity=".35"');
    decor += C(112, 236, 8, accent, 'opacity=".3"');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${esc(product.name)}">
<defs>
<linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient>
<radialGradient id="${uid}-spot"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".68"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="${uid}-shadow"><stop offset="0" stop-color="${INK}" stop-opacity=".2"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></radialGradient>
<pattern id="${uid}-grain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".5" fill="${INK}" opacity=".07"/><circle cx="5" cy="4" r=".35" fill="${accent}" opacity=".11"/></pattern>
</defs>
<rect width="800" height="1000" fill="url(#${uid}-bg)"/>
<circle cx="${spotX}" cy="${spotY}" r="372" fill="url(#${uid}-spot)"/>
<rect width="800" height="1000" fill="url(#${uid}-grain)" opacity=".7"/>
${decor}
<ellipse cx="400" cy="826" rx="216" ry="30" fill="url(#${uid}-shadow)"/>
<g transform="${transform}">${silhouette}</g>
<text x="58" y="72" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" letter-spacing="8" fill="${INK}" opacity=".88">TRAPO</text>
<text x="742" y="70" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" letter-spacing="3" fill="${INK}" opacity=".66">${esc(product.category.toUpperCase())}</text>
<text x="58" y="948" font-family="Arial, Helvetica, sans-serif" font-size="13" letter-spacing="3" fill="${INK}" opacity=".5">${esc(product.id)} · EDITION 01</text>
<line x1="58" y1="958" x2="742" y2="958" stroke="${INK}" stroke-width="1" opacity=".16"/>
</svg>
`;
}

function writeProductsAndArtwork(products) {
  for (const dir of [PATHS.productsDir, PATHS.brandDir, PATHS.serverUploadDir,
    path.dirname(PATHS.clientProducts), path.dirname(PATHS.serverProducts),
    path.dirname(PATHS.clientCollections), path.dirname(PATHS.serverCollections)]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const expected = new Set();
  let maxSvg = 0;
  for (const product of products) {
    const silhouette = silhouetteFor(product);
    for (const view of ['main', 'detail', 'lifestyle']) {
      const file = path.join(PATHS.productsDir, `${product.id}-${view}.svg`);
      expected.add(path.basename(file));
      const svg = makeSvg(product, view, silhouette);
      const bytes = Buffer.byteLength(svg, 'utf8');
      maxSvg = Math.max(maxSvg, bytes);
      if (bytes > MAX_SVG_BYTES) throw new Error(`SVG too large (${bytes} bytes): ${file}`);
      fs.writeFileSync(file, svg, 'utf8');
    }
  }

  const generatedPattern = /^TRP-[A-Z]{2}-\d{3}-(?:main|detail|lifestyle)\.svg$/;
  for (const file of fs.readdirSync(PATHS.productsDir)) {
    if (generatedPattern.test(file) && !expected.has(file)) fs.unlinkSync(path.join(PATHS.productsDir, file));
  }

  const productsJson = `${JSON.stringify(products, null, 2)}\n`;
  fs.writeFileSync(PATHS.clientProducts, productsJson, 'utf8');
  fs.copyFileSync(PATHS.clientProducts, PATHS.serverProducts);

  if (!fs.existsSync(PATHS.mascotSource)) {
    throw new Error(`Mascot source not found: ${PATHS.mascotSource} (set TRAPO_MASCOT_SOURCE to override)`);
  }
  fs.copyFileSync(PATHS.mascotSource, PATHS.mascotDest);
  fs.copyFileSync(PATHS.mascotSource, PATHS.serverMascotDest);
  return { expected, maxSvg };
}

// ---------- verification ----------
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifyOnDisk() {
  const clientProductsBuffer = fs.readFileSync(PATHS.clientProducts);
  const serverProductsBuffer = fs.readFileSync(PATHS.serverProducts);
  const clientCollectionsBuffer = fs.readFileSync(PATHS.clientCollections);
  const serverCollectionsBuffer = fs.readFileSync(PATHS.serverCollections);
  assert(clientProductsBuffer.equals(serverProductsBuffer), 'product JSON copies differ');
  assert(clientCollectionsBuffer.equals(serverCollectionsBuffer), 'collection JSON copies differ');

  const products = JSON.parse(clientProductsBuffer.toString('utf8'));
  const collections = JSON.parse(clientCollectionsBuffer.toString('utf8'));
  assert(Array.isArray(products), 'products JSON is not an array');
  assert(Array.isArray(collections), 'collections JSON is not an array');
  assert(products.length >= 120, `expected 120+ products, got ${products.length}`);
  assert(collections.length === 6, `expected 6 collections, got ${collections.length}`);

  const ids = new Set();
  const names = new Set();
  const imagePaths = new Set();
  const categoryCounts = {};
  let totalImages = 0;
  let maxSvg = 0;

  for (const product of products) {
    const keys = Object.keys(product);
    assert(keys.length === PRODUCT_KEYS.length &&
      PRODUCT_KEYS.every((key) => keys.includes(key)),
    `invalid field set for ${product.id}`);
    assert(!ids.has(product.id), `duplicate product id: ${product.id}`);
    ids.add(product.id);
    assert(!names.has(product.name), `duplicate product name: ${product.name}`);
    names.add(product.name);
    assert(CATEGORIES.includes(product.category), `invalid category: ${product.category}`);
    assert(new RegExp(`^TRP-${CATEGORY_PREFIX[product.category]}-\\d{3}$`).test(product.id),
      `id/category prefix mismatch: ${product.id}`);
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    assert(typeof product.price === 'number' && product.price >= 18 && product.price <= 1200,
      `price out of range: ${product.id}`);
    assert(Math.abs(Math.round(product.price * 100) - product.price * 100) < 1e-6, `too many price decimals: ${product.id}`);
    if (product.compareAtPrice !== null) {
      assert(typeof product.compareAtPrice === 'number' && product.compareAtPrice > product.price,
        `compareAtPrice must exceed price: ${product.id}`);
      assert(product.discountPercent === Math.round((1 - product.price / product.compareAtPrice) * 100),
        `discountPercent mismatch: ${product.id}`);
    } else {
      assert(product.discountPercent === 0, `unexpected discount: ${product.id}`);
    }
    assert(Array.isArray(product.colors) && product.colors.length >= 2 && product.colors.length <= 4,
      `invalid colors: ${product.id}`);
    assert(product.colors.every((c) => Object.keys(c).length === 2 && /^#[0-9A-F]{6}$/.test(c.hex)),
      `invalid color entry: ${product.id}`);
    assert(Array.isArray(product.sizes) && Array.isArray(product.specifications) &&
      product.specifications.length >= 4 && product.specifications.length <= 6,
    `invalid sizes/specifications: ${product.id}`);
    assert(product.specifications.every((s) => typeof s.label === 'string' && typeof s.value === 'string'),
      `invalid specification entry: ${product.id}`);
    assert(Number.isInteger(product.stock) && product.stock >= 0 && product.stock <= 120,
      `invalid stock: ${product.id}`);
    assert(product.inStock === (product.stock > 0), `inStock mismatch: ${product.id}`);
    assert(product.isDemo === true, `isDemo must be true: ${product.id}`);
    [product.isNew, product.isBestseller, product.isTrending, product.featured]
      .forEach((flag) => assert(typeof flag === 'boolean', `invalid flag: ${product.id}`));
    assert(product.rating >= 3.8 && product.rating <= 5 &&
      Math.abs(Math.round(product.rating * 10) - product.rating * 10) < 1e-6, `invalid rating: ${product.id}`);
    assert(Number.isInteger(product.reviewCount) && product.reviewCount >= 0 && product.reviewCount <= 900,
      `invalid reviewCount: ${product.id}`);
    assert(Array.isArray(product.tags) && product.tags.length >= 2 && product.tags.length <= 5 &&
      product.tags.every((tag) => tag === tag.toLowerCase()), `invalid tags: ${product.id}`);
    assert(!Number.isNaN(Date.parse(product.createdAt)), `invalid createdAt: ${product.id}`);

    assert(Array.isArray(product.images) && product.images.length === 3, `invalid images: ${product.id}`);
    product.images.forEach((image, index) => {
      const suffix = ['main', 'detail', 'lifestyle'][index];
      assert(image === `/products/${product.id}-${suffix}.svg`, `unexpected image path: ${image}`);
      assert(!imagePaths.has(image), `duplicate image path: ${image}`);
      imagePaths.add(image);
      totalImages += 1;
      const file = path.join(ROOT, 'client/public', image.replace(/^\//, ''));
      assert(fs.existsSync(file), `missing artwork: ${file}`);
      const size = fs.statSync(file).size;
      maxSvg = Math.max(maxSvg, size);
      assert(size > 0 && size <= MAX_SVG_BYTES, `artwork size out of range: ${file} (${size})`);
      const text = fs.readFileSync(file, 'utf8');
      assert(text.startsWith('<?xml') && text.includes('</svg>') && text.includes('viewBox="0 0 800 1000"'),
        `invalid SVG structure: ${file}`);
    });
  }

  const collectionNames = COLLECTION_DEFS.map((entry) => entry[1]);
  const collected = new Set();
  for (const collection of collections) {
    const keys = Object.keys(collection);
    assert(keys.length === COLLECTION_KEYS.length && COLLECTION_KEYS.every((key) => keys.includes(key)),
      `invalid field set for collection ${collection.id}`);
    assert(collectionNames.includes(collection.name), `unexpected collection name: ${collection.name}`);
    assert(collection.slug === collection.name.toLowerCase().replace(/\s+/g, '-'),
      `invalid slug: ${collection.slug}`);
    assert(collection.image.startsWith('/products/') && imagePaths.has(collection.image),
      `invalid collection image: ${collection.image}`);
    assert(collection.isDemo === true, `collection isDemo must be true: ${collection.id}`);
    assert(Array.isArray(collection.productIds) && collection.productIds.length > 0,
      `empty collection: ${collection.id}`);
    for (const id of collection.productIds) {
      assert(ids.has(id), `unknown product in collection: ${id}`);
      assert(!collected.has(id), `product in more than one collection: ${id}`);
      collected.add(id);
    }
  }
  assert(new Set(collections.map((c) => c.name)).size === 6, 'duplicate collection names');

  const svgFiles = fs.readdirSync(PATHS.productsDir).filter((file) => file.endsWith('.svg'));
  assert(svgFiles.length >= 330, `expected 330+ SVG files, got ${svgFiles.length}`);
  assert(fs.existsSync(PATHS.mascotDest), 'missing client mascot copy');
  assert(fs.existsSync(PATHS.serverMascotDest), 'missing server mascot copy');
  assert(fs.readFileSync(PATHS.mascotDest).equals(fs.readFileSync(PATHS.serverMascotDest)),
    'mascot copies differ');

  return {
    products,
    collections,
    categoryCounts,
    svgCount: svgFiles.length,
    totalImages,
    maxSvg,
    collectionCounts: Object.fromEntries(collections.map((c) => [c.name, c.productIds.length])),
    zeroStock: products.filter((p) => p.stock === 0).length,
  };
}

function printReport(stats, verifyOnly, generationMaxSvg) {
  console.log(`TRAPO seed ${verifyOnly ? 'verification' : 'generation + verification'} complete`);
  console.log(`Products: ${stats.products.length}`);
  for (const category of CATEGORIES) {
    console.log(`  ${category}: ${stats.categoryCounts[category] || 0}`);
  }
  console.log(`Collections: ${stats.collections.length} (${Object.entries(stats.collectionCounts).map(([k, v]) => `${k}=${v}`).join(', ')})`);
  console.log(`SVG artwork: ${stats.svgCount} files (${stats.totalImages} referenced, max ${Math.max(stats.maxSvg, generationMaxSvg || 0)} bytes)`);
  console.log(`Out of stock products: ${stats.zeroStock}`);
  console.log(`Mascot: client/public/brand/trapo-mascot.jpeg + server/data/trapo/uploads/trapo-mascot.jpeg`);
  console.log('Checks passed: JSON parsed, byte-identical copies, unique ids/names/image paths, valid fields, valid SVG structure.');
}

function main() {
  if (VERIFY_ONLY) {
    const stats = verifyOnDisk();
    printReport(stats, true, 0);
    return;
  }
  const products = generateProducts();
  writeProductsAndArtwork(products);
  const collections = buildCollections(products);
  const collectionsJson = `${JSON.stringify(collections, null, 2)}\n`;
  fs.writeFileSync(PATHS.clientCollections, collectionsJson, 'utf8');
  fs.copyFileSync(PATHS.clientCollections, PATHS.serverCollections);
  const stats = verifyOnDisk();
  printReport(stats, false, 0);
}

main();
