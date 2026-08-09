import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '@mumo/core'
import { buildContinuationHeadPlugin } from '../src/plugins/playback-plugins.js'

function mkView(nodes: Parameters<typeof schema.nodes.doc.create>[2]) {
  const doc = schema.nodes.doc.create(null, nodes)
  const state = EditorState.create({ doc, plugins: [buildContinuationHeadPlugin()] })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, { state })
}

// Regression: the end-of-continuation marker must NOT be a ProseMirror widget
// at the end of the textblock. A trailing widget makes ProseMirror inject a
// <br class="ProseMirror-trailingBreak"> (and a separator <img>) after it,
// producing a phantom empty line and breaking clicking into head/intermediate
// continuation blocks. The marker is now a CSS ::after, so the editable content
// stays free of trailing hack nodes.
describe('continuation marker does not pollute editable content', () => {
  it('non-empty head with a continuation has no trailing hack nodes', () => {
    const view = mkView([
      schema.nodes.utterance.create({ id: 'A' }, schema.text('hello world')),
      schema.nodes.utterance.create({ id: 'B', continuationOfId: 'A' }, schema.text('more')),
    ])
    const head = view.dom.querySelector('[data-id="A"]') as HTMLElement
    expect(head.getAttribute('data-has-continuation')).toBe('true')
    expect(head.querySelector('br.ProseMirror-trailingBreak')).toBeNull()
    expect(head.querySelector('img.ProseMirror-separator')).toBeNull()
    expect(head.querySelector('.utt-head-mark')).toBeNull()
    expect(head.textContent).toBe('hello world')
    view.destroy()
  })

  it('empty middle continuation keeps exactly one trailing break (its click target)', () => {
    const view = mkView([
      schema.nodes.utterance.create({ id: 'A' }, schema.text('head text')),
      schema.nodes.utterance.create({ id: 'B', continuationOfId: 'A' }),
      schema.nodes.utterance.create({ id: 'C', continuationOfId: 'A' }, schema.text('last')),
    ])
    const mid = view.dom.querySelector('[data-id="B"]') as HTMLElement
    // Empty block still gets ProseMirror's normal single trailing break, and no
    // extra separator img from a widget.
    expect(mid.querySelectorAll('br.ProseMirror-trailingBreak').length).toBe(1)
    expect(mid.querySelector('img.ProseMirror-separator')).toBeNull()
    view.destroy()
  })
})
