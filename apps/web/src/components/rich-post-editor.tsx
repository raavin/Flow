import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Link as TiptapLink } from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import type { KeyboardEvent, ReactNode } from 'react'

type Insert = (text: string, deleteLength: number) => void
export function RichPostEditor({
  initialContent,
  onChange,
  onKeyDown,
  renderSuggestions,
}: {
  initialContent: string
  onChange: (html: string, beforeCursor: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, insert: Insert) => void
  renderSuggestions: (insert: Insert) => ReactNode
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      TaskList,
      TaskItem.configure({ nested: false }),
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "What's on your mind?" }),
    ],
    content: initialContent,
    autofocus: 'end',
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      onChange(html === '<p></p>' ? '' : html, e.state.doc.textBetween(0, e.state.selection.anchor, '\n'))
    },
    editorProps: { attributes: { class: 'min-h-[220px] outline-none text-[15px] leading-relaxed text-ink' } },
  })
  const insert: Insert = (text, deleteLength) => {
    if (!editor) return
    const anchor = editor.state.selection.anchor
    editor
      .chain()
      .focus()
      .deleteRange({ from: anchor - deleteLength, to: anchor })
      .insertContent(text)
      .run()
  }
  return (
    <>
      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-cloud/40 px-4 py-2">
        {(
          [
            {
              name: 'bold',
              label: 'B',
              style: { fontWeight: 700 } as React.CSSProperties,
              action: () => editor?.chain().focus().toggleBold().run(),
            },
            {
              name: 'italic',
              label: 'I',
              style: { fontStyle: 'italic' } as React.CSSProperties,
              action: () => editor?.chain().focus().toggleItalic().run(),
            },
          ] as const
        ).map(({ name, label, style, action }) => (
          <button
            key={name}
            type="button"
            title={name}
            style={style}
            className={`flex h-7 w-8 items-center justify-center rounded border text-xs transition ${editor?.isActive(name) ? 'border-ink/40 bg-ink/15 text-ink' : 'border-border bg-white text-ink/70 hover:border-ink/40 hover:text-ink'}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          title="heading"
          className={`flex h-7 w-8 items-center justify-center rounded border text-xs transition ${editor?.isActive('heading', { level: 3 }) ? 'border-ink/40 bg-ink/15 text-ink' : 'border-border bg-white text-ink/70 hover:border-ink/40 hover:text-ink'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H₁
        </button>
        <button
          type="button"
          title="list"
          className={`flex h-7 w-8 items-center justify-center rounded border text-xs transition ${editor?.isActive('bulletList') ? 'border-ink/40 bg-ink/15 text-ink' : 'border-border bg-white text-ink/70 hover:border-ink/40 hover:text-ink'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          ≡
        </button>
        <button
          type="button"
          title="checklist"
          className={`flex h-7 w-8 items-center justify-center rounded border text-xs transition ${editor?.isActive('taskList') ? 'border-ink/40 bg-ink/15 text-ink' : 'border-border bg-white text-ink/70 hover:border-ink/40 hover:text-ink'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          ☑
        </button>
        <button
          type="button"
          title="link"
          className="flex h-7 w-8 items-center justify-center rounded border border-border bg-white text-xs text-ink/70 hover:border-ink/40 hover:text-ink transition"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = prompt('URL:')
            if (url) editor?.chain().focus().setLink({ href: url }).run()
          }}
        >
          ⌘K
        </button>
        <div className="flex-1" />
        <span className="text-xs text-ink/30">@mention #topic /command</span>
      </div>

      <div className="relative px-6 pt-4 pb-2">
        <EditorContent editor={editor} onKeyDown={(event) => onKeyDown(event, insert)} />
        {renderSuggestions(insert)}
      </div>
    </>
  )
}
