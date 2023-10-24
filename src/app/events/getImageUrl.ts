export function getImageUrl(src: string) {
  if (!src.startsWith('data:image/png;base64,')) return '/images/' + src
  return src
}