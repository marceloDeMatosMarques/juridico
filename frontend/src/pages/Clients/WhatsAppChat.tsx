import { useState, useEffect, useRef, FormEvent } from 'react'
import { api } from '../../services/api'

type Message = {
  id: string
  direction: 'sent' | 'received'
  content: string | null
  status: string
  sent_at: string
  message_type: string
}

export default function WhatsAppChat({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<{ messages: Message[] }>(`/api/whatsapp/history/${clientId}`)
      .then(({ data }) => setMessages(data.messages ?? []))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      await api.post('/api/whatsapp/send', { client_id: clientId, message: text.trim() })
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        direction: 'sent',
        content: text.trim(),
        status: 'sent',
        sent_at: new Date().toISOString(),
        message_type: 'text',
      }])
      setText('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao enviar.'
      alert(msg)
    } finally { setSending(false) }
  }

  return (
    <div className="card mt-3 border-success">
      <div className="card-header py-2 d-flex align-items-center justify-content-between bg-success-subtle">
        <span className="fw-semibold fs-13">
          <iconify-icon icon="solar:chat-round-like-linear" className="me-1 text-success" />WhatsApp
        </span>
        <button className="btn-close btn-close-sm" onClick={onClose} />
      </div>

      <div
        className="card-body p-2"
        style={{ maxHeight: 320, overflowY: 'auto', background: '#f0f2f5' }}
      >
        {loading ? (
          <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-success" /></div>
        ) : messages.length === 0 ? (
          <p className="text-muted text-center fs-13 py-3">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map(m => (
            <div
              key={m.id}
              className={`d-flex mb-2 ${m.direction === 'sent' ? 'justify-content-end' : 'justify-content-start'}`}
            >
              <div
                className={`px-3 py-2 rounded-3 fs-13 ${m.direction === 'sent' ? 'bg-success text-white' : 'bg-white border'}`}
                style={{ maxWidth: '75%', wordBreak: 'break-word' }}
              >
                <div>{m.content}</div>
                <div className={`fs-11 mt-1 ${m.direction === 'sent' ? 'text-white-50' : 'text-muted'}`} style={{ textAlign: 'right' }}>
                  {new Date(m.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {m.direction === 'sent' && m.status === 'delivered' && ' ✓✓'}
                  {m.direction === 'sent' && m.status === 'sent' && ' ✓'}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="card-footer p-2">
        <form onSubmit={e => void handleSend(e)} className="d-flex gap-2">
          <input
            className="form-control form-control-sm"
            placeholder="Mensagem..."
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={sending}
          />
          <button className="btn btn-sm btn-success" type="submit" disabled={sending || !text.trim()}>
            {sending ? <span className="spinner-border spinner-border-sm" /> : <iconify-icon icon="solar:send-twice-bold" />}
          </button>
        </form>
      </div>
    </div>
  )
}
