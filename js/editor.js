/**
 * editor.js - 사진 보정(필터/슬라이더) 및 사진 선택/순서 배치 에디터 모듈
 */

export const FILTER_PRESETS = [
  {
    id: 'original',
    name: '원본',
    icon: '✨',
    cssFilter: 'none',
    settings: { brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'bright',
    name: '화사하게 (뽀샤시)',
    icon: '🌸',
    cssFilter: 'brightness(1.12) contrast(1.05) saturate(1.15)',
    settings: { brightness: 112, contrast: 105, saturation: 115, sepia: 5, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'film',
    name: '빈티지 필름',
    icon: '🎞️',
    cssFilter: 'sepia(0.25) contrast(1.12) brightness(1.04) saturate(0.9)',
    settings: { brightness: 104, contrast: 112, saturation: 90, sepia: 25, grayscale: 0, hueRotate: 0 }
  },
  {
    id: 'mono',
    name: '모던 흑백',
    icon: '🖤',
    cssFilter: 'grayscale(1) contrast(1.25) brightness(1.05)',
    settings: { brightness: 105, contrast: 125, saturation: 0, sepia: 0, grayscale: 100, hueRotate: 0 }
  },
  {
    id: 'warm',
    name: '따뜻한 웜톤',
    icon: '☕',
    cssFilter: 'sepia(0.18) hue-rotate(-10deg) brightness(1.06) saturate(1.1)',
    settings: { brightness: 106, contrast: 102, saturation: 110, sepia: 18, grayscale: 0, hueRotate: -10 }
  },
  {
    id: 'cool',
    name: '청량한 쿨톤',
    icon: '🌊',
    cssFilter: 'hue-rotate(15deg) saturate(1.2) brightness(1.08) contrast(1.05)',
    settings: { brightness: 108, contrast: 105, saturation: 120, sepia: 0, grayscale: 0, hueRotate: 15 }
  }
];

export class PhotoEditor {
  constructor() {
    this.rawShots = []; // 6 captured shots
    this.currentPreset = 'original';
    this.customAdjustments = {
      brightness: 100, // 50 ~ 150 %
      contrast: 100,   // 50 ~ 150 %
      saturation: 100, // 0 ~ 200 %
    };
    this.selectedIndices = []; // Indices in rawShots assigned to frame slots [0, 1, 2, 3]
    this.slotCount = 4;
  }

  // 촬영된 6장 로드
  init(shots, slotCount = 4) {
    this.rawShots = [...shots];
    this.slotCount = slotCount;
    this.currentPreset = 'original';
    this.resetAdjustments();

    // 기본값: 앞에서부터 슬롯 개수만큼 자동 선택
    this.selectedIndices = [];
    for (let i = 0; i < Math.min(this.rawShots.length, this.slotCount); i++) {
      this.selectedIndices.push(i);
    }
  }

  resetAdjustments() {
    this.customAdjustments = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
    };
  }

  // 프리셋 적용
  applyPreset(presetId) {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      this.currentPreset = presetId;
      this.customAdjustments.brightness = preset.settings.brightness;
      this.customAdjustments.contrast = preset.settings.contrast;
      this.customAdjustments.saturation = preset.settings.saturation;
    }
  }

  // 미세 조정 슬라이더 업데이트
  setAdjustment(type, value) {
    if (this.customAdjustments[type] !== undefined) {
      this.customAdjustments[type] = Number(value);
    }
  }

  // 현재 필터 CSS 스트링 계산
  getCSSFilterString() {
    const preset = FILTER_PRESETS.find(p => p.id === this.currentPreset);
    const sepia = preset ? preset.settings.sepia : 0;
    const grayscale = preset ? preset.settings.grayscale : 0;
    const hue = preset ? preset.settings.hueRotate : 0;

    const b = this.customAdjustments.brightness / 100;
    const c = this.customAdjustments.contrast / 100;
    const s = this.customAdjustments.saturation / 100;

    let filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
    if (sepia > 0) filter += ` sepia(${sepia / 100})`;
    if (grayscale > 0) filter += ` grayscale(${grayscale / 100})`;
    if (hue !== 0) filter += ` hue-rotate(${hue}deg)`;

    return filter;
  }

  // 사진 선택 토글
  togglePhotoSelection(photoIndex) {
    const existingSlotIdx = this.selectedIndices.indexOf(photoIndex);
    if (existingSlotIdx > -1) {
      // 이미 선택됨 -> 해제
      this.selectedIndices.splice(existingSlotIdx, 1);
    } else {
      // 선택 추가 (슬롯 개수 이하일 때만)
      if (this.selectedIndices.length < this.slotCount) {
        this.selectedIndices.push(photoIndex);
      } else {
        // 이미 꽉 찬 경우 마지막 것을 교체
        this.selectedIndices[this.selectedIndices.length - 1] = photoIndex;
      }
    }
    return [...this.selectedIndices];
  }

  // 슬롯 내 위치 스왑
  swapSlots(indexA, indexB) {
    if (
      indexA >= 0 && indexA < this.selectedIndices.length &&
      indexB >= 0 && indexB < this.selectedIndices.length
    ) {
      const temp = this.selectedIndices[indexA];
      this.selectedIndices[indexA] = this.selectedIndices[indexB];
      this.selectedIndices[indexB] = temp;
    }
    return [...this.selectedIndices];
  }

  // 슬롯에 배치될 최종 이미지 목록 (DataURL)
  getSelectedPhotos() {
    return this.selectedIndices.map(idx => this.rawShots[idx]).filter(Boolean);
  }
}
