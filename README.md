# Car Diary

GitHub Pages에 배포되는 정적 웹앱이면서, 실제 차량 데이터는 GitHub Repository JSON/이미지 파일로 읽고 쓰는 차량 정비/차계부 앱입니다.

- 프론트엔드: React + TypeScript + Vite + Tailwind CSS
- 라우팅: `HashRouter`
- 차트: Recharts
- 아이콘: lucide-react
- 데이터 저장: GitHub Repository Contents API + raw GitHub URL
- 인증: 사전 허용 차량번호 + 비밀번호 해시 기반의 가벼운 접근 제한

중요:

- 이 프로젝트는 금융서비스 수준의 강보안 시스템이 아닙니다.
- GitHub password를 앱에 넣어 쓰지 않습니다.
- 쓰기 기능은 사용자가 직접 입력한 GitHub Personal Access Token을 브라우저 `localStorage`에 저장하는 방식입니다.

## 1. 전체 아키텍처

### 1-1. 왜 이런 구조인가

이 앱의 목표는 `로컬 PC가 꺼져 있어도 사이트와 데이터 조회가 계속 가능`한 구조입니다.

- 화면은 GitHub Pages에서 정적으로 렌더링됩니다.
- 데이터는 GitHub Repository 안의 JSON/이미지 파일로 저장됩니다.
- 공개 읽기는 `raw.githubusercontent.com` 경로를 사용합니다.
- 쓰기는 브라우저가 GitHub Contents API를 직접 호출합니다.
- 별도 서버, DB, Firebase, Supabase 없이 운영 가능합니다.

### 1-2. 읽기/쓰기 흐름

읽기:

1. 앱 번들은 GitHub Pages에서 로드됩니다.
2. 공개 데이터는 `public/data/*`, `public/repository-data/*` 경로를 raw GitHub URL로 읽습니다.
3. token이 없어도 공개 데이터 조회는 가능합니다.

쓰기:

1. 사용자가 설정 화면에 GitHub token을 입력합니다.
2. token은 브라우저 `localStorage`에 저장됩니다.
3. 정비내역/정비예정/주행거리/활성화 작업 시 GitHub Contents API로 JSON 또는 이미지 파일을 갱신합니다.
4. `sha` 기반 업데이트 흐름을 사용합니다.

### 1-3. 라우팅 선택 이유

이 프로젝트는 `HashRouter`를 사용합니다.

이유:

- GitHub Pages 정적 환경에서 새로고침/직접 진입 시 가장 단순하고 안정적입니다.
- 별도 `404.html` 리다이렉트 트릭 없이 동작합니다.
- 루트 사이트(`car-diary.github.io/`)에서도 운영 부담이 작습니다.

## 2. 폴더 구조

```text
CarDiary/
├─ build_allowed_users.bat
├─ index.html
├─ package.json
├─ postcss.config.js
├─ README.md
├─ tailwind.config.ts
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ public/
│  ├─ data/
│  │  ├─ allowed_users.json
│  │  └─ allowed_users.meta.json
│  └─ repository-data/
│     └─ users/
│        └─ 68보0632/
│           ├─ maintenance-records.json
│           ├─ odometer-history.json
│           ├─ profile.json
│           ├─ scheduled-maintenance.json
│           ├─ storage-summary.json
│           ├─ photos/
│           └─ receipts/
├─ src/
│  ├─ App.tsx
│  ├─ components/
│  │  ├─ layout/AppShell.tsx
│  │  └─ ui.tsx
│  ├─ constants/
│  │  ├─ app.ts
│  │  └─ maintenanceItems.ts
│  ├─ context/AppContext.tsx
│  ├─ lib/
│  │  ├─ format.ts
│  │  ├─ image.ts
│  │  ├─ password.ts
│  │  ├─ selectors.ts
│  │  ├─ storage.ts
│  │  ├─ utils.ts
│  │  └─ validation.ts
│  ├─ pages/
│  │  ├─ ActivateAccountPage.tsx
│  │  ├─ BackupsPage.tsx
│  │  ├─ HomePage.tsx
│  │  ├─ LoginPage.tsx
│  │  ├─ MaintenanceRecordsPage.tsx
│  │  ├─ ScheduledMaintenancePage.tsx
│  │  ├─ SettingsPage.tsx
│  │  └─ StatisticsPage.tsx
│  ├─ services/
│  │  ├─ carDiaryRepository.ts
│  │  └─ githubApi.ts
│  └─ types/models.ts
└─ tools/
   ├─ allowed_vehicle_ids.txt
   └─ build_allowed_users.py
```

## 3. 기술 선택 이유

### React + TypeScript + Vite

- 정적 앱에 적합합니다.
- 컴포넌트 분리와 타입 안정성이 좋습니다.
- GitHub Pages 배포가 단순합니다.

### Tailwind CSS

- 다크 테마 카드 UI를 빠르게 일관되게 만들 수 있습니다.
- shadcn/ui 스타일의 정제된 컴포넌트 패턴을 직접 구현하기 좋습니다.

### Recharts

- 월별/연도별 비용과 주행거리 그래프를 빠르게 구성할 수 있습니다.

### GitHub Contents API

- 서버 없이 파일 단위 CRUD가 가능합니다.
- JSON/이미지 저장 구조가 직관적입니다.
- `sha` 기반으로 업데이트 충돌 흐름을 이해하기 쉽습니다.

## 4. 데이터 구조 / JSON 문서 모델

### 4-1. 저장 구조

```text
public/data/allowed_users.json
public/data/allowed_users.meta.json
public/repository-data/users/{vehicleId}/profile.json
public/repository-data/users/{vehicleId}/odometer-history.json
public/repository-data/users/{vehicleId}/maintenance-records.json
public/repository-data/users/{vehicleId}/scheduled-maintenance.json
public/repository-data/users/{vehicleId}/storage-summary.json
public/repository-data/users/{vehicleId}/photos/*
public/repository-data/users/{vehicleId}/receipts/*
```

### 4-2. 엔티티 요약

#### AllowedUserBuildSource

- 문서상 개념
- 로컬의 `tools/allowed_vehicle_ids.txt` 원본 행 정보
- GitHub에는 원본 txt를 그대로 올리지 않습니다

#### AllowedUserPublicEntry

- `vehicleId: string`
- `displayName: string`
- `status: 'pending' | 'activated'`
- `passwordSalt: string | null`
- `passwordHash: string | null`
- `activatedAt: string | null`
- `passwordUpdatedAt: string | null`
- `profilePath: string`
- `notes: string | null`

예시:

```json
{
  "vehicleId": "68보0632",
  "displayName": "68보0632",
  "status": "activated",
  "passwordSalt": "demo-salt-cardiary",
  "passwordHash": "Q7ECBzt9PBDKGciYWAGe74b41w139OIlSKDrl28/ooU=",
  "activatedAt": "2026-04-03T03:00:00.000Z",
  "passwordUpdatedAt": "2026-04-03T03:00:00.000Z",
  "profilePath": "public/repository-data/users/68보0632/profile.json",
  "notes": "demo account"
}
```

#### UserProfile

- 차량 기본 정보와 현재 주행거리
- 홈 화면 상단 카드와 설정에서 사용

주요 필드:

- `vehicleId`
- `nickname`
- `manufacturer`
- `modelName`
- `trim`
- `modelYear`
- `fuelType`
- `purchaseDate`
- `currentOdometerKm`
- `createdAt`
- `updatedAt`
- `notes`

#### OdometerHistory

- 현재 주행거리와 이력 배열을 함께 저장
- `entries[]`의 각 항목은 기록 시점, 주행거리, 출처를 가짐

#### MaintenanceRecord / MaintenanceRecordItem

- 완료 정비 기록 문서
- 한 건의 정비에 복수 항목 선택 가능
- 비용, 사진, 영수증, 대표사진, 메모 포함

#### ScheduledMaintenance

- 예정일 또는 목표주행거리 기반 정비 계획
- 둘 중 하나만 있어도 등록 가능
- 완료 처리 또는 정비내역 전환 가능

#### AttachmentPhoto

- 업로드 파일 메타데이터
- `path`는 GitHub Repository 파일 경로
- 렌더링 시 raw GitHub URL로 변환

#### StorageUsageSummary

- 사용자별 총 사용량 요약
- JSON 용량 + 첨부 용량
- 300MB 초과 시 업로드 차단

#### AppSettings

- 브라우저 `localStorage`에 저장되는 앱 설정
- `repoOwner`, `repoName`, `branch`, `dataRootPath`, `allowedUsersPath`, `token` 포함

### 4-3. 관계 설명

- `AllowedUserPublicEntry.vehicleId` = `UserProfile.vehicleId`
- `MaintenanceRecord.scheduledSourceId`는 정비예정에서 전환된 원본 ID를 가리킬 수 있음
- `ScheduledMaintenance.completedByRecordId`는 완료 처리된 정비내역 ID를 참조함
- `StorageUsageSummary`는 `MaintenanceRecord.photos/receiptPhotos`와 각 JSON 문서를 합산한 결과임

## 5. GitHub API 연동 방식

### 5-1. 공개 읽기

- `src/services/githubApi.ts`
- `buildRawPublicUrl()`로 raw GitHub URL 생성
- 로컬 개발 중에는 `public/` 상대 경로를 사용
- 배포 환경에서는 raw GitHub URL을 사용해 최신 데이터를 직접 읽음

### 5-2. 쓰기

- GitHub REST API `repos/{owner}/{repo}/contents/{path}`
- 순서:
  1. 현재 파일의 `sha` 조회
  2. base64 인코딩된 새 내용과 함께 `PUT`
  3. 삭제는 `DELETE`

### 5-3. 이미지 업로드

- 브라우저 캔버스로 리사이즈/압축
- base64 인코딩
- GitHub Contents API로 `public/repository-data/users/{vehicleId}/photos/*` 또는 `receipts/*`에 업로드

### 5-4. 에러 UX

- 401: token 오류 또는 권한 부족
- 403 + `x-ratelimit-remaining=0`: rate limit 경고
- 404: 대상 파일 없음
- 앱에서는 토스트와 메시지로 보여줌

## 6. 핵심 UI 화면 설계

### 홈

- 로그인 차량번호
- 현재 주행거리
- 주행거리 갱신 폼
- 정비예정 요약 카드
- 최근 정비내역 카드
- 경고/알림 배너
- 이번 달 지출
- 연간 누적 정비비
- 저장공간 사용량
- 최근 업로드 사진
- 빠른 액션

### 정비내역

- 날짜/업체/비용/메모/사진/영수증 입력
- 정비항목 복수 선택
- 날짜순/비용순/주행거리순 정렬
- 기간/항목/비용 범위 필터
- 수정/삭제/복제 지원

### 정비예정

- 예정일 또는 목표주행거리 등록
- 중요도 표시
- 정비내역으로 전환 버튼
- 완료만 표시 버튼

### 통계

- 연도별 연평균 주행거리
- 연도별 연평균 정비비
- 월별 주행거리 그래프
- 월별 정비비 그래프
- 정비항목별 지출 비중
- 정비 건수 통계
- 최근 12개월 추이

## 7. 실행 방법

### 7-1. 의존성 설치

```bash
npm install
```

### 7-2. 허용 차량번호 파일 생성/갱신

```bash
python tools/build_allowed_users.py
```

또는

```bat
build_allowed_users.bat
```

### 7-3. 개발 서버 실행

```bash
npm run dev
```

### 7-4. 프로덕션 빌드

```bash
npm run build
```

## 8. GitHub Pages 배포 방법

이 프로젝트는 루트 경로 배포를 전제로 설계되어 있습니다.

권장 방식:

1. 이 소스 저장소를 `car-diary.github.io` 리포에 둡니다.
2. GitHub Actions 또는 직접 업로드 방식으로 Vite 빌드 결과를 Pages에 배포합니다.
3. 앱 설정의 기본값을 다음과 같이 유지합니다.
   - `repoOwner = car-diary`
   - `repoName = car-diary.github.io`
   - `branch = main`
   - `dataRootPath = public/repository-data`
   - `allowedUsersPath = public/data/allowed_users.json`

핵심 포인트:

- 앱 정적 번들은 Pages에서 서빙됩니다.
- 최신 JSON/이미지는 raw GitHub URL로 직접 읽기 때문에, 데이터 조회는 Pages 재빌드 없이도 최신 리포 상태를 반영합니다.

## 9. 허용 차량번호 추가 방법

초보자용 관리자 흐름:

1. `tools/allowed_vehicle_ids.txt`를 메모장으로 엽니다.
2. 차량번호를 한 줄 추가/삭제합니다.
3. 저장합니다.
4. `build_allowed_users.bat` 또는 `python tools/build_allowed_users.py`를 실행합니다.
5. 생성된 `public/data/allowed_users.json`, `public/data/allowed_users.meta.json`을 커밋/푸시합니다.

### 9-1. `tools/allowed_vehicle_ids.txt` 샘플 내용

```text
# allowed vehicle ids
68보0632
123가4567
45나8888
```

### 9-2. 빌드 스크립트 특징

- 빈 줄 무시
- `#` 주석 줄 무시
- 차량번호 형식 검증
- 줄 번호 기반 형식 오류 출력
- 줄 번호 기반 중복 출력
- 기존 `allowed_users.json`의 활성화 상태와 해시를 보존
- 원본 txt가 없으면 샘플 파일 자동 생성

### 9-3. 성공 출력 예시

```text
=== allowed users build summary ===
읽은 차량번호 수: 3
유효한 차량번호 수: 3
형식 오류 수: 0
중복 차량번호 수: 0
출력 파일: C:\Users\JW\Desktop\CarDiary\public\data\allowed_users.json
메타 파일: C:\Users\JW\Desktop\CarDiary\public\data\allowed_users.meta.json

[done] allowed_users.json 생성이 완료되었습니다.
```

### 9-4. 중복/오류 출력 예시

예시 원본:

```text
# allowed vehicle ids
68보0632
68보0632
12잘못345
```

예시 출력:

```text
=== allowed users build summary ===
읽은 차량번호 수: 3
유효한 차량번호 수: 1
형식 오류 수: 1
중복 차량번호 수: 1

[error] 잘못된 차량번호 형식
  - line 4: 12잘못345

[error] 중복 차량번호
  - 68보0632: first line 2, duplicate line 3

[fail] 오류를 수정한 뒤 다시 실행하세요.
```

## 10. GitHub token 설정 방법

이 앱은 GitHub password가 아니라 Personal Access Token을 사용합니다.

권장:

- Fine-grained Personal Access Token
- 대상 리포: `car-diary.github.io`
- 권한: `Contents` read/write

설정 순서:

1. GitHub에서 token 발급
2. 앱 로그인 화면 또는 설정 화면에서 token 입력
3. 브라우저 `localStorage`에 저장
4. 이후 정비내역/정비예정/회원가입/이미지 업로드 가능

token이 없으면:

- 공개 데이터 조회만 가능
- 쓰기 기능은 비활성화

## 11. 주의사항 및 한계

- 강보안 인증 시스템이 아닙니다.
- 공개 리포 기반이므로 민감한 개인정보 저장에 적합하지 않습니다.
- token은 브라우저 localStorage에 저장됩니다.
- GitHub API rate limit 영향을 받을 수 있습니다.
- 첨부 이미지는 export JSON에 포함되지 않고 GitHub 파일 경로를 참조합니다.
- 대량 이미지 업로드가 많아지면 리포 크기와 커밋 수가 빠르게 증가할 수 있습니다.

## 12. 향후 확장 포인트

- 사용자별 썸네일 별도 저장
- 이미지 업로드 큐와 재시도
- 정비주기 추천 로직 강화
- Left/Right 세분화가 가능한 정비항목 구조 확장
- 여러 차량 동시 전환 뷰
- SQLite 또는 서버 DB로 이관 가능한 어댑터 계층 추가

## 13. 샘플 데이터

현재 샘플 계정:

- 차량번호: `68보0632`
- 비밀번호: `cardiary123!`

샘플 데이터 구성:

- 정비내역 4건
- 정비예정 3건
- 최근 사진 4장
- 영수증 2장
- 주행거리 이력 4건
