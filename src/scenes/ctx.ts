import type { GameState, SceneId } from '../types';
import type { Store } from '../ui/store';
import type { DialogueController } from '../ui/dialogue';
import type { SoundManager } from '../audio/sound';
import type { VoiceManager } from '../audio/voice';
import { costText } from '../data/files';
import type { Cost } from '../types';

export interface Ctx {
  store: Store;
  dlg: DialogueController;
  sound: SoundManager;
  voice: VoiceManager;
  go: (scene: SceneId) => void;
  rerender: () => void;
  openFile: (id: string) => void;
  /** 상태 변경 + 새 파일 알림 */
  act: <T>(fn: (s: GameState) => T) => T;
}

export interface Scene {
  /** 장면에 처음 들어올 때(이어하기 포함) 한 번 */
  enter?: (ctx: Ctx) => void;
  render: (root: HTMLElement, ctx: Ctx) => void;
}

export function costChip(c: Cost, s?: GameState): string {
  const parts: string[] = [];
  if (c.slack > 0) parts.push(`<span class="chip slack" title="작업 여유">⏱ ${c.slack}칸</span>`);
  if (c.slack < 0) parts.push(`<span class="chip gain" title="작업 여유 회복">⏱ +${-c.slack}칸</span>`);
  if (c.ai > 0) parts.push(`<span class="chip ai" title="AI 이용권">✦ ${c.ai}</span>`);
  if (!parts.length) parts.push('<span class="chip zero">비용 없음</span>');
  let warn = '';
  if (s) {
    if (c.ai > s.ai) warn += `<span class="chip warnc" title="이용권 부족분은 사람이 직접 처리합니다">이용권 부족 → 일부 직접 처리</span>`;
    else if (c.slack > s.slack) warn += `<span class="chip warnc" title="초과분은 일정 지연으로 기록됩니다">여유 초과 ${c.slack - s.slack}칸</span>`;
  }
  return `<span class="costs" aria-label="예상 비용: ${costText(c)}">${parts.join('')}${warn}</span>`;
}

/** 장면 안의 단계 진행 표시 (현재 단계 강조) */
export function stepper(labels: string[], cur: number): string {
  return `<ol class="wstep">${labels.map((l, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><span>${i < cur ? '✓' : i + 1}</span>${l}</li>`).join('<li class="sep" aria-hidden="true"></li>')}</ol>`;
}

export const icon = (e: string) => `<div class="cc-icon" aria-hidden="true">${e}</div>`;

export function sceneHeader(kicker: string, title: string, sub: string): string {
  return `<header class="scene-h"><p class="kicker">${kicker}</p><h1 tabindex="-1" class="scene-title">${title}</h1><p class="sub">${sub}</p></header>`;
}
