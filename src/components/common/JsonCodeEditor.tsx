import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { type Diagnostic, forceLinting, linter, lintGutter } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';

interface JsonCodeEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  diagnostics?: readonly Diagnostic[];
  minHeight?: number;
}

function createEditorTheme(minHeight: number): Extension {
  return EditorView.theme(
    {
      '&': {
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
      },
      '&.cm-focused': {
        outline: 'none',
        borderColor: 'var(--border-focus)',
      },
      '.cm-scroller': {
        minHeight: `${minHeight}px`,
      },
      '.cm-content': {
        minHeight: `${minHeight}px`,
        padding: '10px 12px',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-surface)',
        color: 'var(--text-faint)',
        borderRight: '1px solid var(--border-default)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--bg-hover)',
      },
      '.cm-tooltip.cm-tooltip-lint': {
        zIndex: '1000',
      },
    },
    { dark: true },
  );
}

export function JsonCodeEditor({
  value,
  onChange,
  diagnostics = [],
  minHeight = 260,
}: JsonCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const diagnosticsRef = useRef<readonly Diagnostic[]>(diagnostics);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    diagnosticsRef.current = diagnostics;
    if (viewRef.current) {
      forceLinting(viewRef.current);
    }
  }, [diagnostics]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        highlightActiveLine(),
        json(),
        linter(jsonParseLinter()),
        linter(() => diagnosticsRef.current, { delay: 0 }),
        lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        createEditorTheme(minHeight),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }
          onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [minHeight]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: value,
      },
    });
  }, [value]);

  return <div ref={hostRef} />;
}
