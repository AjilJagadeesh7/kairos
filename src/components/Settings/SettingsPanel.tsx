import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { deriveKey } from '../../crypto/crypto'
import { setSetting } from '../../db/schema'
import { Button } from '../ui/Button'

export function SettingsPanel(): JSX.Element {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [modelName, setModelName] = useState('Phi-3.5-mini-instruct-q4f16_1-MLC')
  const [message, setMessage] = useState('')

  async function savePassword() {
    if (!password.trim()) return
    await deriveKey(password)
    await setSetting('passwordHint', 'set')
    setMessage('Password key material refreshed locally.')
    setPassword('')
  }

  async function saveModel() {
    await setSetting('aiModel', modelName)
    setMessage('Preferred AI model saved.')
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="xs" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5">
          <ArrowLeft size={13} /> Back
        </Button>
        <h2 className="text-xl font-bold text-text">Settings</h2>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text">Encryption Password</h3>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-text2"
          placeholder="Set or rotate password"
        />
        <Button variant="primary" size="sm" onClick={() => void savePassword()}>
          Save Password
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text">AI Model</h3>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          className="w-full rounded border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none focus:border-text2"
        />
        <Button variant="primary" size="sm" onClick={() => void saveModel()}>
          Save Model
        </Button>
      </div>

      {message && <p className="rounded bg-surface3 p-2 text-sm text-text2">{message}</p>}
    </section>
  )
}
