import type { Expression, SpeakerId } from '../types';
import { CHARACTERS } from '../data/characters';

/** 코드로 그린 일러스트형 아바타. 실제 인물을 묘사하지 않는다. */

type Eyes = 'normal' | 'happy' | 'sharp' | 'big' | 'tired';
type Brows = 'neutral' | 'raised' | 'furrow' | 'worried' | 'one';
type Mouth = 'smile' | 'flat' | 'frown' | 'smirk' | 'o' | 'grin' | 'small';

const EXPR: Record<Expression, { eyes: Eyes; brows: Brows; mouth: Mouth; sweat?: boolean; blush?: boolean }> = {
  neutral: { eyes: 'normal', brows: 'neutral', mouth: 'flat' },
  smile: { eyes: 'happy', brows: 'neutral', mouth: 'smile', blush: true },
  happy: { eyes: 'happy', brows: 'raised', mouth: 'grin', blush: true },
  bright: { eyes: 'normal', brows: 'raised', mouth: 'smile' },
  focused: { eyes: 'normal', brows: 'furrow', mouth: 'flat' },
  calm: { eyes: 'normal', brows: 'neutral', mouth: 'small' },
  sharp: { eyes: 'sharp', brows: 'furrow', mouth: 'flat' },
  serious: { eyes: 'normal', brows: 'furrow', mouth: 'frown' },
  worried: { eyes: 'normal', brows: 'worried', mouth: 'frown' },
  sheepish: { eyes: 'happy', brows: 'worried', mouth: 'smirk', sweat: true },
  excited: { eyes: 'big', brows: 'raised', mouth: 'grin', blush: true },
  smirk: { eyes: 'normal', brows: 'one', mouth: 'smirk' },
  surprised: { eyes: 'big', brows: 'raised', mouth: 'o' },
  thinking: { eyes: 'normal', brows: 'one', mouth: 'small' },
  tired: { eyes: 'tired', brows: 'worried', mouth: 'flat' },
};

function hairBack(style: string, c: string) {
  switch (style) {
    case 'bob': return `<path d="M26 46 Q24 18 50 16 Q76 18 74 46 L75 66 Q68 70 64 64 L36 64 Q32 70 25 66 Z" fill="${c}"/>`;
    case 'long': return `<path d="M27 44 Q25 17 50 16 Q75 17 73 44 L76 86 Q64 92 60 80 L40 80 Q36 92 24 86 Z" fill="${c}"/>`;
    case 'wavy': return `<path d="M27 44 Q24 17 50 16 Q76 17 73 44 Q78 56 73 64 Q77 72 68 74 L32 74 Q23 72 27 64 Q22 56 27 44 Z" fill="${c}"/>`;
    case 'ponytail': return `<path d="M68 26 Q86 24 84 44 Q82 58 74 62 Q80 46 70 36 Z" fill="${c}"/><circle cx="70" cy="27" r="5" fill="#d9536f"/>`;
    default: return '';
  }
}

function hairFront(style: string, c: string) {
  switch (style) {
    case 'bob': return `<path d="M29 44 Q28 19 50 19 Q72 19 71 44 Q68 31 56 29 Q46 33 36 31 Q31 36 29 44 Z" fill="${c}"/>`;
    case 'long': return `<path d="M29 45 Q27 18 50 18 Q73 18 71 45 Q66 28 46 29 Q35 32 29 45 Z" fill="${c}"/>`;
    case 'wavy': return `<path d="M29 42 Q29 19 50 19 Q71 19 71 42 L67 36 L61 33 L55 35 L49 32 L43 35 L37 33 Z" fill="${c}"/>`;
    case 'ponytail': return `<path d="M29 43 Q28 19 50 19 Q72 19 71 43 Q66 29 50 28 Q36 29 29 43 Z" fill="${c}"/>`;
    case 'short': return `<path d="M30 40 Q30 20 50 20 Q70 20 70 40 Q67 30 50 29 Q35 29 30 40 Z" fill="${c}"/>`;
    case 'sweep': return `<path d="M30 42 Q28 18 50 18 Q73 18 70 40 Q60 25 40 33 Q34 36 30 42 Z" fill="${c}"/>`;
    case 'messy': return `<path d="M29 41 L30 24 L36 28 L39 16 L46 24 L51 13 L56 24 L63 16 L65 28 L71 23 L71 41 Q63 30 50 30 Q37 30 29 41 Z" fill="${c}"/>`;
    default: return '';
  }
}

function eyes(e: Eyes) {
  const ink = '#2a2330';
  switch (e) {
    case 'happy': return `<path d="M39 47 Q42 43.5 45 47 M55 47 Q58 43.5 61 47" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'sharp': return `<circle cx="42" cy="47" r="2.3" fill="${ink}"/><circle cx="58" cy="47" r="2.3" fill="${ink}"/><path d="M38.5 45 L45.5 44.5 M54.5 44.5 L61.5 45" stroke="${ink}" stroke-width="1.6"/>`;
    case 'big': return `<circle cx="42" cy="46.5" r="3.2" fill="${ink}"/><circle cx="58" cy="46.5" r="3.2" fill="${ink}"/><circle cx="43" cy="45.5" r="1" fill="#fff"/><circle cx="59" cy="45.5" r="1" fill="#fff"/>`;
    case 'tired': return `<path d="M39 47.5 L45 47.5 M55 47.5 L61 47.5" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
    default: return `<g class="eyes-blink"><circle cx="42" cy="47" r="2.5" fill="${ink}"/><circle cx="58" cy="47" r="2.5" fill="${ink}"/><circle cx="42.8" cy="46.2" r=".8" fill="#fff"/><circle cx="58.8" cy="46.2" r=".8" fill="#fff"/></g>`;
  }
}

function brows(b: Brows, c: string) {
  const s = `stroke="${c}" stroke-width="2" stroke-linecap="round" fill="none"`;
  switch (b) {
    case 'raised': return `<path d="M38 39 Q42 36.5 46 38.5 M54 38.5 Q58 36.5 62 39" ${s}/>`;
    case 'furrow': return `<path d="M38 40 L46 41.5 M54 41.5 L62 40" ${s}/>`;
    case 'worried': return `<path d="M38 41 L46 39 M54 39 L62 41" ${s}/>`;
    case 'one': return `<path d="M38 40.5 L46 40.5 M54 39 Q58 36.5 62 38.5" ${s}/>`;
    default: return `<path d="M38 40 Q42 39 46 40 M54 40 Q58 39 62 40" ${s}/>`;
  }
}

function mouth(m: Mouth) {
  const ink = '#7a3340';
  const s = `stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"`;
  switch (m) {
    case 'smile': return `<path d="M44 57 Q50 62 56 57" ${s}/>`;
    case 'grin': return `<path d="M43.5 56 Q50 64 56.5 56 Z" fill="${ink}"/>`;
    case 'frown': return `<path d="M45 59.5 Q50 56 55 59.5" ${s}/>`;
    case 'smirk': return `<path d="M45 58 Q51 60 56 55.5" ${s}/>`;
    case 'o': return `<ellipse cx="50" cy="58" rx="2.8" ry="3.4" fill="${ink}"/>`;
    case 'small': return `<path d="M46.5 57.5 Q50 59.5 53.5 57.5" ${s}/>`;
    default: return `<path d="M45.5 58 L54.5 58" ${s}/>`;
  }
}

export function avatarSvg(id: SpeakerId, expression: Expression = 'neutral'): string {
  const c = CHARACTERS[id].look;
  const ex = EXPR[expression] || EXPR.neutral;
  const shade = 'rgba(0,0,0,.08)';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <circle cx="50" cy="50" r="50" fill="${c.bg}"/>
  ${hairBack(c.hairStyle, c.hair)}
  <path d="M14 100 Q17 74 50 72 Q83 74 86 100 Z" fill="${c.shirt}"/>
  <path d="M42 72 L50 82 L58 72 Z" fill="#fff" opacity=".85"/>
  <rect x="43" y="60" width="14" height="14" rx="5" fill="${c.skin}"/>
  <rect x="43" y="60" width="14" height="6" fill="${shade}"/>
  <ellipse cx="30.5" cy="48" rx="3.5" ry="5" fill="${c.skin}"/>
  <ellipse cx="69.5" cy="48" rx="3.5" ry="5" fill="${c.skin}"/>
  <ellipse cx="50" cy="45" rx="20" ry="23" fill="${c.skin}"/>
  ${hairFront(c.hairStyle, c.hair)}
  ${brows(ex.brows, c.hair)}
  ${eyes(ex.eyes)}
  ${c.glasses ? `<g stroke="#3b3b44" stroke-width="1.6" fill="rgba(255,255,255,.18)"><rect x="35.5" y="42" width="13" height="10" rx="4"/><rect x="51.5" y="42" width="13" height="10" rx="4"/><path d="M48.5 46 L51.5 46"/></g>` : ''}
  ${ex.blush ? `<ellipse cx="37" cy="54" rx="3.5" ry="2" fill="#f19aa0" opacity=".55"/><ellipse cx="63" cy="54" rx="3.5" ry="2" fill="#f19aa0" opacity=".55"/>` : ''}
  <path d="M49 50 Q50 53 48.5 54" stroke="rgba(0,0,0,.22)" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <g class="m-closed">${mouth(ex.mouth)}</g>
  <g class="m-open"><ellipse cx="50" cy="58" rx="4.2" ry="3.2" fill="#7a3340"/><ellipse cx="50" cy="59.6" rx="2.6" ry="1.2" fill="#e27b84"/></g>
  ${ex.sweat ? `<path d="M68 34 Q71 39 68 41 Q65 39 68 34 Z" fill="#8fd0f5"/>` : ''}
</svg>`;
}

export function avatarEl(id: SpeakerId, expression: Expression = 'neutral', size = 48, extraClass = ''): string {
  return `<span class="avatar ${extraClass}" data-avatar="${id}" style="--s:${size}px">${avatarSvg(id, expression)}</span>`;
}
