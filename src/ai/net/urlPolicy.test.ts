import { describe, it, expect } from 'vitest'
import { checkProviderUrl, locationForUrl, destinationLabel } from './urlPolicy'

describe('checkProviderUrl', () => {
  it.each([
    'https://api.openai.com/v1',
    'https://openrouter.ai/api/v1',
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://192.168.1.20:11434/v1',
    'http://10.0.2.2:11434/v1',
    'http://172.16.4.2/v1',
    'http://172.31.255.1/v1',
    'http://[::1]:8080/v1',
    'http://[fd12::1]:8080/v1',
    'http://nas.local:11434/v1',
  ])('allows %s', (url) => {
    expect(checkProviderUrl(url).ok).toBe(true)
  })

  it.each([
    'http://api.openai.com/v1',
    'http://8.8.8.8/v1',
    'http://172.32.0.1/v1',
    'http://192.169.0.1/v1',
    'ftp://localhost/v1',
    'localhost:11434',
  ])('refuses %s', (url) => {
    expect(checkProviderUrl(url).ok).toBe(false)
  })
})

describe('locationForUrl', () => {
  it('classifies local and LAN hosts as self-hosted, the rest as cloud', () => {
    expect(locationForUrl('http://localhost:11434/v1')).toBe('self-hosted')
    expect(locationForUrl('https://192.168.0.5/v1')).toBe('self-hosted')
    expect(locationForUrl('https://api.groq.com/openai/v1')).toBe('cloud')
    expect(locationForUrl('garbage')).toBe('cloud')
  })

  it('builds the chat-header label', () => {
    expect(destinationLabel('self-hosted', 'Ollama')).toBe('Self-hosted: Ollama')
    expect(destinationLabel('cloud', 'OpenRouter')).toBe('Cloud: OpenRouter')
    expect(destinationLabel('on-device', 'x')).toBe('On-device')
    expect(destinationLabel('on-device', 'On-device · MiniCPM5 2B (Q4_K_M)')).toBe('On-device: MiniCPM5 2B (Q4_K_M)')
    expect(locationForUrl('local://on-device')).toBe('on-device')
  })
})
