// Process sidenotes
//
'use strict'

// Returns the sidenote number as a string
// If env.docId is set, it is included in the id to make it unique across documents
function render_sidenote_number (tokens, idx, options, env/*, slf */) {
  // const n = Number(tokens[idx].meta.id + 101).toString()
  const n = Number(101).toString()
  let prefix = ''

  if (typeof env.docId === 'string') prefix = `-${env.docId}-`

  return prefix + n
}

// Renders the sidenote reference in the text
// The sidenote itself is rendered at the end of the document
function render_sidenote_ref (tokens, idx, options, env, slf) {
  const title = tokens[idx].meta.title
  return `<sup id="sidenote${title}">${title}</sup>`
}

// Renderers for sidenote block (the collection of all sidenotes at the end of the document)
function render_sidenote_block_open (tokens, idx, options) {
  return '<!-- sidenote open -->\n'
}

// Not really needed, but for symmetry
function render_sidenote_block_close (tokens) {
  return '<!-- sidenote close -->\n'
}

// Renderers for individual sidenotes
function render_sidenote_open (tokens, idx, options, env, slf) {
  let id = slf.rules.sidenote_number(tokens, idx, options, env, slf)

  // if (tokens[idx].meta.subId > 0) id += `:${tokens[idx].meta.subId}`

  return  `<span id="sidenote${id}" class="sidenote">\n`
}

// Not really needed, but for symmetry
function render_sidenote_close () {
  return `</span>\n`
}

// Renders the CSS style for sidenotes
// This is added only once, at the start of the document
function render_sidenote_style () {
  return `<style>
    .sidenote {
    float: right;
    clear: right;
    width: 25%;
    margin: 0 0 0.5rem 1rem;
    box-sizing: border-box;
    background: #f9f9fb;
    border-left: 3px solid #c8c8d0;
    padding: 0.5rem 0.75rem;
    font-size: 0.9em;
    color: #333;
  }
</style>\n`
  .trim()
}

export default function sidenote_plugin (md) {
  const parseLinkLabel = md.helpers.parseLinkLabel
  const isSpace = md.utils.isSpace

  md.renderer.rules.sidenote_ref          = render_sidenote_ref
  md.renderer.rules.sidenote_block_open   = render_sidenote_block_open
  md.renderer.rules.sidenote_block_close  = render_sidenote_block_close
  md.renderer.rules.sidenote_open         = render_sidenote_open
  md.renderer.rules.sidenote_close        = render_sidenote_close
  md.renderer.rules.sidenote_style        = render_sidenote_style

  // helpers (only used in other rules, no tokens are attached to those)
  md.renderer.rules.sidenote_number       = render_sidenote_number

  // Process sidenote block definition
  // Example:
  // [$1]:  Here is the sidenote.
  //        Subsequent lines are indented to show that they
  //        belong to the same sidenote.
  function sidenote_def (state, startLine, endLine, silent) {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]

    // line should be at least 5 chars - "[$x]:"
    if (start + 4 > max) return false
    if (state.src.charCodeAt(start) !== 0x5B/* [ */) return false
    if (state.src.charCodeAt(start + 1) !== 0x24/* $ */) return false

    let pos = start + 2
    while (pos < max && state.src.charCodeAt(pos) !== 0x5D /* ] */) {
      if (state.src.charCodeAt(pos) === 0x20) return false
      pos++
    }

    if (pos === start + 2 || pos + 1 >= max || state.src.charCodeAt(++pos) !== 0x3A /* : */) return false
    if (silent) return true

    if (!state.env.sidenotes) state.env.sidenotes = []
    const title = state.src.slice(start + 2, pos - 2)

    const token_fref_o = new state.Token('sidenote_reference_open', '', 1)
    token_fref_o.meta  = { title }
    token_fref_o.level = state.level++
    state.tokens.push(token_fref_o)

    const oldBMark = state.bMarks[startLine]
    const oldTShift = state.tShift[startLine]
    const oldSCount = state.sCount[startLine]
    const oldParentType = state.parentType

    const posAfterColon = pos
    const initial = state.sCount[startLine] + pos - (state.bMarks[startLine] + state.tShift[startLine])
    let offset = initial

    while (pos < max) {
      const ch = state.src.charCodeAt(pos)

      if (isSpace(ch)) {
        if (ch === 0x09) {
          offset += 4 - offset % 4
        } else {
          offset++
        }
      } else {
        break
      }

      pos++
    }

    state.tShift[startLine] = pos - posAfterColon
    state.sCount[startLine] = offset - initial

    state.bMarks[startLine] = posAfterColon
    state.blkIndent += 4
    state.parentType = 'sidenote'

    if (state.sCount[startLine] < state.blkIndent) {
      state.sCount[startLine] += state.blkIndent
    }

    state.md.block.tokenize(state, startLine, endLine, true)

    state.parentType = oldParentType
    state.blkIndent -= 4
    state.tShift[startLine] = oldTShift
    state.sCount[startLine] = oldSCount
    state.bMarks[startLine] = oldBMark

    const token_fref_c = new state.Token('sidenote_reference_close', '', -1)
    token_fref_c.level = --state.level
    state.tokens.push(token_fref_c)

    return true
  }

  // Process inline sidenotes ($[...])
  // Example: Here is a sidenote reference,$[Here is the sidenote.]
  function sidenote_inline (state, silent) {
    const max = state.posMax
    const start = state.pos

    if (start + 2 >= max) return false
    if (state.src.charCodeAt(start) !== 0x24/* $ */) return false
    if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) return false

    const labelStart = start + 2
    const labelEnd = parseLinkLabel(state, start + 1)

    // parser failed to find ']', so it's not a valid note
    if (labelEnd < 0) return false

    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    if (!silent) {
      if (!state.env.sidenotes) state.env.sidenotes = []
      let title = String(state.env.sidenotes.length + 1)
      if ( state.env.sidenotes.includes(title) ) {
        title += ":"
      }
      state.env.sidenotes.push(title)
      const tokens = []

      state.md.inline.parse(
        state.src.slice(labelStart, labelEnd),
        state.md,
        state.env,
        tokens
      )

      const token = new state.Token('sidenote_ref', '', 1)
      token.meta = { title: title }
      state.tokens.push(token)
    }

    state.pos = labelEnd + 1
    state.posMax = max
    return true
  }

  // Process sidenote references ([$...])
  // Example: Here is a sidenote reference,[$1] and another.[$1]
  function sidenote_ref (state, silent) {
    const max = state.posMax
    const start = state.pos

    // should be at least 4 chars - "[$x]"
    if (start + 3 > max) return false

    if (!state.env.sidenotes ) state.env.sidenotes = {}
    if (state.src.charCodeAt(start) !== 0x5B/* [ */) return false
    if (state.src.charCodeAt(start + 1) !== 0x24/* $ */) return false

    let pos

    for (pos = start + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 0x20) return false
      if (state.src.charCodeAt(pos) === 0x0A) return false
      if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
        break
      }
    }

    if (pos === start + 2) return false // no empty sidenote labels
    if (pos >= max) return false
    pos++

    const title = state.src.slice(start + 2, pos - 1)

    if (!silent) {
      if (!state.env.sidenotes) state.env.sidenotes = []
      if (!(state.env.sidenotes.includes(title))) {
        state.env.sidenotes.push(title)
      }
      const token = new state.Token('sidenote_ref', '', 0)
      token.meta = { title: title }
      state.tokens.push(token)
    }

    state.pos = pos
    state.posMax = max
    return true
  }

  // Glue sidenote tokens to end of token stream
  function sidenote_tail (state) {
    let tokens
    let current
    let currentLabel
    let insideRef = false
    const refTokens = {}

    if (!state.env.sidenotes) { return }

    state.tokens = state.tokens.filter(function (tok) {
      if (tok.type === 'sidenote_reference_open') {
        insideRef = true
        current = []
        currentLabel = tok.meta.label
        return false
      }
      if (tok.type === 'sidenote_reference_close') {
        insideRef = false
        // prepend ':' to avoid conflict with Object.prototype members
        refTokens[':' + currentLabel] = current
        return false
      }
      if (insideRef) { current.push(tok) }
      return !insideRef
    })

    if (!state.env.sidenotes.list) { return }
    const list = state.env.sidenotes.list

    state.tokens.push(new state.Token('sidenote_block_open', '', 1))
    const token_style = new state.Token('sidenote_style', '', 0)
    state.tokens.unshift(token_style)

    for (let i = 0, l = list.length; i < l; i++) {
      const token_fo = new state.Token('sidenote_open', '', 1)
      token_fo.meta = { id: i, label: list[i].label }
      state.tokens.push(token_fo)

      if (list[i].tokens) {
        tokens = []

        const token_i = new state.Token('inline', '', 0)
        token_i.children = list[i].tokens
        token_i.content = list[i].content
        tokens.push(token_i)

      } else if (list[i].label) {
        tokens = refTokens[`:${list[i].label}`]
      }

      if (tokens) state.tokens = state.tokens.concat(tokens)

      let lastParagraph

      if (state.tokens[state.tokens.length - 1].type === 'paragraph_close') {
        lastParagraph = state.tokens.pop()
      } else {
        lastParagraph = null
      }

      if (lastParagraph) {
        state.tokens.push(lastParagraph)
      }

      state.tokens.push(new state.Token('sidenote_close', '', -1))
    }

    state.tokens.push(new state.Token('sidenote_block_close', '', -1))
  }
   function debug (state) {
    console.log(state)
   }

  md.block.ruler.before('reference', 'sidenote_def', sidenote_def, { alt: ['paragraph', 'reference'] })
  md.inline.ruler.after('image', 'sidenote_inline', sidenote_inline)
  md.inline.ruler.after('sidenote_inline', 'sidenote_ref', sidenote_ref)
  // md.core.ruler.after('inline', 'sidenote_tail', sidenote_tail)
  md.core.ruler.push('debug_log', debug)
};
