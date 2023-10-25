import { remult } from 'remult'

export function getImageUrl(src: string) {
  if (!src.startsWith('data:image/png;base64,'))
    return remult.context.origin + '/images/' + src
  return src
}
