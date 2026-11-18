// Mesmo cenário do AssistenteLocalTest (back): os pesos do quadro e do assistente precisam dar a mesma ordem. Uso: node scripts/prioridade.check.ts
import assert from 'node:assert/strict';
import { recomendada } from '../frontend/src/prioridade.ts';

const hoje = '2026-11-18';
const t = (id: number, prioridade: string, prazo: string | undefined, horasEstimadas: number | undefined, status = 'BACKLOG') =>
  ({ id, listaId: 1, titulo: `t${id}`, prioridade, prazo, horasEstimadas, status, posicao: 0, criadoEm: '' }) as never;
const atrasadaBaixa = t(1, 'BAIXA', '2026-11-16', 0.25), altaSemPrazo = t(2, 'ALTA', undefined, 3),
  altaEm3Dias = t(3, 'ALTA', '2026-11-21', 4), baixaAmanha = t(4, 'BAIXA', '2026-11-19', 0.5), concluida = t(5, 'MEDIA', hoje, 1, 'CONCLUIDA');

assert.equal(recomendada([altaSemPrazo, altaEm3Dias, baixaAmanha, concluida, atrasadaBaixa], hoje), 1);   // atrasada primeiro
assert.equal(recomendada([altaSemPrazo, baixaAmanha, altaEm3Dias], hoje), 3);                            // alta em 3 dias (75) > baixa amanhã (68)
assert.equal(recomendada([altaSemPrazo, baixaAmanha], hoje), 4);
assert.equal(recomendada([concluida], hoje), undefined);
console.log('prioridade.check: ok');
