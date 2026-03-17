import { supabase } from './supabase'

type MediaBucket = 'message-media' | 'post-media' | 'dm-media'

async function uploadFiles(bucket: MediaBucket, userId: string, files: File[]) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const uploadedPaths: string[] = []

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
    })
    if (error) throw error
    uploadedPaths.push(path)
  }

  return uploadedPaths
}

async function getSignedUrls(bucket: MediaBucket, paths: string[]) {
  const client = supabase
  if (!client || !paths.length) return {}

  const signedEntries = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60)
      if (error) throw error
      return [path, data.signedUrl] as const
    }),
  )

  return Object.fromEntries(signedEntries)
}

export function uploadMessageImages(userId: string, files: File[]) {
  return uploadFiles('message-media', userId, files)
}

export function getSignedMessageImageUrls(paths: string[]) {
  return getSignedUrls('message-media', paths)
}

export function uploadPostImages(userId: string, files: File[]) {
  return uploadFiles('post-media', userId, files)
}

export async function uploadPostVideoFiles(userId: string, files: File[]): Promise<string[]> {
  const paths = await uploadFiles('post-media', userId, files)
  return paths.map((p) => `vid:${p}`)
}

export async function uploadPostAudioFiles(userId: string, files: File[]): Promise<string[]> {
  const paths = await uploadFiles('post-media', userId, files)
  return paths.map((p) => `aud:${p}`)
}

export async function getSignedPostImageUrls(paths: string[]): Promise<Record<string, string>> {
  const client = supabase
  if (!client || !paths.length) return {}

  const result: Record<string, string> = {}
  await Promise.all(
    paths.map(async (path) => {
      // External video/audio links — strip prefix and use URL directly
      if (path.startsWith('video:') || path.startsWith('audio:')) {
        result[path] = path.replace(/^(video|audio):/, '')
        return
      }
      // Storage-backed video/audio — strip prefix to get actual storage path
      const storagePath = path.replace(/^(vid|aud):/, '')
      const { data, error } = await client.storage.from('post-media').createSignedUrl(storagePath, 60 * 60)
      if (!error) result[path] = data.signedUrl
    }),
  )
  return result
}

export function uploadDmImages(userId: string, files: File[]) {
  return uploadFiles('dm-media', userId, files)
}

export function getSignedDmImageUrls(paths: string[]) {
  return getSignedUrls('dm-media', paths)
}
