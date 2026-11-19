/**
 * 함께 보는 순위 서버 주소 (Google Apps Script 웹 앱 '/exec' 주소).
 * 비어 있으면 '이 기기 기록'만 보여 준다. 설치 방법: server/SETUP.md
 * 빌드할 때 VITE_LEADERBOARD_URL 환경 변수로도 넣을 수 있다.
 */
export const LEADERBOARD_URL: string = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined) || '';
