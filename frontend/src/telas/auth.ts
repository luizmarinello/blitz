// Telas 02 Login, 03 Cadastro (com aceite), 04 Recuperação de senha, Termos. UC01, RF01–RF04, RF-LGPD01, RF-LGPD02.
import { api } from '../api';
import { aplicarPrefs } from '../prefs';
import { estado, navegar } from '../router';
import { dados, html, montar, mostrarErros, q, toast } from '../ui';

export const VERSAO_POLITICA = '1.0';

async function entrarComPrefs() {
  try { aplicarPrefs(await api.prefs()); } catch { /* segue com as preferências locais */ }
  navegar('#/');
}

export function telaLogin(root: HTMLElement) {
  montar(root, html`
    <section class="auth card">
      <a class="logo" href="#/login">Blitz<span>.</span></a>
      <h1>Entrar</h1>
      <p class="muted small" style="text-align:center">O aplicativo que decide com você o que fazer agora.</p>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
          <span class="erro" data-erro="email"></span>
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          <input id="senha" name="senha" type="password" autocomplete="current-password" required />
          <span class="erro" data-erro="senha"></span>
        </div>
        <button class="btn" type="submit" style="width:100%;justify-content:center">Entrar</button>
      </form>
      <p style="margin-top:var(--space-4);text-align:center"><a href="#/recuperar">Esqueci minha senha</a></p>
      <p style="text-align:center">Ainda não tem conta? <a href="#/cadastro">Criar conta</a></p>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dados(form);
    const btn = q<HTMLButtonElement>(form, 'button[type=submit]');
    btn.disabled = true;
    try {
      estado.usuario = await api.login(d.email, d.senha);
      toast(`Bem-vindo de volta, ${estado.usuario.nome.split(' ')[0]}!`, 'ok');
      await entrarComPrefs();
    } catch (err) {
      mostrarErros(form, err);
    } finally { btn.disabled = false; }
  });
  q(root, '#email').focus();
}

export function telaCadastro(root: HTMLElement) {
  montar(root, html`
    <section class="auth card">
      <a class="logo" href="#/login">Blitz<span>.</span></a>
      <h1>Criar conta</h1>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo">
          <label for="nome">Nome</label>
          <input id="nome" name="nome" autocomplete="name" required maxlength="180" />
          <span class="erro" data-erro="nome"></span>
        </div>
        <div class="campo">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
          <span class="erro" data-erro="email"></span>
        </div>
        <div class="campo">
          <label for="senha">Senha <span class="muted small">(mínimo 8 caracteres)</span></label>
          <input id="senha" name="senha" type="password" autocomplete="new-password" required minlength="8" />
          <span class="erro" data-erro="senha"></span>
        </div>
        <!-- RF-LGPD01: consentimento explícito, sem pré-marcação. RF-LGPD02: finalidade e base legal visíveis. -->
        <div class="check">
          <input id="aceitaTermos" name="aceitaTermos" type="checkbox" />
          <label for="aceitaTermos">Li e aceito os <a href="#/termos" target="_blank">Termos de Uso e a Política de Privacidade</a> (versão ${VERSAO_POLITICA}).
            Registramos data, hora e versão deste aceite.</label>
        </div>
        <span class="erro" data-erro="aceitaTermos" style="display:block;margin:-0.5rem 0 1rem"></span>
        <details class="small muted" style="margin-bottom:var(--space-4)">
          <summary>Como usamos seus dados</summary>
          <p style="margin-top:var(--space-2)"><strong>Finalidade:</strong> prestar o serviço Blitz (gestão de tarefas, sessões de foco e assistente de IA).
          <strong>Base legal:</strong> execução de contrato e consentimento (art. 7º, I e V, LGPD).
          <strong>IA:</strong> enviamos ao provedor apenas título, prioridade, prazo e horas das tarefas; nunca seu nome, e-mail ou identificador.
          <strong>Seus direitos:</strong> acessar, corrigir, exportar e excluir seus dados a qualquer momento em Privacidade e dados.</p>
        </details>
        <button class="btn" type="submit" style="width:100%;justify-content:center">Criar conta</button>
      </form>
      <p style="margin-top:var(--space-4);text-align:center">Já tem conta? <a href="#/login">Entrar</a></p>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dados(form);
    const aceita = q<HTMLInputElement>(form, '#aceitaTermos').checked;
    const btn = q<HTMLButtonElement>(form, 'button[type=submit]');
    btn.disabled = true;
    try {
      estado.usuario = await api.cadastro(d.nome, d.email, d.senha, aceita);
      toast('Conta criada. Bem-vindo ao Blitz!', 'ok');
      await entrarComPrefs();
    } catch (err) {
      mostrarErros(form, err);
    } finally { btn.disabled = false; }
  });
  q(root, '#nome').focus();
}

// RF03 passo 1: pedir o link. A resposta é a mesma exista ou não a conta.
export function telaRecuperar(root: HTMLElement) {
  montar(root, html`
    <section class="auth card">
      <a class="logo" href="#/login">Blitz<span>.</span></a>
      <h1>Recuperar senha</h1>
      <p class="muted small" style="text-align:center">Informe o e-mail da conta. Enviaremos um link válido por 1 hora.</p>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
          <span class="erro" data-erro="email"></span>
        </div>
        <button class="btn" type="submit" style="width:100%;justify-content:center">Enviar link</button>
      </form>
      <p style="margin-top:var(--space-4);text-align:center"><a href="#/login">Voltar para o login</a></p>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = q<HTMLButtonElement>(form, 'button[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.recuperar(dados(form).email);
      montar(root, html`
        <section class="auth card">
          <a class="logo" href="#/login">Blitz<span>.</span></a>
          <h1>Verifique seu e-mail</h1>
          <div class="alerta alerta-ok" role="status">${r.mensagem}</div>
          <p class="muted small">Não chegou? Confira a caixa de spam ou <a href="#/recuperar">peça outro link</a>.</p>
          <p style="text-align:center"><a href="#/login">Voltar para o login</a></p>
        </section>`);
    } catch (err) { mostrarErros(form, err); btn.disabled = false; }
  });
  q(root, '#email').focus();
}

// RF03 passo 2: chegou pelo link do e-mail (#/redefinir?token=...).
export function telaRedefinir(root: HTMLElement, params: Record<string, string>) {
  const token = params.token ?? '';
  if (!token) {
    montar(root, html`<section class="auth card"><h1>Link incompleto</h1><p>Abra o link exatamente como veio no e-mail ou <a href="#/recuperar">peça um novo</a>.</p></section>`);
    return;
  }
  montar(root, html`
    <section class="auth card">
      <a class="logo" href="#/login">Blitz<span>.</span></a>
      <h1>Nova senha</h1>
      <form novalidate>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo">
          <label for="novaSenha">Nova senha <span class="muted small">(mínimo 8 caracteres)</span></label>
          <input id="novaSenha" name="novaSenha" type="password" autocomplete="new-password" required minlength="8" />
          <span class="erro" data-erro="novaSenha"></span>
        </div>
        <button class="btn" type="submit" style="width:100%;justify-content:center">Redefinir senha</button>
      </form>
      <p style="margin-top:var(--space-4);text-align:center"><a href="#/login">Voltar para o login</a></p>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = q<HTMLButtonElement>(form, 'button[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.redefinir(token, dados(form).novaSenha);
      toast(r.mensagem, 'ok');
      navegar('#/login');
    } catch (err) {
      mostrarErros(form, err);
      btn.disabled = false;
      const geral = form.querySelector<HTMLElement>('[data-erro-geral]');
      if (geral?.textContent) geral.innerHTML += ' <a href="#/recuperar">Pedir novo link</a>';
    }
  });
  q(root, '#novaSenha').focus();
}

export function telaTermos(root: HTMLElement) {
  montar(root, html`
    <section class="card" style="max-width:48rem;margin:var(--space-6) auto">
      <h1>Termos de Uso e Política de Privacidade</h1>
      <p class="muted small">Versão ${VERSAO_POLITICA}. Minuta elaborada pela equipe T03N para o protótipo acadêmico Blitz; não substitui revisão jurídica.</p>
      <h2>1. O que é o Blitz</h2>
      <p>Ferramenta de organização de tarefas e sustentação do foco, com assistente de IA que ajuda a decidir a ordem de execução. Protótipo de Trabalho de Conclusão de Curso, sem garantia de disponibilidade contínua.</p>
      <h2>2. Dados tratados e finalidade</h2>
      <p>Nome e e-mail (identificação e acesso à conta); tarefas, listas e sessões de foco (prestação do serviço e métricas pessoais); mensagens ao assistente (geração de respostas); preferências de acessibilidade (adaptação da interface).</p>
      <h2>3. Base legal</h2>
      <p>Execução de contrato (art. 7º, V) e consentimento (art. 7º, I) da Lei 13.709/2018. O aceite é registrado com data, hora e versão desta política.</p>
      <h2>4. Assistente de IA</h2>
      <p>As mensagens são processadas por um provedor externo (Google Gemini) por meio do servidor do Blitz. Enviamos somente título, prioridade, prazo, horas estimadas e status das tarefas. Nunca enviamos nome, e-mail ou identificador da conta. Há um limite diário de uso por pessoa.</p>
      <h2>5. Seus direitos (art. 18)</h2>
      <p>Você pode acessar, corrigir, exportar (JSON e CSV) e excluir seus dados na tela Privacidade e dados. A exclusão anonimiza a conta e apaga tarefas, listas e conversas; o tempo de foco permanece de forma desvinculada, apenas para métricas.</p>
      <h2>6. Segurança</h2>
      <p>Senhas são armazenadas com hash. Os dados trafegam por HTTPS.</p>
      <p style="margin-top:var(--space-6)"><a href="#/cadastro">Voltar ao cadastro</a></p>
    </section>`);
}
