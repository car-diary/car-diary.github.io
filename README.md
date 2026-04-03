# Car Diary

GitHub Pages에 배포되는 차량 정비/차계부 웹앱입니다.  
허용된 차량번호만 로그인할 수 있고, 정비내역, 정비예정, 주행거리, 사진, 영수증 데이터를 GitHub 저장소 JSON과 이미지 파일에 기록합니다.

## 1. 핵심 구조

- 프론트엔드: React + TypeScript + Vite + Tailwind CSS
- 라우팅: `HashRouter`
- 배포: GitHub Pages
- 데이터 저장: 같은 저장소의 `public/repository-data` 경로
- 허용 차량 관리: 로컬 `tools/allowed_vehicle_ids.txt`에서 빌드

`HashRouter`를 사용한 이유:

- GitHub Pages는 정적 호스팅이므로 직접 경로 진입 시 서버 라우팅이 없습니다.
- `#/records`, `#/scheduled` 형태로 경로를 고정하면 새로고침과 직접 진입이 안정적입니다.
- 별도 `404.html` 라우팅 트릭보다 단순하고 유지보수가 쉽습니다.

## 2. 로그인 방식

- 로그인 화면에서는 차량번호만 입력합니다.
- 차량번호가 `public/data/allowed_users.json`에 있으면 접속할 수 있습니다.
- 처음 접속한 차량번호에 사용자 데이터 폴더가 없으면 앱이 기본 JSON 문서를 생성합니다.

주의:

- 배포 빌드에는 GitHub API 쓰기용 값이 포함될 수 있습니다.
- 이 방식은 강한 보안 구조가 아닙니다.
- 공개 저장소와 개인 프로젝트 운영 편의를 우선한 구조입니다.

## 3. 데이터 구조

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

### 3-1. `allowed_users.json`

```json
[
  {
    "vehicleId": "68보0632",
    "displayName": "68보0632",
    "profilePath": "public/repository-data/users/68보0632/profile.json",
    "notes": null
  }
]
```

### 3-2. `profile.json`

```json
{
  "vehicleId": "68보0632",
  "nickname": "68보0632",
  "manufacturer": "",
  "modelName": "차량 정보 미입력",
  "trim": "",
  "modelYear": 2026,
  "fuelType": "미입력",
  "purchaseDate": null,
  "currentOdometerKm": 0,
  "createdAt": "2026-04-03T00:00:00.000Z",
  "updatedAt": "2026-04-03T00:00:00.000Z",
  "notes": ""
}
```

### 3-3. `maintenance-records.json`

```json
{
  "vehicleId": "68보0632",
  "records": [],
  "updatedAt": "2026-04-03T00:00:00.000Z"
}
```

### 3-4. `scheduled-maintenance.json`

```json
{
  "vehicleId": "68보0632",
  "items": [],
  "updatedAt": "2026-04-03T00:00:00.000Z"
}
```

### 3-5. `storage-summary.json`

```json
{
  "vehicleId": "68보0632",
  "limitBytes": 314572800,
  "usedBytes": 0,
  "jsonBytes": 0,
  "attachmentBytes": 0,
  "percentUsed": 0,
  "fileBreakdown": [],
  "updatedAt": "2026-04-03T00:00:00.000Z"
}
```

## 4. 허용 차량번호 관리 방법

### 4-1. 원본 파일

경로:

```text
tools/allowed_vehicle_ids.txt
```

형식:

- 한 줄에 차량번호 1개
- 빈 줄 무시
- `#`로 시작하는 줄은 주석

샘플:

```text
# allowed vehicle ids
68보0632
123가4567
45나8888
```

### 4-2. 빌드 명령

```bash
python tools/build_allowed_users.py
```

또는

```bat
build_allowed_users.bat
```

### 4-3. 콘솔 출력 예시

정상 예시:

```text
=== allowed users build summary ===
읽은 차량번호 수: 3
유효한 차량번호 수: 3
형식 오류 수: 0
중복 차량번호 수: 0
출력 파일: C:\...\public\data\allowed_users.json
메타 파일: C:\...\public\data\allowed_users.meta.json

[done] allowed_users.json 생성이 완료되었습니다.
```

오류 예시:

```text
[error] 잘못된 차량번호 형식
  - line 4: 12345678

[error] 중복 차량번호
  - 68보0632: first line 2, duplicate line 5

[fail] 오류를 수정한 뒤 다시 실행하세요.
```

## 5. 실행 방법

```bash
npm install
npm run dev
```

배포용 빌드:

```bash
npm run build
```

## 6. GitHub Pages 배포

이 저장소는 GitHub Actions로 Pages를 배포합니다.

워크플로:

```text
.github/workflows/deploy.yml
```

동작:

1. `main` 브랜치 푸시
2. `python tools/build_allowed_users.py`
3. `npm run build`
4. `dist` 업로드
5. GitHub Pages 배포

## 7. GitHub 저장 연동

- 읽기: `raw.githubusercontent.com` 경로에서 공개 JSON/이미지 조회
- 쓰기: GitHub Contents API 사용
- 이미지 업로드: 압축 후 base64 변환 뒤 업로드
- 삭제: Contents API의 `DELETE` 사용

## 8. 설정 값

주요 설정 파일:

```text
src/constants/app.ts
```

기본값:

- `repoOwner: car-diary`
- `repoName: car-diary.github.io`
- `branch: main`
- `dataRootPath: public/repository-data`
- `allowedUsersPath: public/data/allowed_users.json`
- `storageLimitBytes: 300MB`

## 9. 배포 빌드용 저장 권한 값

GitHub Actions secret:

```text
VITE_GITHUB_TOKEN
```

워크플로는 이 값을 `VITE_GITHUB_TOKEN` 환경 변수로 빌드에 주입합니다.

중요:

- 이 값은 클라이언트 번들에 포함될 수 있습니다.
- 따라서 강한 보안이 필요한 프로젝트에는 적합하지 않습니다.
- 이 저장소는 개인 운영 편의와 단순한 구조를 우선합니다.

## 10. 현재 포함 기능

- 차량번호 로그인
- 홈 대시보드
- 주행거리 갱신
- 정비내역 등록, 수정, 삭제, 복제
- 정비예정 등록, 완료 처리, 삭제
- 통계 차트
- 사진 및 영수증 업로드
- 저장공간 사용량 계산
- 내보내기, 가져오기, CSV 내보내기

## 11. 개발 메모

- 정비항목은 코드 상수로 관리합니다.
- `프론트` / `리어` 표현을 통일합니다.
- 저장공간 한도는 계정당 300MB입니다.
- 공개 저장소 특성상 민감 정보 저장은 피해야 합니다.
