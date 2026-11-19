/**
 * 함께 보는 순위 서버 주소 (Google Apps Script 웹 앱 '/exec' 주소).
 * 설치 방법: server/SETUP.md. 빌드할 때 VITE_LEADERBOARD_URL 환경 변수가 있으면 그 주소를 쓴다.
 */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbyi8ApDRuw8tkIy47TA7t1tNqjmpa7Vqb8aK2MMBuJiahgMEqUQ2Z8wpYviFpCUXo91UA/exec';
export const LEADERBOARD_URL: string = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined) || DEFAULT_URL;
