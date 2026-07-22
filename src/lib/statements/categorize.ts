import { TRANSACTION_CATEGORIES } from '@/lib/constants';

/**
 * Deterministic merchant → category mapping. No AI in the hot path: this is a
 * keyword dictionary that runs for free on every import. It is intentionally
 * conservative — anything unmatched falls back to `Other`, and the user can
 * override every row in the review table before saving.
 *
 * Keys are UPPERCASE substrings matched against the (uppercased) description.
 * Order matters: the first match wins, so put more specific rules first.
 */
const RULES: { match: string[]; category: (typeof TRANSACTION_CATEGORIES)[number] }[] = [
  // Fuel / parking / transport
  {
    match: [
      'PARQUEO',
      'PARQUEOS',
      'ESTACION DE SERVICIO',
      'EST DE SERV',
      'GASOLINERA',
      'UBER',
      'TESLA',
      'PUMA',
      'SHELL',
    ],
    category: 'Transport',
  },
  // Food & drink (restaurants, cafes, fast food, bakeries)
  {
    match: [
      'MCDONALDS',
      'TACO BELL',
      'SUBWAY',
      'PIZZA',
      'HUT',
      'BURGER',
      'KFC',
      'WENDY',
      'CAFE',
      'BARISTA',
      'STARBUCKS',
      'DIESELDORFF',
      'RESTAURANTE',
      'TRE FRATELLI',
      'HACIENDA REAL',
      'PUPUSERIA',
      'PANADERIA',
      'SAN MARTIN',
      'TACO',
      'SUSHI',
      'QDELY',
      '12 OZ',
      'BROTHERS',
      'DUNKIN',
      'POLLO',
      'CAMPERO',
      'DOMINOS',
    ],
    category: 'Food',
  },
  // Supermarkets / groceries — kept under Food to match the app's category set
  {
    match: [
      'SUPERMERCADO',
      'LA TORRE',
      'SUPER DEL BARRIO',
      'WALMART',
      'PAIZ',
      'MAXI DESPENSA',
      'DESPENSA',
    ],
    category: 'Food',
  },
  // Retail / shopping / department stores
  {
    match: [
      'CEMACO',
      'DOLLARCITY',
      'FOREVESA',
      'ISTORE',
      'APPLE',
      'AMAZON',
      'TEMU',
      'SHEIN',
      'COMERCIALISA',
      'ZARA',
      'SIMAN',
    ],
    category: 'Shopping',
  },
  // Health / fitness / pharmacy
  {
    match: ['FITNESS', 'GYM', 'FARMACIA', 'CLINICA', 'HOSPITAL', 'DENTAL', 'ZURICH', 'ADENTA'],
    category: 'Health',
  },
  // Utilities / telecom / insurance / bank service fees
  {
    match: [
      'TELGUA',
      'CLARO',
      'TIGO',
      'ENERGUATE',
      'EEGSA',
      'AGUA',
      'SEGURO',
      'SEGUROS',
      'MAFRE',
      'MAPFRE',
      'ASISTENCIA',
      'RENOVACION',
      'CARGO POR',
      'COMISION',
    ],
    category: 'Utilities',
  },
  // Entertainment / subscriptions
  {
    match: [
      'NETFLIX',
      'SPOTIFY',
      'DISNEY',
      'HBO',
      'MAX',
      'YOUTUBE',
      'CINEPOLIS',
      'CINEMARK',
      'STEAM',
      'PLAYSTATION',
      'XBOX',
    ],
    category: 'Entertainment',
  },
];

export function guessCategory(description: string): (typeof TRANSACTION_CATEGORIES)[number] {
  const upper = description.toUpperCase();
  for (const rule of RULES) {
    if (rule.match.some((m) => upper.includes(m))) return rule.category;
  }
  return 'Other';
}
