import { useState, useEffect, FormEvent } from 'react'
import { api } from '../../services/api'

type Hearing = {
  id: string
  title: string
  hearing_type: string
  hearing_date: string
  hearing_time: string
  location: string | null
  description: string | null
  status: string
  outlook_event_id: string | null
  google_event_id: string | null
}

type FormData = {
  title: string
  hearing_type: string
  hearing_date: string
  hearing_time: string
  end_time: string
  location: string
  description: string
  status: string
}

const EMPTY: FormData = {
  title: '', hearing_type: 'audiencia_instrucao', hearing_date: '', hearing_time: '',
  end_time: '', location: '', description: '', status: 'agendada',
}

const TYPE_LABEL: Record<string, string> = {
  audiencia_instrucao:   'Audiência de Instrução',
  audiencia_conciliacao: 'Audiência de Conciliação',
  audiencia_julgamento:  'Audiência de Julgamento',
  reuniao_cliente:       'Reunião c/ Cliente',
  prazo_processual:      'Prazo Processual',
  diligencia:            'Diligência',
  pericia:               'Perícia',
}

const STATUS_BADGE: Record<string, string> = {
  agendada:  'bg-primary-subtle text-primary',
  realizada: 'bg-success-subtle text-success',
  cancelada: 'bg-danger-subtle text-danger',
  adiada:    'bg-warning-subtle text-warning',
}

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', adiada: 'Adiada',
}

const TYPE_ICON: Record<string, string> = {
  audiencia_instrucao:   '⚖️',
  audiencia_conciliacao: '🤝',
  audiencia_julgamento:  '🏛️',
  reuniao_cliente:       '👤',
  prazo_processual:      '📅',
  diligencia:            '🔍',
  pericia:               '🔬',
}

export default function HearingList({ processId }: { processId: string }) {
  const [hearings, setHearings]     = useState<Hearing[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Hearing | null>(null)
  const [form, setForm]             = useState<FormData>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState('')

  useEffect(() => {
    api.get<{ hearings: Hearing[] }>(`/api/processes/${processId}/hearings`)
      .then(({ data }) => setHearings(data.hearings ?? []))
      .catch(() => null)
  }, [processId])

  function openNew() {
    setEditTarget(null)
    setForm(EMPTY)
    setErro('')
    setShowForm(true)
  }

  function openEdit(h: Hearing) {
    setEditTarget(h)
    setForm({
      title:        h.title,
      hearing_type: h.hearing_type,
      hearing_date: h.hearing_date.slice(0, 10),
      hearing_time: h.hearing_time,
      end_time:     '',
      location:     h.location ?? '',
      description:  h.description ?? '',
      status:       h.status,
    })
    setErro('')
    setShowForm(true)
  }

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErro('')
    try {
      const payload = {
        ...form,
        end_time:    form.end_time    || undefined,
        location:    form.location    || undefined,
        description: form.description || undefined,
      }
      if (editTarget) {
        const { data } = await api.put<Hearing>(`/api/processes/${processId}/hearings/${editTarget.id}`, payload)
        setHearings(prev => prev.map(h => h.id === editTarget.id ? data : h))
      } else {
        const { data } = await api.post<Hearing>(`/api/processes/${processId}/hearings`, payload)
        setHearings(prev => [...prev, data])
      }
      setShowForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao salvar.'
      setErro(msg)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta audiência?')) return
    await api.delete(`/api/processes/${processId}/hearings/${id}`).catch(() => null)
    setHearings(prev => prev.filter(h => h.id !== id))
    if (editTarget?.id === id) setShowForm(false)
  }

  const upcoming = hearings.filter(h => h.status === 'agendada').sort((a, b) => a.hearing_date.localeCompare(b.hearing_date))
  const past     = hearings.filter(h => h.status !== 'agendada').sort((a, b) => b.hearing_date.localeCompare(a.hearing_date))

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="card-title mb-0">Audiências e Prazos ({hearings.length})</h6>
          <button className="btn btn-sm btn-primary" onClick={openNew}>+ Nova</button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card border-primary mb-3">
            <div className="card-body">
              <h6 className="mb-3 fs-14">{editTarget ? 'Editar Audiência' : 'Nova Audiência'}</h6>
              {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}
              <form onSubmit={e => void handleSubmit(e)}>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label fs-13">Título *</label>
                    <input className="form-control form-control-sm" value={form.title} onChange={e => set('title', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13">Tipo *</label>
                    <select className="form-select form-select-sm" value={form.hearing_type} onChange={e => set('hearing_type', e.target.value)}>
                      {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fs-13">Data *</label>
                    <input className="form-control form-control-sm" type="date" value={form.hearing_date} onChange={e => set('hearing_date', e.target.value)} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fs-13">Horário *</label>
                    <input className="form-control form-control-sm" type="time" value={form.hearing_time} onChange={e => set('hearing_time', e.target.value)} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fs-13">Término</label>
                    <input className="form-control form-control-sm" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13">Local</label>
                    <input className="form-control form-control-sm" placeholder="Vara, sala, endereço..." value={form.location} onChange={e => set('location', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13">Status</label>
                    <select className="form-select form-select-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fs-13">Observações</label>
                    <textarea className="form-control form-control-sm" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
                  </div>
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Próximas */}
        {upcoming.length > 0 && (
          <div className="mb-3">
            <p className="text-muted fs-12 mb-2 text-uppercase fw-semibold">Próximas</p>
            {upcoming.map(h => <HearingRow key={h.id} h={h} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        )}

        {/* Passadas */}
        {past.length > 0 && (
          <div>
            <p className="text-muted fs-12 mb-2 text-uppercase fw-semibold">Realizadas / Passadas</p>
            {past.map(h => <HearingRow key={h.id} h={h} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        )}

        {hearings.length === 0 && !showForm && (
          <p className="text-muted text-center py-3 fs-13">Nenhuma audiência cadastrada.</p>
        )}
      </div>
    </div>
  )
}

function HearingRow({
  h,
  onEdit,
  onDelete,
}: {
  h: Hearing
  onEdit: (h: Hearing) => void
  onDelete: (id: string) => void
}) {
  const isPast = h.status !== 'agendada' ||
    new Date(`${h.hearing_date.slice(0, 10)}T${h.hearing_time}`) < new Date()

  return (
    <div className={`d-flex align-items-start gap-3 py-2 px-2 rounded mb-1 ${isPast ? 'bg-light' : 'border-start border-primary border-3 ps-2'}`}>
      <div className="flex-shrink-0 fs-20 mt-1">{TYPE_ICON[h.hearing_type] ?? '📌'}</div>
      <div className="flex-grow-1 overflow-hidden">
        <div className="fw-medium fs-13">{h.title}</div>
        <div className="text-muted fs-12">
          {TYPE_LABEL[h.hearing_type] ?? h.hearing_type} &nbsp;·&nbsp;
          {new Date(h.hearing_date).toLocaleDateString('pt-BR')} às {h.hearing_time}
          {h.location && <> &nbsp;·&nbsp; {h.location}</>}
        </div>
        {h.description && <div className="text-muted fs-12 text-truncate">{h.description}</div>}
      </div>
      <div className="d-flex align-items-center gap-2 flex-shrink-0">
        <span className={`badge ${STATUS_BADGE[h.status] ?? 'bg-secondary-subtle text-secondary'}`}>
          {STATUS_LABEL[h.status] ?? h.status}
        </span>
        {h.outlook_event_id && <span className="badge bg-info-subtle text-info fs-10" title="Sincronizado Outlook">OL</span>}
        {h.google_event_id  && <span className="badge bg-danger-subtle text-danger fs-10" title="Sincronizado Google">GC</span>}
        <button className="btn btn-xs btn-outline-secondary" onClick={() => onEdit(h)} title="Editar"><iconify-icon icon="solar:pen-linear" /></button>
        <button className="btn btn-xs btn-outline-danger"    onClick={() => onDelete(h.id)} title="Remover"><iconify-icon icon="solar:trash-bin-2-linear" /></button>
      </div>
    </div>
  )
}
