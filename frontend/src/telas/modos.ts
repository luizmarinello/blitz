// Tela 07 Modos de concentração: CRUD completo (pendência nº 1 da Sprint 4). UC05, RF12, RF13, RN05.
import { api, type Modo } from '../api';
import { carregando, confirmar, dados, erroEstado, html, montar, mostrarErros, q, toast, vazio } from '../ui';

export async function telaModos(root: HTMLElement) {
  montar(root, carregando());
  let modos: Modo[];
  try { modos = await api.modos(); } catch (e) {
    montar(root, erroEstado(e, 'recarregar'));
    root.querySelector('[data-acao=recarregar]')?.addEventListener('click', () => telaModos(root));
    return;
  }
  const predefinidos = modos.filter((m) => m.predefinido);
  const meus = modos.filter((m) => !m.predefinido);

  const cartao = (m: Modo) => html`
    <li class="modo">
      <div style="display:flex;justify-content:space-between;gap:var(--space-2);align-items:baseline">
        <h3 style="margin:0">${m.nome}</h3>
        ${m.predefinido ? html`<span class="chip chip-neutro">Predefinido</span>` : ''}
      </div>
      <div class="ciclos" aria-label="${m.cicloFocoMin} minutos de foco e ${m.cicloPausaMin} de pausa">${m.cicloFocoMin} min foco · ${m.cicloPausaMin} min pausa</div>
      ${m.descricao ? html`<p class="muted small" style="margin:0">${m.descricao}</p>` : ''}
      <div class="acoes" style="margin-top:auto">
        <a class="btn btn-pequeno" href="#/foco?modo=${m.id}">Usar</a>
        ${m.predefinido ? '' : html`
          <button class="btn btn-fantasma btn-pequeno" type="button" data-editar="${m.id}">Editar</button>
          <button class="btn btn-fantasma btn-pequeno" type="button" data-excluir="${m.id}" aria-label="Excluir modo ${m.nome}">Excluir</button>`}
      </div>
    </li>`;

  montar(root, html`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
      <h1 style="margin:0">Modos de concentração</h1>
      <button class="btn" type="button" data-novo>+ Novo modo</button>
    </div>
    <p class="muted">Cada modo define o ciclo de foco e pausa da sessão. Os predefinidos não podem ser alterados; crie o seu.</p>
    <h2>Predefinidos</h2>
    <ul class="lista-modos">${predefinidos.map(cartao)}</ul>
    <h2 style="margin-top:var(--space-6)">Meus modos</h2>
    ${meus.length ? html`<ul class="lista-modos">${meus.map(cartao)}</ul>`
      : vazio('Você ainda não criou um modo', 'Personalize os ciclos de foco e pausa do seu jeito.', html`<button class="btn" type="button" data-novo>+ Novo modo</button>`)}

    <dialog data-dlg aria-labelledby="dlg-modo-titulo">
      <h2 id="dlg-modo-titulo">Novo modo</h2>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo"><label for="m-nome">Nome</label><input id="m-nome" name="nome" required maxlength="80" /><span class="erro" data-erro="nome"></span></div>
        <div class="campo"><label for="m-desc">Descrição <span class="muted small">(opcional)</span></label><input id="m-desc" name="descricao" maxlength="500" /><span class="erro" data-erro="descricao"></span></div>
        <div class="linha">
          <div class="campo"><label for="m-foco">Foco (min, 1–240)</label><input id="m-foco" name="cicloFocoMin" type="number" min="1" max="240" required value="25" /><span class="erro" data-erro="cicloFocoMin"></span></div>
          <div class="campo"><label for="m-pausa">Pausa (min, 0–120)</label><input id="m-pausa" name="cicloPausaMin" type="number" min="0" max="120" required value="5" /><span class="erro" data-erro="cicloPausaMin"></span></div>
        </div>
        <div class="acoes"><button class="btn" type="submit">Salvar</button><button class="btn btn-fantasma" type="button" data-fechar>Cancelar</button></div>
      </form>
    </dialog>`);

  const dlg = q<HTMLDialogElement>(root, '[data-dlg]');
  const form = q<HTMLFormElement>(dlg, 'form');
  let editando: Modo | null = null;
  const abrir = (m: Modo | null) => {
    editando = m;
    q(dlg, 'h2').textContent = m ? 'Editar modo' : 'Novo modo';
    form.reset();
    if (m) {
      q<HTMLInputElement>(form, '#m-nome').value = m.nome;
      q<HTMLInputElement>(form, '#m-desc').value = m.descricao ?? '';
      q<HTMLInputElement>(form, '#m-foco').value = String(m.cicloFocoMin);
      q<HTMLInputElement>(form, '#m-pausa').value = String(m.cicloPausaMin);
    }
    dlg.showModal();
    q(form, '#m-nome').focus();
  };
  root.querySelectorAll('[data-novo]').forEach((b) => b.addEventListener('click', () => abrir(null)));
  root.querySelectorAll<HTMLElement>('[data-editar]').forEach((b) => b.addEventListener('click', () => abrir(modos.find((m) => m.id === Number(b.dataset.editar))!)));
  q(dlg, '[data-fechar]').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dados(form);
    const corpo = { nome: d.nome, descricao: d.descricao || undefined, cicloFocoMin: Number(d.cicloFocoMin), cicloPausaMin: Number(d.cicloPausaMin) };
    try {
      if (editando) await api.editarModo(editando.id, corpo); else await api.criarModo(corpo);
      toast(editando ? 'Modo atualizado.' : 'Modo criado.', 'ok');
      dlg.close();
      telaModos(root);
    } catch (err) { mostrarErros(form, err); }
  });
  root.querySelectorAll<HTMLElement>('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    const m = modos.find((x) => x.id === Number(b.dataset.excluir))!;
    if (!(await confirmar(`Excluir "${m.nome}"?`, 'Modos já usados em sessões não podem ser excluídos, para preservar o histórico.', 'Excluir', true))) return;
    try { await api.excluirModo(m.id); toast('Modo excluído.', 'ok'); telaModos(root); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao excluir.', 'erro'); }
  }));
}
