import { useState, useEffect, FormEvent } from 'react'
import { api } from '../../services/api'

type Installment = {
  id: string
  installment_number: number
  value: string
  due_date: string
  paid_date: string | null
  status: string
  payment_method: string | null
}

type FinancialRecord = {
  id: string
  record_type: string
  description: string
  total_value: string
  cause_value: string | null
  percentage: string
  calculated_fee: string | null
  payment_status: string
  payment_type: string
  installments_total: number
  installments_paid: number
  due_date: string | null
  paid_date: string | null
  notes: string | null
  installments: Installment[]
}

type FormData = {
  record_type: string
  description: string
  total_value: string
  cause_value: string
  percentage: string
  payment_type: string
  installments_total: string
  due_date: string
  notes: string
}

const EMPTY: FormData = {
  record_type: 'honorario', description: '', total_value: '', cause_value: '',
  percentage: '30', payment_type: 'unico', installments_total: '1', due_date: '', notes: '',
}

const TYPE_LABEL: Record<string, string> = {
  honorario:       'Honorário',
  despesa:         'Despesa',
  reembolso:       'Reembolso',
  honorario_exito: 'Honorário de Êxito',
}

const STATUS_BADGE: Record<string, string> = {
  pendente:  'bg-warning-subtle text-warning',
  parcial:   'bg-info-subtle text-info',
  pago:      'bg-success-subtle text-success',
  cancelado: 'bg-secondary-subtle text-secondary',
  atrasado:  'bg-danger-subtle text-danger',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', cancelado: 'Cancelado', atrasado: 'Atrasado',
}

function brl(v: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function isOverdue(record: FinancialRecord) {
  return (record.payment_status === 'pendente' || record.payment_status === 'parcial') &&
    record.due_date && new Date(record.due_date) < new Date()
}

export default function FinancialList({ processId }: { processId: string }) {
  const [records, setRecords]   = useState<FinancialRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormData>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [erro, setErro]         = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.get<{ records: FinancialRecord[] }>(`/api/processes/${processId}/financial`)
      .then(({ data }) => setRecords(data.records ?? []))
      .catch(() => null)
  }, [processId])

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErro('')
    try {
      const payload = {
        record_type:        form.record_type,
        description:        form.description,
        total_value:        parseFloat(form.total_value),
        cause_value:        form.cause_value ? parseFloat(form.cause_value) : undefined,
        percentage:         form.percentage ? parseFloat(form.percentage) : undefined,
        payment_type:       form.payment_type,
        installments_total: parseInt(form.installments_total) || 1,
        due_date:           form.due_date || undefined,
        notes:              form.notes || undefined,
      }
      const { data } = await api.post<FinancialRecord>(`/api/processes/${processId}/financial`, payload)
      setRecords(prev => [data, ...prev])
      setForm(EMPTY)
      setShowForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao salvar.'
      setErro(msg)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este registro financeiro?')) return
    await api.delete(`/api/processes/${processId}/financial/${id}`).catch(() => null)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function handlePay(recordId: string, installmentId: string) {
    const { data } = await api.patch<FinancialRecord>(
      `/api/processes/${processId}/financial/${recordId}/installments/${installmentId}/pay`
    )
    setRecords(prev => prev.map(r => r.id === recordId ? data : r))
  }

  async function handleMarkPaid(recordId: string) {
    const { data } = await api.put<FinancialRecord>(`/api/processes/${processId}/financial/${recordId}`, {
      payment_status: 'pago',
      paid_date: new Date().toISOString().slice(0, 10),
    })
    setRecords(prev => prev.map(r => r.id === recordId ? data : r))
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalPendente = records
    .filter(r => r.payment_status === 'pendente' || r.payment_status === 'parcial' || r.payment_status === 'atrasado')
    .reduce((s, r) => s + Number(r.total_value), 0)
  const totalPago = records
    .filter(r => r.payment_status === 'pago')
    .reduce((s, r) => s + Number(r.total_value), 0)

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 className="card-title mb-0">Financeiro ({records.length})</h6>
            {records.length > 0 && (
              <div className="d-flex gap-3 mt-1">
                <span className="fs-12 text-warning">A receber: <strong>{brl(totalPendente)}</strong></span>
                <span className="fs-12 text-success">Recebido: <strong>{brl(totalPago)}</strong></span>
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => { setShowForm(s => !s); setErro('') }}>
            {showForm ? 'Cancelar' : '+ Novo'}
          </button>
        </div>

        {showForm && (
          <div className="card border-primary mb-3">
            <div className="card-body">
              <h6 className="mb-3 fs-14">Novo Registro Financeiro</h6>
              {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}
              <form onSubmit={e => void handleSubmit(e)}>
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label fs-13">Tipo *</label>
                    <select className="form-select form-select-sm" value={form.record_type} onChange={e => set('record_type', e.target.value)}>
                      {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fs-13">Descrição *</label>
                    <input className="form-control form-control-sm" value={form.description} onChange={e => set('description', e.target.value)} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fs-13">Valor Total (R$) *</label>
                    <input className="form-control form-control-sm" type="number" step="0.01" min="0.01" value={form.total_value} onChange={e => set('total_value', e.target.value)} required />
                  </div>
                  {form.record_type === 'honorario' && <>
                    <div className="col-md-4">
                      <label className="form-label fs-13">Valor da Causa (R$)</label>
                      <input className="form-control form-control-sm" type="number" step="0.01" value={form.cause_value} onChange={e => set('cause_value', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fs-13">% Honorários</label>
                      <input className="form-control form-control-sm" type="number" step="0.5" min="0" max="100" value={form.percentage} onChange={e => set('percentage', e.target.value)} />
                    </div>
                  </>}
                  <div className="col-md-4">
                    <label className="form-label fs-13">Pagamento</label>
                    <select className="form-select form-select-sm" value={form.payment_type} onChange={e => set('payment_type', e.target.value)}>
                      <option value="unico">À vista</option>
                      <option value="parcelado">Parcelado</option>
                    </select>
                  </div>
                  {form.payment_type === 'parcelado' && (
                    <div className="col-md-4">
                      <label className="form-label fs-13">Nº de Parcelas</label>
                      <input className="form-control form-control-sm" type="number" min="2" max="120" value={form.installments_total} onChange={e => set('installments_total', e.target.value)} />
                    </div>
                  )}
                  <div className="col-md-4">
                    <label className="form-label fs-13">Vencimento</label>
                    <input className="form-control form-control-sm" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fs-13">Observações</label>
                    <textarea className="form-control form-control-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-sm btn-primary mt-3" type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </div>
          </div>
        )}

        {records.length === 0 && !showForm && (
          <p className="text-muted text-center py-3 fs-13">Nenhum registro financeiro.</p>
        )}

        {records.map(r => (
          <div key={r.id} className={`border rounded mb-2 ${isOverdue(r) ? 'border-danger' : ''}`}>
            <div className="d-flex align-items-start gap-2 p-2">
              <div className="flex-grow-1">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="badge bg-light text-dark border fs-11">{TYPE_LABEL[r.record_type]}</span>
                  <span className={`badge fs-11 ${STATUS_BADGE[r.payment_status] ?? 'bg-secondary-subtle'}`}>
                    {STATUS_LABEL[r.payment_status] ?? r.payment_status}
                  </span>
                  {isOverdue(r) && <span className="badge bg-danger fs-11">VENCIDO</span>}
                  <span className="fw-semibold fs-13">{brl(r.total_value)}</span>
                  {r.payment_type === 'parcelado' && (
                    <span className="text-muted fs-12">{r.installments_paid}/{r.installments_total} parcelas</span>
                  )}
                </div>
                <div className="fs-13 mt-1">{r.description}</div>
                <div className="text-muted fs-12">
                  {r.due_date && <>Vence: {new Date(r.due_date).toLocaleDateString('pt-BR')}</>}
                  {r.paid_date && <> · Pago em: {new Date(r.paid_date).toLocaleDateString('pt-BR')}</>}
                </div>
              </div>
              <div className="d-flex gap-1 flex-shrink-0 align-items-start">
                {r.payment_type === 'unico' && r.payment_status !== 'pago' && (
                  <button className="btn btn-xs btn-outline-success" onClick={() => void handleMarkPaid(r.id)} title="Marcar como pago">✓ Pago</button>
                )}
                {r.payment_type === 'parcelado' && r.installments.length > 0 && (
                  <button className="btn btn-xs btn-outline-secondary" onClick={() => toggleExpanded(r.id)}>
                    {expanded.has(r.id) ? '▲' : '▼'} Parcelas
                  </button>
                )}
                <button className="btn btn-xs btn-outline-danger" onClick={() => void handleDelete(r.id)} title="Remover">
                  <iconify-icon icon="solar:trash-bin-2-linear" />
                </button>
              </div>
            </div>

            {expanded.has(r.id) && r.installments.length > 0 && (
              <div className="border-top px-2 pb-2">
                {r.installments.map(inst => (
                  <div key={inst.id} className="d-flex align-items-center gap-2 py-1 border-bottom fs-12">
                    <span className="text-muted" style={{ minWidth: 28 }}>#{inst.installment_number}</span>
                    <span>{brl(inst.value)}</span>
                    <span className="text-muted">
                      {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className={`badge fs-10 ${STATUS_BADGE[inst.status] ?? 'bg-secondary-subtle'}`}>
                      {STATUS_LABEL[inst.status] ?? inst.status}
                    </span>
                    {inst.paid_date && <span className="text-muted fs-11">✓ {new Date(inst.paid_date).toLocaleDateString('pt-BR')}</span>}
                    {inst.status !== 'pago' && (
                      <button className="btn btn-xs btn-outline-success ms-auto" onClick={() => void handlePay(r.id, inst.id)}>
                        Pagar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
