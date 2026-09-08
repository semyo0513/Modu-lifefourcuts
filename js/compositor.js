/**
 * compositor.js - 고해상도 캔버스 합성 엔진
 * 프레임 메타데이터와 슬롯 좌표를 기반으로 사진들을 Cover-crop 방식으로 합성하고
 * 상단에 프레임 오버레이 및 날짜 텍스트를 렌더링합니다.
 */

export class FrameCompositor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  // 헬퍼: Image 객체 로드 프로미스
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // data: or blob: URLs do not need crossOrigin
      if (typeof src === 'string' && !src.startsWith('data:') && !src.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = (err) => {
        // If crossOrigin anonymous failed on external image, try fallback without crossOrigin
        if (img.crossOrigin) {
          const fallbackImg = new Image();
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => reject(new Error(`Failed to load image: ${src}`));
          fallbackImg.src = src;
        } else {
          reject(new Error(`Failed to load image: ${src}`));
        }
      };
      img.src = src;
    });
  }

  // 헬퍼: Aspect Ratio Cover 방식으로 슬롯 영역에 이미지 렌더링
  drawCoverImage(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const slotRatio = w / h;

    let sx, sy, sw, sh;

    if (imgRatio > slotRatio) {
      // 이미지가 슬롯보다 가로로 김 -> 좌우 크롭
      sh = img.height;
      sw = img.height * slotRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      // 이미지가 슬롯보다 세로로 김 -> 상하 크롭
      sw = img.width;
      sh = img.width / slotRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // 최종 캔버스 합성
  async composite({ frameMeta, photos, filterString = 'none', addDateStamp = true }) {
    const { canvas: canvasSize, slots, file: frameFile } = frameMeta;
    const width = canvasSize.width;
    const height = canvasSize.height;

    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 1. 기본 배경 렌더링 (흰색)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. 각 슬롯에 사진 렌더링 (개별 필터 적용)
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const photoItem = photos[i];

      if (photoItem) {
        const photoSrc = typeof photoItem === 'object' ? photoItem.photoSrc : photoItem;
        const currentFilter = (typeof photoItem === 'object' && photoItem.filterString) ? photoItem.filterString : filterString;

        if (photoSrc) {
          try {
            const img = await this.loadImage(photoSrc);

            ctx.save();
            // 슬롯 영역으로 클리핑 (모서리 라운딩 및 오버플로우 방지)
            ctx.beginPath();
            const r = 8;
            ctx.roundRect(slot.x, slot.y, slot.w, slot.h, [r, r, r, r]);
            ctx.clip();

            // 개별 보정 필터 적용
            ctx.filter = currentFilter || 'none';
            this.drawCoverImage(ctx, img, slot.x, slot.y, slot.w, slot.h);
            ctx.restore();
          } catch (e) {
            console.error(`Error loading photo at slot ${i}:`, e);
          }
        }
      }
    }

    // 3. 프레임 PNG 오버레이 렌더링
    if (frameFile) {
      try {
        const frameImg = await this.loadImage(frameFile);
        ctx.drawImage(frameImg, 0, 0, width, height);
      } catch (e) {
        console.warn('Could not load frame overlay image:', frameFile, e);
      }
    }

    // 4. 날짜 및 브랜딩 스탬프 (하단 여백에 깔끔하게 인쇄)
    if (addDateStamp) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      const brandStr = "EVERYONE'S FOUR CUTS";

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (width <= 600) {
        // 4컷 세로 스트립
        ctx.fillStyle = frameMeta.id === 'frame_mono' ? '#ffffff' : (frameMeta.id === 'frame_pink' ? '#ff6b8b' : '#333333');
        ctx.font = 'bold 22px "Noto Sans KR", sans-serif';
        ctx.fillText(brandStr, width / 2, height - 55);

        ctx.font = '16px "Noto Sans KR", monospace';
        ctx.fillStyle = frameMeta.id === 'frame_mono' ? '#aaaaaa' : '#666666';
        ctx.fillText(dateStr, width / 2, height - 28);
      } else {
        // 2x2 와이드 그리드
        ctx.fillStyle = '#6b46c1';
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.fillText(brandStr, width / 2, height - 60);

        ctx.font = '20px "Noto Sans KR", monospace';
        ctx.fillStyle = '#718096';
        ctx.fillText(dateStr, width / 2, height - 28);
      }

      ctx.restore();
    }

    return {
      canvas: this.canvas,
      dataUrl: this.canvas.toDataURL('image/png'),
      blob: await this.getBlob('image/png')
    };
  }

  // Blob 추출 헬퍼
  getBlob(type = 'image/png', quality = 0.95) {
    return new Promise(resolve => {
      this.canvas.toBlob(blob => resolve(blob), type, quality);
    });
  }
}
