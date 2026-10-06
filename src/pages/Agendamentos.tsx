import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { agendar, meusAgendamentos, meuHistorico } from '../services/triagens'
import { listarHemocentros } from '../services/hemocentros'
import type { Agendamento, HistoricoItem, RespostaPreTriagem } from '../types/triagem'
import { dataAtendimento, mensagemErro, STATUS_LABELS } from '../utils/triagemFormatters'

export function Agendamentos() {
  const navigate = useNavigate()
  const [centros, setCentros] = useState<{ id: number; nome: string }[]>([])
  const [agendas, setAgendas] = useState<Agendamento[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [centro, setCentro] = useState('')
  const [data, setData] = useState('')
  const [respostas, setRespostas] = useState<RespostaPreTriagem[]>([])
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [revisao, setRevisao] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function carregar() {
      setCarregando(true); setErro('')
      try {
        const [unidades, registros, anteriores] = await Promise.all([
          listarHemocentros(controller.signal), meusAgendamentos(controller.signal), meuHistorico(controller.signal),
        ])
        if (!controller.signal.aborted) {
          setCentros(unidades.filter(item => item.status === 'ATIVO'))
          setAgendas(registros); setHistorico(anteriores)
        }
      } catch (error) { if (!controller.signal.aborted) setErro(mensagemErro(error)) }
      finally { if (!controller.signal.aborted) setCarregando(false) }
    }
    void carregar()
    return () => controller.abort()
  }, [revisao])

  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (ocupado) return
    setErro(''); setMensagem('')
    if (!centro || !data || new Date(data).getTime() <= Date.now()) { setErro('Escolha um hemocentro e uma data futura.'); return }
    if (respostas.some(item => !item.pergunta.trim() || !item.resposta.trim())) { setErro('Preencha a pergunta e a resposta de cada item, ou remova o item vazio.'); return }
    setOcupado(true)
    try {
      await agendar({ hemocentro_id: Number(centro), agendado_em: new Date(data).toISOString(), respostas_pre_triagem: respostas })
      setMensagem('Agendamento registrado. Na chegada, procure a recepção.')
      setData(''); setRespostas([]); setRevisao(value => value + 1)
    } catch (error) { setErro(mensagemErro(error)) }
    finally { setOcupado(false) }
  }

  return <section className="space-y-5" aria-label="Agendamentos e histórico">
    <Button variant="secondary" onClick={() => navigate('/home')}>Voltar à central</Button>
    {carregando && <p role="status">Carregando dados...</p>}
    {erro && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{erro} <Button variant="ghost" disabled={ocupado} onClick={() => setRevisao(value => value + 1)}>Atualizar dados</Button></div>}
    {mensagem && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{mensagem}</p>}
    <form onSubmit={enviar} className="space-y-4 rounded-xl border border-red-100 p-5">
      <h2 className="text-xl font-semibold">Registrar agendamento</h2>
      <p className="text-sm text-zinc-600">Escolha uma data combinada com a unidade. Esta base registra o atendimento, mas não consulta disponibilidade de vagas ou horários de funcionamento.</p>
      <label className="grid gap-2">Hemocentro<select required disabled={ocupado || carregando} className="rounded-xl border border-red-200 p-3" value={centro} onChange={e => setCentro(e.target.value)}>
        <option value="">Selecione uma unidade</option>{centros.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
      </select></label>
      {!carregando && !erro && centros.length === 0 && <p role="status">Nenhum hemocentro ativo disponível.</p>}
      <label className="grid gap-2">Data/hora (seu horário local)<Input type="datetime-local" required value={data} onChange={e => setData(e.target.value)} disabled={ocupado} /></label>
      <fieldset className="space-y-3" disabled={ocupado}>
        <legend className="font-semibold">Respostas de pré-triagem</legend>
        <p className="text-sm text-zinc-600">Registre apenas perguntas e respostas fornecidas pelo questionário oficial da instituição. Nenhum questionário clínico foi definido nesta versão. Se não recebeu um, não invente perguntas: confirme as orientações com a unidade.</p>
        {respostas.map((item, index) => <div key={index} className="grid gap-2 rounded-xl bg-rose-50 p-3">
          <label className="grid gap-1">Pergunta {index + 1}<Input required maxLength={500} value={item.pergunta} onChange={e => setRespostas(respostas.map((row, i) => i === index ? { ...row, pergunta: e.target.value } : row))} /></label>
          <label className="grid gap-1">Resposta {index + 1}<textarea required maxLength={2000} className="rounded-xl border border-red-200 p-3" value={item.resposta} onChange={e => setRespostas(respostas.map((row, i) => i === index ? { ...row, resposta: e.target.value } : row))} /></label>
          <Button variant="ghost" onClick={() => setRespostas(respostas.filter((_, i) => i !== index))}>Remover item {index + 1}</Button>
        </div>)}
        <Button variant="secondary" disabled={respostas.length >= 100} onClick={() => setRespostas([...respostas, { pergunta: '', resposta: '' }])}>Adicionar resposta institucional</Button>
      </fieldset>
      <p className="text-sm text-zinc-600">Revise as respostas: após o envio, não há edição nesta versão.</p>
      <Button type="submit" disabled={ocupado || carregando || centros.length === 0}>{ocupado ? 'Registrando...' : 'Registrar agendamento'}</Button>
    </form>
    {!carregando && !erro && <>
      <article className="space-y-3 rounded-xl border border-red-100 p-5">
        <h2 className="text-xl font-semibold">Meus agendamentos</h2>
        {agendas.length === 0 ? <p>Nenhum agendamento registrado.</p> : <ul className="space-y-2">{agendas.map(item => <li key={item.id}>{dataAtendimento(item.agendado_em)} · {centros.find(unidade => unidade.id === item.hemocentro_id)?.nome ?? `Hemocentro ${item.hemocentro_id}`} · {STATUS_LABELS[item.status]}</li>)}</ul>}
      </article>
      <article className="space-y-3 rounded-xl border border-red-100 p-5">
        <h2 className="text-xl font-semibold">Histórico de atendimentos</h2>
        <p className="text-sm text-zinc-600">Resultados de triagem, não comprovação de doações realizadas.</p>
        {historico.length === 0 ? <p>Nenhuma triagem finalizada.</p> : <ul className="space-y-2">{historico.map(item => <li key={item.agendamento_id}>{dataAtendimento(item.data)} · {item.tipo} · {STATUS_LABELS[item.resultado]}</li>)}</ul>}
      </article>
    </>}
  </section>
}
