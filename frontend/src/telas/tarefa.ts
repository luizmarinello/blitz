// Tela 06 Detalhe da tarefa + formulário compartilhado com o painel. RF06 (título, descrição, prioridade, prazo, horas), RN02.
import { api, type Lista, type Tarefa, type TarefaEntrada } from '../api';
import { navegar, type Params } from '../router';
import { carregando, confirmar, dados, dataBr, dataHoraBr, erroEstado, html, montar, mostrarErros, q, rotuloStatus, toast } from '../ui';

export function formTarefa(t: Partial<Tarefa> = {}, listas: Lista[] = [], listaId?: number) {
  const opt = (v: string, r: string, sel?: string) => html`<option value="${v}" ${v === sel ? 'selected' : ''}>${r}</option>`;
  return html`
    <p class="erro" data-erro-geral role="alert"></p>
    <div class="campo">
      <label for="titulo">Título</label>
      <input id="titulo" name="titulo" required maxlength="200" value="${t.titulo ?? ''}" />
      <span class="erro" data-erro="titulo"></span>
    </div>
    <div class="campo">
      <label for="descricao">Descrição <span class="muted small">(opcional)</span></label>
      <textarea id="descricao" name="descricao" maxlength="4000">${t.descricao ?? ''}</textarea>
      <span class="erro" data-erro="descricao"></span>
    </div>
    <div class="linha">
      <div class="campo">
        <label for="prioridade">Prioridade</label>
        <select id="prioridade" name="prioridade">
          ${opt('BAIXA', '▽ Baixa', t.prioridade ?? 'MEDIA')}${opt('MEDIA', '● Média', t.prioridade ?? 'MEDIA')}${opt('ALTA', '▲ Alta', t.prioridade ?? 'MEDIA')}
        </select>
      </div>
      <div class="campo">
        <label for="prazo">Prazo</label>
        <input id="prazo" name="prazo" type="date" value="${t.prazo ?? ''}" />
        <span class="erro" data-erro="prazo"></span>
      </div>
      <div class="campo">
        <label for="horasEstimadas">Horas estimadas</label>
        <input id="horasEstimadas" name="horasEstimadas" type="number" min="0.25" step="0.25" inputmode="decimal" value="${t.horasEstimadas ?? ''}" />
        <span class="erro" data-erro="horasEstimadas"></span>
      </div>
    </div>
    ${t.id ? html`
      <div class="linha">
        <div class="campo">
          <label for="status">Status</label>
          <select id="status" name="status">
            ${opt('BACKLOG', rotuloStatus.BACKLOG, t.status)}${opt('EM_ANDAMENTO', rotuloStatus.EM_ANDAMENTO, t.status)}${opt('CONCLUIDA', rotuloStatus.CONCLUIDA, t.status)}
          </select>
        </div>
        <div class="campo">
          <label for="listaId">Lista</label>
          <select id="listaId" name="listaId">
            ${listas.map((l) => opt(String(l.id), l.nome, String(listaId ?? t.listaId)))}
          </select>
        </div>
      </div>` : ''}`;
}

export function lerTarefa(form: HTMLFormElement): TarefaEntrada {
  const d = dados(form);
  return {
    titulo: d.titulo,
    descricao: d.descricao || undefined,
    prioridade: d.prioridade as TarefaEntrada['prioridade'],
    prazo: d.prazo || null,
    horasEstimadas: d.horasEstimadas ? Number(d.horasEstimadas) : null,
    status: (d.status as TarefaEntrada['status']) || undefined,
    listaId: d.listaId ? Number(d.listaId) : undefined,
  };
}

export async function telaTarefa(root: HTMLElement, params: Params) {
  const id = Number(params.id);
  montar(root, carregando());
  let t: Tarefa, listas: Lista[];
  try {
    [t, listas] = await Promise.all([api.tarefa(id), api.listas()]);
  } catch (e) {
    montar(root, html`<div style="max-width:40rem;margin:auto">${erroEstado(e)}<p style="margin-top:1rem"><a href="#/">Voltar ao painel</a></p></div>`);
    return;
  }

  montar(root, html`
    <section class="card" style="max-width:44rem;margin:auto">
      <p><a href="#/">← Voltar ao painel</a></p>
      <h1>Tarefa</h1>
      <p class="muted small">Criada em ${dataHoraBr(t.criadoEm)}${t.concluidaEm ? html` · Concluída em ${dataHoraBr(t.concluidaEm)}` : ''}${t.prazo ? html` · Prazo ${dataBr(t.prazo)}` : ''}</p>
      <form novalidate>
        ${formTarefa(t, listas)}
        <div class="acoes">
          <button class="btn" type="submit">Salvar</button>
          <a class="btn btn-fantasma" href="#/foco?tarefa=${t.id}">Focar nesta tarefa</a>
          <span class="spacer" style="flex:1"></span>
          <button class="btn btn-perigo" type="button" data-excluir>Excluir</button>
        </div>
      </form>
    </section>`);

  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.editarTarefa(t.id, lerTarefa(form));
      toast('Tarefa salva.', 'ok');
      navegar('#/');
    } catch (err) { mostrarErros(form, err); }
  });
  q(root, '[data-excluir]').addEventListener('click', async () => {
    if (!(await confirmar('Excluir tarefa?', 'O tempo de foco já registrado nela é mantido nas suas métricas, apenas desvinculado.', 'Excluir', true))) return;
    try {
      await api.excluirTarefa(t.id);
      toast('Tarefa excluída.', 'ok');
      navegar('#/');
    } catch (err) { toast(err instanceof Error ? err.message : 'Erro ao excluir.', 'erro'); }
  });
  q(root, '#titulo').focus();
}
