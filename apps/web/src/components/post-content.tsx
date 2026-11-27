import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { sanitizeHtml } from '@/lib/post-content'
import { getSignedPostImageUrls } from '@/lib/message-media'
export function PostText({ body, mentionMap }: { body: string; mentionMap?: Record<string, string> }) {
  if (/<[a-z][\s\S]*>/i.test(body))
    return (
      <div className="rich-content break-words" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />
    )
  return (
    <p className="whitespace-pre-wrap break-words">
      {body.split(/(@[a-z0-9_.-]+|#[a-z0-9_-]+)/gi).map((text, i) =>
        text.startsWith('@') && mentionMap?.[text.slice(1).toLowerCase()] ? (
          <Link
            key={i}
            to="/app/messages/profile/$profileId"
            params={{ profileId: mentionMap[text.slice(1).toLowerCase()] }}
            className="font-semibold underline"
          >
            {text}
          </Link>
        ) : text.startsWith('#') ? (
          <Link
            key={i}
            to="/app/messages/topics/$slug"
            params={{ slug: text.slice(1).toLowerCase() }}
            className="font-semibold underline"
          >
            {text}
          </Link>
        ) : (
          <span key={i}>{text}</span>
        ),
      )}
    </p>
  )
}
export function PostMedia({ paths }: { paths: string[] }) {
  const query = useQuery({
    queryKey: ['post-media', paths],
    queryFn: () => getSignedPostImageUrls(paths),
    enabled: paths.length > 0,
  })
  if (!paths.length) return null
  return (
    <div className="mt-3 grid gap-3">
      {paths.map((path, i) => {
        const src = query.data?.[path]
        if (!src) return null
        let url: URL
        try {
          url = new URL(src)
        } catch {
          return null
        }
        if (!['http:', 'https:'].includes(url.protocol)) return null
        if (path.startsWith('aud:') || path.startsWith('audio:'))
          return (
            <audio
              key={path}
              src={src}
              controls
              aria-label={`Audio attachment ${i + 1}`}
              className="w-full"
            />
          )
        if (path.startsWith('vid:') || path.startsWith('video:')) {
          const id =
            url.hostname === 'youtu.be'
              ? url.pathname.slice(1)
              : ['youtube.com', 'www.youtube.com'].includes(url.hostname)
                ? url.searchParams.get('v')
                : null
          if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
            return (
              <iframe
                key={path}
                title={`Video attachment ${i + 1}`}
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                className="aspect-video w-full"
                allowFullScreen
                loading="lazy"
              />
            )
          return <video key={path} src={src} controls preload="metadata" className="max-h-96 w-full" />
        }
        return (
          <a key={path} href={src} target="_blank" rel="noreferrer">
            <img
              src={src}
              alt={`Post attachment ${i + 1}`}
              loading="lazy"
              className="max-h-96 w-full rounded-lg object-contain"
            />
          </a>
        )
      })}
      {query.isError && (
        <p role="status" className="text-sm text-ink/60">
          Attachments could not be loaded.
        </p>
      )}
    </div>
  )
}
