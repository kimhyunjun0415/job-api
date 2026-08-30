# 랩핑잡 (job-api)

이 레포는 GitHub Pages에 호스팅된 PWA에 OneSignal 웹 푸시 알림을 연결하고,
GitHub Actions로 여러 구직 사이트를 주기적으로 스크랩하여 신규 공고가 발견되면
OneSignal으로 푸시를 보내는 구성입니다.

설치/설정

1. OneSignal 앱 생성
   - https://onesignal.com/ 에서 무료 계정 생성 후 Web App을 추가하세요.
   - App ID (Public)와 REST API Key (Private)를 얻습니다.

2. GitHub Secrets 설정
   - 레포지토리 페이지 → Settings → Secrets and variables → Actions → New repository secret
   - 이름: ONESIGNAL_APP_ID 값: (OneSignal의 App ID) — 공개 정보이므로 직접 넣어도 됩니다.
   - 이름: ONESIGNAL_API_KEY 값: (OneSignal의 REST API Key) — 반드시 비밀로 저장하세요.

3. (선택) onesignal-setup.js 확인
   - 기본적으로 onesignal-setup.js에 App ID가 삽입되어 있습니다. 변경하려면 파일을 편집하세요.

4. 수동으로 워크플로우 실행(테스트)
   - Actions 탭에서 "Poll job sites and send OneSignal notifications" 워크플로우를 선택하고
     "Run workflow"로 수동 실행할 수 있습니다. 또는 30분마다 자동 실행됩니다.

테스트 방법 (Android)
 - Chrome에서 https://<your-username>.github.io/job-api/ 를 열고 메뉴 → 홈 화면에 추가
 - 설치된 PWA에서 알림 허용을 선택하면 OneSignal이 푸시를 받아 표시합니다.

주의점
 - 고용24(구 워크넷)은 사이트 구조가 바뀌어 현재는 자동 스크랩 템플릿이 비어있습니다.
 - 스크래핑은 사이트 구조 변화에 취약합니다. 안정성을 위해 사람인 API(액세스 키)가 있다면
   scripts/fetch-jobs.js를 API 호출로 바꾸는 것을 권장합니다.
