import type { Agendamento } from '../types/triagem'

export const STATUS_LABELS: Record<Agendamento['status'], string> = {
  AGENDADO: 'Agendado',
  AGUARDANDO_TRIAGEM: 'Aguardando triagem',
  EM_TRIAGEM: 'Em triagem',
  APTO: 'Apto',
  INAPTO: 'Inapto',
  ENCAMINHADO_MEDICO: 'Encaminhado ao médico',
}

export function dataAtendimento(value: string): string {
  // Os timestamps sem offset enviados pelo backend estão em UTC.
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
}
