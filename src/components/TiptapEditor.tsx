import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2,
  List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon, Image as ImageIcon
} from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const btnStyle = (isActive: boolean) => ({
    background: isActive ? '#e0f2fe' : 'transparent',
    color: isActive ? '#0ea5e9' : '#64748b',
    border: 'none',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  });

  const addImage = () => {
    const url = window.prompt("URL de l'image :");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt("URL du lien :", previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '10px',
      borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
      borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
    }}>
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))} title="Gras">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))} title="Italique">
        <Italic size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} style={btnStyle(editor.isActive('strike'))} title="Barré">
        <Strikethrough size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} style={btnStyle(editor.isActive('code'))} title="Code Inline">
        <Code size={16} />
      </button>
      
      <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />

      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={btnStyle(editor.isActive('heading', { level: 2 }))} title="Titre 2">
        <Heading1 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={btnStyle(editor.isActive('heading', { level: 3 }))} title="Titre 3">
        <Heading2 size={16} />
      </button>

      <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))} title="Liste à puces">
        <List size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))} title="Liste numérotée">
        <ListOrdered size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btnStyle(editor.isActive('blockquote'))} title="Citation">
        <Quote size={16} />
      </button>

      <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />

      <button type="button" onClick={setLink} style={btnStyle(editor.isActive('link'))} title="Lien">
        <LinkIcon size={16} />
      </button>
      <button type="button" onClick={addImage} style={btnStyle(false)} title="Image">
        <ImageIcon size={16} />
      </button>

      <div style={{ flex: 1 }} />

      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{ ...btnStyle(false), opacity: editor.can().undo() ? 1 : 0.5 }} title="Annuler">
        <Undo size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{ ...btnStyle(false), opacity: editor.can().redo() ? 1 : 0.5 }} title="Refaire">
        <Redo size={16} />
      </button>
    </div>
  );
};

export default function TiptapEditor({ content, onChange, placeholder = "Rédigez votre article ici..." }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-4 min-h-[300px]',
        style: 'max-width: none; outline: none;'
      },
    },
  });

  // Effect to update content when the prop changes entirely (like editing a different post)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Intentionally omitting 'editor' to prevent cursor reset issues

  return (
    <div style={{ 
      border: '1px solid #e2e8f0', 
      borderRadius: '12px', 
      background: 'white',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
    }}>
      <MenuBar editor={editor} />
      <div style={{ flex: 1, minHeight: '300px', cursor: 'text' }} onClick={() => editor?.commands.focus()}>
        <style dangerouslySetInnerHTML={{__html: `
          .ProseMirror p.is-editor-empty:first-child::before {
            color: #94a3b8;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1rem 0;
          }
          .ProseMirror a {
            color: #0ea5e9;
            text-decoration: underline;
          }
        `}} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
