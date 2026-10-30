// Telas 13 Privacidade e dados, 14 Exportar dados, 15 Excluir conta. UC11, RF-LGPD02, RF-LGPD03, RF-LGPD04, RN07.
import { api, baixar, type Consentimento } from '../api';
import { estado, navegar } from '../router';
import { carregando, dados, dataHoraBr, html, montar, mostrarErros, q, toast } from '../ui';

export async function telaPrivacidade(root: HTMLElement) {
  montar(root, carregando());
  let cons: Consentimento[] = [];
  try { cons = await api.consentimentos(); } catch { /* mostra a tela mesmo sem o histórico */ }

  montar(root, html`
    <section class="card" style="max-width:44rem;margin:auto">
      <h1>Privacidade e dados</h1>
      <p class="muted">Você é o titular dos seus dados. Aqui estão as informações da LGPD e os seus direitos do art. 18.</p>

      <h2>O que guardamos e para quê</h2>
      <table class="tabela">
        <thead><tr><th scope="col">Dado</th><th scope="col">Finalidade</th><th scope="col">Base legal</th></tr></thead>
        <tbody>
          <tr><td>Nome e e-mail</td><td>Identificar você e permitir o acesso</td><td>Execução de contrato</td></tr>
          <tr><td>Listas, tarefas e sessões</td><td>Prestar o serviço e gerar suas métricas</td><td>Execução de contrato</td></tr>
          <tr><td>Mensagens ao assistente</td><td>Gerar respostas e controlar o limite de uso</td><td>Consentimento</td></tr>
          <tr><td>Preferências de acessibilidade</td><td>Adaptar a interface</td><td>Execução de contrato</td></tr>
        </tbody>
      </table>
      <p class="small muted" style="margin-top:var(--space-3)">Ao assistente de IA (Google Gemini) enviamos apenas título, prioridade, prazo, horas e status das tarefas. Nunca nome, e-mail ou identificador. <a href="#/termos">Política completa</a>.</p>

      <h2 style="margin-top:var(--space-6)">Seus consentimentos</h2>
      ${cons.length === 0 ? html`<p class="muted">Nenhum registro encontrado.</p>` : html`
        <table class="tabela">
          <thead><tr><th scope="col">Versão da política</th><th scope="col">Aceito em</th><th scope="col">Canal</th></tr></thead>
          <tbody>${cons.map((c) => html`<tr><td>${c.versaoPolitica}</td><td>${dataHoraBr(c.aceitoEm)}</td><td>${c.canal}</td></tr>`)}</tbody>
        </table>`}

      <h2 style="margin-top:var(--space-6)">Seus direitos</h2>
      <div class="acoes" style="margin-top:0">
        <a class="btn btn-fantasma" href="#/perfil">Corrigir meus dados</a>
        <a class="btn btn-fantasma" href="#/privacidade/exportar">Exportar meus dados</a>
        <a class="btn btn-perigo" href="#/privacidade/excluir">Excluir minha conta</a>
      </div>
    </section>`);
}

export function telaExportar(root: HTMLElement) {
  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto">
      <p><a href="#/privacidade">← Privacidade e dados</a></p>
      <h1>Exportar dados</h1>
      <p>Baixe uma cópia do que o Blitz guarda sobre você (art. 18, V da LGPD).</p>
      <div class="card" style="margin-bottom:var(--space-4)">
        <h3>Cópia completa (JSON)</h3>
        <p class="muted small">Conta, consentimentos, preferências, listas, tarefas, modos, sessões de foco e conversas com o assistente. Formato legível por máquina, para portabilidade.</p>
        <button class="btn" type="button" data-baixar="/api/privacidade/exportar" data-nome="blitz-meus-dados.json">Baixar JSON</button>
      </div>
      <div class="card">
        <h3>Tarefas (CSV)</h3>
        <p class="muted small">Planilha com todas as tarefas, incluindo as concluídas. Abre direto no Excel ou no Google Planilhas.</p>
        <button class="btn btn-secundario" type="button" data-baixar="/api/privacidade/exportar.csv" data-nome="blitz-tarefas.csv">Baixar CSV</button>
      </div>
    </section>`);
  root.querySelectorAll<HTMLButtonElement>('[data-baixar]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await baixar(b.dataset.baixar!, b.dataset.nome!); toast('Arquivo gerado.', 'ok'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao exportar.', 'erro'); }
    finally { b.disabled = false; }
  }));
}

export function telaExcluirConta(root: HTMLElement) {
  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto">
      <p><a href="#/privacidade">← Privacidade e dados</a></p>
      <h1>Excluir conta</h1>
      <div class="alerta alerta-erro" role="alert"><strong>Esta ação não pode ser desfeita.</strong> Sua sessão será encerrada imediatamente.</div>
      <h2>O que acontece</h2>
      <ul>
        <li>Nome, e-mail e senha são substituídos por valores anônimos (anonimização, art. 12 da LGPD).</li>
        <li>Listas, tarefas e conversas com o assistente são apagadas.</li>
        <li>O tempo das sessões de foco permanece sem vínculo com você, apenas para métricas agregadas.</li>
        <li>O registro de que você aceitou a política fica guardado como prova do consentimento.</li>
      </ul>
      <p class="small muted">Quer levar uma cópia antes? <a href="#/privacidade/exportar">Exporte seus dados</a>.</p>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo"><label for="x-senha">Confirme sua senha</label><input id="x-senha" name="senha" type="password" autocomplete="current-password" required /><span class="erro" data-erro="senha"></span></div>
        <label class="check"><input type="checkbox" name="ciente" required /><span>Entendo que a exclusão é definitiva.</span></label>
        <div class="acoes"><button class="btn btn-perigo" type="submit">Excluir minha conta definitivamente</button><a class="btn btn-fantasma" href="#/privacidade">Cancelar</a></div>
      </form>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!q<HTMLInputElement>(form, '[name=ciente]').checked) { q(form, '[data-erro-geral]').textContent = 'Marque a confirmação para continuar.'; return; }
    const btn = q<HTMLButtonElement>(form, 'button[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.excluirConta(dados(form).senha);
      estado.usuario = null;
      toast(r.mensagem, 'ok');
      navegar('#/login');
    } catch (err) { mostrarErros(form, err); btn.disabled = false; }
  });
}
