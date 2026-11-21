import { isRecord, type Picture } from '../pictures-of'

// The image blocks of a message's content, a tool_result's own included.
function* imagesIn(content: ReadonlyArray<unknown>): Generator<Record<string, unknown>> {
  for (const block of content) {
    if (!isRecord(block)) {
      continue
    }

    if (block.type === 'image') {
      yield block
    } else if (block.type === 'tool_result' && Array.isArray(block.content)) {
      yield* imagesIn(block.content)
    }
  }
}

/**
 * The bytes of a picture moved to a REPL's result, from the conversation as
 * the model reads it: the newest image block of its type whose base64 is the
 * length the note gave. The REPL's own result, or the Poll that delivered it,
 * carries the block; nothing else ties it to its call.
 *
 * @param messages `$.session.messages({ as: 'api' })`
 * @param picture a picture with `moved`
 * @returns the base64, or null while no message holds it (not delivered
 *   yet, left out by the REPL's image cap, or compacted away)
 */
export const movedBytesOf = (
  messages: ReadonlyArray<{ role: string; content: ReadonlyArray<unknown> | string }>,
  picture: Pick<Picture, 'mediaType' | 'moved'>,
): string | null => {
  for (let at = messages.length - 1; at >= 0; at--) {
    const { content } = messages[at]!

    if (typeof content === 'string') {
      continue
    }

    for (const image of imagesIn(content)) {
      const source = image.source

      if (
        isRecord(source) &&
        source.type === 'base64' &&
        source.media_type === picture.mediaType &&
        typeof source.data === 'string' &&
        source.data.length === picture.moved
      ) {
        return source.data
      }
    }
  }

  return null
}

/**
 * Whether a row being kept carries an image block anywhere in its content:
 * a delivery a moved picture may be waiting for.
 *
 * @param value the row's content, of any shape
 * @param depth how deep to look
 */
export const holdsImage = (value: unknown, depth = 4): boolean => {
  if (depth < 0) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some(item => holdsImage(item, depth - 1))
  }

  if (!isRecord(value)) {
    return false
  }

  return value.type === 'image' || Object.values(value).some(item => holdsImage(item, depth - 1))
}
