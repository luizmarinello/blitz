// RN05: cada modo de concentração tem identidade (ícone + cor) e muda o comportamento da sessão de foco.
import type { Modo } from './api';
import { raw } from './ui';

export type Slug = 'pomodoro' | 'profundo' | 'relax' | 'personalizado';
export interface Identidade {
  slug: Slug;
  icone: string;            // paths de um SVG 24x24 (stroke currentColor)
  silencioso: boolean;      // Profundo: sem avisos de troca de fase nem controles secundários
  mensagemPausa?: string;   // Relax: a pausa ganha destaque e uma frase
}

const SVG: Record<Slug, string> = {
  pomodoro: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 3h6"/>',
  profundo: '<path d="M21 13A8 8 0 1 1 11 3a6 6 0 0 0 10 10z"/>',
  relax: '<path d="M5 20c0-8 4-13 14-14-1 10-6 14-14 14z"/><path d="M5 20c3-5 6-8 10-10"/>',
  personalizado: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};

export function identidade(m: Pick<Modo, 'nome' | 'predefinido'>): Identidade {
  const n = m.predefinido ? m.nome.toLowerCase() : '';
  const slug: Slug = n.startsWith('pomodoro') ? 'pomodoro' : n.startsWith('profundo') ? 'profundo' : n.startsWith('relax') ? 'relax' : 'personalizado';
  return {
    slug,
    icone: SVG[slug],
    silencioso: slug === 'profundo',
    mensagemPausa: slug === 'relax' ? 'Respire fundo. A pausa também faz parte do foco.' : undefined,
  };
}

export const iconeModo = (m: Pick<Modo, 'nome' | 'predefinido'>) =>
  raw(`<svg class="icone-modo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${identidade(m).icone}</svg>`);
