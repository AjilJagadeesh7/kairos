import { ModalShell } from '../../molecules/ModalShell'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'

interface ConsentDialogProps {
  providerName: string
  baseUrl: string
  onAccept: () => void
  onCancel: () => void
}

function hostOf(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/** Shown before the first request to a cloud provider. Nothing is sent until Allow. */
export function ConsentDialog({ providerName, baseUrl, onAccept, onCancel }: ConsentDialogProps) {
  return (
    <ModalShell onClose={onCancel} zIndex="z-[60]">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Icon name="cloud" size={18} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-text">Send content to {providerName}?</h2>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-text2">
          <p>
            {providerName} is a cloud service at <span className="font-mono">{hostOf(baseUrl)}</span>. When you use it,
            Kairos sends the page you're on, any notes and cards retrieved for your question, and your chat messages
            to that provider, where they're handled under its terms and privacy policy.
          </p>
          <p>Requests go straight from this device using your own API key. No Kairos server is involved.</p>
          <p className="font-medium text-text">Nothing is sent until you choose Allow.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="md" onClick={onAccept}>Allow</Button>
        </div>
      </div>
    </ModalShell>
  )
}
