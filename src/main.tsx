import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 서비스워커: 첫 온라인 접속 때 모든 파일을 저장해 두고, 이후 오프라인에서도 열린다.
// 새 버전이 있으면 조용히 받아 두었다가 다음에 열 때 적용(게임 중 갑자기 새로고침하지 않음).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
