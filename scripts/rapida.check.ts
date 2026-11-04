// Checagem do interpretador da entrada rápida. Uso: node scripts/rapida.check.ts  (Node 22.6+ lê .ts direto)
import assert from 'node:assert/strict';
import { dataDe, interpretarRapida } from '../frontend/src/rapida.ts';

const qua = new Date(2026, 10, 4, 9);   // quarta-feira, 04/11/2026

assert.deepEqual(interpretarRapida('Revisar slides !alta @sexta 2h', qua), { titulo: 'Revisar slides', prioridade: 'ALTA', prazo: '2026-11-06', horasEstimadas: 2 });
assert.deepEqual(interpretarRapida('Ler artigo', qua), { titulo: 'Ler artigo', prioridade: 'MEDIA', prazo: null, horasEstimadas: null });
assert.deepEqual(interpretarRapida('!baixa Arrumar a mesa 1,5h @amanhã', qua), { titulo: 'Arrumar a mesa', prioridade: 'BAIXA', prazo: '2026-11-05', horasEstimadas: 1.5 });
assert.equal(interpretarRapida('Pagar @25/11', qua)!.prazo, '2026-11-25');
assert.equal(interpretarRapida('Pagar @01/01', qua)!.prazo, '2027-01-01');            // sem ano, já passou: ano que vem
assert.equal(interpretarRapida('Pagar @25/11/2026', qua)!.prazo, '2026-11-25');
assert.equal(interpretarRapida('Falar com @joao', qua)!.titulo, 'Falar com @joao');    // @ que não é data fica no título
assert.equal(interpretarRapida('Pagar @31/02', qua)!.titulo, 'Pagar @31/02');          // data inválida fica no título
assert.equal(interpretarRapida('Reunião às 14h', qua)!.horasEstimadas, 14);           // limitação conhecida: "14h" vira 14 horas estimadas
assert.equal(interpretarRapida('   !alta   ', qua), null);
assert.equal(dataDe('quarta', qua), '2026-11-11');                                    // mesmo dia da semana: a próxima, não hoje
assert.equal(dataDe('seg', qua), '2026-11-09');
assert.equal(dataDe('sábado', qua), '2026-11-07');
assert.equal(dataDe('hoje', qua), '2026-11-04');
assert.equal(dataDe('xyz', qua), null);

console.log('rapida.check: ok');
