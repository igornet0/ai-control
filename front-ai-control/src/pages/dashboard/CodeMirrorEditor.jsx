// src/components/CodeMirrorEditor.jsx
import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { dataCode, dataCodeCompletions } from '../../parsers/dataCode';

export default function CodeMirrorEditor({ value, onChange }) {
  const editor = useRef();

  useEffect(() => {
    if (!editor.current) return;

    const startState = EditorState.create({
        doc: value,
        extensions: [
            keymap.of([...defaultKeymap, ...historyKeymap]),
            history(),
            highlightSpecialChars(),
            drawSelection(),
            syntaxHighlighting(defaultHighlightStyle),
            indentOnInput(),
            bracketMatching(),
            highlightActiveLine(),
            dataCode(), // Use DataCode language support instead of JavaScript
            autocompletion({ override: [dataCodeCompletions] }),
            oneDark,
            EditorView.updateListener.of(update => {
            if (update.docChanged) {
                const val = update.state.doc.toString();
                onChange(val);
            }
            }),
        ]
        });

    const view = new EditorView({
      state: startState,
      parent: editor.current
    });

    return () => view.destroy();
  }, [editor]);

  return <div ref={editor} style={{ height: '100%', width: '100%' }} />;
}