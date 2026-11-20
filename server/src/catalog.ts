import type { Pair } from './types.js'

const forex = (symbol: string, name: string, base: string, quote: string): Pair => ({
  symbol,
  name,
  category: 'forex',
  base,
  quote,
  liveFeed: true,
})

/**
 * A curated catalogue of real, exchange-traded spot FX pairs.
 * These are names only — no prices are stored or invented anywhere in this app.
 */
export const FOREX_PAIRS: Pair[] = [
  forex('EUR/USD', 'Euro / US Dollar', 'EUR', 'USD'),
  forex('GBP/USD', 'British Pound / US Dollar', 'GBP', 'USD'),
  forex('USD/JPY', 'US Dollar / Japanese Yen', 'USD', 'JPY'),
  forex('AUD/USD', 'Australian Dollar / US Dollar', 'AUD', 'USD'),
  forex('USD/CAD', 'US Dollar / Canadian Dollar', 'USD', 'CAD'),
  forex('USD/CHF', 'US Dollar / Swiss Franc', 'USD', 'CHF'),
  forex('NZD/USD', 'New Zealand Dollar / US Dollar', 'NZD', 'USD'),
  forex('EUR/GBP', 'Euro / British Pound', 'EUR', 'GBP'),
  forex('GBP/JPY', 'British Pound / Japanese Yen', 'GBP', 'JPY'),
  forex('EUR/JPY', 'Euro / Japanese Yen', 'EUR', 'JPY'),
  forex('EUR/AUD', 'Euro / Australian Dollar', 'EUR', 'AUD'),
  forex('EUR/CAD', 'Euro / Canadian Dollar', 'EUR', 'CAD'),
  forex('EUR/CHF', 'Euro / Swiss Franc', 'EUR', 'CHF'),
  forex('EUR/NZD', 'Euro / New Zealand Dollar', 'EUR', 'NZD'),
  forex('GBP/AUD', 'British Pound / Australian Dollar', 'GBP', 'AUD'),
  forex('GBP/CAD', 'British Pound / Canadian Dollar', 'GBP', 'CAD'),
  forex('GBP/CHF', 'British Pound / Swiss Franc', 'GBP', 'CHF'),
  forex('AUD/JPY', 'Australian Dollar / Japanese Yen', 'AUD', 'JPY'),
  forex('AUD/CAD', 'Australian Dollar / Canadian Dollar', 'AUD', 'CAD'),
  forex('AUD/CHF', 'Australian Dollar / Swiss Franc', 'AUD', 'CHF'),
  forex('AUD/NZD', 'Australian Dollar / New Zealand Dollar', 'AUD', 'NZD'),
  forex('CAD/JPY', 'Canadian Dollar / Japanese Yen', 'CAD', 'JPY'),
  forex('CHF/JPY', 'Swiss Franc / Japanese Yen', 'CHF', 'JPY'),
  forex('NZD/JPY', 'New Zealand Dollar / Japanese Yen', 'NZD', 'JPY'),
  forex('NZD/CAD', 'New Zealand Dollar / Canadian Dollar', 'NZD', 'CAD'),
  forex('USD/NOK', 'US Dollar / Norwegian Krone', 'USD', 'NOK'),
  forex('USD/SEK', 'US Dollar / Swedish Krona', 'USD', 'SEK'),
  forex('USD/MXN', 'US Dollar / Mexican Peso', 'USD', 'MXN'),
  forex('USD/ZAR', 'US Dollar / South African Rand', 'USD', 'ZAR'),
  forex('USD/TRY', 'US Dollar / Turkish Lira', 'USD', 'TRY'),
  forex('USD/SGD', 'US Dollar / Singapore Dollar', 'USD', 'SGD'),
  forex('USD/HKD', 'US Dollar / Hong Kong Dollar', 'USD', 'HKD'),
]

const otcNote =
  'Broker-synthetic instrument. It has no independent public market feed, so no live price or AI analysis is available here. Use your broker’s own chart to evaluate it.'

/**
 * These are common broker "OTC" / synthetic labels. We list them for clarity,
 * but deliberately provide NO prices for them: an independent real-time feed
 * does not exist for broker-generated OTC quotes.
 */
export const OTC_PAIRS: Pair[] = [
  'EUR/USD (OTC)',
  'GBP/USD (OTC)',
  'USD/JPY (OTC)',
  'AUD/USD (OTC)',
  'USD/CAD (OTC)',
  'EUR/GBP (OTC)',
  'GBP/JPY (OTC)',
  'BTC/USD (OTC)',
  'ETH/USD (OTC)',
  'Volatility 10 Index',
  'Volatility 25 Index',
  'Volatility 75 Index',
  'Boom 500 Index',
  'Crash 500 Index',
].map((symbol) => ({
  symbol,
  name: symbol.replace(' (OTC)', ''),
  category: 'otc' as const,
  liveFeed: false,
  note: otcNote,
}))
