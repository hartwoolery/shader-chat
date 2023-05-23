import {EditorView, basicSetup} from "codemirror"
import {keymap} from "@codemirror/view"
import {cpp} from "@codemirror/lang-cpp"
import { materialDark } from 'cm6-theme-material-dark'
import {indentWithTab} from "@codemirror/commands"

let editor = new EditorView({
	extensions: [basicSetup, cpp(), keymap.of([indentWithTab]), materialDark],
	parent: document.getElementById("output")
})

  

document.editor = editor;

//node_modules/.bin/rollup public/rollup/editor.mjs -f iife -o public/javascripts/editor.bundle.js -p @rollup/plugin-node-resolve