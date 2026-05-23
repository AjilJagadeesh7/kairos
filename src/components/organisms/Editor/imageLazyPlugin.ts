import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

// ProseMirror plugin that sets loading="lazy" on every <img> the editor renders.
// This defers off-screen base64 / remote images from being decoded immediately,
// which matters most for large note bodies with many embedded images.
const imageLazyKey = new PluginKey('imageLazy')

function applyLazyToImages(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img:not([loading])').forEach(img => {
    img.loading = 'lazy'
  })
}

export const imageLazyPlugin = $prose(
  () =>
    new Plugin({
      key: imageLazyKey,
      view(editorView) {
        // Apply once on mount
        applyLazyToImages(editorView.dom as HTMLElement)
        return {
          update(view) {
            // Re-apply after each editor update (new images may have been inserted)
            applyLazyToImages(view.dom as HTMLElement)
          },
        }
      },
    }),
)
