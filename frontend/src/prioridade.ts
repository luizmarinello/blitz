// RF16: mesmo critério do assistente (AssistenteLocal.avaliar no back): urgência do prazo, prioridade,
// "terminar o que começou" e vitória rápida. Mudou lá, muda aqui (o teste do back documenta os pesos).
import type { Tarefa } from './api';

export function pontos(t: Pick<Tarefa, 'prazo' | 'prioridade' | 'status' | 'horasEstimadas'>, hoje: string): number {
  let p = 0;
  let dias: number | null = null;
  if (t.prazo) {
    dias = Math.round((Date.parse(t.prazo) - Date.parse(hoje)) / 864e5);
    p += dias < 0 ? 100 + Math.min(30, -dias * 5) : dias === 0 ? 80 : dias === 1 ? 60 : dias <= 3 ? 45 : dias <= 7 ? 30 : 10;
  }
  p += t.prioridade === 'ALTA' ? 30 : t.prioridade === 'MEDIA' ? 15 : 0;
  if (t.status === 'EM_ANDAMENTO') p += 12;
  const h = t.horasEstimadas;
  if (h != null) { if (h <= 1) p += 8; else if (h >= 4 && (dias === null || dias > 7)) p -= 5; }
  return p;
}

/** A tarefa que o quadro destaca como "Comece por aqui": maior pontuação; empate pelo prazo mais próximo e pelo id. */
export function recomendada(ts: Tarefa[], hoje: string): number | undefined {
  return ts.filter((t) => t.status !== 'CONCLUIDA')
    .sort((a, b) => pontos(b, hoje) - pontos(a, hoje) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.id - b.id)[0]?.id;
}
