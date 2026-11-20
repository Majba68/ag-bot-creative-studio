import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BusinessProfile, BusinessProfileInput, CreativeProject, CreativeProjectInput } from '../types.js'

type StoredAsset = { mime: string; name: string; bytes: number }

type StoreData = {
  profiles: BusinessProfile[]
  projects: CreativeProject[]
  assets: Record<string, StoredAsset>
}

// Serverless filesystems are read-only except /tmp. Hosts can point this at a
// writable (or persistent, when available) directory via CREATIVE_DATA_DIR.
const defaultRoot = process.env.VERCEL === '1'
  ? '/tmp/creative-studio'
  : fileURLToPath(new URL('../../data/creative-studio/', import.meta.url))
const root = process.env.CREATIVE_DATA_DIR
  ? path.resolve(process.env.CREATIVE_DATA_DIR)
  : defaultRoot
// The committed data directory is used as a read-only seed when a serverless
// host starts with an empty /tmp. Local runs use it directly and skip the copy.
const seedRoot = fileURLToPath(new URL('../../data/creative-studio/', import.meta.url))
const assetDir = path.join(root, 'assets')
const dataFile = path.join(root, 'studio.json')

let cache: StoreData | null = null
let writeQueue: Promise<void> = Promise.resolve()

const emptyStore = (): StoreData => ({ profiles: [], projects: [], assets: {} })

async function seedFromBundle(): Promise<void> {
  if (path.resolve(seedRoot) === path.resolve(root)) return
  try {
    await fs.access(path.join(seedRoot, 'studio.json'))
  } catch {
    return
  }
  await fs.mkdir(root, { recursive: true })
  await fs.cp(seedRoot, root, { recursive: true, force: true })
}

const extensionFor = (mime: string) => (
  mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'bin'
)

export const isAssetId = (id: string) => /^[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/i.test(id)

async function load(): Promise<StoreData> {
  if (cache) return cache
  await fs.mkdir(assetDir, { recursive: true })
  let text: string
  try {
    text = await fs.readFile(dataFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await seedFromBundle()
    try {
      text = await fs.readFile(dataFile, 'utf8')
    } catch {
      cache = emptyStore()
      await persist(cache)
      return cache
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The Creative Studio data file is corrupted. It was left untouched; restore server/data/creative-studio/studio.json from a backup before continuing.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The Creative Studio data file is invalid. It was left untouched.')
  }
  const source = parsed as Partial<StoreData>
  if (!Array.isArray(source.profiles) || !Array.isArray(source.projects) || !source.assets || typeof source.assets !== 'object' || Array.isArray(source.assets)) {
    throw new Error('The Creative Studio data file has an invalid structure. It was left untouched.')
  }
  cache = source as StoreData
  return cache
}

async function persist(data: StoreData): Promise<void> {
  await fs.mkdir(root, { recursive: true })
  const temporary = `${dataFile}.tmp`
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(temporary, dataFile)
}

async function commit(): Promise<void> {
  const data = await load()
  // A failed write must not poison every later commit.
  const pending = writeQueue.catch(() => undefined).then(() => persist(data))
  writeQueue = pending
  await pending
}

export async function saveAsset(
  buffer: Buffer,
  mime: string,
  name: string,
): Promise<{ id: string; url: string; name: string; mime: string; bytes: number }> {
  const data = await load()
  const id = `${randomUUID()}.${extensionFor(mime)}`
  await fs.mkdir(assetDir, { recursive: true })
  await fs.writeFile(path.join(assetDir, id), buffer)
  data.assets[id] = { mime, name, bytes: buffer.length }
  await commit()
  return { id, url: `/api/creative-studio/assets/${id}`, name, mime, bytes: buffer.length }
}

export async function getAsset(id: string): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
  if (!isAssetId(id)) return null
  const data = await load()
  const meta = data.assets[id]
  if (!meta) return null
  try {
    const buffer = await fs.readFile(path.join(assetDir, id))
    return { buffer, mime: meta.mime, name: meta.name }
  } catch {
    return null
  }
}

export async function deleteAsset(id: string): Promise<void> {
  if (!isAssetId(id)) return
  const data = await load()
  delete data.assets[id]
  await fs.unlink(path.join(assetDir, id)).catch(() => undefined)
  await commit()
}

export async function listProfiles(): Promise<BusinessProfile[]> {
  const data = await load()
  return [...data.profiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveProfile(input: BusinessProfileInput, id?: string): Promise<BusinessProfile> {
  const data = await load()
  const now = new Date().toISOString()
  const existing = id ? data.profiles.find((item) => item.id === id) : undefined
  const profile: BusinessProfile = {
    ...input,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  if (existing) data.profiles[data.profiles.indexOf(existing)] = profile
  else data.profiles.push(profile)
  await commit()
  return profile
}

export async function deleteProfile(id: string): Promise<boolean> {
  const data = await load()
  const index = data.profiles.findIndex((item) => item.id === id)
  if (index === -1) return false
  data.profiles.splice(index, 1)
  await commit()
  return true
}

export async function listProjects(): Promise<CreativeProject[]> {
  const data = await load()
  return [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveProject(
  input: CreativeProjectInput,
  posterAssetId: string,
  id?: string,
): Promise<CreativeProject> {
  const data = await load()
  const now = new Date().toISOString()
  const existing = id ? data.projects.find((item) => item.id === id) : undefined
  const project: CreativeProject = {
    ...input,
    id: existing?.id ?? randomUUID(),
    posterAssetId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const previousAssetId = existing?.posterAssetId
  if (existing) data.projects[data.projects.indexOf(existing)] = project
  else data.projects.push(project)
  // Commit the new project before removing the old poster. A failed write must
  // never destroy the previous version of the user's work.
  await commit()
  if (previousAssetId && previousAssetId !== posterAssetId) await deleteAsset(previousAssetId)
  return project
}

export async function toggleProjectFavorite(id: string): Promise<CreativeProject | null> {
  const data = await load()
  const project = data.projects.find((item) => item.id === id)
  if (!project) return null
  project.favorite = !project.favorite
  project.updatedAt = new Date().toISOString()
  await commit()
  return project
}

export async function deleteProject(id: string): Promise<boolean> {
  const data = await load()
  const index = data.projects.findIndex((item) => item.id === id)
  if (index === -1) return false
  const [project] = data.projects.splice(index, 1)
  await deleteAsset(project.posterAssetId)
  await commit()
  return true
}
