

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: 'video' | 'image' | 'audio';
}

export type TextStyleType = 
  | 'None' 
  | 'Shadow Soft' 
  | 'Shadow Hard' 
  | 'Long Shadow' 
  | 'Lift' 
  | 'Hollow' 
  | 'Splice' 
  | 'Glitch' 
  | 'Neon' 
  | 'Echo' 
  | 'Background' 
  | 'Curve' 
  | 'Duotone' 
  | 'Melt' 
  | 'Glossy';

export interface TextLayer {
  id: string;
  visible: boolean;
  content: string;
  fontFamily: string;
  textColor: string;
  effectMode: string;
  fxSpeed: number;
  size: number;
  opacity: number;
  x: number;
  y: number;
  
  // Advanced Styles
  style: TextStyleType;
  styleColor: string;
  styleAmount: number;
  styleOffset: number;
}

export type BlendMode = 'source-over' | 'screen' | 'multiply' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type CropShape = 'Original' | '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | 'Circle';

export interface OverlayLayer {
  id: string;
  type: 'video' | 'image';
  url: string;
  name: string;
  visible: boolean;
  blendMode: BlendMode;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  cropShape: CropShape;
  speed: number;
}

export interface VJState {
  // Global Project
  projectName: string;

  // Playlist State
  backgroundPlaylist: MediaItem[];
  currentBackgroundIndex: number;
  nextBackgroundIndex: number; // Preload buffer
  activeVideoSlot: 'A' | 'B'; // Dual buffer system
  isTransitioning: boolean;
  transitionProgress: number; // 0.0 to 1.0
  lastBackgroundChangeTime: number; // For Image Timer
  
  // Audio Engine State
  mainAudioPlaylist: MediaItem[];
  currentAudioIndex: number;
  nextAudioIndex: number; // Buffer for next track
  activeAudioSlot: 'A' | 'B'; // Dual audio deck
  isAudioTransitioning: boolean;
  isAudioShuffle: boolean;
  audioCrossfadeDuration: number; // in seconds, default 5
  isMerging: boolean; // Merging process state

  // Derived/Active State
  backgroundType: 'video' | 'image' | null;
  backgroundUrl: string | null; // Currently active logical URL
  containFit: boolean;
  seamlessFade: boolean;
  bgVideoSpeed: number; // Playback rate
  bgImageDuration: number; // Seconds per image
  
  // Transform State (Pan/Zoom)
  bgScale: number;
  bgPosX: number;
  bgPosY: number;
  
  // Overlay Layers (Compositing)
  overlayLayers: OverlayLayer[];
  activeOverlayLayerId: string | null;
  
  mainAudioUrl: string | null; // Legacy/Display ref
  
  audioFxUrl: string | null;
  audioFxVolume: number; // 0-100
  audioFxLoop: boolean;

  // Text Layers (Refactored)
  textLayers: TextLayer[];

  // FX Tab
  activeEffect: string | null; // 'Rain', 'Snow', etc.
  audioReactEnabled: boolean;
  particleColor: string;
  fxOpacity: number;
  fxDensity: number;
  fxParamSpeed: number;
  fxSize: number; // 0.1 to 5.0
  fxDirection: number; // -10 to 10 (Wind)

  // EQ Tab
  eqEnabled: boolean;
  eqType: 'Bars' | 'Wave' | 'Circle' | 'Shimmer';
  eqRainbow: boolean;
  eqPosX: number;
  eqPosY: number;
  eqScale: number;
  eqGain: number;
  eqOpacity: number;

  // Logo Tab
  logoUrl: string | null;
  logoPosX: number;
  logoPosY: number;
  logoSize: number;
  logoOpacity: number;

  // Interactive
  activeOverlay: 'Text' | 'EQ' | 'Logo' | 'Layer' | null;
  activeLayerId: string | null; // To track which specific text/overlay layer is selected

  // Global
  isPlaying: boolean;
  masterVolume: number;
  resolution: string;
  targetFps: number; // 30 or 60
  isRendering: boolean;
  
  // Render Status
  renderProgress: number; // 0-100
  renderStatus: string; // "Encoding...", "Processing Audio..."
}

export const INITIAL_STATE: VJState = {
  projectName: 'My VJ Project',

  backgroundPlaylist: [],
  currentBackgroundIndex: -1,
  nextBackgroundIndex: -1,
  activeVideoSlot: 'A',
  isTransitioning: false,
  transitionProgress: 0,
  lastBackgroundChangeTime: 0,

  mainAudioPlaylist: [],
  currentAudioIndex: -1,
  nextAudioIndex: -1,
  activeAudioSlot: 'A',
  isAudioTransitioning: false,
  isAudioShuffle: false,
  audioCrossfadeDuration: 5,
  isMerging: false,

  backgroundType: null,
  backgroundUrl: null,
  containFit: false,
  seamlessFade: true,
  bgVideoSpeed: 1.0,
  bgImageDuration: 5,
  bgScale: 1.0,
  bgPosX: 0,
  bgPosY: 0,
  
  overlayLayers: [],
  activeOverlayLayerId: null,

  mainAudioUrl: null,
  audioFxUrl: null,
  audioFxVolume: 100,
  audioFxLoop: true,

  textLayers: [
    {
      id: 'default-text',
      visible: true,
      content: 'LAMBDA MAGIC',
      fontFamily: 'Impact',
      textColor: '#ffffff',
      effectMode: 'None',
      fxSpeed: 1.0,
      size: 80,
      opacity: 100,
      x: 50,
      y: 50,
      style: 'None',
      styleColor: '#000000',
      styleAmount: 50,
      styleOffset: 20,
    }
  ],

  activeEffect: 'Rain',
  audioReactEnabled: true,
  particleColor: '#ffffff',
  fxOpacity: 100,
  fxDensity: 300,
  fxParamSpeed: 1.0,
  fxSize: 1.0,
  fxDirection: 0,

  eqEnabled: false,
  eqType: 'Bars',
  eqRainbow: true,
  eqPosX: 50,
  eqPosY: 80,
  eqScale: 50,
  eqGain: 50,
  eqOpacity: 80,

  logoUrl: null,
  logoPosX: 90,
  logoPosY: 10,
  logoSize: 0.5,
  logoOpacity: 0.8,

  activeOverlay: null,
  activeLayerId: null,

  isPlaying: false,
  masterVolume: 100,
  resolution: '1920x1080 (FHD)',
  targetFps: 60,
  isRendering: false,
  
  renderProgress: 0,
  renderStatus: ''
};