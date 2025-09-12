# markdown-it-sidenotes

[![npm version](https://img.shields.io/npm/v/markdown-it-sidenotes.svg)](https://www.npmjs.com/package/markdown-it-sidenotes)
[![downloads/month](https://img.shields.io/npm/dm/markdown-it-sidenotes.svg)](https://www.npmjs.com/package/markdown-it-sidenotes)
[![license](https://img.shields.io/npm/l/markdown-it-sidenotes.svg)](license)

A plugin for [markdown-it](https://github.com/markdown-it/markdown-it) that generates a semantic analytical index based on specially marked terms within the markdown text.

The plugin detects words marked with a customizable marker and wraps them in html tags with unique anchors, then creates a list of references at a designated placeholder location using `<!-- @sidenotes -->`.

The plugin is customizable as described below.

---