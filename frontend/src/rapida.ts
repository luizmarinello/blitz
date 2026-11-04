// Entrada rápida de tarefa (RF06): uma linha de texto vira {titulo, prioridade, prazo, horas}.
// Atalhos: "!alta" "!media" "!baixa" (prioridade) · "@hoje" "@amanha" "@sexta" "@25/11" "@25/11/2026" (prazo) · "2h" "1,5h" (horas).
// Checagem executável: node scripts/rapida.check.ts
import type { Prioridade, TarefaEntrada } from './api';

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function dataDe(texto: string, hoje = new Date()): string | null {
  const t = semAcento(texto).replace(/-feira$/, '');
  const base = new Date(hoje); base.setHours(12, 0, 0, 0);
  if (t === 'hoje') return iso(base);
  if (t === 'amanha') { base.setDate(base.getDate() + 1); return iso(base); }
  if (t.length >= 3) {
    const i = DIAS.findIndex((d) => d.startsWith(t));
    if (i >= 0) { const delta = (i - base.getDay() + 7) % 7 || 7; base.setDate(base.getDate() + delta); return iso(base); }   // próximo dia da semana, nunca hoje
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const ano = m[3] ? Number(m[3]) : base.getFullYear();
    const d = new Date(ano, Number(m[2]) - 1, Number(m[1]), 12);
    if (d.getMonth() !== Number(m[2]) - 1) return null;          // 31/02 etc.
    if (!m[3] && d < base) d.setFullYear(ano + 1);               // sem ano: a próxima ocorrência
    return iso(d);
  }
  return null;
}

export function interpretarRapida(texto: string, hoje = new Date()): TarefaEntrada | null {
  let prioridade: Prioridade = 'MEDIA', prazo: string | null = null, horas: number | null = null;
  let titulo = texto
    .replace(/(^|\s)!(alta|m[eé]dia|baixa)\b/i, (_, sp, p) => { const c = semAcento(p)[0]; prioridade = c === 'a' ? 'ALTA' : c === 'b' ? 'BAIXA' : 'MEDIA'; return sp; })
    .replace(/(^|\s)@(\S+)/, (m, sp, d) => { const p = dataDe(d, hoje); if (!p) return m; prazo = p; return sp; })
    .replace(/(^|\s)(\d+(?:[.,]\d+)?)h\b/i, (_, sp, n) => { horas = Number(n.replace(',', '.')); return sp; })
    .replace(/\s+/g, ' ').trim();
  if (!titulo) return null;
  return { titulo, prioridade, prazo, horasEstimadas: horas };
}
