/**
 * studio.js - 원클릭 프레임 제작기 (Frame Studio)
 * 브라우저 캔버스를 활용하여 투명 슬롯이 뚫린 고해상도 네컷 프레임 PNG를 즉석 생성하고
 * 구글 드라이브 업로드 및 로컬 PNG 다운로드를 원클릭으로 지원합니다.
 */

import { gasManager } from './gas.js';
import { sound } from './sound.js';

export const COLOR_PRESETS = [
  { name: '러블리 핑크', color: '#ff7597', textColor: '#ffffff' },
  { name: '파스텔 퍼플', color: '#a78bfa', textColor: '#ffffff' },
  { name: '스카이 블루', color: '#38bdf8', textColor: '#ffffff' },
  { name: '민트 그린', color: '#34d399', textColor: '#ffffff' },
  { name: '버터 옐로우', color: '#fde047', textColor: '#333333' },
  { name: '체리 레드', color: '#f43f5e', textColor: '#ffffff' },
  { name: '시크 블랙', color: '#18181b', textColor: '#ffffff' },
  { name: '크림 화이트', color: '#fdfbf7', textColor: '#18181b' },
  { name: '딥 네이비', color: '#1e293b', textColor: '#ffffff' },
  { name: '웜 브라운', color: '#78350f', textColor: '#ffffff' }
];

export const GRADIENT_PRESETS = [
  { name: '선셋 글로우', colors: ['#ff5e8e', '#ff9966'], textColor: '#ffffff' },
  { name: '오로라 드림', colors: ['#4facfe', '#00f2fe'], textColor: '#ffffff' },
  { name: '코튼 캔디', colors: ['#fbc2eb', '#a6c1ee'], textColor: '#333333' },
  { name: '퍼플 갤럭시', colors: ['#667eea', '#764ba2'], textColor: '#ffffff' },
  { name: '네온 라임', colors: ['#11998e', '#38ef7d'], textColor: '#ffffff' },
  { name: '로맨틱 로즈', colors: ['#ff9a9e', '#fecfef'], textColor: '#333333' }
];

export const STICKER_PALETTES = {
  '하트 & 러브': ['💖', '💗', '💕', '🎀', '🧸', '💌', '🧁'],
  '파티 & 반짝이': ['✨', '🌟', '🎉', '🎈', '🎂', '🌸', '👑'],
  '귀여운 동물': ['🐱', '🐶', '🐰', '🐻', '🐥', '🐼', '🐾'],
  '레트로 & 감성': ['📸', '🎞️', '🎧', '💿', '🕶️', '✌️', '🍀']
};

export class FrameStudio {
  constructor(app) {
    this.app = app;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    // 현재 스튜디오 설정 상태
    this.state = {
      name: '나만의 네컷 프레임',
      description: '프레임 스튜디오에서 제작한 커스텀 프레임',
      presetType: 'strip_4', // strip_4 or grid_4
      bgType: 'color', // color or gradient
      bgColor: '#ff7597',
      gradientIndex: 0,
      slotRadius: 10,
      slotBorderWidth: 0,
      slotBorderColor: '#ffffff',
      mainText: "EVERYONE'S FOUR CUTS",
      subText: '2026.09.08 • HAPPY DAY',
      textColor: '#ffffff',
      fontStyle: 'sans-serif',
      showDate: true,
      stickers: [
        { emoji: '🎀', xRatio: 0.5, yRatio: 0.025, sizeRatio: 0.06 },
        { emoji: '💖', xRatio: 0.86, yRatio: 0.94, sizeRatio: 0.05 },
        { emoji: '✨', xRatio: 0.14, yRatio: 0.94, sizeRatio: 0.05 }
      ],
      showSamplePhotos: true
    };

    // 샘플 사진 캐시
    this.samplePhotoColors = ['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'];
  }

  // 모달 엘리먼트 바인딩 및 이벤트 등록
  init() {
    this.modal = document.getElementById('frame-studio-modal');
    this.previewImg = document.getElementById('studio-preview-img');
    this.statusMsg = document.getElementById('studio-status-msg');

    if (!this.modal) return;

    this.bindControls();
    this.renderPreview();
  }

  bindControls() {
    // 1. 프레임 이름
    const nameInput = document.getElementById('studio-input-name');
    nameInput?.addEventListener('input', (e) => {
      this.state.name = e.target.value.trim() || '나만의 네컷 프레임';
      this.renderPreview();
    });

    // 2. 규격 선택 (4컷 스트립 / 2x2 그리드)
    document.querySelectorAll('.studio-layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        document.querySelectorAll('.studio-layout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.presetType = btn.dataset.layout;
        this.renderPreview();
      });
    });

    // 3. 배경색 단색 스와치 렌더링
    const colorSwatchesEl = document.getElementById('studio-color-swatches');
    if (colorSwatchesEl) {
      colorSwatchesEl.innerHTML = '';
      COLOR_PRESETS.forEach((preset, idx) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = `studio-color-swatch ${idx === 0 ? 'active' : ''}`;
        swatch.style.backgroundColor = preset.color;
        swatch.title = preset.name;
        swatch.addEventListener('click', () => {
          sound.playClick();
          document.querySelectorAll('.studio-color-swatch, .studio-gradient-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          this.state.bgType = 'color';
          this.state.bgColor = preset.color;
          this.state.textColor = preset.textColor;
          const customColorEl = document.getElementById('studio-custom-color');
          if (customColorEl) customColorEl.value = preset.color;
          const textColorEl = document.getElementById('studio-text-color');
          if (textColorEl) textColorEl.value = preset.textColor;
          this.renderPreview();
        });
        colorSwatchesEl.appendChild(swatch);
      });
    }

    // 커스텀 배경색 피커
    const customColorInput = document.getElementById('studio-custom-color');
    customColorInput?.addEventListener('input', (e) => {
      this.state.bgType = 'color';
      this.state.bgColor = e.target.value;
      this.renderPreview();
    });

    // 4. 그라데이션 스와치 렌더링
    const gradientSwatchesEl = document.getElementById('studio-gradient-swatches');
    if (gradientSwatchesEl) {
      gradientSwatchesEl.innerHTML = '';
      GRADIENT_PRESETS.forEach((preset, idx) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'studio-gradient-swatch';
        swatch.style.background = `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`;
        swatch.title = preset.name;
        swatch.addEventListener('click', () => {
          sound.playClick();
          document.querySelectorAll('.studio-color-swatch, .studio-gradient-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          this.state.bgType = 'gradient';
          this.state.gradientIndex = idx;
          this.state.textColor = preset.textColor;
          const textColorEl = document.getElementById('studio-text-color');
          if (textColorEl) textColorEl.value = preset.textColor;
          this.renderPreview();
        });
        gradientSwatchesEl.appendChild(swatch);
      });
    }

    // 5. 슬롯 라운딩 & 테두리
    const sliderRadius = document.getElementById('studio-slot-radius');
    sliderRadius?.addEventListener('input', (e) => {
      this.state.slotRadius = Number(e.target.value);
      const valEl = document.getElementById('val-studio-radius');
      if (valEl) valEl.textContent = `${this.state.slotRadius}px`;
      this.renderPreview();
    });

    const sliderBorder = document.getElementById('studio-slot-border');
    sliderBorder?.addEventListener('input', (e) => {
      this.state.slotBorderWidth = Number(e.target.value);
      const valEl = document.getElementById('val-studio-border');
      if (valEl) valEl.textContent = `${this.state.slotBorderWidth}px`;
      this.renderPreview();
    });

    const slotBorderColorInput = document.getElementById('studio-slot-border-color');
    slotBorderColorInput?.addEventListener('input', (e) => {
      this.state.slotBorderColor = e.target.value;
      this.renderPreview();
    });

    // 6. 텍스트 문구
    const mainTextInput = document.getElementById('studio-main-text');
    mainTextInput?.addEventListener('input', (e) => {
      this.state.mainText = e.target.value;
      this.renderPreview();
    });

    const subTextInput = document.getElementById('studio-sub-text');
    subTextInput?.addEventListener('input', (e) => {
      this.state.subText = e.target.value;
      this.renderPreview();
    });

    const textColorInput = document.getElementById('studio-text-color');
    textColorInput?.addEventListener('input', (e) => {
      this.state.textColor = e.target.value;
      this.renderPreview();
    });

    // 7. 스티커 팔레트 렌더링
    const stickerPaletteEl = document.getElementById('studio-sticker-palette');
    if (stickerPaletteEl) {
      stickerPaletteEl.innerHTML = '';
      Object.entries(STICKER_PALETTES).forEach(([category, emojis]) => {
        const catGroup = document.createElement('div');
        catGroup.style.display = 'flex';
        catGroup.style.alignItems = 'center';
        catGroup.style.gap = '6px';
        catGroup.style.flexWrap = 'wrap';
        catGroup.style.marginBottom = '6px';

        const catLabel = document.createElement('span');
        catLabel.style.fontSize = '0.72rem';
        catLabel.style.color = 'var(--text-muted)';
        catLabel.style.width = '75px';
        catLabel.textContent = category;
        catGroup.appendChild(catLabel);

        emojis.forEach(emoji => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'studio-sticker-btn';
          btn.textContent = emoji;
          btn.addEventListener('click', () => {
            sound.playClick();
            this.addSticker(emoji);
          });
          catGroup.appendChild(btn);
        });

        stickerPaletteEl.appendChild(catGroup);
      });
    }

    // 스티커 모두 지우기
    document.getElementById('btn-clear-stickers')?.addEventListener('click', () => {
      sound.playClick();
      this.state.stickers = [];
      this.renderStickerList();
      this.renderPreview();
    });

    // 샘플 사진 토글
    document.getElementById('btn-toggle-sample-photos')?.addEventListener('click', () => {
      sound.playClick();
      this.state.showSamplePhotos = !this.state.showSamplePhotos;
      this.renderPreview();
    });

    // 8. 저장 버튼 액션
    document.getElementById('btn-studio-save-cloud')?.addEventListener('click', () => {
      this.saveToGoogleDrive();
    });

    document.getElementById('btn-studio-download-png')?.addEventListener('click', () => {
      this.downloadPng();
    });

    this.renderStickerList();
  }

  // 스티커 추가
  addSticker(emoji) {
    const positions = [
      { xRatio: 0.5, yRatio: 0.025, sizeRatio: 0.06 },
      { xRatio: 0.86, yRatio: 0.94, sizeRatio: 0.05 },
      { xRatio: 0.14, yRatio: 0.94, sizeRatio: 0.05 },
      { xRatio: 0.08, yRatio: 0.25, sizeRatio: 0.045 },
      { xRatio: 0.92, yRatio: 0.48, sizeRatio: 0.045 },
      { xRatio: 0.08, yRatio: 0.72, sizeRatio: 0.045 },
    ];
    const pos = positions[this.state.stickers.length % positions.length];

    this.state.stickers.push({
      emoji: emoji,
      xRatio: pos.xRatio,
      yRatio: pos.yRatio,
      sizeRatio: pos.sizeRatio
    });

    this.renderStickerList();
    this.renderPreview();
  }

  // 스티커 목록 태그 UI 렌더링
  renderStickerList() {
    const listEl = document.getElementById('studio-active-stickers');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.state.stickers.length === 0) {
      listEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">적용된 스티커가 없습니다.</span>';
      return;
    }

    this.state.stickers.forEach((st, idx) => {
      const chip = document.createElement('span');
      chip.className = 'studio-sticker-chip';
      chip.innerHTML = `${st.emoji} <button type="button" class="btn-remove-sticker">&times;</button>`;
      chip.querySelector('.btn-remove-sticker').addEventListener('click', () => {
        this.state.stickers.splice(idx, 1);
        this.renderStickerList();
        this.renderPreview();
      });
      listEl.appendChild(chip);
    });
  }

  // 프레임 규격 및 슬롯 메타데이터 가져오기
  getLayoutMeta() {
    if (this.state.presetType === 'grid_4') {
      return {
        canvas: { width: 1200, height: 1600 },
        aspectRatio: '3:4',
        slotCount: 4,
        slots: [
          { x: 50, y: 50, w: 530, h: 680 },
          { x: 620, y: 50, w: 530, h: 680 },
          { x: 50, y: 770, w: 530, h: 680 },
          { x: 620, y: 770, w: 530, h: 680 }
        ]
      };
    }

    // 기본 4컷 세로 스트립
    return {
      canvas: { width: 600, height: 1800 },
      aspectRatio: '1:3',
      slotCount: 4,
      slots: [
        { x: 40, y: 40, w: 520, h: 380 },
        { x: 40, y: 460, w: 520, h: 380 },
        { x: 40, y: 880, w: 520, h: 380 },
        { x: 40, y: 1300, w: 520, h: 380 }
      ]
    };
  }

  // 캔버스에 프레임 렌더링 (투명 슬롯 뚫기 및 디자인 합성)
  renderFrameCanvas(includeSamplePhotos = false) {
    const meta = this.getLayoutMeta();
    const width = meta.canvas.width;
    const height = meta.canvas.height;

    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // 1. 배경 채우기
    if (this.state.bgType === 'gradient') {
      const gradPreset = GRADIENT_PRESETS[this.state.gradientIndex] || GRADIENT_PRESETS[0];
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, gradPreset.colors[0]);
      grad.addColorStop(1, gradPreset.colors[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = this.state.bgColor;
    }
    ctx.fillRect(0, 0, width, height);

    // 2. 슬롯 투명 구멍 뚫기 (또는 샘플 사진 렌더링)
    meta.slots.forEach((slot, sIdx) => {
      const r = this.state.slotRadius * (width / 600); // 캔버스 배율 반영

      if (includeSamplePhotos) {
        // 샘플 사진 모드: 사진 일러스트/그라데이션 채우기
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.w, slot.h, [r, r, r, r]);
        ctx.clip();
        ctx.fillStyle = this.samplePhotoColors[sIdx % this.samplePhotoColors.length];
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

        // 사진 번호 표시
        ctx.fillStyle = '#475569';
        ctx.font = `bold ${Math.round(42 * (width / 600))}px "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`📸 컷 #${sIdx + 1}`, slot.x + slot.w / 2, slot.y + slot.h / 2);
        ctx.restore();
      } else {
        // 투명 프레임 모드: destination-out으로 슬롯 영역을 완벽하게 투명(Alpha 0%)하게 뚫음
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.w, slot.h, [r, r, r, r]);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.restore();
      }

      // 슬롯 테두리 그리기 (설정된 경우)
      if (this.state.slotBorderWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.w, slot.h, [r, r, r, r]);
        ctx.lineWidth = this.state.slotBorderWidth * (width / 600);
        ctx.strokeStyle = this.state.slotBorderColor;
        ctx.stroke();
        ctx.restore();
      }
    });

    // 3. 상단 / 하단 브랜딩 텍스트 렌더링
    ctx.save();
    ctx.fillStyle = this.state.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const scale = width / 600;

    if (this.state.presetType === 'strip_4') {
      // 4컷 세로 스트립 하단 여백
      if (this.state.mainText) {
        ctx.font = `bold ${Math.round(24 * scale)}px "Noto Sans KR", sans-serif`;
        ctx.fillText(this.state.mainText, width / 2, height - 58 * scale);
      }
      if (this.state.subText) {
        ctx.font = `${Math.round(15 * scale)}px "Noto Sans KR", monospace`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(this.state.subText, width / 2, height - 28 * scale);
      }
    } else {
      // 2x2 와이드 그리드 하단 여백
      if (this.state.mainText) {
        ctx.font = `bold ${Math.round(30 * scale)}px "Noto Sans KR", sans-serif`;
        ctx.fillText(this.state.mainText, width / 2, height - 65 * scale);
      }
      if (this.state.subText) {
        ctx.font = `${Math.round(18 * scale)}px "Noto Sans KR", monospace`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(this.state.subText, width / 2, height - 30 * scale);
      }
    }
    ctx.restore();

    // 4. 스티커 및 이모지 장식 렌더링
    if (Array.isArray(this.state.stickers)) {
      this.state.stickers.forEach(st => {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.round(st.sizeRatio * height);
        ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        const posX = st.xRatio * width;
        const posY = st.yRatio * height;
        ctx.fillText(st.emoji, posX, posY);
        ctx.restore();
      });
    }

    return this.canvas;
  }

  // 모달 안의 미리보기 갱신
  renderPreview() {
    if (!this.previewImg) return;
    const canvas = this.renderFrameCanvas(this.state.showSamplePhotos);
    this.previewImg.src = canvas.toDataURL('image/png');
  }

  // 투명 프레임 PNG Data URL 추출 (투명 슬롯 뚫린 원본)
  getTransparentFrameDataUrl() {
    const canvas = this.renderFrameCanvas(false); // 사진 없이 투명 슬롯 뚫기
    return canvas.toDataURL('image/png');
  }

  // 모달 열기
  open() {
    if (this.modal) {
      this.modal.classList.add('active');
      this.renderPreview();
    }
  }

  // 모달 닫기
  close() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }

  // PC로 투명 프레임 PNG 다운로드
  downloadPng() {
    sound.playClick();
    const dataUrl = this.getTransparentFrameDataUrl();
    const link = document.createElement('a');
    const safeName = this.state.name.replace(/[^a-zA-Z0-9가-힣_]/g, '_');
    link.download = `frame_${safeName}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    if (this.statusMsg) {
      this.statusMsg.innerHTML = '<span style="color:#10b981;">✅ 투명 프레임 PNG 다운로드가 완료되었습니다.</span>';
    }
  }

  // 구글 드라이브에 프레임 등록 및 프레임 목록 즉각 반영
  async saveToGoogleDrive() {
    sound.playClick();
    if (!gasManager.isConfigured()) {
      alert('Google Apps Script 웹 앱 URL이 설정되지 않았습니다. [설정⚙️]에서 먼저 URL을 등록해 주세요.');
      return;
    }

    if (this.statusMsg) {
      this.statusMsg.innerHTML = '<span style="color:#38bdf8;">☁️ 구글 드라이브에 프레임을 저장하고 있습니다...</span>';
    }

    const meta = this.getLayoutMeta();
    const dataUrl = this.getTransparentFrameDataUrl();

    try {
      const newFrame = await gasManager.uploadFrame({
        name: this.state.name,
        description: `스튜디오 제작: ${this.state.mainText}`,
        imageBase64: dataUrl,
        slotPreset: this.state.presetType,
        customSlots: meta.slots,
        adminPin: '1234'
      });

      if (this.statusMsg) {
        this.statusMsg.innerHTML = '<span style="color:#10b981; font-weight:700;">🎉 구글 드라이브 등록 완료! 프레임 선택 목록에 즉시 추가되었습니다.</span>';
      }

      // 앱 프레임 목록 새로고침 및 방금 만든 프레임 자동 선택
      if (this.app) {
        await this.app.loadFrames();
        this.app.selectedFrame = newFrame;
        this.app.renderFrameGallery();
      }

      setTimeout(() => {
        this.close();
        if (this.app) {
          this.app.goToStep('frame');
        }
      }, 1200);

    } catch (err) {
      console.error('Frame Studio Upload Error:', err);
      if (this.statusMsg) {
        this.statusMsg.innerHTML = `<span style="color:#ef4444;">❌ 저장 실패: ${err.message}</span>`;
      }
    }
  }
}
