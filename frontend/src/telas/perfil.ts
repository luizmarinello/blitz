// Tela 11 Perfil e preferências; Tela 12 Preferências de acessibilidade. UC12, RA04–RA06, RN08, RF-LGPD03 (corrigir).
import { api, type Prefs } from '../api';
import { aplicarPrefs, prefsLocais } from '../prefs';
import { estado, renderizar } from '../router';
import { carregando, dados, html, montar, mostrarErros, q, toast } from '../ui';

export function telaPerfil(root: HTMLElement) {
  const u = estado.usuario!;
  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto">
      <h1>Perfil e preferências</h1>
      <form novalidate data-form-nome>
        <h2>Dados da conta</h2>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo"><label for="p-nome">Nome</label><input id="p-nome" name="nome" value="${u.nome}" required maxlength="180" /><span class="erro" data-erro="nome"></span></div>
        <div class="campo"><label for="p-email">E-mail</label><input id="p-email" value="${u.email}" disabled aria-describedby="p-email-ajuda" /><span id="p-email-ajuda" class="muted small">O e-mail é o identificador da conta e não pode ser alterado nesta versão.</span></div>
        <button class="btn" type="submit">Salvar nome</button>
      </form>
      <hr style="border:0;border-top:1px solid var(--color-border-subtle);margin:var(--space-6) 0" />
      <form novalidate data-form-senha>
        <h2>Trocar senha</h2>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="campo"><label for="s-atual">Senha atual</label><input id="s-atual" name="atual" type="password" autocomplete="current-password" required /><span class="erro" data-erro="atual"></span></div>
        <div class="campo"><label for="s-nova">Nova senha <span class="muted small">(mínimo 8 caracteres)</span></label><input id="s-nova" name="nova" type="password" autocomplete="new-password" required minlength="8" /><span class="erro" data-erro="nova"></span></div>
        <button class="btn" type="submit">Trocar senha</button>
      </form>
      <hr style="border:0;border-top:1px solid var(--color-border-subtle);margin:var(--space-6) 0" />
      <h2>Atalhos</h2>
      <div class="acoes" style="margin-top:0">
        <a class="btn btn-fantasma" href="#/acessibilidade">Acessibilidade</a>
        <a class="btn btn-fantasma" href="#/privacidade">Privacidade e dados</a>
      </div>
    </section>`);

  const fNome = q<HTMLFormElement>(root, '[data-form-nome]');
  fNome.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { estado.usuario = await api.renomear(dados(fNome).nome); toast('Nome atualizado.', 'ok'); renderizar(); }
    catch (err) { mostrarErros(fNome, err); }
  });
  const fSenha = q<HTMLFormElement>(root, '[data-form-senha]');
  fSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dados(fSenha);
    try { await api.trocarSenha(d.atual, d.nova); fSenha.reset(); toast('Senha alterada.', 'ok'); }
    catch (err) { mostrarErros(fSenha, err); }
  });
}

export async function telaAcessibilidade(root: HTMLElement) {
  montar(root, carregando());
  let p: Prefs;
  try { p = await api.prefs(); } catch { p = prefsLocais(); }
  const original = { ...p };

  const radio = (nome: keyof Prefs, valor: string, rotulo: string, ajuda: string) => html`
    <label class="check" style="align-items:center">
      <input type="radio" name="${nome}" value="${valor}" ${p[nome] === valor ? 'checked' : ''} />
      <span><strong>${rotulo}</strong> <span class="muted small">${ajuda}</span></span>
    </label>`;

  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto">
      <h1>Preferências de acessibilidade</h1>
      <p class="muted">As mudanças são aplicadas na hora, em todas as telas, para você conferir antes de salvar.</p>
      <form novalidate>
        <fieldset style="border:0;padding:0;margin:0 0 var(--space-4)">
          <legend style="font-weight:600;margin-bottom:var(--space-2)">Tema</legend>
          ${radio('tema', 'CLARO', 'Claro', 'fundo branco')}
          ${radio('tema', 'ESCURO', 'Escuro', 'fundo escuro, menos brilho')}
          ${radio('tema', 'ALTO_CONTRASTE', 'Alto contraste', 'preto no branco, contraste 21:1')}
        </fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 var(--space-4)">
          <legend style="font-weight:600;margin-bottom:var(--space-2)">Tamanho da fonte</legend>
          ${radio('tamanhoFonte', 'PEQUENO', 'Pequeno', '15 px')}
          ${radio('tamanhoFonte', 'MEDIO', 'Médio', '16 px, padrão')}
          ${radio('tamanhoFonte', 'GRANDE', 'Grande', '19 px')}
        </fieldset>
        <label class="check" style="align-items:center"><input type="checkbox" name="reduzirAnimacoes" ${p.reduzirAnimacoes ? 'checked' : ''} /><span><strong>Reduzir animações</strong> <span class="muted small">remove transições e movimento</span></span></label>
        <label class="check" style="align-items:center"><input type="checkbox" name="leitorTela" ${p.leitorTela ? 'checked' : ''} /><span><strong>Uso leitor de tela</strong> <span class="muted small">prioriza descrições em texto</span></span></label>
        <div class="acoes"><button class="btn" type="submit">Salvar preferências</button><button class="btn btn-fantasma" type="button" data-desfazer>Desfazer</button></div>
      </form>
    </section>`);

  const form = q<HTMLFormElement>(root, 'form');
  const ler = (): Prefs => {
    const d = new FormData(form);
    return { tema: d.get('tema') as Prefs['tema'], tamanhoFonte: d.get('tamanhoFonte') as Prefs['tamanhoFonte'], reduzirAnimacoes: d.has('reduzirAnimacoes'), leitorTela: d.has('leitorTela') };
  };
  form.addEventListener('change', () => aplicarPrefs(ler()));   // prévia imediata
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { aplicarPrefs(await api.salvarPrefs(ler())); toast('Preferências salvas.', 'ok'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Erro ao salvar.', 'erro'); }
  });
  q(root, '[data-desfazer]').addEventListener('click', () => { aplicarPrefs(original); telaAcessibilidade(root); });
}
