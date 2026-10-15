import type { Scene } from './ctx';
import { sceneHeader } from './ctx';
import { avatarEl } from '../ui/avatar';

export const introScene: Scene = {
  render: (root, ctx) => {
    root.innerHTML = `${sceneHeader('입사 일주일 전 · 월요일 09:00', '신입사원 30명 온보딩 준비', '교육 일정은 정해졌습니다. 남은 건 안내자료, 설문, 운영 준비.')}
    <div class="board">
      <div class="board-card"><h3>📋 이번 주 할 일</h3>
        <ul class="checklist"><li>안내자료 (장소·시간·출입 절차)</li><li>첫날 안내 도구 + 의견 받기</li><li>지난 차수 의견 분석</li><li>자료 정리·공유</li></ul></div>
      <div class="board-card"><h3>🧰 쓸 수 있는 것</h3>
        <ul class="checklist"><li><b>작업 여유 18칸</b> — 게임 속 업무 비용 (실제 시간 아님)</li><li><b>AI 이용권 100점</b> — 입력 분량·생성·재작업 비용 (가상 단위)</li><li>승인된 사내 AI · 사내 승인 공유함 · 승인 설문 도구</li><li class="muted">외부 AI·외부 설문·공개 링크: 사내 정책상 사용 불가</li></ul></div>
      <div class="board-card team"><h3>👥 팀</h3><div class="team-row">${['hong', 'sujin', 'jongyun', 'chian', 'heeyeon', 'heoin', 'yunjin'].map((id) => avatarEl(id as any, 'smile', 44)).join('')}</div>
        <p class="muted">왼쪽 팀원을 누르면 직급·강점·현재 의견을 볼 수 있어요.</p></div>
    </div>
    <p class="hint">선택 전에는 항상 예상 비용과 알려진 조건이 표시됩니다. 제한 시간은 없어요.</p>
    <div class="actions"><button type="button" class="btn primary big" data-testid="start-work">업무 시작 ▶</button></div>`;
    root.querySelector('[data-testid=start-work]')!.addEventListener('click', () => { ctx.sound.sfx('confirm'); ctx.go('ev1'); });
  },
};
