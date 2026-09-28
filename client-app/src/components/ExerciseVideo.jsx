// Renders a real YouTube demo video for an exercise as a responsive
// embedded iframe, so a member who's unsure about form can just watch it —
// no login/API key needed, this is the standard public YouTube embed.
function toEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    let videoId = null
    if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.slice(1)
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v')
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/embed/')[1]
      }
    }
    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}`
  } catch {
    return null
  }
}

export default function ExerciseVideo({ url, title }) {
  const embedUrl = toEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <div className="exercise-video-wrap">
      <iframe
        className="exercise-video-frame"
        src={embedUrl}
        title={title ? `${title} — demo video` : 'Exercise demo video'}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
