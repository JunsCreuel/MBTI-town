'use client';

// 오른쪽 클릭(길게 누르기) 메뉴를 띄우지 않는다: 3D 화면·그림 위에서 "이미지 저장" 같은 브라우저 메뉴가 뜨지 않게.
// 글을 쓰는 칸(입력·글상자)에서는 붙여넣기·맞춤법 메뉴가 필요하므로 그대로 둔다.
import { useEffect } from 'react';

export function NoContextMenu() {
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    };
    window.addEventListener('contextmenu', onMenu);
    return () => window.removeEventListener('contextmenu', onMenu);
  }, []);
  return null;
}
