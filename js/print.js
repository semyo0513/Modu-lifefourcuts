/**
 * print.js - 인쇄 및 모바일 Web Share 연동 모듈
 * 데스크톱: @media print 스타일을 활용한 window.print()
 * 모바일: navigator.share() 파일 공유를 통한 AirPrint 및 OS 인쇄 서비스 호출
 */

export class PrintManager {
  constructor() {
    this.printContainerId = 'print-strip-target';
  }

  // 인쇄 전용 DOM 컨테이너에 이미지 셋업
  preparePrintDOM(dataUrl) {
    let container = document.getElementById(this.printContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.printContainerId;
      document.body.appendChild(container);
    }
    container.innerHTML = `<img src="${dataUrl}" alt="Print Four Cut Strip" style="width:100%; height:auto; display:block;" />`;
  }

  // 기기 환경에 따른 인쇄 처리
  async handlePrint(blob, dataUrl, filename = 'everyone-four-cut.png') {
    const file = new File([blob], filename, { type: 'image/png' });

    // 1. 모바일 환경: Web Share API 파일 공유 시도 (iOS AirPrint / Android 프린터 서비스 자동 연동)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: '모두의 네컷 사진',
          text: '모두의 네컷 사진에서 촬영한 인생네컷 포토 스트립입니다!',
        });
        return { success: true, method: 'share' };
      } catch (err) {
        if (err.name === 'AbortError') {
          return { success: false, aborted: true };
        }
        console.warn('Web Share failed, falling back to window.print():', err);
      }
    }

    // 2. 데스크톱 또는 Web Share 미지원 환경: window.print()
    this.preparePrintDOM(dataUrl);

    // 잠시 렌더링 대기 후 인쇄 대화상자 호출
    await new Promise(r => setTimeout(r, 150));
    window.print();
    return { success: true, method: 'print' };
  }

  // 이미지 로컬 다운로드
  downloadImage(dataUrl, filename = 'everyone-four-cut.png') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const printer = new PrintManager();
