// Tela 10 Métricas e histórico. RF14, RN02 (concluídas no histórico), RN03 (sessões geram métricas, mesmo sem tarefa).
import { api, type Metricas, type Modo, type Sessao, type Tarefa } from '../api';
import { carregando, dataBr, dataHoraBr, duracao, erroEstado, html, montar, vazio } from '../ui';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export async function telaMetricas(root: HTMLElement) {
  montar(root, carregando());
  let m: Metricas, sessoes: Sessao[], modos: Modo[], tarefas: Tarefa[];
  try { [m, sessoes, modos, tarefas] = await Promise.all([api.metricas(), api.sessoes(), api.modos(), api.tarefas()]); }
  catch (e) {
    montar(root, erroEstado(e, 'recarregar'));
    root.querySelector('[data-acao=recarregar]')?.addEventListener('click', () => telaMetricas(root));
    return;
  }
  const nomeModo = (id: number) => modos.find((x) => x.id === id)?.nome ?? 'Modo removido';
  const nomeTarefa = (id?: number) => (id == null ? html`<span class="muted">Sessão livre</span>` : tarefas.find((t) => t.id === id)?.titulo ?? html`<span class="muted">Tarefa removida</span>`);
  const maximo = Math.max(1, ...m.porDia.map((d) => d.segundos));
  const concluidas = tarefas.filter((t) => t.status === 'CONCLUIDA').sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''));

  montar(root, html`
    <h1>Métricas e histórico</h1>
    <div class="kpis">
      <div class="kpi"><div class="valor">${duracao(m.hojeSegundos)}</div><div class="muted small">de foco hoje</div></div>
      <div class="kpi"><div class="valor">${duracao(m.semanaSegundos)}</div><div class="muted small">nos últimos 7 dias</div></div>
      <div class="kpi"><div class="valor">${m.sessoesSemana}</div><div class="muted small">sessões na semana · média ${duracao(m.mediaSessaoSemanaSegundos)}</div></div>
      <div class="kpi"><div class="valor">${m.totalSessoes}</div><div class="muted small">sessões no total</div></div>
      <div class="kpi"><div class="valor">${m.tarefasConcluidas}</div><div class="muted small">tarefas concluídas</div></div>
    </div>

    <section class="card" aria-labelledby="g-titulo">
      <h2 id="g-titulo">Foco por dia (últimos 7 dias)</h2>
      ${m.semanaSegundos === 0 ? vazio('Sem sessões nesta semana', 'Inicie uma sessão de foco e o gráfico começa a aparecer aqui.', html`<a class="btn" href="#/foco">Iniciar sessão</a>`) : html`
        <div class="grafico" role="img" aria-label="Gráfico de barras: ${m.porDia.map((d) => `${dataBr(d.dia)} ${duracao(d.segundos)}`).join(', ')}">
          ${m.porDia.map((d) => html`
            <div class="dia">
              <span class="small">${d.segundos ? duracao(d.segundos) : ''}</span>
              <div class="barra-v" style="height:${Math.max(2, Math.round((d.segundos / maximo) * 100))}%"></div>
              <span class="rotulo">${DIAS[new Date(d.dia + 'T12:00:00').getDay()]} ${d.dia.slice(8)}</span>
            </div>`)}
        </div>`}
    </section>

    <section class="card" aria-labelledby="s-titulo">
      <h2 id="s-titulo">Sessões recentes</h2>
      ${sessoes.length === 0 ? html`<p class="muted">Nenhuma sessão encerrada ainda.</p>` : html`
        <div style="overflow:auto"><table class="tabela">
          <thead><tr><th scope="col">Início</th><th scope="col">Duração</th><th scope="col">Modo</th><th scope="col">Tarefa</th></tr></thead>
          <tbody>${sessoes.map((s) => html`<tr><td>${dataHoraBr(s.inicio)}</td><td>${duracao(s.duracaoSegundos ?? 0)}</td><td>${nomeModo(s.modoId)}</td><td>${nomeTarefa(s.tarefaId)}</td></tr>`)}</tbody>
        </table></div>`}
    </section>

    <section class="card" aria-labelledby="c-titulo">
      <h2 id="c-titulo">Tarefas concluídas</h2>
      ${concluidas.length === 0 ? html`<p class="muted">Nenhuma tarefa concluída ainda. Elas ficam guardadas aqui quando você as marcar como concluídas.</p>` : html`
        <div style="overflow:auto"><table class="tabela">
          <thead><tr><th scope="col">Tarefa</th><th scope="col">Prioridade</th><th scope="col">Concluída em</th></tr></thead>
          <tbody>${concluidas.map((t) => html`<tr><td><a href="#/tarefas/${t.id}">${t.titulo}</a></td><td>${t.prioridade}</td><td>${dataHoraBr(t.concluidaEm)}</td></tr>`)}</tbody>
        </table></div>`}
    </section>`);
}
