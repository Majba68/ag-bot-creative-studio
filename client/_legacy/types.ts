export type Interval = '1min' | '5min' | '15min' | '30min' | '1h'

export type VisionVerdict = 'UP' | 'DOWN' | 'WAIT' | 'INSUFFICIENT_DATA'

export type VisionSettings = {
  pair: string
  timeframe: Interval
  duration: number
  marketType: 'forex' | 'otc'
  depth: 'quick' | 'standard' | 'deep'
}

export type VisionAnalysis = {
  verdict: VisionVerdict
  confidence: number
  summary: string
  upScenario: string
  downScenario: string
  waitReason?: string
  observedFacts: string[]
  interpretations: string[]
  detectedPatterns: string[]
  bullishEvidence: string[]
  bearishEvidence: string[]
  supportResistance: string[]
  trendStrength: string
  conflictingIndicators: string[]
  missingInformation: string[]
  alternativeScenarios: string[]
  requestAnotherScreenshot: boolean
  model: string
  timestamp: string
  disclaimer: string
}

export type VisionHistoryEntry = {
  id: string
  createdAt: string
  imageName: string
  preview: string
  settings: VisionSettings
  result: VisionAnalysis
}

export type VisionAnalyzeResponse = {
  available: boolean
  error?: string
  result: VisionAnalysis | null
}

export type SupportResistanceZone = {
  type: 'support' | 'resistance'
  yPercent: number
  reason: string
  strength: 'weak' | 'moderate' | 'strong'
}

export type SupportResistanceAnalysis = {
  enoughEvidence: boolean
  summary: string
  supportWhy: string
  resistanceWhy: string
  breakoutMeaning: string
  breakdownMeaning: string
  observedFacts: string[]
  missingInformation: string[]
  requestAnotherScreenshot: boolean
  confidence: number
  zones: SupportResistanceZone[]
  model: string
  timestamp: string
  disclaimer: string
}

export type SupportResistanceAnalyzeResponse = {
  available: boolean
  error?: string
  result: SupportResistanceAnalysis | null
}

export type SmartChartToolCategory = 'indicator' | 'drawing'
export type SmartChartClutterRisk = 'low' | 'medium' | 'high'

export type SmartChartRecommendation = {
  name: string
  category: SmartChartToolCategory
  whyUseful: string
  suggestedSettings: string
  optional: boolean
  clutterRisk: SmartChartClutterRisk
  clutterNote?: string
}

export type SmartChartScreenshotReview = {
  chartVisible: boolean
  candlesVisible: boolean
  timeframeVisible: string | null
  visibleIndicators: string[]
  chartStructure: string
  observedFacts: string[]
  missingInformation: string[]
}

export type SmartChartSetupGuide = {
  indicatorsToConsider: string[]
  drawingToolsToConsider: string[]
  settingsAndConfigurations: string[]
  howToCombine: string[]
  howToReadCombinedChart: string[]
}

export type SmartChartDirectionVerdict = 'UP' | 'DOWN' | 'WAIT' | 'INSUFFICIENT_DATA'

export type SmartChartDirection = {
  enoughInformation: boolean
  verdict: SmartChartDirectionVerdict
  confidence: number
  upEvidence: string[]
  downEvidence: string[]
  conflictingSignals: string[]
  waitReason?: string
  requestAnotherScreenshot: boolean
}

export type SmartChartBengaliLearning = {
  toolsToUse: string[]
  whyToolsHelp: string[]
  howToConfigure: string[]
  howToReadChart: string[]
  upScenario: string
  downScenario: string
  waitGuidance: string
}

export type SmartChartSetupAnalysis = {
  enoughEvidence: boolean
  summary: string
  screenshot: SmartChartScreenshotReview
  recommendations: SmartChartRecommendation[]
  setupGuide: SmartChartSetupGuide
  direction: SmartChartDirection
  bengaliLearning: SmartChartBengaliLearning
  model: string
  timestamp: string
  disclaimer: string
}

export type SmartChartSetupAnalyzeResponse = {
  available: boolean
  error?: string
  result: SmartChartSetupAnalysis | null
}

export type DirectionProVerdict = 'UP_BIAS' | 'DOWN_BIAS' | 'INSUFFICIENT_EVIDENCE'

export type DirectionProScreenshot = {
  pairVisible: string | null
  timeframeVisible: string | null
  chartReadable: boolean
  candlesVisible: boolean
  indicatorsReadable: boolean
  observedFacts: string[]
  missingInformation: string[]
}

export type DirectionProAdvancedAnalysis = {
  marketTrend: string
  candlestickPatterns: string[]
  supportResistance: string[]
  rsiMacd: string
  movingAverages: string
  momentum: string
  breakoutReversal: string[]
}

export type DirectionProDecision = {
  verdict: DirectionProVerdict
  confidence: number
  whySelected: string
  supportingSignals: string[]
  disagreeingSignals: string[]
  invalidation: string[]
}

export type DirectionProBengaliExplanation = {
  summary: string
  whySelected: string
  howToRead: string
  upScenario: string
  downScenario: string
  riskNote: string
}

export type DirectionProAnalysis = {
  enoughEvidence: boolean
  summary: string
  screenshot: DirectionProScreenshot
  advancedAnalysis: DirectionProAdvancedAnalysis
  decision: DirectionProDecision
  bengaliExplanation: DirectionProBengaliExplanation
  model: string
  timestamp: string
  disclaimer: string
}

export type DirectionProAnalyzeResponse = {
  available: boolean
  error?: string
  result: DirectionProAnalysis | null
}

export type DirectionProDemoOutcome = 'UP' | 'DOWN'

export type DirectionProVerifyDemoResponse = {
  available: boolean
  error?: string
  data: {
    simulated: true
    symbol: string
    interval: Interval
    horizon: number
    outcome: DirectionProDemoOutcome
    basis: string
    lastCandleTime: string
    generatedAt: string
  } | null
}

export type DirectionProVerification = {
  status: 'correct' | 'incorrect' | 'not-applicable'
  mode: 'demo-simulated'
  outcome: DirectionProDemoOutcome | null
  symbol: string
  interval: Interval
  horizon: number
  verifiedAt: string
  note: string
}

export type DirectionProHistoryEntry = {
  id: string
  createdAt: string
  imageName: string
  preview: string
  pair: string | null
  timeframe: string | null
  verdict: DirectionProVerdict
  confidence: number
  result: DirectionProAnalysis
  verification: DirectionProVerification | null
}

export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type DataStatus = 'live' | 'delayed' | 'unavailable' | 'error' | 'simulated'

export type Pair = {
  symbol: string
  name: string
  category: 'forex' | 'otc'
  base?: string
  quote?: string
  liveFeed: boolean
  note?: string
}

export type MarketPayload = {
  symbol: string
  interval: Interval
  candles: Candle[]
  status: DataStatus
  lastUpdated: string | null
  volumeAvailable: boolean
  reason?: string
  source: string
}

export type Factor = {
  label: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight: number
  score: number
  detail: string
}

export type Analysis = {
  signal: 'UP' | 'DOWN' | 'WAIT'
  confidence: number
  score: number
  explanation: string
  factors: Factor[]
  support: number[]
  resistance: number[]
  riskWarning: string
  timestamp: string
  dataStatus: DataStatus
  source: 'deterministic' | 'deterministic+llm'
  educationalDemo: boolean
  metrics: {
    price: number | null
    rsi: number | null
    macd: number | null
    macdSignal: number | null
    macdHistogram: number | null
    ema20: number | null
    ema50: number | null
    sma200: number | null
    atrPercent: number | null
    trendSlopePercent: number | null
    volumeAvailable: boolean
    barsAnalyzed: number
  }
  timeframeConfirmation: Array<{
    interval: Interval
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
    detail: string
  }>
  disclaimer: string
}

export type Settings = {
  symbol: string
  interval: Interval
  duration: number
  marketType: 'forex' | 'otc'
  chartType: 'candlestick' | 'line' | 'area'
  indicators: string[]
}

export type Health = {
  ok: boolean
  version: string
  serverTime: string
  marketDataConfigured: boolean
  llmConfigured: boolean
  visionConfigured: boolean
  llmProvider: string
  demoMode: boolean
  dataMode: 'real' | 'simulated' | 'unavailable'
}

export type HorrorObjectClass = 'cup' | 'ball'

export type HorrorObjectStatus = 'visible' | 'uncertain' | 'occluded'

export type HorrorDetectedObject = {
  class: HorrorObjectClass
  x: number
  y: number
  w: number
  h: number
  confidence: number
  status: HorrorObjectStatus
}

export type HorrorFrameDetection = {
  frameIndex: number
  timeSec: number
  enoughEvidence: boolean
  objects: HorrorDetectedObject[]
  confidence: number
  note: string
}

export type HorrorTrackingFrameResponse = {
  available: boolean
  error?: string
  result: HorrorFrameDetection | null
}

export type CreativeToolId =
  | 'poster' | 'advertisement' | 'banner' | 'flyer' | 'brochure' | 'business-card'
  | 'thumbnail' | 'menu' | 'gaming' | 'esports' | 'football' | 'product'
  | 'social' | 'background' | 'logo-remover' | 'image-enhancer' | 'slogan'
  | 'description' | 'promo' | 'colors'

export type CreativeSizeId =
  | 'instagram-portrait' | 'instagram-square' | 'instagram-story' | 'facebook-post'
  | 'facebook-cover' | 'youtube-thumbnail' | 'youtube-community' | 'promotional-banner'
  | 'custom'

export type CreativeQuality = 'HD' | 'FULL_HD' | '2K' | '4K'

export type BusinessProfileInput = {
  businessName: string
  contact1: string
  contact2: string
  whatsapp: string
  website: string
  email: string
  address: string
  facebook: string
  instagram: string
  services: string
  description: string
  brandColors: string
  slogan: string
  logoAssetId: string
  teamPhotoAssetId: string
}

export type BusinessProfile = BusinessProfileInput & {
  id: string
  createdAt: string
  updatedAt: string
}

export type CreativeLayerType =
  | 'background' | 'worker' | 'logo' | 'business' | 'headline' | 'subtitle' | 'contact'
  | 'website' | 'slogan' | 'description' | 'services' | 'email' | 'address'
  | 'social' | 'cta'

export type CreativeLayer = {
  id: string
  type: CreativeLayerType
  x: number
  y: number
  w: number
  h: number
  text?: string
  assetId?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  weight?: number
  letterSpacing?: number
  lineHeight?: number
  opacity?: number
  radius?: number
  role?: 'primary' | 'secondary' | 'accent'
}

export type CreativeEffects = {
  gradient: boolean
  lighting: boolean
  shadows: boolean
  threeD: boolean
  graphics: boolean
  scanlines: boolean
}

export type CreativeDesign = {
  tool: CreativeToolId
  category: string
  customCategory: string
  brief: string
  purpose: string
  headline: string
  subtitle: string
  cta: string
  slogan: string
  description: string
  services: string
  sizeId: CreativeSizeId
  width: number
  height: number
  quality: CreativeQuality
  style: string
  layout: string
  palette: { primary: string; secondary: string; accent: string; text: string; muted: string }
  backgroundAssetId: string
  visibleFields: string[]
  layers: CreativeLayer[]
  effects: CreativeEffects
  concept: number
}

export type CreativeProjectInput = {
  name: string
  favorite: boolean
  profileId: string
  design: CreativeDesign
}

export type CreativeProject = CreativeProjectInput & {
  id: string
  createdAt: string
  updatedAt: string
  posterAssetId: string
}

export type CreativeBriefPlan = {
  category: string
  customCategory: string
  purpose: string
  style: string
  layout: string
  palette: { primary: string; secondary: string; accent: string; text: string; muted: string }
  headline: string
  subtitle: string
  cta: string
  slogan: string
  description: string
  services: string
  missingFacts: string[]
  rationale: string
}

export type CreativeImageProvider = 'gemini' | 'openai' | 'none'
export type CreativeQuotaState = 'ready' | 'exhausted' | 'unavailable' | 'unknown'

export type CreativeProviderStatus = {
  provider: 'gemini' | 'openai'
  model: string
  role: 'primary' | 'fallback'
  configured: boolean
  modelAvailable: boolean
  quota: CreativeQuotaState
  available: boolean
  detail: string
}

export type CreativeCapability = {
  operation: 'text-generation' | 'image-analysis' | 'video-frame-analysis' | 'image-generation'
  provider: string
  model: string
  configured: boolean
  note?: string
}

export type CreativeImagePricing = {
  currency: 'USD'
  standardPerMillionOutputTokens: number
  batchPerMillionOutputTokens: number
  estimatedPerImage: Record<'1K' | '2K' | '4K', number>
  freeTierImageGeneration: boolean
  source: string
  note: string
}

export type CreativeImagePreflight = {
  provider: CreativeImageProvider
  model: string
  modelAvailable: boolean
  quota: CreativeQuotaState
  available: boolean
  detail: string
  pricing: CreativeImagePricing
  checkedAt: string
  providers?: CreativeProviderStatus[]
}

export type CreativeConfigResponse = {
  available: boolean
  provider: CreativeImageProvider
  imageProvider: CreativeImageProvider
  supportedImageProviders: string[]
  imageModel: string
  imageGeneration: boolean
  logoRemoval: boolean
  logoRemovalMode: 'precision-local' | 'api' | 'none'
  supportedRatios: string[]
  supportedImageSizes: string[]
  exportFormats: string[]
  maxExportDimension: number
  maxExportPixels: number
  storage: 'server-json-files'
  pricing: CreativeImagePricing
  capabilities?: CreativeCapability[]
  message?: string
}

export type CreativeResultResponse<T> = {
  available: boolean
  error?: string
  quotaState?: CreativeQuotaState
  result: T | null
}

export type CreativeCatalogResponse = {
  categories: string[]
  tools: Array<{ id: CreativeToolId; label: string; defaultSize: CreativeSizeId }>
  styles: string[]
  sizes: Array<{ id: CreativeSizeId; label: string; width: number; height: number; ratio: string }>
  palettes: Array<{ id: string; label: string; primary: string; secondary: string; accent: string; text: string; muted: string }>
  fonts: string[]
  layouts: string[]
}

export type CreativeAsset = {
  id: string
  url: string
  name: string
  mime: string
  bytes: number
}

export type CreativeTextKind = 'slogan' | 'description' | 'promo' | 'colors'
