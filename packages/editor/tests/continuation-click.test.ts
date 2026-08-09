import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import type { ViewMutationRecord } from 'prosemirror-view'
import { schema } from '@mumo/core'
import { buildContinuationHeadPlugin } from '../src/plugins/playback-plugins.js'
import { UtteranceNodeView } from '../src/nodeviews/UtteranceNodeView.js'

function mkView(nodes: Parameters<typeof schema.nodes.doc.create>[2]) {
  const doc = schema.nodes.doc.create(null, nodes)
  const state = EditorState.create({ doc, plugins: [buildContinuationHeadPlugin()] })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, {
    state,
    nodeViews: {
      utterance: (node, editorView, getPos) => new UtteranceNodeView(node, editorView, getPos),
    },
  })
}

function nodeViewFor(view: EditorView, id: string): UtteranceNodeView {
  const dom = view.dom.querySelector(`[data-id="${id}"]`) as HTMLElement & { __nodeView: UtteranceNodeView }
  return dom.__nodeView
}

// Regression: the continuation chain-hover plugin toggles a class directly on the
// utterance wrapper DOM. ProseMirror's DOMObserver treats an attribute change on a
// nodeview wrapper as an edit and redraws the whole node, which drops a just-placed
// caret — so continuation blocks (the only ones that get the class) became
// unclickable (reproduced in Electron's Chromium). ignoreMutation must ignore
// attribute mutations on the wrapper so PM leaves the node — and the caret — alone.
describe('continuation block wrapper mutations are ignored', () => {
  it('ignores attribute (class) mutations on the wrapper', () => {
    const view = mkView([
      schema.nodes.utterance.create({ id: 'A' }, schema.text('hello world')),
      schema.nodes.utterance.create({ id: 'B', continuationOfId: 'A' }, schema.text('more')),
    ])
    const nv = nodeViewFor(view, 'A')
    const mutation = {
      type: 'attributes',
      target: nv.dom,
      attributeName: 'class',
    } as unknown as ViewMutationRecord

    expect(nv.ignoreMutation(mutation)).toBe(true)
    view.destroy()
  })

  it('does not blanket-ignore real content mutations inside contentDOM', () => {
    const view = mkView([
      schema.nodes.utterance.create({ id: 'A' }, schema.text('hello world')),
      schema.nodes.utterance.create({ id: 'B', continuationOfId: 'A' }, schema.text('more')),
    ])
    const nv = nodeViewFor(view, 'A')
    const childListMutation = {
      type: 'childList',
      target: nv.contentDOM,
      addedNodes: [],
      removedNodes: [],
    } as unknown as ViewMutationRecord

    expect(nv.ignoreMutation(childListMutation)).toBe(false)
    view.destroy()
  })
})
