# 모두의 네컷 사진 (Everyone's Four Cuts) 📸

> **프레임 선택 → 6컷 순차 촬영 → 뽀샤시/필터 보정 → 슬롯 배치 → 실물 인쇄 및 이메일 전송**까지 한 번에 즐기는 브라우저 기반 포토부스 웹 애플리케이션입니다.  
> 별도의 백엔드 서버 없이 동작하며, **GitHub Pages**로 즉시 배포하여 무료로 호스팅할 수 있습니다.

---

## ✨ 주요 기능

- 🎨 **감성 프레임 선택**: 핑크 리본, 모던 모노크롬, 레트로 필름, 2x2 파스텔 그리드 등 다양한 테마 제공 (`frames/frames.json` 매니페스트로 확장 가능)
- 📸 **6컷 연속 자동 촬영**: 3초 카운트다운 타이머, 사운드 효과(Web Audio API 비프음/셔터음), 플래시 효과, 전/후면 카메라 전환 및 미러 모드 지원
- 📁 **사진 업로드 폴백**: 웹캠/카메라 사용이 불가능한 환경에서도 로컬 사진을 업로드하여 사용 가능
- 🌸 **필터 프리셋 & 미세 보정**: 뽀샤시(화사하게), 빈티지 필름, 흑백, 웜톤, 쿨톤 프리셋 및 밝기/대비/채도 슬라이더
- 🧩 **슬롯 배치 & 순서 변경**: 촬영된 6장 중 프레임 슬롯 수만큼 자유롭게 선택하고 원클릭 화살표로 순서 재배열
- 🖼️ **고해상도 캔버스 합성 Engine**: Aspect-ratio cover 방식으로 사진을 자동 크롭하고 투명 프레임 오버레이 및 날짜 스탬프 렌더링
- 🖨️ **실물 규격 인쇄 (2×6인치)**:
  - 데스크톱: `window.print()` + `@media print` CSS로 포토 스트립 크기 자동 맞춤
  - 모바일: Web Share API (`navigator.share`)를 통해 iOS AirPrint / 안드로이드 시스템 프린트 서비스로 즉시 전송
- 💌 **이메일 전송 (EmailJS)**: 서버 없이 클라이언트에서 완성된 포토 스트립을 JPEG 압축하여 이메일로 전송
- 💾 **기기 즉시 저장**: 고해상도 PNG 파일 원클릭 다운로드

---

## 📂 프로젝트 구조

```
모두의 네컷 사진/
├── index.html              # SPA 전체 마크업 (5단계 스텝 및 모달)
├── style.css               # 포토부스 네온 테마, 반응형 레이아웃, @media print
├── frames/
│   ├── frames.json         # 프레임 목록 및 슬롯 좌표 메타데이터
│   ├── frame_pink.png      # 러블리 핑크 4컷 세로 스트립 (600x1800)
│   ├── frame_mono.png      # 모던 모노크롬 4컷 세로 스트립 (600x1800)
│   ├── frame_retro.png     # 빈티지 필름 4컷 세로 스트립 (600x1800)
│   └── frame_grid.png      # 파스텔 2x2 그리드 (1200x1600)
├── js/
│   ├── main.js             # 화면 라우팅 및 전역 상태 관리 진입점
│   ├── camera.js           # getUserMedia 스트림 제어 및 6컷 시퀀스 촬영
│   ├── sound.js            # Web Audio API 기반 비프음 / 셔터음 생성
│   ├── editor.js           # 필터 프리셋, 슬라이더 연산, 사진 선택/스왑
│   ├── compositor.js       # 고해상도 Canvas 합성 엔진
│   ├── print.js            # window.print & Web Share API 연동
│   └── email.js            # EmailJS API 연동
├── scripts/
│   └── generate_frames.js  # 기본 프레임 이미지 자동 생성 스크립트
├── plan.md                 # 기획 및 요구사항 명세서
└── README.md               # 프로젝트 매뉴얼 및 배포 가이드
```

---

## 🚀 로컬 실행 방법

브라우저의 카메라 API(`getUserMedia`)와 ES Modules(`import/export`)는 보안상 로컬 웹 서버 환경에서 구동해야 합니다.

### 방법 1: Node.js (npx serve)
```bash
npx serve .
# 또는
npx http-server -p 8080
```

### 방법 2: Python HTTP Server
```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080` (또는 표시된 로컬 주소)로 접속합니다.

---

## 🌐 GitHub Pages 배포 방법

1. **GitHub 저장소 생성 및 푸시**:
   ```bash
   git init
   git add .
   git commit -m "feat: 모두의 네컷 사진 웹앱 최초 릴리즈"
   git branch -M main
   git remote add origin https://github.com/<사용자아이디>/<저장소이름>.git
   git push -u origin main
   ```

2. **GitHub Pages 활성화**:
   - GitHub 저장소 웹 페이지에서 **Settings** → 좌측 **Pages** 메뉴로 이동합니다.
   - **Build and deployment** 항목의 **Source**를 `Deploy from a branch`로 설정합니다.
   - **Branch**를 `main` (또는 `master`), 폴더를 `/(root)`로 지정하고 **Save**를 누릅니다.

3. **접속 확인**:
   - 약 1~2분 후 `https://<사용자아이디>.github.io/<저장소이름>/` 주소로 배포가 완료됩니다.
   - GitHub Pages는 기본적으로 **HTTPS** 환경을 제공하므로 모바일/PC 모두 카메라 권한 및 공유 기능이 정상 작동합니다.

---

## 📧 EmailJS 연동 가이드 (선택 사항)

이메일 전송 기능을 활성화하려면 무료 [EmailJS](https://www.emailjs.com/) 계정 설정이 필요합니다.

1. EmailJS 회원가입 후 **Email Services**에서 본인의 이메일(Gmail 등)을 연동합니다.
2. **Email Templates**에서 새 템플릿을 생성하고 다음 필드를 설정합니다:
   - To Email: `{{to_email}}`
   - Content: `{{message}}`
   - Attachment: `{{photo_attachment}}`
3. 웹앱 우측 상단 **[설정 ⚙️]** 버튼을 눌러 다음 3가지 키를 입력하고 저장합니다:
   - **Service ID**
   - **Template ID**
   - **Public Key**
4. EmailJS 콘솔의 **Account → Security**에서 배포된 GitHub Pages 도메인을 **Allowed Domains**에 등록합니다.

---

## 💡 브라우저 인쇄 팁

- 데스크톱 인쇄 시 인쇄 설정 창에서:
  - **용지 크기**: 2×6인치 또는 사용하시는 포토 용지 선택
  - **여백**: '없음 (None)' 권장
  - **배경 그래픽**: '체크 (On)' 권장
- 모바일(스마트폰)에서는 **[인쇄하기]** 버튼 클릭 시 OS 공유 시트가 열리며, **AirPrint** 또는 **기기 등록 프린터**를 선택해 즉시 출력할 수 있습니다.
