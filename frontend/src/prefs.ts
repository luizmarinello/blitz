// RN08: preferências de acessibilidade aplicadas no <html>, em todas as telas. Cópia local para valer antes do login.
import type { Prefs } from './api';

const CHAVE = 'blitz.prefs';
export const PREFS_PADRAO: Prefs = { tema: 'CLARO', tamanhoFonte: 'MEDIO', reduzirAnimacoes: false, leitorTela: false };

export function aplicarPrefs(p: Prefs) {
  const h = document.documentElement;
  h.dataset.theme = p.tema;
  h.dataset.fonte = p.tamanhoFonte;
  if (p.reduzirAnimacoes) h.dataset.motion = 'reduzir'; else delete h.dataset.motion;
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* armazenamento indisponível: segue sem persistir */ }
}

export function prefsLocais(): Prefs {
  try { return { ...PREFS_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return PREFS_PADRAO; }
}
