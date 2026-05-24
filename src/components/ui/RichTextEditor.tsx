import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'

interface Props {
  content: string
  onChange: (html: string) => void
}

function ToolBtn({ active, onClick, title, children }: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: '0 .45rem',
        minWidth: 30,
        height: 28,
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: 6,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        cursor: 'pointer',
        fontSize: '.78rem',
        fontWeight: active ? 700 : 500,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ content, onChange }: Props) {
  const initialized = useRef(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // Sync initial content when tournament data first loads from DB
  useEffect(() => {
    if (!editor || initialized.current) return
    if (content) {
      editor.commands.setContent(content, false)
      initialized.current = true
    }
  }, [editor, content])

  if (!editor) return null

  const sep = <div style={{ width: 1, background: 'var(--border)', margin: '0 .15rem', alignSelf: 'stretch' }} />

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: '#f8fafc', transition: 'border-color .2s' }}
      onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
      onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '.25rem', padding: '.35rem .5rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc' }}>
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Tučné (Ctrl+B)">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Kurzíva (Ctrl+I)">
          <em style={{ fontStyle: 'italic' }}>I</em>
        </ToolBtn>
        {sep}
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Nadpis">
          H2
        </ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Podnadpis">
          H3
        </ToolBtn>
        {sep}
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Odrážkový seznam">
          ☰
        </ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Číslovaný seznam">
          1≡
        </ToolBtn>
      </div>
      {/* Editor */}
      <div className="rich-editor-area" style={{ padding: '.55rem .9rem', background: '#fff', minHeight: 100, cursor: 'text' }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
