import type {
  Analysis, BusinessProfile, BusinessProfileInput,
  CreativeAsset, CreativeBriefPlan, CreativeCatalogResponse, CreativeConfigResponse,
  CreativeImagePreflight, CreativeProject, CreativeProjectInput, CreativeResultResponse, CreativeTextKind,
  DirectionProAnalyzeResponse, DirectionProVerifyDemoResponse,
  Health, HorrorTrackingFrameResponse, Interval, MarketPayload, Pair,
  SmartChartSetupAnalyzeResponse, SupportResistanceAnalyzeResponse,
  VisionAnalyzeResponse, VisionSettings,
} from './types'

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status})`)
  return data
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  return readJson<T>(response)
}

const post = <T>(url: string, body: unknown) =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const api = {
  health: () => request<Health>('/api/health'),

  pairs: () => request<{ forex: Pair[]; otc: Pair[]; source: string }>('/api/market/pairs'),

  candles: (symbol: string, interval: Interval) =>
    request<MarketPayload>(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}`),

  analyze: (symbol: string, interval: Interval, higherIntervals: Interval[]) =>
    post<Analysis>('/api/analysis/analyze', { symbol, interval, higherIntervals }),

  chat: (message: string, analysis: Analysis | null) =>
    post<{ available: boolean; text: string; error?: string }>('/api/assistant/chat', { message, analysis }),

  vision: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<{ available: boolean; text: string; error?: string }>('/api/assistant/vision', {
      method: 'POST',
      body: form,
    })
  },

  visionAnalyze: (file: File, settings: VisionSettings) => {
    const form = new FormData()
    form.append('image', file)
    form.append('settings', JSON.stringify(settings))
    return request<VisionAnalyzeResponse>('/api/vision/analyze', { method: 'POST', body: form })
  },

  supportResistanceAnalyze: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<SupportResistanceAnalyzeResponse>('/api/vision/support-resistance', { method: 'POST', body: form })
  },

  smartChartSetupAnalyze: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<SmartChartSetupAnalyzeResponse>('/api/vision/smart-chart-setup', { method: 'POST', body: form })
  },

  directionProAnalyze: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<DirectionProAnalyzeResponse>('/api/vision/direction-pro/analyze', { method: 'POST', body: form })
  },

  directionProVerifyDemo: (symbol: string, interval: Interval, horizon: number) =>
    post<DirectionProVerifyDemoResponse>('/api/vision/direction-pro/verify-demo', { symbol, interval, horizon }),

  horrorTrackingFrame: (frame: File, frameIndex: number, timeSec: number) => {
    const form = new FormData()
    form.append('frame', frame)
    form.append('frameIndex', String(frameIndex))
    form.append('timeSec', timeSec.toFixed(2))
    return request<HorrorTrackingFrameResponse>('/api/vision/horror-tracking/frame', {
      method: 'POST',
      body: form,
    })
  },

  creativeConfig: () => request<CreativeConfigResponse>('/api/creative-studio/config'),

  creativeCatalog: () => request<CreativeCatalogResponse>('/api/creative-studio/catalog'),

  creativeImagePreflight: (force = false) =>
    request<CreativeResultResponse<CreativeImagePreflight>>(`/api/creative-studio/preflight${force ? '?force=1' : ''}`),

  creativeBrief: (args: { request: string; tool: string; categoryHint: string; profile: Record<string, string> }) =>
    post<CreativeResultResponse<CreativeBriefPlan>>('/api/creative-studio/brief', args),

  creativeText: (args: { kind: CreativeTextKind; request: string; category: string; profile: Record<string, string> }) =>
    post<CreativeResultResponse<string>>('/api/creative-studio/text', args),

  creativeImage: (args: { prompt: string; ratio: string; size: string; sourceAssetId?: string }) =>
    post<CreativeResultResponse<{ asset: CreativeAsset; model: string; ratio: string }>>('/api/creative-studio/image', args),

  creativeUploadImage: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<CreativeResultResponse<CreativeAsset>>('/api/creative-studio/upload', {
      method: 'POST',
      body: form,
    })
  },

  creativeRemoveLogo: (file: File) => {
    const form = new FormData()
    form.append('logo', file)
    return request<CreativeResultResponse<{
      asset: CreativeAsset
      mode: string
      removedPixels: number | null
      warning?: string
    }>>('/api/creative-studio/logo/remove', { method: 'POST', body: form })
  },

  creativeProfiles: () =>
    request<CreativeResultResponse<BusinessProfile[]>>('/api/creative-studio/profiles'),

  creativeSaveProfile: (profile: BusinessProfileInput, id?: string) =>
    post<CreativeResultResponse<BusinessProfile>>('/api/creative-studio/profiles', { profile, id }),

  creativeDeleteProfile: (id: string) =>
    request<CreativeResultResponse<{ deleted: true }>>(`/api/creative-studio/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  creativeProjects: () =>
    request<CreativeResultResponse<CreativeProject[]>>('/api/creative-studio/projects'),

  creativeSaveProject: (project: CreativeProjectInput, poster: Blob, id?: string) => {
    const form = new FormData()
    form.append('project', JSON.stringify(project))
    form.append('poster', poster, 'poster.png')
    if (id) form.append('id', id)
    return request<CreativeResultResponse<CreativeProject>>('/api/creative-studio/projects', {
      method: 'POST',
      body: form,
    })
  },

  creativeToggleFavorite: (id: string) =>
    post<CreativeResultResponse<CreativeProject>>(`/api/creative-studio/projects/${encodeURIComponent(id)}/favorite`, {}),

  creativeDeleteProject: (id: string) =>
    request<CreativeResultResponse<{ deleted: true }>>(`/api/creative-studio/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
}
