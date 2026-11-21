/**
 * A picture to draw: an id unique in the session (its call's or message's,
 * with its place there), the bytes as the model saw them (Read may re-encode,
 * a PNG read as JPEG), their MIME type and a name to show.
 *
 * `moved` is set for a call made inside a REPL script, whose result holds a
 * note where the bytes were: they went to the REPL's result, and the model
 * read them there. It is their length in base64, by which they are found in
 * the conversation; `base64` is empty until then.
 */
export type Picture = {
  id: string
  base64: string
  mediaType: string
  name: string
  moved?: number
}

// The note a call inside a REPL script holds in place of its image's bytes:
// `[291252 base64 chars — image bytes moved to the REPL result, …]`.
const MOVED_NOTE = /^\[(\d+) base64 chars\b/

// Base64's alphabet, padding and the whitespace a decoder skips.
const BASE64_HEAD = /^[A-Za-z0-9+/=\s]*$/

/**
 * What an image's `data` (or a Read's `file.base64`) holds: the bytes, a
 * note that they were moved to the REPL's result and how long they are, or
 * neither.
 *
 * @param data the field as stored
 * @returns `{ base64 }`, `{ moved }`, or null for anything else
 */
export const bytesOf = (data: string): { base64: string } | { moved: number } | null => {
  const note = MOVED_NOTE.exec(data)

  if (note) {
    return { moved: Number(note[1]) }
  }

  return BASE64_HEAD.test(data.slice(0, 64)) ? { base64: data } : null
}

const pictureOf = (data: string, rest: Omit<Picture, 'base64' | 'moved'>): Picture | null => {
  const bytes = bytesOf(data)

  if (!bytes) {
    return null
  }

  return 'moved' in bytes ? { ...rest, base64: '', moved: bytes.moved } : { ...rest, base64: bytes.base64 }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The picture a Messages API image block holds (`{ type: 'image', source:
 * { type: 'base64', media_type, data } }`), as MCP results and pasted
 * images carry them.
 *
 * @param block any content block
 * @param id the picture's id
 * @param name the name to show
 * @returns the picture, or null for any other block
 */
export const pictureOfBlock = (block: unknown, id: string, name: string): Picture | null => {
  if (!isRecord(block) || block.type !== 'image' || !isRecord(block.source)) {
    return null
  }

  const { type, media_type, data } = block.source

  if (type !== 'base64' || typeof media_type !== 'string' || typeof data !== 'string') {
    return null
  }

  return pictureOf(data, { id, mediaType: media_type, name })
}

const readPictureOf = (id: string, input: unknown, output: unknown): Picture[] => {
  if (!isRecord(output) || output.type !== 'image' || !isRecord(output.file)) {
    return []
  }

  const { base64, type } = output.file

  if (typeof base64 !== 'string' || typeof type !== 'string') {
    return []
  }

  const path = isRecord(input) && typeof input.file_path === 'string' ? input.file_path : 'image'
  const picture = pictureOf(base64, { id: `${id}#0`, mediaType: type, name: path.slice(path.lastIndexOf('/') + 1) })

  return picture ? [picture] : []
}

const mcpPicturesOf = (id: string, tool: string, output: unknown): Picture[] => {
  if (!Array.isArray(output)) {
    return []
  }

  const images = output.filter(block => isRecord(block) && block.type === 'image')
  const name = tool.slice(tool.lastIndexOf('__') + 2)

  return images.flatMap(
    (block, at) => pictureOfBlock(block, `${id}#${at}`, images.length > 1 ? `${name} ${at + 1}` : name) ?? [],
  )
}

/**
 * The pictures a finished tool call returned: a Read of an image, or the
 * image blocks of an MCP tool's result, in order. A call made inside a REPL
 * script gives its pictures `moved`, their bytes to be found.
 *
 * @param call a `ToolUse` row's props or one of a `ToolGroup`'s calls
 * @returns its pictures; none for any other call, a running one, and a group
 *   call with no id (a desktop host's, never the terminal's)
 */
export const picturesOf = (call: {
  tool_use_id?: string
  tool: string
  input: unknown
  output?: unknown
}): Picture[] => {
  const { tool_use_id, tool, input, output } = call

  if (tool_use_id === undefined) {
    return []
  }

  if (tool === 'Read') {
    return readPictureOf(tool_use_id, input, output)
  }

  return tool.startsWith('mcp__') ? mcpPicturesOf(tool_use_id, tool, output) : []
}
