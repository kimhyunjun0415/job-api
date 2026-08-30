# 랩핑잡 (job-api)

GitHub Pages에 호스팅된 차량 랩핑/PPF 채용 바로가기 페이지입니다.
백엔드나 API 연동 없이 동작하는 정적 페이지입니다.

## 사용 방법

1. `index.html`을 열면 검색어 프리셋(차량랩핑, PPF 등) 또는 직접 입력한 검색어로
   미리보기·바로가기 목록이 모두 갱신됩니다.
2. **미리보기**: 사람인·잡코리아는 X-Frame-Options 차단이 없어 화면 안 iframe으로 바로
   표시됩니다. 탭을 눌러 두 사이트를 전환하고, ⤢ 버튼으로 전체화면으로 볼 수 있어요.
3. **바로가기**: 나머지 사이트(알바몬/원티드/알바천국/인크루트/고용24/당근 알바)는
   X-Frame-Options 등으로 화면 안에 표시할 수 없어 카드를 누르면 새 탭에서 열립니다.
   - `바로검색` 배지: 검색어가 URL에 포함되어 결과 페이지가 바로 열림 (알바몬/원티드)
   - `홈` 배지: 사이트 구조상 검색어를 URL로 넘길 수 없어 직접 검색해야 함
     (알바천국/인크루트/당근 알바는 홈, 고용24는 채용정보 상세검색 화면)

## 사이트 목록 수정

`index.html` 안의 `previewSites`(화면 안 미리보기) / `sites`(새 탭 바로가기) 배열을 수정하면 됩니다.
`urlTpl`에 `{kw}` 자리표시자를 넣으면 검색어가 URL 인코딩되어 치환됩니다. 어떤 사이트가
iframe에 표시되는지는 사이트가 보내는 `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`
응답 헤더에 달려 있어, 다른 사이트를 미리보기로 옮기기 전에 헤더를 확인하는 게 안전합니다.

## 배포

`main` 브랜치에 push하면 GitHub Pages가 자동으로 반영합니다 (저장소 Settings → Pages 참고).

## 신규 공고 알림 (ntfy)

`scripts/fetch-jobs.js`가 GitHub Actions(`.github/workflows/poll-jobs.yml`)에서 30분마다
사람인/잡코리아/알바몬/원티드를 훑어서 새 공고를 찾으면 [ntfy](https://ntfy.sh) 토픽으로
알림을 보냅니다. Firebase나 커스텀 앱 없이, 이미 있는 ntfy 앱으로 폰 알림을 받는 방식입니다.

설정 방법:

1. 폰에 **ntfy** 앱 설치 (Play 스토어 검색: `ntfy`)
2. 앱에서 "+"를 눌러 토픽 구독. 토픽 이름은 아무나 추측 못 하게 임의 문자열로 정하세요.
   (예: `wrapjob-lapping-9f3kq2x` — 실제로 쓸 토픽 이름은 본인만 알고 있어야 합니다.
   ntfy.sh는 공개 서버라 토픽 이름을 아는 사람은 누구나 구독/발행할 수 있어요.)
3. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - 이름: `NTFY_TOPIC`
   - 값: 2번에서 정한 토픽 이름 (저장소가 public이라 코드에는 절대 직접 적지 마세요)
4. Actions 탭 → "Poll job sites and send ntfy notifications" → **Run workflow**로
   수동 실행해서 폰에 테스트 알림이 오는지 확인하세요. 이후로는 30분마다 자동 실행됩니다.

### 한계

스크래핑은 실제 채용 API가 아니라 검색 결과 HTML의 링크를 휴리스틱으로 훑는 방식이라
사이트 구조가 바뀌면 새 공고를 못 찾거나 엉뚱한 링크를 잡을 수 있습니다. 안정성이 중요하면
사람인 API(액세스 키)가 있을 때 `scripts/fetch-jobs.js`를 API 호출로 바꾸는 걸 권장합니다.
