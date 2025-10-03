// Process sidenotes
//
'use strict'


// Generates a style string for the sidenote CSS
// according to the provided parameters
function style_str (type, parameters) {
  let style_sidenote = ''
  style_sidenote += 'float: right;'
  style_sidenote += 'clear: right;'
  style_sidenote += 'width:' + parameters.width + ';'
  style_sidenote += 'margin:' + parameters.margin + ';'
  style_sidenote += 'box-sizing: border-box;'
  style_sidenote += 'background-color:' + parameters.background + ';'
  style_sidenote += 'border-left: 3px solid ' + parameters.borderLeftColor + ';'
  style_sidenote += 'padding: ' + parameters.padding + ';'
  style_sidenote += 'font-size: ' + parameters.fontSize + ';'

  let style_ref = ''
  style_ref += 'color: inherit;'
  style_ref += 'transition: color 0.2s;'
  
  let style_ref_hover = ''
  style_ref_hover += 'color: ' + parameters.colorRef + ';'

  if (type === 'sidenote') return style_sidenote
  if (type === 'ref') return style_ref
  if (type === 'ref_hover') return style_ref_hover
  if (type === 'all') {
    return `<style>
      .sidenote {
        ${style_sidenote}
      }
      .sn-pair sup {
        ${style_ref}
      }
      .sn-pair:hover sup {
        ${style_ref_hover}
      }
    </style>\n`
  }

  return ''
}

// Renders the sidenote reference in the text
// The sidenote itself is rendered at the end of the document
function render_sidenote_ref (tokens, idx, options, env, slf) {
  let title = tokens[idx].meta.title
  if (typeof env.docId === 'string') title += `-${env.docId}`
  return `<sup id="sidenote${title}">${title}</sup>`
}

// Renderers for individual sidenotes
function render_sidenote_open (tokens, idx, options, env, slf) {
  let title = tokens[idx].meta.title
  if (typeof env.docId === 'string') title += `-${env.docId}`
  return  `<span id="sidenote${title}" class="sidenote"><strong>${title}</strong>\n`
}

// Not really needed, but for symmetry
function render_sidenote_close () {
  return `</span>\n`
}

// Renders the CSS style for sidenotes
// This is added only once, at the start of the document
function render_sidenote_style (tokens, idx, options, env, slf) {
  const params = tokens[idx].meta.parameters || options.parameters
  return style_str('all', params)
}

export default function sidenote_plugin (md, options) {
  const parseLinkLabel = md.helpers.parseLinkLabel
  const isSpace = md.utils.isSpace

  options = options || {}
  const paramSidenoteStart = options.paramMarkerStart || '<!-- @sidenote'
  const paramSidenoteEnd = options.paramMarkerEnd || '-->'
  const parameters = {
    marker: options.marker || '$',
    inlineOnly: options.inlineOnly || false,
    width: options.width || '20ch',
    margin: options.margin || '0 0 0.2em 0.1em',
    background: options.background || 'rgba(128, 128, 128, 0.18)',
    borderLeftColor: options.borderLeftColor || 'rgba(128, 128, 128, 0.75)',
    padding: options.padding || '0.2em 0.2em',
    fontSize: options.fontSize || '0.8em',
    colorRef: options.colorRef || 'red'
  }
  // md.renderer.rules.sidenote_ref          = render_sidenote_ref
  // md.renderer.rules.sidenote_open         = render_sidenote_open
  // md.renderer.rules.sidenote_close        = render_sidenote_close
  md.renderer.rules.sidenote_style        = render_sidenote_style

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
    const title = state.src.slice(start + 2, pos - 1)

    const token_sref_o = new state.Token('sidenote_open', 'span', 1)
    token_sref_o.level = state.level++
    token_sref_o.attrPush(['class', 'sidenote'])
    token_sref_o.attrPush(['title', `sidenote${title}`])
    token_sref_o.meta = { title }
    state.tokens.push(token_sref_o)

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

    console.log(startLine, endLine)
    state.md.block.tokenize(state, startLine, endLine, true)

    state.parentType = oldParentType
    state.blkIndent -= 4
    state.tShift[startLine] = oldTShift
    state.sCount[startLine] = oldSCount
    state.bMarks[startLine] = oldBMark

    const token_sref_c = new state.Token('sidenote_close', 'span', -1)
    token_sref_c.level = --state.level
    state.tokens.push(token_sref_c)

    return true
  }

  // Process inline sidenotes ($[...])
  // Example: Here is a sidenote reference,$[Here is the sidenote.]
  function sidenote_inline (state, silent) {
    const max = state.posMax
    const start = state.pos

    if (start + 1 + parameters.marker.length >= max) return false
    if (state.src.slice(start, start + parameters.marker.length) !== parameters.marker) return false
    if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) return false

    const labelStart = start + 1 + parameters.marker.length
    const labelEnd = parseLinkLabel(state, start + parameters.marker.length)
    if (labelEnd < 0) return false

    // Check if the note is not empty.
    const note = state.src.slice(labelStart, labelEnd).trim()
    if (!note) return false

    // If is not silent, parse the note content
    if (!silent) {
      if (!state.env.sidenotes) state.env.sidenotes = []
      // Generate a title for the sidenote, in the inline case we use
      // a number based on the number of existing sidenotes.
      let title = String(state.env.sidenotes.length + 1)
      // Ensure unique titles
      if ( state.env.sidenotes.includes(title) ) {
        title += ":"
      }
      state.env.sidenotes.push(title)

      // apertura span wrapper
      const wrapperOpen = state.push('sidenote_wrapper_open', 'span', 1)
      wrapperOpen.attrPush(['class', 'sn-pair'])
      // wrapperOpen.level = state.level++

      // sup
      const supOpen = state.push('sidenote_sup_open', 'sup', 1)
      // supOpen.level = state.level++
      const supText = state.push('text', '', 0)
      supText.level = state.level
      supText.content = title
      const supClose = state.push('sidenote_sup_close', 'sup', -1)
      // supClose.level = state.level--

      // apertura span nota
      const noteOpen = state.push('sidenote_note_open', 'span', 1)
      noteOpen.attrPush(['class', 'sidenote'])
      // noteOpen.level = state.level++

      // contenuto della nota (inline parse)
      const tokens = []
      state.md.inline.parse(
        state.src.slice(labelStart, labelEnd),
        state.md,
        state.env,
        tokens
      )
      for (let i = 0; i < tokens.length; i++) {
        state.tokens.push(tokens[i])
      }

      // chiusura span nota
      const noteClose = state.push('sidenote_note_close', 'span', -1)
      // noteClose.level = state.level--

      // chiusura span wrapper
      const wrapperClose = state.push('sidenote_wrapper_close', 'span', -1)
      // wrapperClose.level = state.level--
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
      const token = state.push('sidenote_ref', '', 0)
      token.meta = { title }
    }

    state.pos = pos
    state.posMax = max
    return true
  }

  // Inject the CSS style for sidenotes
  function sidenote_css (state, silent) {
    if (!silent) {
      const token = new state.Token('sidenote_style', '', 0)
      token.meta = { parameters }
      state.tokens.push(token)
    }
    return false
  }

   function debug (state) {
    console.log(state)
   }

  md.inline.ruler.after('image', 'sidenote_inline', sidenote_inline)
  md.block.ruler.before('reference', 'sidenote_css', sidenote_css)

  // md.block.ruler.before('reference', 'sidenote_def', sidenote_def, { alt: ['paragraph', 'reference'] })
  // md.inline.ruler.after('sidenote_inline', 'sidenote_ref', sidenote_ref)
  md.core.ruler.push('debug_log', debug)
};

// CSS da mettere a posto