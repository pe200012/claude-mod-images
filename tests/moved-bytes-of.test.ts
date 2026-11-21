import { describe, expect, test, tier } from 'claude-code/testing'

import { holdsImage, movedBytesOf } from '../hooks/moved-bytes-of'

tier('user')

const image = (data: string, media_type = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type, data } })
const delivered = (...blocks: unknown[]) => ({
  role: 'user',
  content: [{ type: 'tool_result', tool_use_id: 'poll', content: [{ type: 'text', text: 'events' }, ...blocks] }],
})

describe('moved-bytes-of', () => {
  test("a moved picture's bytes are the newest image of its type and length", () => {
    const messages = [
      delivered(image('old1')),
      { role: 'assistant', content: 'a reply' },
      delivered(image('xyz', 'image/png'), image('new1', 'image/jpeg'), image('new2')),
    ]

    expect(movedBytesOf(messages, { mediaType: 'image/png', moved: 4 })).toBe('new2')
    expect(movedBytesOf(messages, { mediaType: 'image/jpeg', moved: 4 })).toBe('new1')
    expect(movedBytesOf(messages, { mediaType: 'image/png', moved: 3 })).toBe('xyz')
  })

  test('an image at the top of a message counts too', () => {
    expect(movedBytesOf([{ role: 'user', content: [image('abcd')] }], { mediaType: 'image/png', moved: 4 })).toBe('abcd')
  })

  test('none of that length or type is null', () => {
    const messages = [delivered(image('abcd'))]

    expect(movedBytesOf(messages, { mediaType: 'image/png', moved: 5 })).toBeNull()
    expect(movedBytesOf(messages, { mediaType: 'image/gif', moved: 4 })).toBeNull()
    expect(movedBytesOf([], { mediaType: 'image/png', moved: 4 })).toBeNull()
  })

  test('a row holds an image anywhere in its content, a few levels down', () => {
    expect(holdsImage([image('a')])).toBe(true)
    expect(holdsImage(delivered(image('a')).content)).toBe(true)
    expect(holdsImage({ media: [[image('a')]] })).toBe(true)
    expect(holdsImage([{ type: 'text', text: 'image' }])).toBe(false)
    expect(holdsImage('image')).toBe(false)
  })
})
