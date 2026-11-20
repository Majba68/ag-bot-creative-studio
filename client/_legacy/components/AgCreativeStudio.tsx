import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Check, Download, Eraser, Eye, FolderOpen, Heart, Image as ImageIcon,
  Layers, Layout, Loader2, Maximize, Palette, Pencil, Plus, RefreshCw, Save, Settings,
  Shuffle, Sparkles, Trash2, Type, Upload, User, Wand2, X,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type {
  BusinessProfile, BusinessProfileInput, CreativeAsset, CreativeBriefPlan, CreativeCatalogResponse,
  CreativeConfigResponse, CreativeDesign, CreativeImagePreflight, CreativeLayer, CreativeProject,
  CreativeQuality, CreativeSizeId, CreativeTextKind, CreativeToolId,
} from '../types'
import { CreativeCanvasEditor, loadCreativeImages, renderDesign } from './CreativeCanvasEditor'
import {
  applyDesignStyle, availableQualities, buildBackgroundPrompt, composeLayers, conceptFont, conceptLayout,
  conceptPalette, conceptStyle, createDefaultDesign, DEFAULT_SIZES, EMPTY_PROFILE,
  exportDimensions, nearestRatio, profileFacts, recolorLayers, VISIBLE_FIELDS,
} from './creativeStudioUtils'

type Section = 'create' | 'profile' | 'assets' | 'style' | 'tools' | 'history'

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Sparkles }> = [
  { id: 'create', label: 'AI Studio', icon: Sparkles },
  { id: 'profile', label: 'Business Profile', icon: User },
  { id: 'assets', label: 'Assets & Background', icon: ImageIcon },
  { id: 'style', label: 'Style & Typography', icon: Palette },
  { id: 'tools', label: 'AI Tools', icon: Wand2 },
  { id: 'history', label: 'Projects', icon: FolderOpen },
]

const TEXT_TOOLS: CreativeToolId[] = ['slogan', 'description', 'promo', 'colors']

const TEXT_LAYER_FIELDS: Partial<Record<CreativeLayer['type'], keyof CreativeDesign>> = {
  headline: 'headline', subtitle: 'subtitle', slogan: 'slogan', description: 'description',
  services: 'services', cta: 'cta',
}

function validateFile(file: File): string | null {
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Only PNG and JPG images are supported.'
  if (file.size > 12 * 1024 * 1024) return 'Images must be 12 MB or smaller.'
  return null
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not export this canvas.')), mime, quality)
  })
}

async function fileToPng(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The logo could not be decoded.'))
      element.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext('2d')?.drawImage(image, 0, 0)
    const blob = await canvasToBlob(canvas, 'image/png')
    return new File([blob], 'logo.png', { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function planFromDesign(design: CreativeDesign, request: string): CreativeBriefPlan {
  return {
    category: design.category,
    customCategory: design.customCategory,
    purpose: design.purpose || 'professional promotional poster',
    style: design.style,
    layout: design.layout,
    palette: { ...design.palette },
    headline: design.headline,
    subtitle: design.subtitle,
    cta: design.cta,
    slogan: design.slogan,
    description: design.description,
    services: design.services,
    missingFacts: [],
    rationale: 'Manual composition from the current design settings.',
    ...(request ? { purpose: request } : {}),
  }
}

export function AgCreativeStudio() {
  const { notify } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const teamInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)

  const [section, setSection] = useState<Section>('create')
  const [config, setConfig] = useState<CreativeConfigResponse | null>(null)
  const [readiness, setReadiness] = useState<CreativeImagePreflight | null>(null)
  const [catalog, setCatalog] = useState<CreativeCatalogResponse | null>(null)
  const [profiles, setProfiles] = useState<BusinessProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<BusinessProfile | null>(null)
  const [profileDraft, setProfileDraft] = useState<BusinessProfileInput>({ ...EMPTY_PROFILE })
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [design, setDesign] = useState<CreativeDesign>(createDefaultDesign)
  const [concepts, setConcepts] = useState<CreativeDesign[]>([])
  const [selectedConcept, setSelectedConcept] = useState(0)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('layer-headline')
  const [lastPlan, setLastPlan] = useState<CreativeBriefPlan | null>(null)
  const [request, setRequest] = useState('')
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [textResult, setTextResult] = useState('')
  const [projects, setProjects] = useState<CreativeProject[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorites' | 'recent'>('all')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [seed, setSeed] = useState(1)
  const [colorIndex, setColorIndex] = useState(0)

  const getSize = useCallback((id: CreativeSizeId) => (
    catalog?.sizes.find((item) => item.id === id)
    ?? DEFAULT_SIZES.find((item) => item.id === id)
    ?? DEFAULT_SIZES[0]
  ), [catalog])

  const registerAsset = useCallback((asset: CreativeAsset) => {
    setAssetUrls((current) => ({ ...current, [asset.id]: asset.url }))
  }, [])

  const refreshProfiles = useCallback(async () => {
    const response = await api.creativeProfiles()
    if (!response.available || !response.result) throw new Error(response.error || 'Business profiles could not be loaded.')
    setProfiles(response.result)
    return response.result
  }, [])

  const refreshProjects = useCallback(async () => {
    const response = await api.creativeProjects()
    if (!response.available || !response.result) throw new Error(response.error || 'Projects could not be loaded.')
    setProjects(response.result)
  }, [])

  const checkAi = useCallback(async (force = false) => {
    const response = await api.creativeImagePreflight(force)
    if (response.result) setReadiness(response.result)
    if (force && !response.available) {
      setNotice(response.error || 'The configured AI image provider is not ready.')
    }
    return response.result
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      api.creativeConfig(),
      api.creativeCatalog(),
      api.creativeProfiles(),
      api.creativeProjects(),
      api.creativeImagePreflight().catch(() => null),
    ])
      .then(([configData, catalogData, profileData, projectData, preflightData]) => {
        if (!active) return
        setConfig(configData)
        setCatalog(catalogData)
        if (preflightData?.result) setReadiness(preflightData.result)
        if (profileData.result?.length) {
          setProfiles(profileData.result)
          setActiveProfile(profileData.result[0])
          setProfileDraft(profileData.result[0])
        }
        const initialProfile = profileData.result?.[0] ?? null
        setDesign((current) => ({
          ...current,
          layers: composeLayers(current, initialProfile, current.concept),
        }))
        if (projectData.result) setProjects(projectData.result)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Creative Studio could not load its configuration.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const ids = new Set<string>()
    const add = (id?: string) => { if (id) ids.add(id) }
    profiles.forEach((profile) => { add(profile.logoAssetId); add(profile.teamPhotoAssetId) })
    projects.forEach((project) => {
      add(project.posterAssetId)
      add(project.design.backgroundAssetId)
      project.design.layers.forEach((layer) => add(layer.assetId))
    })
    add(profileDraft.logoAssetId)
    add(profileDraft.teamPhotoAssetId)
    add(design.backgroundAssetId)
    design.layers.forEach((layer) => add(layer.assetId))
    concepts.forEach((concept) => {
      add(concept.backgroundAssetId)
      concept.layers.forEach((layer) => add(layer.assetId))
    })
    setAssetUrls((current) => {
      const next = { ...current }
      ids.forEach((id) => {
        if (!next[id]) next[id] = `/api/creative-studio/assets/${id}`
      })
      return next
    })
  }, [profiles, projects, profileDraft, design, concepts])

  const patchDesign = useCallback((patch: Partial<CreativeDesign>) => {
    setDesign((current) => ({ ...current, ...patch }))
  }, [])

  const patchContent = useCallback((patch: Partial<CreativeDesign>) => {
    setDesign((current) => {
      const next = { ...current, ...patch }
      const font = current.layers.find((layer) => layer.type === 'headline')?.fontFamily
      return { ...next, layers: composeLayers(next, activeProfile ?? profileDraft, next.concept, font, { presentationFrom: current.layers }) }
    })
  }, [activeProfile, profileDraft])

  const updateProfileDraft = useCallback((patch: Partial<BusinessProfileInput>) => {
    setProfileDraft((current) => {
      const next = { ...current, ...patch }
      setDesign((previous) => ({ ...previous, layers: composeLayers(previous, next, previous.concept) }))
      return next
    })
  }, [])

  const updateLayer = useCallback((id: string, patch: Partial<CreativeLayer>) => {
    setDesign((current) => {
      const layer = current.layers.find((item) => item.id === id)
      const field = layer ? TEXT_LAYER_FIELDS[layer.type] : undefined
      const synced = field && typeof patch.text === 'string'
        ? { [field]: patch.text } as Partial<CreativeDesign>
        : {}
      return {
        ...current,
        ...synced,
        layers: current.layers.map((item) => item.id === id ? { ...item, ...patch } : item),
      }
    })
  }, [])

  const selectedLayer = useMemo(
    () => design.layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [design.layers, selectedLayerId],
  )

  const qualities = useMemo(
    () => availableQualities(design.width, design.height, config?.maxExportDimension, config?.maxExportPixels),
    [design.width, design.height, config],
  )

  const jumpToSection = (next: Section) => {
    setSection(next)
    if (next === 'create' || next === 'style') stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const applySize = (id: CreativeSizeId) => {
    const size = getSize(id)
    patchDesign({ sizeId: id, width: size.width, height: size.height })
    if (!qualities.includes(design.quality)) patchDesign({ quality: 'HD' })
  }

  const makeConcept = useCallback((plan: CreativeBriefPlan, concept: number, backgroundAssetId: string): CreativeDesign => {
    const profile = activeProfile ?? profileDraft
    const font = conceptFont(plan, concept, catalog)
    const next: CreativeDesign = {
      ...design,
      tool: design.tool,
      category: plan.category || design.category,
      customCategory: plan.customCategory || design.customCategory,
      brief: request,
      purpose: plan.purpose,
      headline: plan.headline || design.headline,
      subtitle: plan.subtitle || design.subtitle,
      cta: plan.cta || design.cta,
      slogan: plan.slogan || profile.slogan || design.slogan,
      description: plan.description || profile.description || design.description,
      services: plan.services || profile.services || design.services,
      style: conceptStyle(plan, concept, catalog),
      layout: conceptLayout(plan, concept, catalog),
      palette: conceptPalette(plan, concept, catalog),
      backgroundAssetId,
      concept,
      layers: [],
      effects: {
        ...design.effects,
        lighting: concept !== 2 ? design.effects.lighting : false,
        graphics: concept !== 3 ? design.effects.graphics : false,
        scanlines: concept === 4 ? design.effects.scanlines : false,
      },
    }
    next.layers = composeLayers(next, profile, concept, font)
    const styled = applyDesignStyle(next, next.style)
    return {
      ...styled,
      layers: styled.layers.map((layer) => layer.text === undefined
        ? layer
        : { ...layer, fontFamily: `${font}, sans-serif` }),
      effects: {
        ...styled.effects,
        lighting: concept !== 2 ? styled.effects.lighting : false,
        graphics: concept !== 3 ? styled.effects.graphics : false,
        scanlines: concept === 4 ? true : styled.effects.scanlines,
      },
    }
  }, [activeProfile, catalog, design, profileDraft, request])

  const generateConcepts = async (count: number) => {
    if (request.trim().length < 6) {
      setError('Describe what you want to create, for example: “Create a premium plumbing advertisement poster.”')
      return
    }
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const preflight = await checkAi()
      if (preflight && !preflight.available) {
        throw new Error(`${preflight.detail} Upload your own artwork and use “Concepts from upload”. No placeholder was created.`)
      }
      const profile = activeProfile ?? profileDraft
      const categoryHint = design.category === 'Custom Category' ? design.customCategory : design.category
      const brief = await api.creativeBrief({
        request,
        tool: design.tool,
        categoryHint,
        profile: profileFacts(profile),
      })
      if (!brief.available || !brief.result) throw new Error(brief.error || 'The AI planner produced no design plan.')
      const plan = brief.result
      setLastPlan(plan)

      const size = getSize(design.sizeId)
      const ratio = size.id === 'custom' ? nearestRatio(size.width, size.height) : size.ratio
      const backgrounds: string[] = []
      const failures: string[] = []
      for (let index = 1; index <= count; index += 1) {
        try {
          const prompt = buildBackgroundPrompt({
            category: plan.category === 'Custom Category' ? (plan.customCategory || categoryHint || 'business') : plan.category,
            purpose: plan.purpose,
            style: conceptStyle(plan, index, catalog),
            layout: conceptLayout(plan, index, catalog),
            palette: conceptPalette(plan, index, catalog),
            concept: index,
            seed: seed + index,
          })
          const generated = await api.creativeImage({ prompt, ratio, size: '1K' })
          if (!generated.available || !generated.result) throw new Error(generated.error || 'The image model returned no artwork.')
          registerAsset(generated.result.asset)
          backgrounds.push(generated.result.asset.id)
        } catch (reason) {
          failures.push(reason instanceof Error ? reason.message : 'Image generation failed.')
        }
      }
      setSeed((current) => current + count + 1)
      if (!backgrounds.length) {
        throw new Error(failures[0] || 'No artwork was produced. Upload your own background and use “Create Concepts From Upload”.')
      }
      const nextConcepts = backgrounds.map((assetId, index) => makeConcept(plan, index + 1, assetId))
      setConcepts(nextConcepts)
      setSelectedConcept(0)
      setDesign(nextConcepts[0])
      setSelectedLayerId(null)
      notify(`${nextConcepts.length} unique concept${nextConcepts.length === 1 ? '' : 's'} ready.`, 'success')
      if (failures.length) setNotice(`${nextConcepts.length} concepts completed. ${failures.length} attempt(s) failed: ${failures[0]}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Design generation failed. No poster was produced.')
    } finally {
      setGenerating(false)
    }
  }

  const createManualConcepts = () => {
    if (!design.backgroundAssetId) {
      setError('Upload a background artwork first, then create concepts from it.')
      return
    }
    const plan = lastPlan ?? planFromDesign(design, request)
    const nextConcepts = [1, 2, 3, 4].map((concept) => makeConcept(plan, concept, design.backgroundAssetId))
    setConcepts(nextConcepts)
    setSelectedConcept(0)
    setDesign(nextConcepts[0])
    setSelectedLayerId(null)
    setNotice('Four layout concepts created from your uploaded artwork. No AI image generation was used.')
  }

  const handleFile = async (
    file: File,
    kind: 'logo' | 'team' | 'background',
  ) => {
    const invalid = validateFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (kind === 'logo') {
        const png = file.type === 'image/png' ? file : await fileToPng(file)
        const response = await api.creativeRemoveLogo(png)
        if (!response.available || !response.result) throw new Error(response.error || 'Logo background removal failed.')
        registerAsset(response.result.asset)
        updateProfileDraft({ logoAssetId: response.result.asset.id })
        if (response.result.warning) setNotice(response.result.warning)
        else notify(`Logo background removed (${response.result.mode}). Original colours and shape preserved.`, 'success')
      } else {
        const response = await api.creativeUploadImage(file)
        if (!response.available || !response.result) throw new Error(response.error || 'Upload failed.')
        registerAsset(response.result)
        if (kind === 'team') {
          updateProfileDraft({ teamPhotoAssetId: response.result.id })
          notify('Team photo uploaded unchanged. No filters, face edits or background removal applied.', 'success')
        } else {
          patchDesign({ backgroundAssetId: response.result.id })
          notify('Background artwork uploaded. You can now create concepts or enhance it with AI.', 'success')
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveProfile = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await api.creativeSaveProfile(profileDraft, activeProfile?.id)
      if (!response.available || !response.result) throw new Error(response.error || 'The profile could not be saved.')
      const saved = response.result
      setActiveProfile(saved)
      setProfileDraft(saved)
      const filled = VISIBLE_FIELDS
        .filter((field) => ['contact1', 'contact2', 'whatsapp', 'website', 'email', 'address', 'facebook', 'instagram', 'services', 'description', 'slogan', 'businessName'].includes(field.key))
        .filter((field) => String((saved as unknown as Record<string, string>)[field.key] ?? '').trim())
        .map((field) => field.key)
      const visibleFields = [...new Set([...design.visibleFields, ...filled])]
      setDesign((current) => {
        const next = { ...current, visibleFields }
        return { ...next, layers: composeLayers(next, saved, next.concept) }
      })
      await refreshProfiles()
      notify('Business profile saved. It will be reused for future designs.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteProfile = async () => {
    if (!activeProfile || !window.confirm(`Delete the profile “${activeProfile.businessName || 'Untitled'}”?`)) return
    setBusy(true)
    try {
      const response = await api.creativeDeleteProfile(activeProfile.id)
      if (!response.available) throw new Error(response.error || 'The profile could not be deleted.')
      const remaining = await refreshProfiles()
      const next = remaining[0] ?? null
      setActiveProfile(next)
      setProfileDraft(next ? { ...next } : { ...EMPTY_PROFILE })
      setDesign((current) => ({ ...current, layers: composeLayers(current, next, current.concept) }))
      notify('Business profile deleted.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The profile could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  const handleTextTool = async (kind: CreativeTextKind) => {
    setBusy(true)
    setError(null)
    setTextResult('')
    try {
      const response = await api.creativeText({
        kind,
        request,
        category: design.category === 'Custom Category' ? design.customCategory || 'business' : design.category,
        profile: profileFacts(activeProfile ?? profileDraft),
      })
      if (!response.available || !response.result) throw new Error(response.error || 'The AI text tool produced no result.')
      setTextResult(response.result)
      if (kind === 'slogan') patchContent({ slogan: response.result.split('\n')[0].trim() })
      if (kind === 'description') patchContent({ description: response.result })
      if (kind === 'colors') {
        const match = /\{[\s\S]*\}/.exec(response.result)
        if (!match) {
          notify('The AI returned colours in an unsupported format. No palette was changed.', 'error')
        } else {
          try {
            const parsed = JSON.parse(match[0]) as Record<string, unknown>
            const palette = { ...design.palette }
            let changes = 0
            for (const key of Object.keys(palette) as Array<keyof CreativeDesign['palette']>) {
              const value = parsed[key]
              if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())) {
                palette[key] = value.trim().toLowerCase()
                changes += 1
              }
            }
            if (changes) {
              patchDesign({ palette })
              setDesign((current) => ({ ...current, palette, layers: recolorLayers({ ...current, palette }) }))
              notify('AI colour palette applied.', 'success')
            } else {
              notify('The AI returned no valid colours. No palette was changed.', 'error')
            }
          } catch {
            notify('The AI returned malformed colour data. No palette was changed.', 'error')
          }
        }
      }
      notify('AI text generated from your saved business facts.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The AI text tool failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleEnhance = async () => {
    if (!design.backgroundAssetId) {
      setError('Upload or generate a background artwork before using the image enhancer. Only generated background artwork is enhanced; team photos are never changed.')
      setSection('assets')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const preflight = await checkAi()
      if (preflight && !preflight.available) {
        throw new Error(`${preflight.detail} Your uploaded artwork was left unchanged.`)
      }
      const size = getSize(design.sizeId)
      const ratio = size.id === 'custom' ? nearestRatio(size.width, size.height) : size.ratio
      const response = await api.creativeImage({
        prompt: 'Enhance only this background artwork: refine lighting, material detail, depth and colour balance. Preserve the composition and subjects. Do not add text, logos, watermarks, people, faces or contact details.',
        ratio,
        size: '1K',
        sourceAssetId: design.backgroundAssetId,
      })
      if (!response.available || !response.result) throw new Error(response.error || 'The image enhancer produced no result.')
      registerAsset(response.result.asset)
      patchDesign({ backgroundAssetId: response.result.asset.id })
      notify('Background artwork enhanced. Team photos and logos were untouched.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image enhancement failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleTool = (tool: CreativeToolId) => {
    setError(null)
    if (TEXT_TOOLS.includes(tool)) {
      const kind = tool as CreativeTextKind
      setSection('tools')
      void handleTextTool(kind)
      return
    }
    if (tool === 'logo-remover') {
      setSection('profile')
      logoInputRef.current?.click()
      return
    }
    if (tool === 'image-enhancer') {
      void handleEnhance()
      return
    }
    if (tool === 'background') {
      setSection('assets')
      return
    }
    const toolInfo = catalog?.tools.find((item) => item.id === tool)
    const size = getSize(toolInfo?.defaultSize ?? 'instagram-portrait')
    patchDesign({ tool, sizeId: size.id, width: size.width, height: size.height })
    if (!request.trim() && toolInfo) setRequest(`Create a premium ${toolInfo.label.replace(/^AI /, '').toLowerCase()} for `)
    setSection('create')
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const changeColors = () => {
    const palettes = catalog?.palettes ?? []
    if (!palettes.length) return
    const nextIndex = (colorIndex + 1) % palettes.length
    const palette = { ...palettes[nextIndex] }
    setColorIndex(nextIndex)
    setDesign((current) => {
      const next = { ...current, palette }
      return { ...next, layers: recolorLayers(next) }
    })
  }

  const changeStyle = () => {
    const styles = catalog?.styles ?? ['Ultra Luxury', 'Cinematic', 'Futuristic', 'Minimalist']
    const index = styles.indexOf(design.style)
    const nextStyle = styles[(index + 1) % styles.length]
    setDesign((current) => applyDesignStyle(current, nextStyle))
  }

  const changeLayout = () => {
    const concept = (design.concept % 4) + 1
    const layout = conceptLayout(lastPlan ?? planFromDesign(design, request), concept, catalog)
    setDesign((current) => {
      const next = { ...current, concept, layout }
      const layers = composeLayers(next, activeProfile ?? profileDraft, concept, undefined, {
        textOverrides: current.layers,
        presentationFrom: current.layers,
      })
      return { ...next, layers }
    })
  }

  const exportCanvas = async (format: 'png' | 'jpg', quality: CreativeQuality) => {
    const dimensions = exportDimensions(design.width, design.height, quality, config?.maxExportDimension, config?.maxExportPixels)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const images = await loadCreativeImages(assetUrls)
    renderDesign(canvas, design, images, null)
    const blob = await canvasToBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg')
    downloadBlob(blob, `ag-ai-creative-studio-${dimensions.width}x${dimensions.height}.${format}`)
    notify(`${format.toUpperCase()} exported at ${dimensions.width} × ${dimensions.height}.`, 'success')
  }

  const saveProject = async () => {
    setBusy(true)
    setError(null)
    try {
      const dimensions = exportDimensions(design.width, design.height, design.quality, config?.maxExportDimension, config?.maxExportPixels)
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      renderDesign(canvas, design, await loadCreativeImages(assetUrls), null)
      const poster = await canvasToBlob(canvas, 'image/png')
      const response = await api.creativeSaveProject({
        name: design.headline.slice(0, 80) || design.category,
        favorite: false,
        profileId: activeProfile?.id ?? '',
        design,
      }, poster, editingProjectId ?? undefined)
      if (!response.available || !response.result) throw new Error(response.error || 'The project could not be saved.')
      setEditingProjectId(response.result.id)
      await refreshProjects()
      notify('Project saved with all editable layers.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The project could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const reopenProject = (project: CreativeProject) => {
    setDesign(project.design)
    setEditingProjectId(project.id)
    setActiveProfile(profiles.find((profile) => profile.id === project.profileId) ?? activeProfile)
    setConcepts([])
    setSelectedLayerId(null)
    setSection('create')
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    notify('Project reopened in the editor.', 'success')
  }

  const toggleFavorite = async (project: CreativeProject) => {
    try {
      const response = await api.creativeToggleFavorite(project.id)
      if (!response.available) throw new Error(response.error || 'Could not update the favourite.')
      setProjects((current) => current.map((item) => item.id === project.id ? response.result! : item))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the favourite.')
    }
  }

  const deleteProject = async (project: CreativeProject) => {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return
    try {
      const response = await api.creativeDeleteProject(project.id)
      if (!response.available) throw new Error(response.error || 'Could not delete the project.')
      setProjects((current) => current.filter((item) => item.id !== project.id))
      if (editingProjectId === project.id) setEditingProjectId(null)
      notify('Project deleted.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the project.')
    }
  }

  const downloadProject = (project: CreativeProject) => {
    const anchor = document.createElement('a')
    anchor.href = `/api/creative-studio/assets/${project.posterAssetId}?download=1`
    anchor.download = `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const openPreview = () => {
    if (!canvasRef.current) return
    setPreviewUrl(canvasRef.current.toDataURL('image/png'))
  }

  const filteredProjects = projects.filter((project) => {
    if (historyFilter === 'favorites') return project.favorite
    if (historyFilter === 'recent') return Date.now() - new Date(project.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
    return true
  })

  const conceptBackgroundUrl = (concept: CreativeDesign) => (
    concept.backgroundAssetId ? assetUrls[concept.backgroundAssetId] ?? '' : ''
  )

  return (
    <div className="cs-shell">
      <header className="cs-header">
        <div className="cs-brand">
          <div className="cs-brand-mark"><Sparkles size={22} /></div>
          <div>
            <p className="cs-eyebrow">AG AI · CREATIVE INTELLIGENCE</p>
            <h1>AG AI CREATIVE STUDIO</h1>
            <p className="cs-subtitle">Premium poster, advertisement and campaign design — generated with real AI, finished with precise compositing.</p>
          </div>
        </div>
        <div className="cs-status-row">
          <button
            type="button"
            className={`cs-status-chip status-action${readiness?.quota === 'ready' ? ' online' : ''}`}
            onClick={() => void checkAi(true)}
            title="Check Gemini model availability and live API quota"
          >
            {readiness?.quota === 'ready' ? <Check size={13} /> : <AlertTriangle size={13} />}
            {readiness?.quota === 'exhausted'
              ? 'AI QUOTA EMPTY'
              : readiness?.quota === 'ready'
                ? 'IMAGE AI READY'
                : readiness?.quota === 'unknown'
                  ? 'AI CHECK REQUIRED'
                  : config?.imageGeneration ? 'IMAGE AI READY' : 'MANUAL ART MODE'}
          </button>
          <span className="cs-status-chip">{config?.logoRemovalMode === 'api' ? 'REMOVE.BG CUTOUT' : 'PRECISION LOCAL CUTOUT'}</span>
          <button type="button" className="cs-ghost-btn" onClick={openPreview}><Eye size={15} /> Preview final</button>
          <button type="button" className="cs-primary-btn" onClick={() => void saveProject()} disabled={busy || !design.layers.length}><Save size={15} /> Save project</button>
        </div>
      </header>

      <nav className="cs-mobile-nav" aria-label="Creative Studio sections">
        {SECTIONS.map((item) => (
          <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => jumpToSection(item.id)}>
            <item.icon size={14} />{item.label}
          </button>
        ))}
      </nav>

      <div className="cs-layout">
        <aside className="cs-sidebar" aria-label="Creative Studio sidebar">
          <p className="cs-sidebar-label">STUDIO</p>
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" className={`cs-nav-item${section === item.id ? ' active' : ''}`} onClick={() => jumpToSection(item.id)}>
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="cs-sidebar-card">
            <Layers size={18} />
            <strong>{concepts.length || (design.layers.length ? 1 : 0)} concept{concepts.length === 1 || (!concepts.length && design.layers.length === 1) ? '' : 's'}</strong>
            <span>{design.width} × {design.height} · {design.quality.replace('_', ' ')}</span>
          </div>
        </aside>

        <section className="cs-controls">
          {section === 'create' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">SMART AI AUTO DESIGN</p><h2>Describe your poster</h2></div><Sparkles size={20} /></div>
              <p className="cs-hint">Type a plain request. AG AI identifies the category, chooses colours and style, retrieves your saved business profile and builds four unique concepts.</p>
              <textarea
                className="cs-textarea"
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                placeholder="Create a premium plumbing advertisement poster with a luxury dark look…"
                rows={4}
              />
              <div className="cs-field-grid two">
                <label className="cs-field">
                  <span>Category</span>
                  <select value={design.category} onChange={(event) => patchDesign({ category: event.target.value })}>
                    {(catalog?.categories ?? ['Custom Category']).map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                {design.category === 'Custom Category' && (
                  <label className="cs-field">
                    <span>Your category</span>
                    <input value={design.customCategory} onChange={(event) => patchDesign({ customCategory: event.target.value })} placeholder="Type any industry or category" />
                  </label>
                )}
                <label className="cs-field">
                  <span>Tool</span>
                  <select value={design.tool} onChange={(event) => handleTool(event.target.value as CreativeToolId)}>
                    {(catalog?.tools ?? []).map((tool) => <option key={tool.id} value={tool.id}>{tool.label}</option>)}
                  </select>
                </label>
                <label className="cs-field">
                  <span>Size</span>
                  <select value={design.sizeId} onChange={(event) => applySize(event.target.value as CreativeSizeId)}>
                    {(catalog?.sizes ?? DEFAULT_SIZES).map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
                  </select>
                </label>
              </div>
              {design.sizeId === 'custom' && (
                <div className="cs-field-grid two">
                  <label className="cs-field"><span>Width (px)</span><input type="number" min={200} max={4096} value={design.width} onChange={(event) => patchDesign({ width: Math.max(200, Math.min(4096, Number(event.target.value) || 200)) })} /></label>
                  <label className="cs-field"><span>Height (px)</span><input type="number" min={200} max={4096} value={design.height} onChange={(event) => patchDesign({ height: Math.max(200, Math.min(4096, Number(event.target.value) || 200)) })} /></label>
                </div>
              )}
              <div className="cs-action-grid">
                <button type="button" className="cs-primary-btn wide" onClick={() => void generateConcepts(1)} disabled={generating}>
                  {generating ? <Loader2 className="cs-spin" size={16} /> : <Sparkles size={16} />} Generate new design
                </button>
                <button type="button" className="cs-primary-btn wide purple" onClick={() => void generateConcepts(4)} disabled={generating}>
                  <Wand2 size={16} /> Generate 4 concepts
                </button>
                <button type="button" className="cs-ghost-btn" onClick={() => void generateConcepts(4)} disabled={generating}><RefreshCw size={15} /> Regenerate</button>
                <button type="button" className="cs-ghost-btn" onClick={createManualConcepts}><ImageIcon size={15} /> Concepts from upload</button>
              </div>
              {config?.message && <div className="cs-notice warning"><AlertTriangle size={15} /><span>{config.message}</span></div>}
              <div className="cs-panel-divider" />
              <div className="cs-panel-head compact"><div><p className="cs-eyebrow">QUICK ACTIONS</p><h3>Refine the active design</h3></div></div>
              <div className="cs-action-grid">
                <button type="button" className="cs-ghost-btn" onClick={changeColors}><Palette size={15} /> Change colors</button>
                <button type="button" className="cs-ghost-btn" onClick={changeStyle}><Shuffle size={15} /> Change style</button>
                <button type="button" className="cs-ghost-btn" onClick={changeLayout}><Layout size={15} /> Change layout</button>
                <button type="button" className="cs-ghost-btn" onClick={() => jumpToSection('style')}><Pencil size={15} /> Edit design</button>
              </div>
            </>
          )}

          {section === 'profile' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">PERMANENT DATA</p><h2>My Business Profile</h2></div><User size={20} /></div>
              <p className="cs-hint">Saved information is reused automatically. Contact details are never invented — empty fields stay empty.</p>
              <div className="cs-profile-tabs">
                {profiles.map((profile) => (
                  <button key={profile.id} type="button" className={activeProfile?.id === profile.id ? 'active' : ''} onClick={() => {
                    setActiveProfile(profile)
                    setProfileDraft({ ...profile })
                    setDesign((current) => ({ ...current, layers: composeLayers(current, profile, current.concept) }))
                  }}>{profile.businessName || 'Untitled profile'}</button>
                ))}
                <button type="button" onClick={() => {
                  setActiveProfile(null)
                  setProfileDraft({ ...EMPTY_PROFILE })
                  patchContent({ visibleFields: [...VISIBLE_FIELDS.slice(0, 9).map((field) => field.key)] })
                }}><Plus size={13} /> New</button>
              </div>
              <div className="cs-field-grid two">
                {([
                  ['businessName', 'Business Name'], ['contact1', 'Contact 1'], ['contact2', 'Contact 2'],
                  ['whatsapp', 'WhatsApp'], ['website', 'Website'], ['email', 'Email'], ['address', 'Address'],
                  ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['brandColors', 'Brand Colors'], ['slogan', 'Slogan'],
                ] as Array<[keyof BusinessProfileInput, string]>).map(([key, label]) => (
                  <label className="cs-field" key={key}><span>{label}</span>
                    <input value={profileDraft[key]} onChange={(event) => updateProfileDraft({ [key]: event.target.value })} />
                  </label>
                ))}
              </div>
              <label className="cs-field"><span>Business Services</span><input value={profileDraft.services} onChange={(event) => updateProfileDraft({ services: event.target.value })} /></label>
              <label className="cs-field"><span>Business Description</span><textarea className="cs-textarea small" rows={3} value={profileDraft.description} onChange={(event) => updateProfileDraft({ description: event.target.value })} /></label>
              <div className="cs-upload-grid">
                <button type="button" className="cs-upload-tile" onClick={() => logoInputRef.current?.click()}>
                  <ImageIcon size={18} /><strong>Business Logo</strong><span>Background removed · transparent PNG · original pixels preserved</span>
                  {profileDraft.logoAssetId && <em>Uploaded</em>}
                </button>
                <button type="button" className="cs-upload-tile" onClick={() => teamInputRef.current?.click()}>
                  <User size={18} /><strong>Team / Worker Photo</strong><span>Original image only · no face filters · no background removal</span>
                  {profileDraft.teamPhotoAssetId && <em>Uploaded</em>}
                </button>
              </div>
              <div className="cs-panel-divider" />
              <p className="cs-eyebrow">SHOW ON POSTER</p>
              <div className="cs-check-grid">
                {VISIBLE_FIELDS.map((field) => (
                  <label key={field.key} className="cs-check">
                    <input type="checkbox" checked={design.visibleFields.includes(field.key)} onChange={(event) => {
                      const visibleFields = event.target.checked
                        ? [...new Set([...design.visibleFields, field.key])]
                        : design.visibleFields.filter((key) => key !== field.key)
                      patchContent({ visibleFields })
                    }} />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
              <div className="cs-action-grid">
                <button type="button" className="cs-primary-btn" onClick={() => void handleSaveProfile()} disabled={busy}><Save size={15} /> Save profile</button>
                <button type="button" className="cs-ghost-btn danger" onClick={() => void handleDeleteProfile()} disabled={!activeProfile || busy}><Trash2 size={15} /> Delete</button>
              </div>
            </>
          )}

          {section === 'assets' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">ARTWORK LIBRARY</p><h2>Assets & Background</h2></div><ImageIcon size={20} /></div>
              <p className="cs-hint">Use AI-generated artwork, upload your own background, or enhance generated artwork. Uploaded team photos are never modified.</p>
              <button type="button" className="cs-upload-tile wide" onClick={() => backgroundInputRef.current?.click()}>
                <Upload size={18} /><strong>Upload background artwork</strong><span>PNG or JPG up to 12 MB · stored securely on the server</span>
              </button>
              <div className="cs-action-grid">
                <button type="button" className="cs-ghost-btn" onClick={() => void handleEnhance()} disabled={!design.backgroundAssetId || busy}><Sparkles size={15} /> AI image enhancer</button>
                <button type="button" className="cs-ghost-btn" onClick={createManualConcepts} disabled={!design.backgroundAssetId}><Layers size={15} /> Concepts from upload</button>
              </div>
              <div className="cs-panel-divider" />
              <p className="cs-eyebrow">GENERATED CONCEPTS</p>
              {concepts.length ? (
                <div className="cs-concept-list">
                  {concepts.map((concept, index) => (
                    <button key={`${concept.concept}-${index}`} type="button" className={`cs-concept-card${selectedConcept === index ? ' active' : ''}`} onClick={() => {
                      setSelectedConcept(index); setDesign(concept); setSelectedLayerId(null)
                    }}>
                      <span className="cs-concept-art" style={conceptBackgroundUrl(concept) ? { backgroundImage: `url(${conceptBackgroundUrl(concept)})` } : { background: `linear-gradient(135deg, ${concept.palette.primary}, ${concept.palette.accent})` }} />
                      <span><strong>Concept {index + 1}</strong><small>{concept.style} · {concept.layout}</small></span>
                    </button>
                  ))}
                </div>
              ) : <p className="cs-empty">No concepts yet. Generate a design to see four distinct directions here.</p>}
            </>
          )}

          {section === 'style' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">DESIGN CONTROL</p><h2>Style & Typography</h2></div><Palette size={20} /></div>
              <p className="cs-eyebrow">COLOR STUDIO</p>
              <div className="cs-palette-grid">
                {(catalog?.palettes ?? []).map((palette) => (
                  <button key={palette.id} type="button" title={palette.label} className="cs-palette-dot" style={{ background: `linear-gradient(135deg, ${palette.primary} 45%, ${palette.accent} 45%, ${palette.accent} 55%, ${palette.secondary} 55%)` }} onClick={() => {
                    const next = { ...palette }
                    patchDesign({ palette: { primary: next.primary, secondary: next.secondary, accent: next.accent, text: next.text, muted: next.muted } })
                    setDesign((current) => ({ ...current, palette: { primary: next.primary, secondary: next.secondary, accent: next.accent, text: next.text, muted: next.muted }, layers: recolorLayers({ ...current, palette: { primary: next.primary, secondary: next.secondary, accent: next.accent, text: next.text, muted: next.muted } }) }))
                  }} />
                ))}
                <button type="button" className="cs-ai-color" onClick={() => void handleTextTool('colors')}><Sparkles size={14} /> AI Auto</button>
              </div>
              <div className="cs-field-grid two">
                {(['primary', 'secondary', 'accent', 'text', 'muted'] as Array<keyof CreativeDesign['palette']>).map((key) => (
                  <label className="cs-field color" key={key}><span>{key}</span><input type="color" value={design.palette[key]} onChange={(event) => {
                    const palette = { ...design.palette, [key]: event.target.value }
                    patchDesign({ palette })
                    setDesign((current) => ({ ...current, palette, layers: recolorLayers({ ...current, palette }) }))
                  }} /></label>
                ))}
              </div>
              <div className="cs-panel-divider" />
              <div className="cs-field-grid two">
                <label className="cs-field"><span>Design style</span><select value={design.style} onChange={(event) => setDesign((current) => applyDesignStyle(current, event.target.value))}>{(catalog?.styles ?? []).map((style) => <option key={style}>{style}</option>)}</select></label>
                <label className="cs-field"><span>Composition</span><select value={design.layout} onChange={(event) => patchDesign({ layout: event.target.value })}>{(catalog?.layouts ?? []).map((layout) => <option key={layout}>{layout}</option>)}</select></label>
              </div>
              <div className="cs-panel-divider" />
              <p className="cs-eyebrow">TEXT CONTENT</p>
              {(['headline', 'subtitle', 'cta', 'slogan', 'description', 'services'] as Array<'headline' | 'subtitle' | 'cta' | 'slogan' | 'description' | 'services'>).map((key) => (
                <label className="cs-field" key={key}><span>{key}</span><input value={design[key]} onChange={(event) => patchContent({ [key]: event.target.value })} /></label>
              ))}
              <p className="cs-eyebrow">EFFECTS</p>
              <div className="cs-check-grid">
                {(['gradient', 'lighting', 'shadows', 'threeD', 'graphics', 'scanlines'] as Array<keyof CreativeDesign['effects']>).map((key) => (
                  <label key={key} className="cs-check">
                    <input type="checkbox" checked={design.effects[key]} onChange={(event) => patchDesign({ effects: { ...design.effects, [key]: event.target.checked } })} />
                    <span>{key === 'threeD' ? '3D depth' : key}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {section === 'tools' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">20 WORKING TOOLS</p><h2>AI Tools</h2></div><Wand2 size={20} /></div>
              <div className="cs-tool-grid">
                {(catalog?.tools ?? []).map((tool) => (
                  <button key={tool.id} type="button" className={`cs-tool-card${design.tool === tool.id ? ' active' : ''}`} onClick={() => handleTool(tool.id)}>
                    <Sparkles size={15} /><span>{tool.label}</span>
                  </button>
                ))}
              </div>
              {textResult && <><div className="cs-panel-divider" /><p className="cs-eyebrow">AI RESULT</p><pre className="cs-result-text">{textResult}</pre></>}
            </>
          )}

          {section === 'history' && (
            <>
              <div className="cs-panel-head"><div><p className="cs-eyebrow">PERSISTENT LIBRARY</p><h2>Saved Projects</h2></div><FolderOpen size={20} /></div>
              <div className="cs-filter-row">
                {(['all', 'favorites', 'recent'] as const).map((filter) => (
                  <button key={filter} type="button" className={historyFilter === filter ? 'active' : ''} onClick={() => setHistoryFilter(filter)}>{filter === 'all' ? 'All' : filter === 'favorites' ? 'Favorites' : 'Recent'}</button>
                ))}
              </div>
              {filteredProjects.length ? (
                <div className="cs-project-list">
                  {filteredProjects.map((project) => (
                    <div className="cs-project-card" key={project.id}>
                      <button type="button" className="cs-project-thumb" onClick={() => reopenProject(project)}>
                        <img src={`/api/creative-studio/assets/${project.posterAssetId}`} alt={project.name} />
                      </button>
                      <div className="cs-project-meta">
                        <strong>{project.name}</strong>
                        <span>{new Date(project.createdAt).toLocaleString()}</span>
                        <small>{project.design.category} · {project.design.width} × {project.design.height}</small>
                      </div>
                      <div className="cs-project-actions">
                        <button type="button" title="Reopen" onClick={() => reopenProject(project)}><Pencil size={14} /></button>
                        <button type="button" title={project.favorite ? 'Remove favourite' : 'Add favourite'} className={project.favorite ? 'favorite' : ''} onClick={() => void toggleFavorite(project)}><Heart size={14} fill={project.favorite ? 'currentColor' : 'none'} /></button>
                        <button type="button" title="Download" onClick={() => downloadProject(project)}><Download size={14} /></button>
                        <button type="button" title="Delete" onClick={() => void deleteProject(project)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="cs-empty">No projects in this view. Generate a design and save it to build your history.</p>}
            </>
          )}
        </section>

        <section className="cs-stage" ref={stageRef}>
          <div className="cs-stage-head">
            <div><p className="cs-eyebrow">LIVE COMPOSITOR</p><h2>Final preview</h2></div>
            <div className="cs-stage-tools">
              <label className="cs-field tiny"><span>Export</span>
                <select value={design.quality} onChange={(event) => patchDesign({ quality: event.target.value as CreativeQuality })}>
                  {qualities.map((quality) => <option key={quality} value={quality}>{quality.replace('_', ' ')}</option>)}
                </select>
              </label>
              <button type="button" className="cs-icon-btn" title="Export PNG" onClick={() => void exportCanvas('png', design.quality)}><Download size={15} /><span>PNG</span></button>
              <button type="button" className="cs-icon-btn" title="Export JPG" onClick={() => void exportCanvas('jpg', design.quality)}><Download size={15} /><span>JPG</span></button>
              <button type="button" className="cs-icon-btn" title="Preview final" onClick={openPreview}><Maximize size={15} /></button>
            </div>
          </div>
          <div className="cs-canvas-frame">
            <CreativeCanvasEditor
              design={design}
              assetUrls={assetUrls}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={updateLayer}
              canvasRef={canvasRef}
            />
            <div className="cs-canvas-glow" />
          </div>
          <p className="cs-stage-hint"><Type size={13} /> Drag any text, logo or photo in the preview. Use the inspector for precise size, position, spacing and colour.</p>
          {error && <div className="cs-error"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={() => void generateConcepts(4)}><RefreshCw size={14} /> Retry</button></div>}
          {notice && <div className="cs-notice"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X size={13} /></button></div>}
        </section>

        <aside className="cs-inspector">
          <div className="cs-panel-head compact"><div><p className="cs-eyebrow">POSTER EDITOR</p><h3>Inspector</h3></div><Settings size={18} /></div>
          {selectedLayer ? (
            <>
              <div className="cs-layer-badge"><Layers size={14} /> {selectedLayer.type}</div>
              {selectedLayer.text !== undefined && (
                <label className="cs-field"><span>Text</span><textarea className="cs-textarea small" rows={3} value={selectedLayer.text} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} /></label>
              )}
              <label className="cs-field"><span>Font</span><select value={selectedLayer.fontFamily || 'Inter, Arial, sans-serif'} onChange={(event) => updateLayer(selectedLayer.id, { fontFamily: event.target.value })}>{(catalog?.fonts ?? ['Inter', 'Montserrat', 'Orbitron', 'Georgia']).map((font) => <option key={font} value={`${font}, sans-serif`}>{font}</option>)}</select></label>
              {selectedLayer.text !== undefined && (
                <>
                  <label className="cs-range"><span>Text size <b>{selectedLayer.fontSize}</b></span><input type="range" min={10} max={140} value={selectedLayer.fontSize || 36} onChange={(event) => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) })} /></label>
                  <label className="cs-range"><span>Letter spacing <b>{selectedLayer.letterSpacing ?? 0}</b></span><input type="range" min={-4} max={12} value={selectedLayer.letterSpacing ?? 0} onChange={(event) => updateLayer(selectedLayer.id, { letterSpacing: Number(event.target.value) })} /></label>
                  <label className="cs-field color"><span>Text colour</span><input type="color" value={selectedLayer.color || '#ffffff'} onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })} /></label>
                  <div className="cs-align-row">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button key={align} type="button" className={selectedLayer.align === align ? 'active' : ''} onClick={() => updateLayer(selectedLayer.id, { align })}>{align}</button>
                    ))}
                  </div>
                </>
              )}
              <div className="cs-panel-divider" />
              <p className="cs-eyebrow">POSITION & SIZE</p>
              {(['x', 'y', 'w', 'h'] as const).map((key) => (
                <label className="cs-range" key={key}>
                  <span>{key.toUpperCase()} <b>{Math.round(selectedLayer[key] * 100)}%</b></span>
                  <input type="range" min={0} max={key === 'w' || key === 'h' ? 1 : 0.99} step={0.01} value={selectedLayer[key]} onChange={(event) => updateLayer(selectedLayer.id, { [key]: Number(event.target.value) })} />
                </label>
              ))}
              <label className="cs-range"><span>Opacity <b>{Math.round((selectedLayer.opacity ?? 1) * 100)}%</b></span><input type="range" min={0.1} max={1} step={0.05} value={selectedLayer.opacity ?? 1} onChange={(event) => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) })} /></label>
              <button type="button" className="cs-ghost-btn danger wide" onClick={() => {
                setDesign((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== selectedLayer.id) }))
                setSelectedLayerId(null)
              }}><Eraser size={15} /> Remove element</button>
            </>
          ) : (
            <div className="cs-empty inspector-empty">
              <Layers size={22} />
              <strong>No element selected</strong>
              <span>Tap text, the logo or a photo in the preview to edit it precisely.</span>
            </div>
          )}
          <div className="cs-panel-divider" />
          <p className="cs-eyebrow">EXPORT QUALITY</p>
          <div className="cs-quality-list">
            {qualities.map((quality) => (
              <button key={quality} type="button" className={design.quality === quality ? 'active' : ''} onClick={() => patchDesign({ quality })}>
                <span>{quality.replace('_', ' ')}</span>
                <small>{exportDimensions(design.width, design.height, quality, config?.maxExportDimension, config?.maxExportPixels).width} × {exportDimensions(design.width, design.height, quality, config?.maxExportDimension, config?.maxExportPixels).height}</small>
              </button>
            ))}
          </div>
          <p className="cs-file-note">{config?.exportFormats.join(' · ') ?? 'PNG · JPG'} · up to {Math.round((config?.maxExportPixels ?? 16_000_000) / 1_000_000)}MP. Only supported resolutions are shown.</p>
        </aside>
      </div>

      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void handleFile(file, 'logo')
        event.target.value = ''
      }} />
      <input ref={teamInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void handleFile(file, 'team')
        event.target.value = ''
      }} />
      <input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void handleFile(file, 'background')
        event.target.value = ''
      }} />

      {previewUrl && (
        <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Final poster preview" onClick={() => setPreviewUrl(null)}>
          <div className="cs-modal-body" onClick={(event) => event.stopPropagation()}>
            <div className="cs-modal-head"><h2>Final design preview</h2><button type="button" onClick={() => setPreviewUrl(null)}><X size={18} /></button></div>
            <img src={previewUrl} alt="Final poster preview" />
            <div className="cs-modal-actions">
              <button type="button" className="cs-ghost-btn" onClick={() => void exportCanvas('png', design.quality)}><Download size={15} /> PNG</button>
              <button type="button" className="cs-ghost-btn" onClick={() => void exportCanvas('jpg', design.quality)}><Download size={15} /> JPG</button>
              <button type="button" className="cs-primary-btn" onClick={() => { setPreviewUrl(null); void saveProject() }}><Save size={15} /> Save project</button>
            </div>
          </div>
        </div>
      )}

      {(generating || busy) && <div className="cs-busy"><Loader2 className="cs-spin" size={18} /> AG AI is working…</div>}
    </div>
  )
}
