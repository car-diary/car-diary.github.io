# Car Diary

차량번호 단위로 차계부, 정비내역, 정비예정, 사진, 영수증을 관리하는 GitHub Pages 기반 정적 웹앱입니다.

운영 주소:

- `https://car-diary.github.io/`

현재 운영 기준:

- 로그인은 `차량번호만` 입력합니다.
- 비밀번호 입력 UI는 없습니다.
- GitHub token 입력 UI는 없습니다.
- 데이터 읽기와 화면 렌더링은 GitHub Pages 정적 파일 기준으로 동작합니다.
- 데이터 저장은 GitHub API를 사용합니다.
- 강한 보안 제품이 아니라 개인 운영 편의 우선 구조입니다.

## 기술 스택

- React
- TypeScript
- Vite
- Tailwind CSS
- lucide-react
- Recharts
- React Router `HashRouter`

`HashRouter`를 쓰는 이유:

- GitHub Pages는 서버 라우팅이 없습니다.
- `#/records`, `#/scheduled`처럼 해시 라우팅을 쓰면 새로고침과 직접 진입이 안정적입니다.
- 별도 `404.html` 우회보다 관리가 단순합니다.

## 현재 로그인 방식

- 로그인 화면에서 차량번호만 입력합니다.
- 입력한 차량번호가 `public/data/allowed_users.json`에 있으면 로그인됩니다.
- 세션은 브라우저 `sessionStorage` 기준으로 유지됩니다.
- 다른 차량이 자동으로 로그인되면 안 되도록 현재 세션 차량번호 기준으로만 동작합니다.

중요:

- 이 프로젝트는 강보안 서비스가 아닙니다.
- GitHub 쓰기 권한은 배포 빌드 시 `VITE_GITHUB_TOKEN`으로 주입됩니다.
- 따라서 공개 서비스용 강보안 구조로 보시면 안 됩니다.

## 데이터 구조

사용자 데이터는 차량번호별로 완전히 분리됩니다.

```text
public/
  data/
    allowed_users.json
    allowed_users.meta.json
  repository-data/
    users/
      {vehicleId}/
        profile.json
        odometer-history.json
        maintenance-records.json
        scheduled-maintenance.json
        storage-summary.json
        photos/
        receipts/
```

예시:

```text
public/repository-data/users/68보0632/profile.json
public/repository-data/users/68보0632/maintenance-records.json
public/repository-data/users/67부1213/profile.json
```

각 차량은 자기 폴더 안의 JSON과 첨부파일만 읽고 씁니다.

## 차량 등록 방법

가장 쉬운 방법은 리포 루트의 관리자 프로그램을 사용하는 것입니다.

파일:

- `CarDiaryAdmin.exe`

차량 등록 순서:

1. `CarDiaryAdmin.exe`를 실행합니다.
2. 오른쪽 입력칸에 차량번호를 입력합니다.
   예: `68보0632`
3. `차량번호 등록` 버튼을 누릅니다.
4. 등록이 끝나면 `빌드 + GitHub Pages 배포` 버튼을 누릅니다.
5. 로그에 배포 완료가 뜨면 사이트에서 그 차량번호로 로그인할 수 있습니다.

차량 등록 시 실제로 일어나는 일:

- `tools/allowed_vehicle_ids.txt`에 차량번호가 추가됩니다.
- `public/data/allowed_users.json`이 다시 생성됩니다.
- `public/repository-data/users/{vehicleId}/` 폴더가 생성됩니다.
- 아래 기본 파일이 생성됩니다.

```text
profile.json
odometer-history.json
maintenance-records.json
scheduled-maintenance.json
storage-summary.json
```

중요:

- `차량번호 등록` 버튼만 눌러서는 GitHub Pages 사이트에 아직 반영되지 않습니다.
- `빌드 + GitHub Pages 배포`까지 눌러야 실제 사이트에 반영됩니다.

## 차량 삭제 방법

관리자 프로그램에서만 삭제합니다.

순서:

1. `CarDiaryAdmin.exe`를 실행합니다.
2. 목록에서 삭제할 차량번호를 선택합니다.
3. `선택 차량번호 삭제`를 누릅니다.
4. 그 다음 `빌드 + GitHub Pages 배포`를 누릅니다.

차량 삭제 시 실제로 일어나는 일:

- `tools/allowed_vehicle_ids.txt`에서 해당 차량번호가 제거됩니다.
- `public/repository-data/users/{vehicleId}` 폴더가 통째로 삭제됩니다.
- 즉, 해당 차량의 실제 데이터도 함께 삭제됩니다.

주의:

- 이 삭제는 되돌리지 않는 기준으로 생각해야 합니다.
- 폴더까지 지우므로 정비내역, 주행거리, 사진, 영수증도 같이 사라집니다.

## 관리자 프로그램 동작 범위

`CarDiaryAdmin.exe`에서 하는 일:

- 현재 등록된 차량번호 목록 표시
- 새 차량번호 등록
- 선택한 차량번호 삭제
- allowed users 재생성
- Git 커밋 / 푸시
- GitHub Pages 배포 완료까지 확인

안전 장치:

- 새 차량 추가 또는 선택한 차량 삭제 외의 기존 차량 데이터 변경이 감지되면 배포를 중단합니다.
- 즉, 실수로 다른 차량 폴더를 건드린 상태면 관리자 배포가 막히도록 되어 있습니다.

## `allowed_vehicle_ids.txt` 직접 관리

관리자 프로그램 대신 직접 관리할 수도 있습니다.

원본 파일:

- `tools/allowed_vehicle_ids.txt`

형식:

- 한 줄에 차량번호 1개
- 빈 줄 무시
- `#`으로 시작하는 줄은 주석

예시:

```text
# allowed vehicle ids
68보0632
67부1213
```

빌드 명령:

```bash
python tools/build_allowed_users.py
```

또는:

```bat
build_allowed_users.bat
```

생성 결과:

- `public/data/allowed_users.json`
- `public/data/allowed_users.meta.json`

## 로컬 실행

```bash
npm install
npm run dev
```

배포용 빌드:

```bash
npm run build
```

## GitHub Pages 배포

워크플로 파일:

- `.github/workflows/deploy.yml`

배포 트리거:

- `main` 브랜치 푸시
- GitHub Actions 수동 실행

배포 순서:

1. `python tools/build_allowed_users.py`
2. `npm run build`
3. `dist` 업로드
4. GitHub Pages 배포

## GitHub token 운영 방식

현재 방식:

- GitHub Actions secret `VITE_GITHUB_TOKEN`을 사용합니다.
- 빌드 시 이 값이 프론트 번들에 주입됩니다.
- 앱에는 token 입력 화면이 없습니다.

반드시 알아둘 점:

- 이 방식은 강보안이 아닙니다.
- token이 클라이언트 빌드에 포함되는 구조입니다.
- 개인 프로젝트, 소규모 운영 전제에서만 사용해야 합니다.

## 주요 파일

- `CarDiaryAdmin.exe`
- `build_allowed_users.bat`
- `tools/build_allowed_users.py`
- `tools/build_admin_tool.bat`
- `tools/car_diary_admin.py`
- `tools/allowed_vehicle_ids.txt`
- `src/constants/app.ts`
- `.github/workflows/deploy.yml`

## 현재 앱 기능

- 차량번호 로그인
- 대시보드
- 주행거리 갱신
- 정비내역 등록 / 수정 / 삭제 / 복제
- 정비목록 조회 / 검색 / 필터
- 정비예정 등록 / 수정 / 완료 / 삭제
- 통계 화면
- 사진 / 영수증 첨부
- 저장공간 계산
- JSON 백업 / 복원
- CSV 내보내기
- 다크 / 라이트 테마

## 차량 등록 관련 자주 헷갈리는 점

- `차량번호 등록`만 누르면 사이트에는 아직 안 보입니다.
- 반드시 `빌드 + GitHub Pages 배포`까지 해야 합니다.
- 새 차량이 로그인 안 되면 배포가 끝났는지 먼저 확인해야 합니다.
- 차량 삭제는 실제 사용자 폴더까지 지우는 동작입니다.
- 관리자 프로그램 배포는 기존 다른 차량 데이터가 섞여 있으면 일부러 중단됩니다.

## 참고

- 실제 앱 데이터는 차량번호별 폴더로 분리되어 저장됩니다.
- 사진도 정비내역에 연결된 첨부파일로 저장됩니다.
- 로그인은 차량번호만 사용합니다.
