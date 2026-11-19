/** 도구 버튼 아이콘 (외부 아이콘 글꼴 없이 직접 그린 SVG) */
const base = { width: 30, height: 30, viewBox: '0 0 32 32', 'aria-hidden': true } as const;

export function IconUndo() {
  return (
    <svg {...base}>
      <path d="M11 9 5 15l6 6" fill="none" stroke="#e2477d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 15h12.5a7.5 7.5 0 0 1 0 15H14" fill="none" stroke="#e2477d" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrophy() {
  return (
    <svg {...base}>
      <path d="M9 5h14v7a7 7 0 0 1-14 0z" fill="#ffc93a" stroke="#d99a00" strokeWidth="1.6" />
      <path d="M9 8H5a4 4 0 0 0 5 6M23 8h4a4 4 0 0 1-5 6" fill="none" stroke="#d99a00" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 19h4v4h-4z" fill="#e8a800" />
      <rect x="9.5" y="23" width="13" height="4.5" rx="1.6" fill="#b5803a" />
      <path d="m16 8.2 1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="#fff6c8" />
    </svg>
  );
}

export function IconHelp() {
  return (
    <svg {...base}>
      <circle cx="16" cy="16" r="12.5" fill="#6cc0f5" />
      <path d="M12.2 12.6a3.9 3.9 0 1 1 5.6 3.5c-1.2.6-1.8 1.4-1.8 2.7v.6" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="23.6" r="1.9" fill="#fff" />
    </svg>
  );
}

export function IconGear() {
  return (
    <svg {...base}>
      <path
        d="M16 4.5l2.2.3.7 2.8 2.2 1 2.5-1.5 1.6 1.6-1.5 2.5 1 2.2 2.8.7.3 2.2-.3 2.2-2.8.7-1 2.2 1.5 2.5-1.6 1.6-2.5-1.5-2.2 1-.7 2.8-2.2.3-2.2-.3-.7-2.8-2.2-1-2.5 1.5-1.6-1.6 1.5-2.5-1-2.2-2.8-.7L4.5 16l.3-2.2 2.8-.7 1-2.2-1.5-2.5 1.6-1.6 2.5 1.5 2.2-1 .7-2.8z"
        fill="#9aa9b5"
      />
      <circle cx="16" cy="16" r="4.6" fill="#fff" />
    </svg>
  );
}

/** 연못 모서리 연잎 장식 */
export function LeafDeco({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="lfg" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#a8e58a" />
          <stop offset="0.6" stopColor="#5fbb58" />
          <stop offset="1" stopColor="#3a9447" />
        </radialGradient>
      </defs>
      <path d="M50 50 L92 38 A45 45 0 1 1 78 18 Z" fill="url(#lfg)" />
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" fill="none">
        <path d="M50 50 L12 40" />
        <path d="M50 50 L20 78" />
        <path d="M50 50 L52 92" />
        <path d="M50 50 L84 72" />
        <path d="M50 50 L30 14" />
      </g>
    </svg>
  );
}
