// Painel administrativo (pendência nº 11, sem tela prototipada). UC06 usuários, UC08 métricas, UC10 integrações, RF18–RF21, RN04.
// Gestor (RF21) vê apenas os agregados da própria organização.
import { api, type MetricasAdmin, type Organizacao, type Papel, type UsuarioAdmin } from '../api';
import { estado } from '../router';
import { carregando, dados, dataHoraBr, erroEstado, html, montar, mostrarErros, q, toast, vazio } from '../ui';

type Aba = 'usuarios' | 'organizacoes' | 'metricas' | 'integracoes';
let abaAtual: Aba = 'usuarios';

export async function telaAdmin(root: HTMLElement) {
  const papel = estado.usuario?.papel;
  if (papel === 'GESTOR') return telaGestor(root);
  if (papel !== 'ADMINISTRADOR') {
    montar(root, html`<div class="estado estado-erro" role="alert"><strong>Acesso restrito</strong>Esta área é só para administradores. <a href="#/">Voltar ao painel</a></div>`);
    return;
  }
  const abas: [Aba, string][] = [['usuarios', 'Usuários'], ['organizacoes', 'Organizações'], ['metricas', 'Métricas'], ['integracoes', 'Integrações']];
  montar(root, html`
    <h1>Administração</h1>
    <div class="abas" role="tablist" aria-label="Seções" style="margin-bottom:var(--space-4)">
      ${abas.map(([id, r]) => html`<button role="tab" aria-selected="${id === abaAtual}" data-aba="${id}">${r}</button>`)}
    </div>
    <div data-conteudo>${carregando()}</div>`);
  root.querySelectorAll<HTMLButtonElement>('[data-aba]').forEach((b) => b.addEventListener('click', () => { abaAtual = b.dataset.aba as Aba; telaAdmin(root); }));
  const alvo = q(root, '[data-conteudo]');
  try {
    if (abaAtual === 'usuarios') await abaUsuarios(alvo);
    else if (abaAtual === 'organizacoes') await abaOrganizacoes(alvo);
    else if (abaAtual === 'metricas') await abaMetricas(alvo);
    else await abaIntegracoes(alvo);
  } catch (e) { montar(alvo, erroEstado(e)); }
}

async function abaUsuarios(el: HTMLElement) {
  const [usuarios, orgs] = await Promise.all([api.adminUsuarios(), api.adminOrganizacoes()]);
  const eu = estado.usuario!.id;
  const opt = (v: string, r: string, sel: string) => html`<option value="${v}" ${v === sel ? 'selected' : ''}>${r}</option>`;
  montar(el, html`
    <p class="muted small">Alterações são salvas na hora. Você não pode mudar o próprio papel nem desativar a própria conta.</p>
    <div style="overflow:auto"><table class="tabela">
      <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">Organização</th><th scope="col">Ativo</th><th scope="col">Desde</th></tr></thead>
      <tbody>${usuarios.map((u: UsuarioAdmin) => {
        const anon = !!u.anonimizadoEm, self = u.id === eu, trava = anon || self;
        return html`<tr>
          <td>${u.nome}${self ? html` <span class="chip chip-neutro">você</span>` : ''}${anon ? html` <span class="chip chip-neutro">anonimizada</span>` : ''}</td>
          <td>${u.email}</td>
          <td><select aria-label="Papel de ${u.nome}" data-papel="${u.id}" ${trava ? 'disabled' : ''}>
            ${opt('USUARIO', 'Usuário', u.papel)}${opt('GESTOR', 'Gestor', u.papel)}${opt('ADMINISTRADOR', 'Administrador', u.papel)}</select></td>
          <td><select aria-label="Organização de ${u.nome}" data-org="${u.id}" ${anon ? 'disabled' : ''}>
            <option value="" ${u.organizacaoId ? '' : 'selected'}>—</option>${orgs.map((o) => opt(String(o.id), o.nome, String(u.organizacaoId ?? '')))}</select></td>
          <td><input type="checkbox" aria-label="Conta ativa de ${u.nome}" data-ativo="${u.id}" ${u.ativo ? 'checked' : ''} ${trava ? 'disabled' : ''} /></td>
          <td class="small muted">${dataHoraBr(u.criadoEm)}</td>
        </tr>`;
      })}</tbody>
    </table></div>`);
  const salvar = async (id: number, p: Parameters<typeof api.adminAlterarUsuario>[1]) => {
    try { await api.adminAlterarUsuario(id, p); toast('Usuário atualizado.', 'ok'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao salvar.', 'erro'); abaUsuarios(el); }
  };
  el.querySelectorAll<HTMLSelectElement>('[data-papel]').forEach((s) => s.addEventListener('change', () => salvar(Number(s.dataset.papel), { papel: s.value as Papel })));
  el.querySelectorAll<HTMLSelectElement>('[data-org]').forEach((s) => s.addEventListener('change', () => salvar(Number(s.dataset.org), { organizacaoId: s.value ? Number(s.value) : null })));
  el.querySelectorAll<HTMLInputElement>('[data-ativo]').forEach((c) => c.addEventListener('change', () => salvar(Number(c.dataset.ativo), { ativo: c.checked })));
}

async function abaOrganizacoes(el: HTMLElement) {
  const orgs: Organizacao[] = await api.adminOrganizacoes();
  montar(el, html`
    <div class="card" style="margin-bottom:var(--space-4)">
      <h3>Nova organização</h3>
      <form novalidate class="linha" style="align-items:flex-end">
        <div class="campo" style="margin:0"><label for="o-nome">Nome</label><input id="o-nome" name="nome" required maxlength="180" /><span class="erro" data-erro="nome"></span></div>
        <div class="campo" style="margin:0;flex:0 1 10rem"><label for="o-lic">Licenças</label><input id="o-lic" name="licencasTotais" type="number" min="0" value="10" /><span class="erro" data-erro="licencasTotais"></span></div>
        <button class="btn" type="submit">Criar</button>
        <p class="erro" data-erro-geral role="alert" style="flex-basis:100%;margin:0"></p>
      </form>
    </div>
    ${orgs.length === 0 ? vazio('Nenhuma organização', 'Crie a primeira para agrupar colaboradores (frente B2B).') : html`
      <table class="tabela"><thead><tr><th scope="col">Nome</th><th scope="col">Licenças</th><th scope="col">Criada em</th></tr></thead>
      <tbody>${orgs.map((o) => html`<tr><td>${o.nome}</td><td>${o.licencasTotais}</td><td class="small muted">${dataHoraBr(o.criadoEm)}</td></tr>`)}</tbody></table>`}`);
  const form = q<HTMLFormElement>(el, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dados(form);
    try { await api.adminCriarOrganizacao(d.nome, Number(d.licencasTotais || 0)); toast('Organização criada.', 'ok'); abaOrganizacoes(el); }
    catch (err) { mostrarErros(form, err); }
  });
}

async function abaMetricas(el: HTMLElement) {
  const m: MetricasAdmin = await api.adminMetricas();
  const kpi = (v: number | string, r: string) => html`<div class="kpi"><div class="valor">${v}</div><div class="muted small">${r}</div></div>`;
  montar(el, html`
    <div class="kpis">
      ${kpi(m.usuarios, 'contas')}${kpi(m.usuariosAtivos, 'ativas')}${kpi(m.usuariosAnonimizados, 'anonimizadas')}
      ${kpi(m.sessoes, 'sessões de foco')}${kpi(`${Math.round(m.minutosFoco / 60)}h`, 'de foco no total')}
      ${kpi(`${m.tarefasConcluidas}/${m.tarefas}`, 'tarefas concluídas')}
      ${kpi(m.conversasIa30Dias, 'conversas com IA (30 dias)')}${kpi(m.tokensIa30Dias, 'tokens de IA (30 dias)')}
    </div>
    <section class="card">
      <h2>Por organização</h2>
      <p class="muted small">Só agregados. Equipes com menos de 5 colaboradores não aparecem, para evitar reidentificação (regra da view no banco).</p>
      ${m.organizacoes.length === 0 ? html`<p class="muted">Nenhuma organização com 5 ou mais colaboradores ativos.</p>` : html`
        <table class="tabela"><thead><tr><th scope="col">Organização</th><th scope="col">Colaboradores</th><th scope="col">Sessões</th><th scope="col">Média por sessão</th></tr></thead>
        <tbody>${m.organizacoes.map((o) => html`<tr><td>${o.organizacao}</td><td>${o.colaboradores}</td><td>${o.total_sessoes}</td><td>${o.media_minutos_por_sessao ?? '—'} min</td></tr>`)}</tbody></table>`}
    </section>`);
}

async function abaIntegracoes(el: HTMLElement) {
  const i = await api.adminIntegracoes();
  const status = (ok: boolean) => html`<span class="chip ${ok ? 'chip-BAIXA' : 'chip-ALTA'}">${ok ? '✓ Configurada' : '✕ Não configurada'}</span>`;
  montar(el, html`
    <p class="muted small">As credenciais ficam só no servidor, em variáveis de ambiente. Aqui você confere o estado; para alterar, mude as variáveis e reinicie.</p>
    <div class="card"><h3>Assistente de IA ${status(i.ia.configurado)}</h3>
      <p>Provedor: ${i.ia.provedor} · Modelo: <code>${i.ia.modelo}</code> · Limite: ${i.ia.limiteTokensDia} tokens por usuário a cada 24 h (RNF09).</p>
      <p class="muted small">Sem chave, o assistente responde em modo alternativo (RF17). Variável: <code>GEMINI_API_KEY</code>.</p></div>
    <div class="card"><h3>E-mail ${status(i.email.configurado)}</h3>
      <p>Provedor: ${i.email.provedor}${i.email.host ? html` · Servidor: <code>${i.email.host}</code>` : ''}</p>
      <p class="muted small">Usado na recuperação de senha (RF03). Sem SMTP, o link vai para o log do servidor. Variáveis: <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>.</p></div>`);
}

async function telaGestor(root: HTMLElement) {
  montar(root, carregando());
  try {
    const g = await api.gestorMetricas();
    montar(root, html`
      <section class="card" style="max-width:40rem;margin:auto">
        <h1>Minha equipe</h1>
        ${g.semOrganizacao ? html`<p class="muted">Sua conta ainda não está vinculada a uma organização. Peça a um administrador.</p>` : html`
          <p><strong>${g.organizacao}</strong> · ${g.colaboradores} ${g.colaboradores === 1 ? 'colaborador ativo' : 'colaboradores ativos'}</p>
          ${g.metricas ? html`
            <div class="kpis">
              <div class="kpi"><div class="valor">${g.metricas.total_sessoes}</div><div class="muted small">sessões de foco</div></div>
              <div class="kpi"><div class="valor">${g.metricas.media_minutos_por_sessao ?? '—'}</div><div class="muted small">min por sessão (média)</div></div>
            </div>`
            : html`<div class="alerta alerta-info">As métricas só aparecem para equipes com 5 ou mais colaboradores, para proteger a privacidade de cada pessoa.</div>`}
          <p class="muted small">Você vê apenas agregados da sua organização (RF21). Dados individuais não são exibidos.</p>`}
      </section>`);
  } catch (e) { montar(root, erroEstado(e)); }
}
