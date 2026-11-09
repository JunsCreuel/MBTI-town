// 화면 어디서든 잠깐 띄우는 작은 알림 (React 밖, 예: 3D 장면 안에서 생긴 일). 2.6초 뒤 사라진다.
export function miniToast(text: string): void {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = 'mini-toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
