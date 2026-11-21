import { describe, expect, test, tier } from 'claude-code/testing'

import { picturesOf } from '../hooks/pictures-of'

tier('user')

const call = (tool: string, output: unknown) => ({
  tool_use_id: 'call',
  tool,
  input: { file_path: '/work/a.png' },
  output,
})

describe('pictures-of', () => {
  test('a Read of an image is one picture named for its file', () => {
    expect(picturesOf(call('Read', { type: 'image', file: { base64: 'b', type: 'image/png' } }))).toEqual([
      { id: 'call#0', base64: 'b', mediaType: 'image/png', name: 'a.png' },
    ])
  })

  test("an MCP result's one image is named for the tool alone", () => {
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'b' } }

    expect(picturesOf(call('mcp__shots__screenshot', [image]))).toEqual([
      { id: 'call#0', base64: 'b', mediaType: 'image/png', name: 'screenshot' },
    ])
  })

  test('text, a running call, a URL image and another tool are no pictures', () => {
    const url = { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } }

    expect(picturesOf(call('Read', { type: 'text', file: { content: 'hi' } }))).toEqual([])
    expect(picturesOf(call('Read', undefined))).toEqual([])
    expect(picturesOf(call('mcp__web__fetch', [url]))).toEqual([])
    expect(picturesOf(call('Bash', [{ type: 'image' }]))).toEqual([])
  })

  test("a Read inside a REPL script is a picture whose bytes were moved, by their length", () => {
    const note = "[8 base64 chars — image bytes moved to the REPL result, subject to its per-result image cap]"

    expect(picturesOf(call('Read', { type: 'image', file: { base64: note, type: 'image/png' } }))).toEqual([
      { id: 'call#0', base64: '', mediaType: 'image/png', name: 'a.png', moved: 8 },
    ])
  })

  test('bytes that are neither base64 nor a note of their move are no picture', () => {
    expect(picturesOf(call('Read', { type: 'image', file: { base64: '<binary>', type: 'image/png' } }))).toEqual([])
  })
})
