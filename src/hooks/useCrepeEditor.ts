import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
import { replaceAll } from '@milkdown/utils'
import { math } from '@milkdown/plugin-math'

import { wikilinkHighlightPlugin } from '../components/organisms/Editor/wikilinkPlugin'
import { calloutPlugin } from '../components/organisms/Editor/calloutPlugin'
import { linkInputRulePlugin, linkKeymapPlugin, linkExitPlugin } from '../components/organisms/Editor/linkInputRulePlugin'
import { pasteSanitizePlugin } from '../components/organisms/Editor/pasteSanitizePlugin'
import { imageLazyPlugin } from '../components/organisms/Editor/imageLazyPlugin'
import { attachmentRenderPlugin } from '../components/organisms/Editor/attachmentRenderPlugin'
import { queryBlockPlugin } from '../components/organisms/Editor/queryBlockPlugin'
import { chartCodeBlockPlugin } from '../components/organisms/Editor/chartCodeBlockPlugin'
import { addBlockPlugin } from '../components/organisms/Editor/mobileAddBlockPlugin'
import { mobileListToolbarPlugin } from '../components/organisms/Editor/mobileListToolbarPlugin'
import { clickBelowAppendPlugin } from '../components/organisms/Editor/clickBelowAppendPlugin'
import { assertUploadSize } from '../tiers/uploadGuard'
import { importAttachment, attachmentRef } from '../attachments/attachmentService'
import type { MutableRefObject, RefObject } from 'react'

interface CrepeEditorParams {
  rootRef: RefObject<HTMLDivElement | null>
  crepeRef: MutableRefObject<Crepe | null>
  noteId: string
  initialMarkdown: string
  readOnly: boolean
  onChange: (markdown: string) => void
  enableAttachments?: boolean
  /** Called once the editor exists; returns its own detach function. */
  attachTooltip: () => (() => void) | undefined
}

/**
 * Owns the Crepe (Milkdown) instance for one editor surface: creation with the
 * full plugin stack, read-only toggling, swapping content when the note changes,
 * and teardown. Returns `attachmentsRef` so sibling hooks can read the current
 * attachment mode at event time.
 */
export function useCrepeEditor({
  rootRef, crepeRef, noteId, initialMarkdown, readOnly, onChange, enableAttachments, attachTooltip,
}: CrepeEditorParams): MutableRefObject<boolean | undefined> {
  const editorReadyRef     = useRef(false)
  const prevNoteIdRef      = useRef(noteId)
  const initialMarkdownRef = useRef(initialMarkdown)
  const pendingContentRef  = useRef<string | null>(null)
  const onChangeRef        = useRef(onChange)
  const readOnlyRef        = useRef(readOnly)
  const attachmentsRef     = useRef(enableAttachments)

  // Keep the flags current for the upload plugins (read at event time).
  useEffect(() => { attachmentsRef.current = enableAttachments }, [enableAttachments])
  useEffect(() => { onChangeRef.current    = onChange          }, [onChange])

  useEffect(() => {
    readOnlyRef.current = readOnly
    if (!editorReadyRef.current || !crepeRef.current) return
    crepeRef.current.editor.action(ctx => {
      ctx.get(editorViewCtx).setProps({ editable: () => !readOnly })
    })
  }, [readOnly, crepeRef])

  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    if (crepeRef.current && editorReadyRef.current) {
      crepeRef.current.editor.action(replaceAll(initialMarkdown))
    } else {
      pendingContentRef.current = initialMarkdown
    }
  }, [noteId, initialMarkdown, crepeRef])

  // When "/" is the only char and the editor regains focus, ping the cursor to
  // force the slash menu to re-trigger.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onFocus = () => {
      const crepe = crepeRef.current
      if (!crepe || !editorReadyRef.current) return
      crepe.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { $from } = state.selection
        if ($from.parent.type.name !== 'paragraph') return
        if ($from.parent.textContent !== '/') return
        const end   = state.selection.from
        const start = $from.start($from.depth)
        if (end === start) return
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start)))
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)))
      })
    }
    root.addEventListener('focusin', onFocus)
    return () => root.removeEventListener('focusin', onFocus)
  }, [rootRef, crepeRef])

  useEffect(() => {
    if (!rootRef.current) return
    const fileToDataURL = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        if (!assertUploadSize(file.size, file.name)) {
          reject(new Error('File exceeds plan limit'))
          return
        }
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    // When attachments are enabled, imported media becomes a standalone file
    // referenced by attachment://<id>; otherwise (e.g. kanban) inline base64.
    const handleUpload = async (file: File): Promise<string> => {
      if (attachmentsRef.current) {
        const rec = await importAttachment(file)
        if (!rec) throw new Error('File rejected')
        return attachmentRef(rec.id)
      }
      return fileToDataURL(file)
    }

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialMarkdownRef.current,
      // BlockEdit (Crepe's tabbed slash menu + block handle) is disabled in favour
      // of the custom keyboard-navigable <SlashMenu>.
      features: { [Crepe.Feature.Toolbar]: false, [Crepe.Feature.BlockEdit]: false },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: handleUpload },
      },
    })
    crepeRef.current = crepe
    crepe.editor.use(wikilinkHighlightPlugin)
    crepe.editor.use(calloutPlugin)
    crepe.editor.use(linkInputRulePlugin)
    crepe.editor.use(linkKeymapPlugin)
    crepe.editor.use(linkExitPlugin)
    crepe.editor.use(math)
    crepe.editor.use(pasteSanitizePlugin)
    crepe.editor.use(imageLazyPlugin)
    crepe.editor.use(attachmentRenderPlugin())
    crepe.editor.use(queryBlockPlugin)
    crepe.editor.use(chartCodeBlockPlugin)
    crepe.editor.use(addBlockPlugin)
    crepe.editor.use(mobileListToolbarPlugin)
    crepe.editor.use(clickBelowAppendPlugin)
    crepe.on(listener => { listener.markdownUpdated((_ctx, md) => onChangeRef.current(md)) })

    void crepe.create().then(() => {
      editorReadyRef.current = true
      if (pendingContentRef.current !== null) {
        crepe.editor.action(replaceAll(pendingContentRef.current))
        pendingContentRef.current = null
      }
      if (readOnlyRef.current) {
        crepe.editor.action(ctx => {
          ctx.get(editorViewCtx).setProps({ editable: () => false })
        })
      }
    })

    const detachTooltip = attachTooltip()
    return () => {
      detachTooltip?.()
      crepeRef.current       = null
      editorReadyRef.current = false
      void crepe.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return attachmentsRef
}
