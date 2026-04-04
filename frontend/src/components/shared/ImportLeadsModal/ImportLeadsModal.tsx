import { useState, useRef } from 'react'
import { X, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onImported?: (count: number) => void
}

type Step = 1 | 3
type UploadState = 'idle' | 'uploaded' | 'importing' | 'done'

const columns = [
  { name: 'Nome', required: true }, { name: 'Empresa', required: true },
  { name: 'E-mail', required: false }, { name: 'Telefone', required: false },
  { name: 'CPF', required: false }, { name: 'CNPJ', required: false },
  { name: 'Cargo', required: false }, { name: 'Fonte', required: false },
  { name: 'Valor', required: false }, { name: 'Etapa', required: false },
  { name: 'Temperatura', required: false }, { name: 'Responsável', required: false },
  { name: 'Observações', required: false },
]

const CSS = `
  @keyframes imFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes imScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .im-body::-webkit-scrollbar{width:4px}.im-body::-webkit-scrollbar-track{background:transparent}
  .im-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}.im-body{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`

export default function ImportLeadsModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [roundRobin, setRoundRobin] = useState(true)
  const [initialStage, setInitialStage] = useState('Sem Contato')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setStep(1); setUploadState('idle'); setFileName(''); setFileSize(''); setDragOver(false)
    setRoundRobin(true); setInitialStage('Sem Contato')
  }

  function handleClose() { reset(); onClose() }

  function downloadTemplate() {
    const header = 'Nome,Empresa,E-mail,Telefone,CPF,CNPJ,Cargo,Fonte,Valor Esperado,Etapa,Temperatura,Responsável,Observações'
    const sample = 'João Silva,Empresa ABC,joao@empresa.com,(11) 99999-0000,,,Gerente Comercial,Instagram,15000,Sem Contato,Morno,Ana Souza,Lead captado via campanha'
    const blob = new Blob([header + '\n' + sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'modelo_importacao_tribocrm.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(file: File) {
    setFileName(file.name)
    setFileSize(file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`)
    setUploadState('uploaded')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleImport() {
    setUploadState('importing')
    setTimeout(() => {
      setUploadState('done')
      onImported?.(47)
      setTimeout(handleClose, 1200)
    }, 1500)
  }

  // Step indicator
  const steps = [{ n: 1, label: 'Baixar modelo' }, { n: 2, label: 'Preencher' }, { n: 3, label: 'Enviar arquivo' }]
  const activeStep = step === 1 ? 1 : 3

  return (
    <>
      <style>{CSS}</style>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, animation: 'imFadeIn 0.2s ease-out' }} />

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, maxWidth: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'imScaleIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Importar Leads</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Importe sua base de leads via planilha Excel</p>
          </div>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {steps.map((s, i) => {
            const done = activeStep > s.n
            const active = activeStep === s.n || (step === 3 && s.n === 3)
            const isCurrent = (step === 1 && s.n === 1) || (step === 3 && s.n === 3)
            return (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: done || isCurrent ? '#f97316' : 'var(--border)',
                    color: done || isCurrent ? '#fff' : 'var(--text-muted)',
                  }}>{done ? '✓' : s.n}</div>
                  <span style={{ fontSize: 10, color: active || isCurrent ? '#f97316' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 48, height: 2, background: done || (step === 3 && i === 1) ? '#f97316' : 'var(--border)', margin: '0 8px', marginBottom: 16 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="im-body" style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <>
              {/* Download template */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 20 }}>
                <Download size={32} color="#f97316" strokeWidth={1.5} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 6px' }}>Baixe o modelo Excel</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  Use nosso modelo para garantir que os dados sejam importados corretamente.<br />Não altere os nomes das colunas.
                </p>
                <button onClick={downloadTemplate} style={{ width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fb923c' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f97316' }}>
                  <Download size={15} strokeWidth={1.5} /> Baixar modelo Excel
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
              </div>

              <button onClick={() => setStep(3)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Já tenho o modelo preenchido →
              </button>
            </>
          )}

          {step === 3 && uploadState === 'idle' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#f97316' : 'var(--border)'}`,
                borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(249,115,22,0.04)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <Upload size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 12 }}>Arraste o arquivo aqui</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>ou clique para selecionar</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>.xlsx, .xls, .csv</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} style={{ display: 'none' }} />
            </div>
          )}

          {step === 3 && (uploadState === 'uploaded' || uploadState === 'importing') && (
            <>
              {/* File info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <FileSpreadsheet size={24} color="#22c55e" strokeWidth={1.5} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{fileName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fileSize}</div>
                </div>
                <button onClick={() => { setUploadState('idle'); setFileName(''); setFileSize('') }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>

              {/* Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <ResultCard icon={<CheckCircle2 size={16} strokeWidth={1.5} />} color="#22c55e" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.2)" text="47 leads prontos para importar" />
                <ResultCard icon={<AlertTriangle size={16} strokeWidth={1.5} />} color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" text="3 duplicatas encontradas (serão ignoradas)" />
                <ResultCard icon={<XCircle size={16} strokeWidth={1.5} />} color="#ef4444" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.2)" text="1 erro — Linha 5: E-mail inválido" />
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={roundRobin} onChange={e => setRoundRobin(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#f97316' }} />
                  Atribuir automaticamente via round-robin
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Etapa inicial:</span>
                  <select value={initialStage} onChange={e => setInitialStage(e.target.value)} style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px',
                    fontSize: 12, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
                  }}>
                    <option>Sem Contato</option><option>Em Contato</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {uploadState === 'done' && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CheckCircle2 size={48} color="#22c55e" strokeWidth={1.5} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12 }}>47 leads importados com sucesso!</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: step === 3 && uploadState === 'uploaded' ? 'space-between' : 'flex-end', flexShrink: 0 }}>
          {step === 3 && (uploadState === 'uploaded' || uploadState === 'importing') && (
            <button onClick={() => { setStep(1); setUploadState('idle') }} disabled={uploadState === 'importing'} style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
              opacity: uploadState === 'importing' ? 0.5 : 1,
            }}>Voltar</button>
          )}
          {step === 1 && (
            <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Fechar</button>
          )}
          {step === 3 && uploadState === 'idle' && (
            <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Fechar</button>
          )}
          {step === 3 && (uploadState === 'uploaded' || uploadState === 'importing') && (
            <button onClick={handleImport} disabled={uploadState === 'importing'} style={{
              background: '#f97316', border: 'none', borderRadius: 8, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: uploadState === 'importing' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, opacity: uploadState === 'importing' ? 0.7 : 1,
            }}>
              {uploadState === 'importing' && <Loader2 size={14} className="animate-spin" />}
              {uploadState === 'importing' ? 'Importando...' : 'Importar 47 leads →'}
            </button>
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
