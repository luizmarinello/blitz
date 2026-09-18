// Tela 05 Painel principal: widgets | quadro | assistente (≥1280px). Só o quadro fica visível em larguras menores.
// UC02 (listas e tarefas), RF05–RF08, RN02. Mover por botões = equivalente por teclado do drag and drop (US-02 pendente).
import { api, type Lista, type Metricas, type Modo, type Sessao, type Status, type Tarefa } from '../api';
import { navegar } from '../router';
import { carregando, confirmar, dataBr, duracao, erroEstado, hoje, html, montar, mostrarErros, q, rotuloPrioridade, rotuloStatus, toast, vazio } from '../ui';
import { montarChat } from './assistente';
import { formTarefa, lerTarefa } from './tarefa';

const STATUS: Status[] = ['BACKLOG', 'EM_ANDAMENTO', 'CONCLUIDA'];
let listaAtual: number | null = Number(sessionStorage.getItem('blitz.lista')) || null;

export async function telaPainel(root: HTMLElement) {
  montar(root, carregando('Carregando seu quadro…'));
  let listas: Lista[], tarefas: Tarefa[], modos: Modo[], metricas: Metricas | null, ativa: Sessao | undefined;
  try {
    [listas, tarefas, modos, metricas, ativa] = await Promise.all([
      api.listas(), api.tarefas(), api.modos(), api.metricas().catch(() => null), api.sessaoAtiva().catch(() => undefined),
    ]);
  } catch (e) {
    montar(root, erroEstado(e, 'recarregar'));
    root.querySelector('[data-acao=recarregar]')?.addEventListener('click', () => telaPainel(root));
    return;
  }
  if (!listas.some((l) => l.id === listaAtual)) listaAtual = listas[0]?.id ?? null;

  montar(root, html`
    <div class="painel">
      <aside class="coluna-lateral" aria-label="Widgets">
        <div class="card">
          <h3>Foco rápido</h3>
          ${ativa
            ? html`<p>Há uma sessão em andamento.</p><a class="btn" href="#/foco" style="width:100%;justify-content:center">Voltar à sessão</a>`
            : html`
              <div class="campo">
                <label for="w-modo">Modo</label>
                <select id="w-modo">${modos.map((m) => html`<option value="${m.id}">${m.nome} · ${m.cicloFocoMin}/${m.cicloPausaMin} min</option>`)}</select>
              </div>
              <button class="btn" type="button" data-iniciar-foco style="width:100%;justify-content:center">Iniciar sessão</button>`}
        </div>
        <div class="card">
          <h3>Hoje</h3>
          ${metricas ? html`
            <p><strong style="font-family:var(--font-title);font-size:1.5rem">${duracao(metricas.hojeSegundos)}</strong><br /><span class="muted small">de foco hoje</span></p>
            <p class="small">${duracao(metricas.semanaSegundos)} nos últimos 7 dias · ${metricas.tarefasConcluidas} ${metricas.tarefasConcluidas === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</p>
            <a href="#/metricas">Ver métricas completas</a>`
            : html`<p class="muted small">Métricas indisponíveis no momento.</p>`}
        </div>
      </aside>

      <section aria-labelledby="quadro-titulo">
        <div class="quadro-cabecalho">
          <h1 id="quadro-titulo" style="margin:0">Quadro</h1>
          <div class="abas" role="tablist" aria-label="Listas">
            ${listas.map((l) => html`<button role="tab" aria-selected="${l.id === listaAtual}" data-lista="${l.id}">${l.nome}</button>`)}
            <button type="button" class="btn-pequeno btn btn-fantasma" data-nova-lista aria-label="Criar nova lista">+ Lista</button>
          </div>
          <span style="flex:1"></span>
          ${listaAtual ? html`
            <button type="button" class="btn btn-fantasma btn-pequeno" data-renomear-lista>Renomear</button>
            <button type="button" class="btn btn-fantasma btn-pequeno" data-excluir-lista ${listas.length <= 1 ? 'disabled title="Mantenha pelo menos uma lista"' : ''}>Excluir lista</button>
            <button type="button" class="btn" data-nova-tarefa>+ Nova tarefa</button>` : ''}
        </div>
        <div data-quadro></div>
      </section>

      <aside class="coluna-lateral" aria-label="Assistente de IA">
        <div class="card"><h3 style="display:flex;justify-content:space-between">Assistente <a class="small" href="#/assistente">Abrir</a></h3><div data-chat></div></div>
      </aside>
    </div>

    <dialog data-dlg-tarefa aria-labelledby="dlg-tarefa-titulo">
      <h2 id="dlg-tarefa-titulo">Nova tarefa</h2>
      <form novalidate>${formTarefa()}
        <div class="acoes"><button class="btn" type="submit">Criar</button><button class="btn btn-fantasma" type="button" data-fechar>Cancelar</button></div>
      </form>
    </dialog>
    <dialog data-dlg-lista aria-labelledby="dlg-lista-titulo">
      <h2 id="dlg-lista-titulo">Lista</h2>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo"><label for="lista-nome">Nome</label><input id="lista-nome" name="nome" required maxlength="120" /><span class="erro" data-erro="nome"></span></div>
        <div class="acoes"><button class="btn" type="submit">Salvar</button><button class="btn btn-fantasma" type="button" data-fechar>Cancelar</button></div>
      </form>
    </dialog>`);

  // ---------- quadro ----------
  const quadro = q(root, '[data-quadro]');
  const desenharQuadro = () => {
    const daLista = tarefas.filter((t) => t.listaId === listaAtual);
    if (!listaAtual) { montar(quadro, vazio('Nenhuma lista', 'Crie sua primeira lista para começar a organizar as tarefas.')); return; }
    if (daLista.length === 0) {
      montar(quadro, vazio('Esta lista está vazia', 'Cadastre a primeira tarefa e o assistente ajuda a decidir por onde começar.',
        html`<button class="btn" type="button" data-nova-tarefa>+ Nova tarefa</button>`));
      quadro.querySelector('[data-nova-tarefa]')?.addEventListener('click', abrirNovaTarefa);
      return;
    }
    const d = hoje();
    montar(quadro, html`<div class="colunas">${STATUS.map((s) => {
      const itens = daLista.filter((t) => t.status === s);
      return html`
        <section class="coluna" aria-labelledby="col-${s}">
          <h3 id="col-${s}">${rotuloStatus[s]} <span class="contador">${itens.length}</span></h3>
          <ul class="tarefas">
            ${itens.length === 0 ? html`<li class="muted small" style="padding:var(--space-2)">Nada aqui.</li>` : ''}
            ${itens.map((t) => {
              const i = STATUS.indexOf(t.status);
              const atrasada = t.prazo && t.prazo < d && t.status !== 'CONCLUIDA';
              return html`
                <li class="tarefa ${t.status === 'CONCLUIDA' ? 'concluida' : ''}">
                  <a class="tarefa-titulo" href="#/tarefas/${t.id}">${t.titulo}</a>
                  <div class="tarefa-meta">
                    <span class="chip chip-${t.prioridade}">${rotuloPrioridade[t.prioridade]}</span>
                    ${t.prazo ? html`<span class="${atrasada ? 'atrasada' : ''}">${atrasada ? '⚠ Atrasada · ' : 'Prazo '}${dataBr(t.prazo)}</span>` : ''}
                    ${t.horasEstimadas ? html`<span>${t.horasEstimadas}h</span>` : ''}
                  </div>
                  <div class="tarefa-acoes">
                    <span>
                      ${i > 0 ? html`<button class="btn btn-fantasma btn-pequeno btn-icone" type="button" data-mover="${t.id}:${STATUS[i - 1]}" aria-label="Mover '${t.titulo}' para ${rotuloStatus[STATUS[i - 1]]}">←</button>` : ''}
                      ${i < 2 ? html`<button class="btn btn-fantasma btn-pequeno btn-icone" type="button" data-mover="${t.id}:${STATUS[i + 1]}" aria-label="Mover '${t.titulo}' para ${rotuloStatus[STATUS[i + 1]]}">${i === 1 ? '✓' : '→'}</button>` : ''}
                    </span>
                    ${t.status !== 'CONCLUIDA' ? html`<a class="btn btn-secundario btn-pequeno" href="#/foco?tarefa=${t.id}" aria-label="Focar em '${t.titulo}'">Focar</a>` : ''}
                  </div>
                </li>`;
            })}
          </ul>
        </section>`;
    })}</div>`);

    quadro.querySelectorAll<HTMLButtonElement>('[data-mover]').forEach((b) => b.addEventListener('click', async () => {
      const [id, status] = b.dataset.mover!.split(':');
      b.disabled = true;
      try {
        const nova = await api.mudarStatus(Number(id), status as Status);
        tarefas = tarefas.map((t) => (t.id === nova.id ? nova : t));
        desenharQuadro();
        toast(`Movida para ${rotuloStatus[status]}.`, 'ok');
      } catch (e) { b.disabled = false; toast(e instanceof Error ? e.message : 'Erro ao mover.', 'erro'); }
    }));
  };
  desenharQuadro();

  // ---------- abas ----------
  root.querySelectorAll<HTMLButtonElement>('[data-lista]').forEach((b) => b.addEventListener('click', () => {
    listaAtual = Number(b.dataset.lista);
    sessionStorage.setItem('blitz.lista', String(listaAtual));
    telaPainel(root);
  }));

  // ---------- nova tarefa ----------
  const dlgTarefa = q<HTMLDialogElement>(root, '[data-dlg-tarefa]');
  const formTarefaEl = q<HTMLFormElement>(dlgTarefa, 'form');
  function abrirNovaTarefa() { formTarefaEl.reset(); dlgTarefa.showModal(); q(formTarefaEl, '#titulo').focus(); }
  root.querySelector('.quadro-cabecalho [data-nova-tarefa]')?.addEventListener('click', abrirNovaTarefa);
  q(dlgTarefa, '[data-fechar]').addEventListener('click', () => dlgTarefa.close());
  formTarefaEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!listaAtual) return;
    try {
      const nova = await api.criarTarefa(listaAtual, lerTarefa(formTarefaEl));
      tarefas.push(nova);
      dlgTarefa.close();
      desenharQuadro();
      toast('Tarefa criada.', 'ok');
    } catch (err) { mostrarErros(formTarefaEl, err); }
  });

  // ---------- listas ----------
  const dlgLista = q<HTMLDialogElement>(root, '[data-dlg-lista]');
  const formLista = q<HTMLFormElement>(dlgLista, 'form');
  let salvarLista: (nome: string) => Promise<void> = async () => undefined;
  const abrirLista = (titulo: string, nome: string, acao: typeof salvarLista) => {
    q(dlgLista, 'h2').textContent = titulo;
    q<HTMLInputElement>(formLista, '#lista-nome').value = nome;
    salvarLista = acao;
    dlgLista.showModal();
    q(formLista, '#lista-nome').focus();
  };
  q(dlgLista, '[data-fechar]').addEventListener('click', () => dlgLista.close());
  formLista.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await salvarLista(q<HTMLInputElement>(formLista, '#lista-nome').value); dlgLista.close(); telaPainel(root); }
    catch (err) { mostrarErros(formLista, err); }
  });
  q(root, '[data-nova-lista]').addEventListener('click', () => abrirLista('Nova lista', '', async (nome) => {
    const l = await api.criarLista(nome); listaAtual = l.id; sessionStorage.setItem('blitz.lista', String(l.id)); toast('Lista criada.', 'ok');
  }));
  root.querySelector('[data-renomear-lista]')?.addEventListener('click', () => {
    const l = listas.find((x) => x.id === listaAtual)!;
    abrirLista('Renomear lista', l.nome, async (nome) => { await api.renomearLista(l.id, nome); toast('Lista renomeada.', 'ok'); });
  });
  root.querySelector('[data-excluir-lista]')?.addEventListener('click', async () => {
    const l = listas.find((x) => x.id === listaAtual)!;
    const n = tarefas.filter((t) => t.listaId === l.id).length;
    if (!(await confirmar(`Excluir "${l.nome}"?`, n ? `As ${n} tarefas desta lista serão excluídas. O tempo de foco registrado nelas é mantido nas métricas.` : 'A lista está vazia.', 'Excluir', true))) return;
    try { await api.excluirLista(l.id); toast('Lista excluída.', 'ok'); listaAtual = null; telaPainel(root); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao excluir.', 'erro'); }
  });

  // ---------- widgets ----------
  root.querySelector('[data-iniciar-foco]')?.addEventListener('click', () => {
    navegar(`#/foco?modo=${q<HTMLSelectElement>(root, '#w-modo').value}&iniciar=1`);
  });
  const chat = root.querySelector<HTMLElement>('[data-chat]');
  if (chat) montarChat(chat, true);
}
