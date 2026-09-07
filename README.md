# 모두의 네컷 사진 (Everyone's Four Cuts) 📸

> **프레임 선택 → 6컷 순차 촬영 → 뽀샤시/필터 보정 → 슬롯 배치 → 실물 인쇄 및 이메일 전송**까지 한 번에 즐기는 브라우저 기반 포토부스 웹 애플리케이션입니다.  
> 별도의 유료 서버 없이 **Google Apps Script(GAS) + Google Drive + GitHub Pages**로 무료 운영할 수 있습니다.

---

## ✨ 주요 기능

- ☁️ **구글 드라이브 프레임 연동 (관리자 모드)**: 관리자가 웹앱에서 PNG 프레임을 업로드하면 구글 드라이브에 자동 저장되고, 사용자 프레임 선택 화면에 즉시 동기화
- 💌 **Gmail 이메일 즉시 전송**: 구글 앱스스크립트(GmailApp)를 통해 촬영된 완성본을 사용자의 이메일로 안전하게 발송
- 🎨 **기본 감성 프레임 제공**: 러블리 핑크, 모던 모노크롬, 빈티지 필름, 2x2 파스텔 그리드 등 내장
- 📸 **6컷 연속 자동 촬영**: 3초 카운트다운 타이머, 사운드 효과(Web Audio API 비프음/셔터음), 플래시 효과, 전/후면 카메라 전환 및 미러 모드 지원
- 📁 **사진 업로드 폴백**: 웹캠/카메라 사용이 불가능한 환경에서도 로컬 사진을 업로드하여 사용 가능
- 🌸 **필터 프리셋 & 미세 보정**: 뽀샤시(화사하게), 빈티지 필름, 흑백, 웜톤, 쿨톤 프리셋 및 밝기/대비/채도 슬라이더
- 🧩 **슬롯 배치 & 순서 변경**: 촬영된 6장 중 프레임 슬롯 수만큼 자유롭게 선택하고 원클릭 화살표로 순서 재배열
- 🖼️ **고해상도 캔버스 합성 Engine**: Aspect-ratio cover 방식으로 사진을 자동 크롭하고 투명 프레임 오버레이 및 날짜 스탬프 렌더링
- 🖨️ **실물 규격 인쇄 (2×6인치)**:
  - 데스크톱: `window.print()` + `@media print` CSS로 포토 스트립 크기 자동 맞춤
  - 모바일: Web Share API (`navigator.share`)를 통해 iOS AirPrint / 안드로이드 시스템 프린트 서비스로 즉시 전송
- 💾 **기기 즉시 저장**: 고해상도 PNG 파일 원클릭 다운로드

---

## 📂 프로젝트 구조

```
모두의 네컷 사진/
├── index.html              # SPA 전체 마크업 (5단계 스텝 및 관리자/설정 모달)
├── style.css               # 포토부스 네온 테마, 반응형 레이아웃, @media print
├── Code.gs                 # 구글 앱스스크립트 백엔드 (구글드라이브 저장 + Gmail 발송)
├── frames/
│   ├── frames.json         # 기본 프레임 목록 및 슬롯 좌표 메타데이터
│   ├── frame_pink.png      # 러블리 핑크 4컷 세로 스트립 (600x1800)
│   ├── frame_mono.png      # 모던 모노크롬 4컷 세로 스트립 (600x1800)
│   ├── frame_retro.png     # 빈티지 필름 4컷 세로 스트립 (600x1800)
│   ├── frame_grid.png      # 파스텔 2x2 그리드 (1200x1600)
│   └── template_guide_strip.png # 프레임 제작용 픽셀 가이드 템플릿
├── js/
│   ├── main.js             # 화면 라우팅, 전역 상태 관리 및 이벤트 제어
│   ├── gas.js              # Google Apps Script API 통신 모듈
│   ├── camera.js           # getUserMedia 스트림 제어 및 6컷 시퀀스 촬영
│   ├── sound.js            # Web Audio API 기반 비프음 / 셔터음 생성
│   ├── editor.js           # 필터 프리셋, 슬라이더 연산, 사진 선택/스왑
│   ├── compositor.js       # 고해상도 Canvas 합성 엔진
│   ├── print.js            # window.print & Web Share API 연동
│   └── email.js            # EmailJS API 연동 (백업용)
├── scripts/
│   ├── generate_frames.js  # 기본 프레임 이미지 자동 생성 스크립트
│   └── generate_guide_templates.js # 가이드 템플릿 생성 스크립트
├── plan.md                 # 기획 및 요구사항 명세서
└── README.md               # 프로젝트 매뉴얼 및 배포 가이드
```

---

## ⚡ Google Apps Script(GAS) 연동 방법 (5분 완성)

구글 드라이브 프레임 저장과 Gmail 이메일 발송을 연동하는 방법입니다:

1. [Google Apps Script](https://script.google.com)에 접속하여 **[새 프로젝트]**를 생성합니다.
2. 프로젝트 내 `Code.gs` 파일을 열고, 이 저장소의 **[`Code.gs`](file:///f:/%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/%EB%AA%A8%EB%91%90%EC%9D%98%20%EB%84%A4%EC%BB%B7%20%EC%82%AC%EC%A7%84/Code.gs)** 파일 내용을 그대로 복사해 붙여넣고 저장(Ctrl+S)합니다.
3. 우측 상단 **[배포]** $\to$ **[새 배포]**를 클릭합니다:
   - 유형: **웹 앱(Web App)** 선택
   - 설명: `모두의 네컷 사진 백엔드`
   - 다음 사용자로 실행: **나 (내 Google 계정)**
   - **액세스 권한이 있는 사용자**: **모든 사용자 (Anyone)** 👈 **(중요!)**
4. **[배포]** 버튼을 누르고 최초 1회 Google 계정 접근 권한을 승인합니다.
5. 발급된 **웹 앱 URL** (형식: `https://script.google.com/macros/s/.../exec`)을 복사합니다.
6. 모두의 네컷 사진 웹앱 우측 상단 **[설정 ⚙️]**을 누르고 **Google Apps Script 웹 앱 URL** 칸에 붙여넣은 뒤 **[설정 저장]**을 누릅니다.

---

## 🔒 관리자 모드: 프레임 업로드 방법

1. 웹앱 우측 상단의 **[관리자 🔒]** 버튼을 클릭합니다.
2. 관리자 비밀번호(기본값: `1234`)를 입력합니다.
3. 프레임 이름, 설명, 규격(4컷 세로 스트립 또는 2x2 그리드)을 선택합니다.
4. 제작한 **투명 PNG 파일**을 선택하고 **[구글 드라이브에 저장 ☁️]**을 누르면 구글 드라이브에 안전하게 업로드되고, 프레임 선택 갤러리에 즉시 표시됩니다.

---

## 🌐 GitHub Pages 배포 방법

```bash
git add .
git commit -m "feat: 구글 앱스스크립트 연동 및 관리자 모드 추가"
git push origin main
```

1. GitHub 저장소의 **Settings** $\to$ **Pages** 메뉴 진입
2. **Source**를 `Deploy from a branch`로 선택하고, Branch를 `main` / `/(root)`로 지정 후 **Save**
3. `https://semyo0513.github.io/Modu-lifefourcuts/` 주소로 즉시 서비스됩니다.
