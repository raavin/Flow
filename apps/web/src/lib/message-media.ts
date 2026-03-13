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

export function getSignedPostImageUrls(paths: string[]) {
  return getSignedUrls('post-media', paths)
}

export function uploadDmImages(userId: string, files: File[]) {
  return uploadFiles('dm-media', userId, files)
}

export function getSignedDmImageUrls(paths: string[]) {
  return getSignedUrls('dm-media', paths)
}
