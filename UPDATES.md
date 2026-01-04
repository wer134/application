# 자동 업데이트 설정 가이드

## 개요

Spotlight Cam은 자동 업데이트 기능을 지원합니다. 사용자는 앱을 실행할 때마다 자동으로 최신 버전을 확인하고, 업데이트가 있으면 다운로드할 수 있습니다.

## 업데이트 서버 설정

### 방법 1: GitHub Releases (권장)

#### 1단계: GitHub 저장소 준비
1. GitHub에 프로젝트 저장소를 생성합니다
2. 저장소에 `updates` 폴더를 생성합니다
3. `updates/latest.json` 파일을 생성합니다

#### 2단계: latest.json 파일 작성
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-01-15",
  "downloadUrl": "https://github.com/yourusername/spotlight-cam/releases/download/v1.0.1/VideoTracker-Setup-1.0.1.exe",
  "releaseNotes": "버그 수정 및 성능 개선\n- 라즈베리파이 연결 안정성 향상\n- UI 개선\n- 새로운 기능 추가"
}
```

**필드 설명:**
- `version`: 새 버전 번호 (예: "1.0.1")
- `releaseDate`: 릴리스 날짜 (YYYY-MM-DD 형식)
- `downloadUrl`: 설치 파일 다운로드 URL (GitHub Releases 또는 자체 서버)
- `releaseNotes`: 릴리스 노트 (줄바꿈은 `\n` 사용)

#### 3단계: main.js 설정
`main.js` 파일에서 업데이트 서버 URL을 설정합니다:

```javascript
const UPDATE_SERVER_URL = 'https://raw.githubusercontent.com/wer134/application/main/updates/latest.json';
```

**현재 설정된 저장소**: [wer134/application](https://github.com/wer134/application)

#### 4단계: 새 버전 배포
1. `package.json`의 버전 번호를 업데이트합니다 (예: "1.0.0" → "1.0.1")
2. 새 버전을 빌드합니다: `npm run make`
3. GitHub Releases에 새 버전을 업로드합니다
4. `updates/latest.json` 파일을 업데이트합니다
5. 변경사항을 커밋하고 푸시합니다

### 방법 2: 자체 서버 사용

#### 1단계: 웹 서버 준비
- HTTPS 지원 권장
- 정적 파일 호스팅 가능한 서버 (예: AWS S3, GitHub Pages, 자체 서버)

#### 2단계: 파일 구조
```
your-server.com/
├── updates/
│   └── latest.json
└── releases/
    ├── VideoTracker-Setup-1.0.0.exe
    ├── VideoTracker-Setup-1.0.1.exe
    └── VideoTracker-Setup-1.0.2.exe
```

#### 3단계: latest.json 작성
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-01-15",
  "downloadUrl": "https://your-server.com/releases/VideoTracker-Setup-1.0.1.exe",
  "releaseNotes": "업데이트 내용..."
}
```

#### 4단계: main.js 설정
```javascript
const UPDATE_SERVER_URL = 'https://your-server.com/updates/latest.json';
```

## 버전 관리 규칙

### 시맨틱 버전 (Semantic Versioning)
- **MAJOR.MINOR.PATCH** 형식 사용
- 예: 1.0.0, 1.0.1, 1.1.0, 2.0.0

### 버전 업데이트 가이드
- **PATCH (1.0.0 → 1.0.1)**: 버그 수정, 작은 개선
- **MINOR (1.0.0 → 1.1.0)**: 새로운 기능 추가, 하위 호환성 유지
- **MAJOR (1.0.0 → 2.0.0)**: 큰 변경사항, 하위 호환성 깨짐

## 업데이트 프로세스

### 개발자 측
1. 코드 수정 및 테스트
2. `package.json` 버전 업데이트
3. 빌드: `npm run make`
4. GitHub Releases에 업로드
5. `updates/latest.json` 업데이트
6. 커밋 및 푸시

### 사용자 측
1. 앱 실행 시 자동으로 업데이트 확인 (5초 후)
2. 업데이트가 있으면 알림 표시
3. 사용자가 다운로드 선택
4. 브라우저에서 설치 파일 다운로드
5. 설치 파일 실행하여 업데이트

## 수동 업데이트 확인

사용자는 다음 방법으로 수동으로 업데이트를 확인할 수 있습니다:
- **Help > Check for Updates** 메뉴 클릭

## 문제 해결

### 업데이트가 확인되지 않는 경우
1. 인터넷 연결 확인
2. 방화벽 설정 확인
3. `UPDATE_SERVER_URL`이 올바른지 확인
4. `latest.json` 파일이 올바른 형식인지 확인

### 다운로드가 실패하는 경우
1. `downloadUrl`이 올바른지 확인
2. 서버가 파일을 제공할 수 있는지 확인
3. CORS 설정 확인 (필요시)

## 보안 고려사항

- HTTPS 사용 권장
- 코드 서명 권장 (Windows Defender 경고 방지)
- 업데이트 서버의 무결성 확인

## 예시: GitHub Releases 사용

### 저장소 구조
```
application/
├── updates/
│   └── latest.json
├── main.js
├── package.json
└── ...
```

### latest.json 예시
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-01-15",
  "downloadUrl": "https://github.com/wer134/application/releases/download/v1.0.1/VideoTracker-Setup-1.0.1.exe",
  "releaseNotes": "주요 변경사항:\n- 라즈베리파이 WebSocket 연동 기능 추가\n- UI 개선\n- 버그 수정"
}
```

### GitHub Releases 설정
1. GitHub 저장소로 이동
2. **Releases** 섹션 클릭
3. **Draft a new release** 클릭
4. 태그: `v1.0.1` (버전과 일치)
5. 제목: `Spotlight Cam v1.0.1`
6. 릴리스 노트 작성
7. 빌드된 `VideoTracker-Setup-1.0.1.exe` 파일 업로드
8. **Publish release** 클릭

이제 사용자들이 자동으로 업데이트를 받을 수 있습니다!

