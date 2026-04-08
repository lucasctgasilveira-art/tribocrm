import { useState, useRef, useMemo } from 'react'
import { X, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { importLeads, downloadImportTemplate, type ImportLeadsResult } from '../../../services/leads.service'

interface PipelineOption {
  id: string
  name: string
  stages: { id: string; name: string; color: string }[]
}

interface UserOption {
  id: string
  name: string
}

interface TeamOption {
  id: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  pipelines: PipelineOption[]
  users: UserOption[]
  teams: TeamOption[]
  onImported?: (result: ImportLeadsResult) => void
}

type Step = 1 | 2
type DistributionType = 'ROUND_ROBIN_ALL' | 'ROUND_ROBIN_TEAM' | 'SPECIFIC_USER'

const columns = [
  { name: 'Nome', required: true },
  { name: 'Empresa', required: false },
  { name: 'E-mail', required: false },
  { name: 'Telefone', required: false },
  { name: 'WhatsApp', required: false },
  { name: 'CPF', required: false },
  { name: 'CNPJ', required: false },
  { name: 'Cargo', required: false },
  { name: 'Origem', required: false },
  { name: 'Temperatura', required: false },
  { name: 'Valor Esperado', required: false },
  { name: 'Observações', required: false },
]

const CSS = `
  @keyframes imFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes imScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .im-body::-webkit-scrollbar{width:4px}.im-body::-webkit-scrollbar-track{background:transparent}
  .im-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}.im-body{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`

export default function ImportLeadsModal({ open, onClose, pipelines, users, teams, onImported }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [distributionType, setDistributionType] = useState<DistributionType>('ROUND_ROBIN_ALL')
  const [responsibleId, setResponsibleId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportLeadsResult | null>(null)
  const [error, setError] = useState('')
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const stages = useMemo(() => {
    const p = pipelines.find(p => p.id === pipelineId)
    return p?.stages ?? []
  }, [pipelines, pipelineId])

  if (!open) return null

  function reset() {
    setStep(1); setFile(null); setDragOver(false)
    setPipelineId(''); setStageId('')
    setDistributionType('ROUND_ROBIN_ALL'); setResponsibleId(''); setTeamId('')
    setImporting(false); setResult(null); setError('')
  }

  function handleClose() { reset(); onClose() }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true)
    try {
      await downloadImportTemplate()
    } catch {
      setError('Não foi possível baixar o modelo.')
    }
    setDownloadingTemplate(false)
  }

  function handleFile(f: File) {
    const ok = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')
    if (!ok) {
      setError('Use um arquivo .xlsx ou .xls')
      return
    }
    setError('')
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    if (!file || !pipelineId || !stageId) {
      setError('Selecione o arquivo, o pipeline e a etapa inicial.')
      return
    }
    if (distributionType === 'ROUND_ROBIN_TEAM' && !teamId) {
      setError('Selecione uma equipe para a distribuição por equipe.')
      return
    }
    setImporting(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pipelineId', pipelineId)
      fd.append('stageId', stageId)
      fd.append('distributionType', distributionType)
      if (distributionType === 'SPECIFIC_USER' && responsibleId) {
        fd.append('responsibleId', responsibleId)
      }
      if (distributionType === 'ROUND_ROBIN_TEAM') {
        fd.append('teamId', teamId)
      }
      const data = await importLeads(fd)
      setResult(data)
      onImported?.(data)
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Erro ao importar leads')
    }
    setImporting(false)
  }

  const fileSizeStr = file
    ? (file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`)
    : ''

  const distOk = distributionType !== 'ROUND_ROBIN_TEAM' || !!teamId
  const canImport = !!file && !!pipelineId && !!stageId && distOk && !importing && !result

  return (
    <>
      <style>{CSS}</style>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, animation: 'imFadeIn 0.2s ease-out' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'imScaleIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Importar Leads</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Importe sua base de leads via planilha Excel</p>
          </div>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Body */}
        <div className="im-body" style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Result screen */}
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <CheckCircle2 size={40} color="#22c55e" strokeWidth={1.5} />
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>Importação concluída</div>
              </div>
              <ResultCard icon={<CheckCircle2 size={16} strokeWidth={1.5} />} color="#22c55e" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.2)" text={`${result.imported} lead${result.imported !== 1 ? 's' : ''} importado${result.imported !== 1 ? 's' : ''}`} />
              <ResultCard icon={<AlertTriangle size={16} strokeWidth={1.5} />} color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" text={`${result.duplicates} duplicata${result.duplicates !== 1 ? 's' : ''} ignorada${result.duplicates !== 1 ? 's' : ''}`} />
              <ResultCard icon={<XCircle size={16} strokeWidth={1.5} />} color="#ef4444" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.2)" text={`${result.errors} erro${result.errors !== 1 ? 's' : ''}`} />
              {result.errorDetails.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Ver detalhes dos erros</summary>
                  <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    {result.errorDetails.map((d, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: i < result.errorDetails.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        Linha {d.row}: {d.reason}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : step === 1 ? (
            <>
              {/* Step 1: download template */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 20 }}>
                <Download size={32} color="#f97316" strokeWidth={1.5} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 6px' }}>Baixe o modelo Excel</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  Use nosso modelo para garantir que os dados sejam importados corretamente.<br />Não altere os nomes das colunas.
                </p>
                <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: downloadingTemplate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: downloadingTemplate ? 0.7 : 1 }}>
                  {downloadingTemplate ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={1.5} />}
                  {downloadingTemplate ? 'Baixando...' : 'Baixar modelo .xlsx'}
                </button>
              </div>

              {/* Columns reference */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Colunas do modelo</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {columns.map(c => (
                    <span key={c.name} style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                      {c.name}{c.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>* Apenas a coluna "Nome" é obrigatória por linha.</div>
              </div>

              <button onClick={() => setStep(2)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Já tenho o modelo preenchido →
              </button>
            </>
          ) : (
            <>
              {/* Step 2: upload + config */}
              {!file ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#f97316' : 'var(--border)'}`,
                    borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'rgba(249,115,22,0.04)' : 'transparent',
                    transition: 'all 0.2s', marginBottom: 16,
                  }}
                >
                  <Upload size={32} color="var(--text-muted)" strokeWidth={1.5} />
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 12 }}>Arraste o arquivo aqui</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>ou clique para selecionar</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>.xlsx ou .xls (máx 5 MB)</div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <FileSpreadsheet size={24} color="#22c55e" strokeWidth={1.5} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fileSizeStr}</div>
                  </div>
                  <button onClick={() => setFile(null)} disabled={importing} style={{ background: 'transparent', border: 'none', cursor: importing ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}

              {/* Pipeline / Stage / Responsible */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Pipeline de destino <span style={{ color: '#f97316' }}>*</span></label>
                  <select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId('') }}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                    <option value="">Selecione um pipeline...</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Etapa inicial <span style={{ color: '#f97316' }}>*</span></label>
                  <select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!pipelineId}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: pipelineId ? 'pointer' : 'not-allowed', appearance: 'none', opacity: pipelineId ? 1 : 0.6 }}>
                    <option value="">{pipelineId ? 'Selecione uma etapa...' : 'Selecione um pipeline primeiro'}</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Distribuição dos leads</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      { k: 'ROUND_ROBIN_ALL' as const, l: 'Distribuição automática (round-robin)', d: 'Distribui em sequência entre todos os vendedores ativos' },
                      { k: 'ROUND_ROBIN_TEAM' as const, l: 'Por equipe', d: 'Distribui em round-robin entre os membros da equipe selecionada' },
                      { k: 'SPECIFIC_USER' as const, l: 'Vendedor específico', d: 'Atribui todos os leads a um único vendedor' },
                    ]).map(opt => {
                      const active = distributionType === opt.k
                      return (
                        <label key={opt.k}
                          onClick={() => setDistributionType(opt.k)}
                          style={{
                            display: 'flex', gap: 10, padding: 10, cursor: 'pointer',
                            border: `1px solid ${active ? '#f97316' : 'var(--border)'}`,
                            background: active ? 'rgba(249,115,22,0.06)' : 'transparent',
                            borderRadius: 8,
                          }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                            border: `2px solid ${active ? '#f97316' : 'var(--border)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.l}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.d}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {distributionType === 'ROUND_ROBIN_TEAM' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Equipe <span style={{ color: '#f97316' }}>*</span></label>
                    <select value={teamId} onChange={e => setTeamId(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                      <option value="">Selecione uma equipe...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {teams.length === 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>Nenhuma equipe cadastrada neste tenant.</div>
                    )}
                  </div>
                )}

                {distributionType === 'SPECIFIC_USER' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Vendedor <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(se vazio, será você)</span></label>
                    <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                      <option value="">Eu mesmo</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          {result ? (
            <button onClick={handleClose} style={{ marginLeft: 'auto', background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Concluir</button>
          ) : step === 1 ? (
            <>
              <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Fechar</button>
              <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: '#f97316', cursor: 'pointer' }}>Próximo →</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} disabled={importing} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>← Voltar</button>
              <button onClick={handleImport} disabled={!canImport} style={{ background: canImport ? '#f97316' : 'var(--border)', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, color: canImport ? '#fff' : 'var(--text-muted)', cursor: canImport ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                {importing && <Loader2 size={14} className="animate-spin" />}
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function ResultCard({ icon, color, bg, border, text }: { icon: React.ReactNode; color: string; bg: string; border: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', color, fontSize: 13 }}>
      {icon}
      <span>{text}</span>
    </div>
  )
}
