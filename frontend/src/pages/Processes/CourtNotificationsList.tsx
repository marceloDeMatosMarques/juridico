import { useState, useEffect } from 'react'
import { api } from '../../services/api'

type CourtNotification = {
  id: string
  source: string
  notification_type: string
  original_email_subject: string | null
  parsed_content: Record<string, unknown> | null
  deadline_date: string | null
  deadline_days_remaining: number | null
  is_urgent: boolean
  whatsapp_alert_sent: boolean
  read_at: string | null
  received_at: string
}

const TYPE_LABEL: Record<string, string> = {
  despacho:           'Despacho',
  intimacao:          'Intimação',
  sentenca:           'Sentença',
  acordao:            'Acórdão',
  audiencia_agendada: 'Audiência Agendada',
  juntada_peca:       'Juntada de Peça',
  determinacao:       'Determinação',
  outro:              'Outro',
}

const SOURCE_BADGE: Record<string, string> = {
  pje:          'bg-primary-subtle text-primary',
  eproc:        'bg-info-subtle text-info',
  projudi:      'bg-warning-subtle text-warning',
  saj:          'bg-secondary-subtle text-secondary',
  esaj:         'bg-secondary-subtle text-secondary',
  email_manual: 'bg-light text-muted',
}

const TYPE_ICON: Record<string, string> = {
  despacho:           '📋',
  intimacao:          '📬',
  sentenca:           '⚖️',
  acordao:            '🏛️',
  audiencia_agendada: '📅',
  juntada_peca:       '📎',
  determinacao:       '📌',
  outro:              '📄',
}

export default function CourtNotificationsList({ processId }: { processId: string }) {
  const [notifications, setNotifications] = useState<CourtNotification[]>([])

  useEffect(() => {
    api.get<{ notifications: CourtNotification[] }>(`/api/court-notifications/process/${processId}`)
      .then(({ data }) => setNotifications(data.notifications ?? []))
      .catch(() => null)
  }, [processId])

  async function markRead(id: string) {
    await api.patch(`/api/court-notifications/${id}/read`).catch(() => null)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  async function remove(id: string) {
    await api.delete(`/api/court-notifications/${id}`).catch(() => null)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (notifications.length === 0) return null

  const unread = notifications.filter(n => !n.read_at)
  const read   = notifications.filter(n => n.read_at)

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-3">
          Notificações do Tribunal ({notifications.length})
          {unread.length > 0 && (
            <span className="badge bg-danger ms-2">{unread.length} nova{unread.length !== 1 ? 's' : ''}</span>
          )}
        </h6>

        {unread.length > 0 && (
          <div className="mb-3">
            {unread.map(n => <NotificationRow key={n.id} n={n} onRead={markRead} onDelete={remove} />)}
          </div>
        )}

        {read.length > 0 && (
          <details>
            <summary className="text-muted fs-12 cursor-pointer mb-2">Lidas ({read.length})</summary>
            <div className="mt-2">
              {read.map(n => <NotificationRow key={n.id} n={n} onRead={markRead} onDelete={remove} />)}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function NotificationRow({
  n,
  onRead,
  onDelete,
}: {
  n: CourtNotification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const summary = n.parsed_content?.summary as string | undefined

  return (
    <div className={`d-flex align-items-start gap-3 py-2 px-2 rounded mb-1 ${!n.read_at ? 'border-start border-danger border-3 ps-2' : 'bg-light'}`}>
      <div className="flex-shrink-0 fs-18 mt-1">{TYPE_ICON[n.notification_type] ?? '📄'}</div>
      <div className="flex-grow-1 overflow-hidden">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-medium fs-13">{TYPE_LABEL[n.notification_type] ?? n.notification_type}</span>
          <span className={`badge fs-10 ${SOURCE_BADGE[n.source] ?? 'bg-light text-muted'}`}>
            {n.source.toUpperCase()}
          </span>
          {n.is_urgent && <span className="badge bg-danger fs-10">URGENTE</span>}
          {n.whatsapp_alert_sent && <span className="badge bg-success-subtle text-success fs-10" title="Alerta WhatsApp enviado">WA</span>}
          {n.parsed_content && Object.keys(n.parsed_content).length > 0 && (
            <span className="badge fs-10" style={{ background: 'rgba(99,102,241,.15)', color: '#6366f1' }} title="Parseado por IA">✦ IA</span>
          )}
        </div>
        {(summary ?? n.original_email_subject) && (
          <div className="text-muted fs-12 text-truncate">{summary ?? n.original_email_subject}</div>
        )}
        <div className="text-muted fs-12">
          {new Date(n.received_at).toLocaleString('pt-BR')}
          {n.deadline_date && (
            <> &nbsp;·&nbsp; <span className={n.is_urgent ? 'text-danger fw-semibold' : ''}>
              Prazo: {new Date(n.deadline_date).toLocaleDateString('pt-BR')}
              {n.deadline_days_remaining != null && ` (${n.deadline_days_remaining}d)`}
            </span></>
          )}
        </div>
      </div>
      <div className="d-flex gap-1 flex-shrink-0">
        {!n.read_at && (
          <button className="btn btn-xs btn-outline-secondary" onClick={() => onRead(n.id)} title="Marcar como lida">✓</button>
        )}
        <button className="btn btn-xs btn-outline-danger" onClick={() => onDelete(n.id)} title="Remover">
          <iconify-icon icon="solar:trash-bin-2-linear" />
        </button>
      </div>
    </div>
  )
}
