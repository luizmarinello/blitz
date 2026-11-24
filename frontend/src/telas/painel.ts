// Tela 05 Painel principal: faixa de widgets + quadro. O assistente é o Bolt, flutuante em todas as telas (bolt.ts).
// UC02 (listas e tarefas), RF05–RF08, RN02. Mover por botões = equivalente por teclado do drag and drop (US-02 pendente).
import { api, type FocoTarefa, type Lista, type Metricas, type Modo, type Sessao, type SprintAtual, type Status, type Tarefa, type TarefaEntrada } from '../api';
import { navegar } from '../router';
import { carregando, confirmar, dataBr, duracao, erroEstado, hoje, html, montar, mostrarErros, q, raw, rotuloPrioridade, rotuloStatus, toast, vazio } from '../ui';
import { formTarefa, lerTarefa } from './tarefa';
import { interpretarRapida } from '../rapida';
import { recomendada as melhorTarefa } from '../prioridade';

const STATUS: Status[] = ['BACKLOG', 'EM_ANDAMENTO', 'CONCLUIDA'];
let listaAtual: number | null = Number(sessionStorage.getItem('blitz.lista')) || null;

export async function telaPainel(root: HTMLElement) {
  montar(root, carregando('Carregando seu quadro…'));
  let listas: Lista[], tarefas: Tarefa[], modos: Modo[], metricas: Metricas | null, ativa: Sessao | undefined, sprint: SprintAtual | undefined, foco: FocoTarefa[];
  try {
    [listas, tarefas, modos, metricas, ativa, sprint, foco] = await Promise.all([
      api.listas(), api.tarefas(), api.modos(), api.metricas().catch(() => null), api.sessaoAtiva().catch(() => undefined),
      api.sprintAtual().catch(() => undefined), api.focoPorTarefa().catch(() => []),
    ]);
    // RN03: tempo de foco já investido em cada tarefa, mostrado no cartão
  } catch (e) {
    montar(root, erroEstado(e, 'recarregar'));
    root.querySelector('[data-acao=recarregar]')?.addEventListener('click', () => telaPainel(root));
    return;
  }
  const focoDe = new Map(foco.map((f) => [f.tarefaId, f.segundos]));
  if (!listas.some((l) => l.id === listaAtual)) listaAtual = listas[0]?.id ?? null;

  montar(root, html`
    <div class="painel">
      <section class="faixa" aria-label="Resumo">
        <div class="faixa-item" data-bolt="Foco rápido">
          <span class="faixa-rotulo">Foco</span>
          ${ativa
            ? html`<span class="small">Sessão em andamento</span><a class="btn btn-pequeno" href="#/foco">Voltar à sessão</a>`
            : html`<select id="w-modo" aria-label="Modo de concentração">${modos.map((m) => html`<option value="${m.id}">${m.nome} · ${m.cicloFocoMin}/${m.cicloPausaMin} min</option>`)}</select>
              <button class="btn btn-pequeno" type="button" data-iniciar-foco>Iniciar</button>`}
        </div>
        <form class="faixa-item" data-form-sprint data-bolt="Sprint">
          <span class="faixa-rotulo">Sprint</span>
          <span class="small muted">${sprint ? `${dataBr(sprint.sprint.dataInicio).slice(0, 5)} a ${dataBr(sprint.sprint.dataFim).slice(0, 5)} · ${sprint.tarefas} ${sprint.tarefas === 1 ? 'tarefa' : 'tarefas'} · ${sprint.horasPlanejadas}h` : 'não planejada'}</span>
          <input id="w-cap" name="capacidadeHoras" type="number" min="1" max="168" value="20" aria-label="Horas disponíveis na semana" title="Horas disponíveis na semana" />
          <span class="small muted" aria-hidden="true">h/sem</span>
          <button class="btn btn-secundario btn-pequeno" type="submit">${sprint ? 'Replanejar' : 'Planejar'}</button>
        </form>
        <div class="faixa-item" data-bolt="Hoje">
          <span class="faixa-rotulo">Hoje</span>
          ${metricas
            ? html`<span class="small"><strong>${duracao(metricas.hojeSegundos)}</strong> de foco · ${duracao(metricas.semanaSegundos)} na semana · ${metricas.tarefasConcluidas} ${metricas.tarefasConcluidas === 1 ? 'concluída' : 'concluídas'}</span><a class="small" href="#/metricas">Métricas</a>`
            : html`<span class="small muted">Métricas indisponíveis.</span>`}
        </div>
      </section>

      <section class="quadro-area" aria-labelledby="quadro-titulo">
        <div class="quadro-cabecalho">
          <h1 id="quadro-titulo" style="margin:0">Quadro</h1>
          <div class="abas" role="tablist" aria-label="Listas" data-bolt="Listas">
            ${listas.map((l) => html`<button role="tab" aria-selected="${l.id === listaAtual}" data-lista="${l.id}">${l.nome}</button>`)}
            <button type="button" class="btn-pequeno btn btn-fantasma" data-nova-lista aria-label="Criar nova lista">+ Lista</button>
          </div>
          <span style="flex:1"></span>
          ${listaAtual ? html`
            <button type="button" class="btn btn-fantasma btn-pequeno" data-renomear-lista>Renomear</button>
            <button type="button" class="btn btn-fantasma btn-pequeno" data-excluir-lista ${listas.length <= 1 ? raw('disabled title="Mantenha pelo menos uma lista"') : ''}>Excluir lista</button>
            <button type="button" class="btn btn-pequeno" data-nova-tarefa data-bolt="Nova tarefa">+ Nova tarefa</button>` : ''}
        </div>
        ${listaAtual ? html`
          <form class="entrada-rapida" data-rapida novalidate data-bolt="Entrada rápida">
            <input name="texto" aria-label="Adicionar tarefa rápida" aria-describedby="dica-rapida" autocomplete="off" maxlength="200"
              placeholder="Adicionar tarefa… ex.: Revisar slides !alta @sexta 2h" />
            <button class="btn btn-pequeno" type="submit">Adicionar</button>
            <span class="small muted" id="dica-rapida">Enter cria na hora. Atalhos: <code>!alta</code> <code>!baixa</code> prioridade · <code>@hoje</code> <code>@amanhã</code> <code>@sexta</code> <code>@25/11</code> prazo · <code>2h</code> horas estimadas</span>
          </form>` : ''}
        <div data-quadro data-bolt="Quadro"></div>
      </section>

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
      // Primeiro uso (nenhuma tarefa em lista nenhuma): o estado vazio ensina o fluxo e oferece tarefas de exemplo reais (seção 8: estado vazio)
      const primeiroUso = tarefas.length === 0;
      montar(quadro, primeiroUso ? html`
        <div class="estado boas-vindas">
          <strong>Bem-vindo ao Blitz</strong>
          <p style="margin-inline:auto">Organize as tarefas e decida com o assistente o que fazer agora. Três passos para começar:</p>
          <ol class="passos">
            <li><span class="passo-n" aria-hidden="true">1</span><div><strong>Crie uma tarefa</strong><br /><span class="small">Título, prioridade, prazo e horas estimadas. O quadro mostra o que fazer, o que está em andamento e o que já foi.</span></div></li>
            <li><span class="passo-n" aria-hidden="true">2</span><div><strong>Pergunte ao Bolt</strong><br /><span class="small">Clique no Bolt, no canto da tela, e pergunte "O que devo fazer agora?". Ele ordena por prazo, prioridade e esforço e marca o cartão "Comece por aqui".</span></div></li>
            <li><span class="passo-n" aria-hidden="true">3</span><div><strong>Inicie uma sessão de foco</strong><br /><span class="small">Escolha o modo (Pomodoro, Profundo, Relax) e a tarefa. O tempo focado vira métrica, mesmo se a tarefa for apagada.</span></div></li>
          </ol>
          <div class="acoes" style="justify-content:center">
            <button class="btn" type="button" data-exemplos>Criar 3 tarefas de exemplo</button>
            <button class="btn btn-fantasma" type="button" data-nova-tarefa>+ Criar minha primeira tarefa</button>
          </div>
        </div>` : vazio('Esta lista está vazia', 'Cadastre a primeira tarefa e o Bolt ajuda a decidir por onde começar.',
        html`<button class="btn" type="button" data-nova-tarefa>+ Nova tarefa</button>`));
      quadro.querySelector('[data-nova-tarefa]')?.addEventListener('click', abrirNovaTarefa);
      quadro.querySelector<HTMLButtonElement>('[data-exemplos]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        const em = (dias: number) => { const x = new Date(); x.setDate(x.getDate() + dias); return x.toISOString().slice(0, 10); };
        const exemplos: TarefaEntrada[] = [
          { titulo: 'Arrastar este cartão para "Em andamento"', descricao: 'Use o mouse ou o botão de seta do cartão (teclado).', prioridade: 'ALTA', prazo: em(1), horasEstimadas: 0.5 },
          { titulo: 'Perguntar ao assistente o que fazer agora', descricao: 'Clique no Bolt, no canto da tela, e escolha uma das sugestões.', prioridade: 'MEDIA', prazo: em(3), horasEstimadas: 0.25 },
          { titulo: 'Iniciar uma sessão de foco nesta tarefa', descricao: 'Clique em Focar neste cartão e escolha o modo Pomodoro.', prioridade: 'BAIXA', prazo: null, horasEstimadas: 1 },
        ];
        try {
          for (const t of exemplos) tarefas.push(await api.criarTarefa(listaAtual!, t));
          toast('Três tarefas de exemplo criadas. Apague quando quiser.', 'ok');
          desenharQuadro();
        } catch (err) { toast(err instanceof Error ? err.message : 'Erro ao criar exemplos.', 'erro'); btn.disabled = false; }
      });
      return;
    }
    const d = hoje();
    // RF16: mesmo critério do assistente (prazo, prioridade, andamento, esforço) escolhe o cartão "Comece por aqui"
    const recomendada = melhorTarefa(daLista, d);
    const simbolo: Record<Status, string> = { BACKLOG: '○', EM_ANDAMENTO: '◐', CONCLUIDA: '✓' };   // RA07: status com símbolo, não só cor
    montar(quadro, html`
      <p class="sr-only" id="dica-quadro">Arraste os cartões entre as colunas ou use os botões de seta de cada cartão (teclado).</p>
      <div class="colunas">${STATUS.map((s) => {
      const itens = daLista.filter((t) => t.status === s);
      return html`
        <section class="coluna coluna-${s}" aria-labelledby="col-${s}" data-status="${s}">
          <h3 id="col-${s}"><span><span class="status-icone" aria-hidden="true">${simbolo[s]}</span>${rotuloStatus[s]}</span><span class="contador">${itens.length}</span></h3>
          <ul class="tarefas">
            ${itens.length === 0 ? html`<li class="muted small" style="padding:var(--space-2)">Nada aqui.</li>` : ''}
            ${itens.map((t) => {
              const i = STATUS.indexOf(t.status);
              const atrasada = t.prazo && t.prazo < d && t.status !== 'CONCLUIDA';
              return html`
                <li class="tarefa prio-${t.prioridade} ${t.status === 'CONCLUIDA' ? 'concluida' : ''} ${t.id === recomendada ? 'destaque' : ''}" draggable="true" data-id="${t.id}" data-bolt-tarefa="${t.id}" ${t.id === recomendada ? raw('data-bolt="Comece por aqui"') : ''} aria-describedby="dica-quadro">
                  <a class="tarefa-titulo" href="#/tarefas/${t.id}">${t.titulo}</a>
                  <div class="tarefa-meta">
                    ${t.id === recomendada ? html`<span class="chip chip-destaque" title="Sugestão por prazo, prioridade e esforço">Comece por aqui</span>` : ''}
                    <span class="chip chip-${t.prioridade}">${rotuloPrioridade[t.prioridade]}</span>
                    ${sprint && t.sprintId === sprint.sprint.id && t.status !== 'CONCLUIDA' ? html`<span class="chip chip-neutro" title="Na sprint desta semana">Sprint</span>` : ''}
                    ${t.prazo ? html`<span class="${atrasada ? 'atrasada' : ''}">${atrasada ? '⚠ Atrasada · ' : 'Prazo '}${dataBr(t.prazo)}</span>` : ''}
                    ${t.horasEstimadas ? html`<span>${t.horasEstimadas}h</span>` : ''}
                    ${focoDe.get(t.id) ? html`<span title="Tempo de foco já registrado nesta tarefa">${duracao(focoDe.get(t.id)!)} de foco</span>` : ''}
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

    // teclado/mouse: botões de seta
    quadro.querySelectorAll<HTMLButtonElement>('[data-mover]').forEach((b) => b.addEventListener('click', () => {
      const [id, status] = b.dataset.mover!.split(':');
      b.disabled = true;
      mover(Number(id), status as Status).catch(() => (b.disabled = false));
    }));

    // US-02: drag and drop nativo (HTML5), sem biblioteca. Muda o status ao soltar em outra coluna.
    quadro.querySelectorAll<HTMLElement>('.tarefa[draggable]').forEach((li) => {
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', li.dataset.id!);
        e.dataTransfer!.effectAllowed = 'move';
        li.classList.add('arrastando');
      });
      li.addEventListener('dragend', () => li.classList.remove('arrastando'));
    });
    quadro.querySelectorAll<HTMLElement>('.coluna').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; col.classList.add('alvo'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget as Node)) col.classList.remove('alvo'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('alvo');
        const id = Number(e.dataTransfer!.getData('text/plain'));
        const status = col.dataset.status as Status;
        const t = tarefas.find((x) => x.id === id);
        if (t && t.status !== status) mover(id, status);
      });
    });
  };

  async function mover(id: number, status: Status) {
    try {
      const nova = await api.mudarStatus(id, status);
      tarefas = tarefas.map((t) => (t.id === nova.id ? nova : t));
      desenharQuadro();
      toast(`Movida para ${rotuloStatus[status]}.`, 'ok');
    } catch (e) { toast(e instanceof Error ? e.message : 'Erro ao mover.', 'erro'); throw e; }
  }
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

  // ---------- entrada rápida (RF06) ----------
  root.querySelector<HTMLFormElement>('[data-rapida]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const campo = q<HTMLInputElement>(form, 'input');
    const entrada = interpretarRapida(campo.value);
    if (!entrada || !listaAtual) { campo.focus(); return; }
    const btn = q<HTMLButtonElement>(form, 'button');
    btn.disabled = true;
    try {
      const nova = await api.criarTarefa(listaAtual, entrada);
      tarefas.push(nova);
      campo.value = '';
      desenharQuadro();
      toast(`Criada: ${nova.titulo} · ${rotuloPrioridade[nova.prioridade]}${nova.prazo ? ` · prazo ${dataBr(nova.prazo)}` : ''}${nova.horasEstimadas ? ` · ${nova.horasEstimadas}h` : ''}`, 'ok');
    } catch (err) { toast(err instanceof Error ? err.message : 'Erro ao criar.', 'erro'); }
    finally { btn.disabled = false; campo.focus(); }
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
  root.querySelector<HTMLFormElement>('[data-form-sprint]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cap = Number(q<HTMLInputElement>(root, '#w-cap').value) || 20;
    try {
      const r = await api.planejarSprint(cap);
      toast(`Sprint planejada: ${r.tarefas} ${r.tarefas === 1 ? 'tarefa' : 'tarefas'} (${r.horasPlanejadas}h)${r.foraDaSprint ? `, ${r.foraDaSprint} ficaram de fora` : ''}.`, 'ok');
      telaPainel(root);
    } catch (err) { toast(err instanceof Error ? err.message : 'Erro ao planejar.', 'erro'); }
  });
  root.querySelector('[data-iniciar-foco]')?.addEventListener('click', () => {
    navegar(`#/foco?modo=${q<HTMLSelectElement>(root, '#w-modo').value}&iniciar=1`);
  });
}
