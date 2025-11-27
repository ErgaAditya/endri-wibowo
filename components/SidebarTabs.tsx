

import React, { useRef } from 'react';
import { Upload, Music, Volume2, Type, Sparkles, BarChart3, Image as ImageIcon, Shuffle, ListMusic, FileVideo, ArrowUp, ArrowDown, Trash2, Play, Circle, Merge, Loader2, Move, ZoomIn, RefreshCw, Palette, Clock, Gauge, Plus, Copy, Eye, EyeOff, Layers, Scissors, Blend } from 'lucide-react';
import { VJState, TextStyleType, TextLayer, OverlayLayer, BlendMode, CropShape } from '../types';

interface TabProps {
  state: VJState;
  updateState: (updates: Partial<VJState>) => void;
  onFileUpload?: (type: 'background' | 'audio' | 'sfx' | 'logo' | 'layer', files: FileList) => void;
  onSelectPlaylistItem?: (type: 'background' | 'audio', index: number) => void;
  onReorderPlaylist?: (type: 'audio', fromIndex: number, direction: 'up' | 'down') => void;
  onRemoveItem?: (type: 'audio', index: number) => void;
  onMergePlaylist?: () => void;
}

// --- Shared Components ---
const SectionLabel = ({ children }: { children?: React.ReactNode }) => (
  <div className="text-xs font-bold text-blue-400 uppercase mb-2 tracking-wider">{children}</div>
);

const SliderControl = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }: any) => (
  <div className="mb-4">
    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>{label}</span>
      <span>{Math.round(value * 10) / 10}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);

const Toggle = ({ label, checked, onChange }: any) => (
  <label className="flex items-center cursor-pointer gap-2 select-none">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`w-4 h-4 border rounded transition-colors flex items-center justify-center ${checked ? 'bg-amber-500 border-amber-500' : 'bg-gray-800 border-gray-600'}`}>
        {checked && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
      </div>
    </div>
    <span className="text-xs text-gray-300">{label}</span>
  </label>
);

const ColorPicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => (
  <div className="w-8 h-8 rounded border border-gray-600 overflow-hidden relative cursor-pointer shadow-sm">
    <input 
      type="color" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="absolute -top-2 -left-2 w-12 h-12 p-0 border-0 cursor-pointer"
    />
  </div>
);

const FileUploadButton = ({ 
  label, 
  icon: Icon, 
  onUpload, 
  accept,
  multiple = false,
  disabled = false
}: { 
  label: string, 
  icon: any, 
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  accept: string,
  multiple?: boolean,
  disabled?: boolean
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <>
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept={accept} 
        onChange={onUpload}
        multiple={multiple}
        disabled={disabled}
      />
      <button 
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="w-full h-10 border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center gap-2 text-sm text-gray-300 transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon size={14} /> {label}
      </button>
    </>
  );
};

// --- Tabs ---

export const MediaTab: React.FC<TabProps> = ({ state, updateState, onFileUpload, onSelectPlaylistItem, onReorderPlaylist, onRemoveItem, onMergePlaylist }) => {
  const handleFile = (type: 'background' | 'audio' | 'sfx' | 'layer', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(type, e.target.files);
    }
  };

  const resetTransform = () => {
    updateState({ bgScale: 1.0, bgPosX: 0, bgPosY: 0 });
  };

  // Layer Management
  const handleRemoveLayer = (id: string) => {
    const updated = state.overlayLayers.filter(l => l.id !== id);
    updateState({ 
        overlayLayers: updated,
        activeOverlayLayerId: null,
        activeOverlay: null
    });
  };

  const updateActiveOverlayLayer = (updates: Partial<OverlayLayer>) => {
    if (!state.activeOverlayLayerId) return;
    const updatedLayers = state.overlayLayers.map(layer => {
        if (layer.id === state.activeOverlayLayerId) {
            return { ...layer, ...updates };
        }
        return layer;
    });
    updateState({ overlayLayers: updatedLayers });
  };

  const activeLayer = state.overlayLayers.find(l => l.id === state.activeOverlayLayerId);
  const blendModes: BlendMode[] = ['source-over', 'screen', 'multiply', 'overlay', 'darken', 'lighten', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'luminosity'];
  const cropShapes: CropShape[] = ['Original', '1:1', '3:4', '4:3', '9:16', '16:9', 'Circle'];

  return (
    <div className="p-4 space-y-6">
      
      {/* Project Name Section */}
      <div>
        <SectionLabel>Project Settings</SectionLabel>
        <div className="bg-gray-900 border border-gray-800 rounded p-2 mb-4">
             <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Project Name (Output Filename)</div>
             <input 
                type="text" 
                value={state.projectName}
                onChange={(e) => updateState({ projectName: e.target.value })}
                className="w-full bg-gray-800 text-sm text-white border border-gray-700 rounded px-2 py-1 focus:border-blue-500 outline-none"
                placeholder="Untitled Project"
             />
        </div>
      </div>

      <div>
        <SectionLabel>Main Sources</SectionLabel>
        
        {/* Background */}
        <div className="border border-gray-800 p-3 rounded bg-gray-900/50 mb-4">
            <div className="flex justify-between items-center mb-2">
                 <div className="text-xs text-gray-400">1. Background (Video/Img)</div>
                 {state.backgroundPlaylist.length > 0 && (
                     <div className="text-[10px] text-blue-400 font-mono">{state.backgroundPlaylist.length} Files</div>
                 )}
            </div>
            
            <FileUploadButton 
                label={state.backgroundPlaylist.length > 0 ? "Tambah File (+)" : "Pilih File"}
                icon={Upload}
                accept="image/*,video/*"
                onUpload={(e) => handleFile('background', e)}
                multiple={true}
            />
            
            {state.backgroundPlaylist.length > 1 && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                        <FileVideo size={12} className="text-gray-400"/>
                        <select 
                            className="bg-transparent w-full text-xs text-gray-300 outline-none"
                            value={state.currentBackgroundIndex}
                            onChange={(e) => onSelectPlaylistItem && onSelectPlaylistItem('background', parseInt(e.target.value))}
                        >
                            {state.backgroundPlaylist.map((item, idx) => (
                                <option key={item.id} value={idx}>
                                    {idx + 1}. {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="flex justify-between px-1 mb-3">
                <Toggle label="Contain Fit" checked={state.containFit} onChange={(v: boolean) => updateState({ containFit: v })} />
                <Toggle label="Seamless Fade" checked={state.seamlessFade} onChange={(v: boolean) => updateState({ seamlessFade: v })} />
            </div>

            {/* SPEED & TIME CONTROLS */}
            <div className="mt-2 space-y-2 border-t border-gray-800 pt-2">
                 <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mb-1">
                    <Gauge size={10} /> <span>VIDEO SPEED</span>
                 </div>
                 <SliderControl label="" value={state.bgVideoSpeed} onChange={(v: number) => updateState({ bgVideoSpeed: v })} min={0.1} max={5.0} step={0.1} unit="x" />

                 <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mb-1 mt-3">
                    <Clock size={10} /> <span>IMAGE DURATION</span>
                 </div>
                 <SliderControl label="" value={state.bgImageDuration} onChange={(v: number) => updateState({ bgImageDuration: v })} min={1} max={60} step={1} unit="s" />
            </div>

            <div className="mt-4 border-t border-gray-800 pt-3">
                 <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1"><Move size={10}/> Transform & Zoom</span>
                     <button onClick={resetTransform} className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1"><RefreshCw size={10} /> Reset</button>
                 </div>
                 
                 <div className="space-y-1">
                     <SliderControl label="Zoom" value={state.bgScale} onChange={(v: number) => updateState({ bgScale: v })} min={0.1} max={5.0} step={0.1} unit="x" />
                     <div className="grid grid-cols-2 gap-2">
                        <SliderControl label="Pan X" value={state.bgPosX} onChange={(v: number) => updateState({ bgPosX: v })} min={-1000} max={1000} step={10} />
                        <SliderControl label="Pan Y" value={state.bgPosY} onChange={(v: number) => updateState({ bgPosY: v })} min={-1000} max={1000} step={10} />
                     </div>
                 </div>
            </div>
        </div>
        
        {/* COMPOSITING / LAYERS */}
        <div className="border border-gray-800 p-3 rounded bg-gray-900/50 mb-4">
             <div className="flex justify-between items-center mb-2">
                 <div className="text-xs text-gray-400 flex items-center gap-1"><Layers size={12}/> Layers / Compositing</div>
                 <span className="text-[10px] text-gray-500">{state.overlayLayers.length}/10</span>
            </div>
            
            <FileUploadButton 
                label="Add Layer (Img/Video)"
                icon={Plus}
                accept="image/*,video/*"
                onUpload={(e) => handleFile('layer', e)}
                disabled={state.overlayLayers.length >= 10}
            />
            
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar mb-3">
                {state.overlayLayers.map((layer, idx) => (
                    <div 
                        key={layer.id}
                        onClick={() => updateState({ activeOverlayLayerId: layer.id, activeOverlay: 'Layer' })}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer border ${state.activeOverlayLayerId === layer.id ? 'bg-blue-900/30 border-blue-500/50 text-white' : 'bg-gray-800 border-transparent text-gray-400'}`}
                    >
                         <div className="flex items-center gap-2 truncate text-xs">
                             <span className="font-mono text-[9px] opacity-50">{idx+1}</span>
                             <span className="truncate max-w-[120px]">{layer.name}</span>
                         </div>
                         <div className="flex items-center gap-1">
                             <button onClick={(e) => { e.stopPropagation(); updateState({ overlayLayers: state.overlayLayers.map(l => l.id === layer.id ? {...l, visible: !l.visible} : l) }) }} className="p-0.5 hover:text-white">
                                {layer.visible ? <Eye size={10}/> : <EyeOff size={10}/>}
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id) }} className="p-0.5 hover:text-red-400"><Trash2 size={10}/></button>
                         </div>
                    </div>
                ))}
            </div>
            
            {activeLayer && (
                <div className="bg-gray-900 border border-gray-800 rounded p-2 animate-in fade-in space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">Layer Properties</div>
                    
                    {/* Blend Mode */}
                    <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                        <Blend size={12} className="text-purple-400" />
                        <select 
                            className="bg-transparent w-full text-xs text-gray-300 outline-none"
                            value={activeLayer.blendMode}
                            onChange={(e: any) => updateActiveOverlayLayer({ blendMode: e.target.value })}
                        >
                            {blendModes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    {/* Crop Shape */}
                    <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                        <Scissors size={12} className="text-green-400" />
                        <select 
                            className="bg-transparent w-full text-xs text-gray-300 outline-none"
                            value={activeLayer.cropShape}
                            onChange={(e: any) => updateActiveOverlayLayer({ cropShape: e.target.value })}
                        >
                            {cropShapes.map(s => <option key={s} value={s}>Crop: {s}</option>)}
                        </select>
                    </div>
                    
                    <div className="pt-2">
                        <SliderControl label="Opacity" value={activeLayer.opacity} onChange={(v: number) => updateActiveOverlayLayer({ opacity: v })} unit="%" />
                        <SliderControl label="Scale" value={activeLayer.scale} onChange={(v: number) => updateActiveOverlayLayer({ scale: v })} min={0.1} max={3.0} step={0.1} />
                        <div className="grid grid-cols-2 gap-2">
                            <SliderControl label="X" value={activeLayer.x} onChange={(v: number) => updateActiveOverlayLayer({ x: v })} min={-500} max={500} />
                            <SliderControl label="Y" value={activeLayer.y} onChange={(v: number) => updateActiveOverlayLayer({ y: v })} min={-500} max={500} />
                        </div>
                        {activeLayer.type === 'video' && (
                             <SliderControl label="Speed" value={activeLayer.speed} onChange={(v: number) => updateActiveOverlayLayer({ speed: v })} min={0.1} max={5.0} step={0.1} unit="x" />
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Main Audio Playlist */}
        <div className="border border-gray-800 p-3 rounded bg-gray-900/50 mb-4">
            <div className="flex justify-between items-center mb-2">
                 <div className="text-xs text-gray-400">2. Main Audio (Mixer)</div>
                 {state.mainAudioPlaylist.length > 0 && (
                     <div className="text-[10px] text-blue-400 font-mono">{state.mainAudioPlaylist.length} Songs</div>
                 )}
            </div>
            
            <FileUploadButton 
                label={state.mainAudioPlaylist.length > 0 ? "Tambah Musik (+)" : "Pilih Musik Utama"}
                icon={Music}
                accept="audio/*"
                onUpload={(e) => handleFile('audio', e)}
                multiple={true}
            />

            {state.mainAudioPlaylist.length > 0 && (
                <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-2">
                         <span className="text-[10px] text-gray-500 uppercase font-bold">Playlist Queue</span>
                         <button 
                            onClick={() => updateState({ isAudioShuffle: !state.isAudioShuffle })}
                            className={`p-1 rounded transition-colors flex items-center gap-1 ${state.isAudioShuffle ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}
                            title="Shuffle Playlist"
                        >
                            <Shuffle size={12} /> <span className="text-[10px]">{state.isAudioShuffle ? 'Shuffle ON' : 'Shuffle OFF'}</span>
                        </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                        {state.mainAudioPlaylist.map((item, idx) => {
                            const isPlaying = state.currentAudioIndex === idx;
                            const isNext = state.nextAudioIndex === idx;
                            return (
                                <div 
                                    key={item.id} 
                                    className={`group flex items-center gap-2 p-1.5 rounded text-xs border ${
                                        isPlaying 
                                        ? 'bg-blue-900/20 border-blue-800 text-blue-200' 
                                        : isNext 
                                            ? 'bg-gray-800 border-yellow-900/30 text-yellow-100'
                                            : 'bg-gray-800/50 border-transparent hover:border-gray-700 text-gray-400'
                                    }`}
                                >
                                    <div className="w-4 shrink-0 flex justify-center">
                                        {isPlaying ? (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        ) : (
                                            <span className="text-[10px] text-gray-600">{idx + 1}</span>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 truncate" title={item.name}>
                                        {item.name}
                                        {isNext && <span className="ml-2 text-[8px] uppercase bg-yellow-900 text-yellow-500 px-1 rounded">Next</span>}
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onSelectPlaylistItem && onSelectPlaylistItem('audio', idx)} title="Play Now" className="p-0.5 hover:text-white"><Play size={10} /></button>
                                        <button onClick={() => onReorderPlaylist && onReorderPlaylist('audio', idx, 'up')} disabled={idx === 0} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowUp size={10} /></button>
                                        <button onClick={() => onReorderPlaylist && onReorderPlaylist('audio', idx, 'down')} disabled={idx === state.mainAudioPlaylist.length - 1} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowDown size={10} /></button>
                                        <button onClick={() => onRemoveItem && onRemoveItem('audio', idx)} className="p-0.5 hover:text-red-400"><Trash2 size={10} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <button 
                        onClick={onMergePlaylist} 
                        disabled={state.isMerging || state.mainAudioPlaylist.length < 2}
                        className="w-full h-8 mt-2 bg-indigo-900/50 hover:bg-indigo-800 border border-indigo-700 rounded text-xs text-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Gabungkan semua lagu menjadi satu file dengan crossfade"
                    >
                        {state.isMerging ? <Loader2 className="animate-spin" size={12} /> : <Merge size={12} />}
                        {state.isMerging ? "Processing Mix..." : "Gabung Playlist (Merge)"}
                    </button>
                </div>
            )}
        </div>

        {/* Audio FX */}
        <div className="border border-gray-800 p-3 rounded bg-gray-900/50 mb-4">
            <div className="flex justify-between items-center mb-2">
                 <div className="text-xs text-gray-400">3. Audio FX (Layer 2)</div>
                 {state.audioFxUrl && (
                     <div className="text-[10px] text-amber-500 font-mono">Active</div>
                 )}
            </div>
            
            <FileUploadButton 
                label={state.audioFxUrl ? "Ganti SFX" : "Tambah SFX/Ambiance"}
                icon={Volume2}
                accept="audio/*"
                onUpload={(e) => handleFile('sfx', e)}
                multiple={false}
            />

            <div className="mt-3 space-y-3">
                 <SliderControl label="Volume" value={state.audioFxVolume} onChange={(v: number) => updateState({ audioFxVolume: v })} unit="%" />
                 <Toggle label="Seamless Loop" checked={state.audioFxLoop} onChange={(v: boolean) => updateState({ audioFxLoop: v })} />
            </div>
        </div>

      </div>
    </div>
  );
};

export const TextTab: React.FC<TabProps> = ({ state, updateState }) => {
  const styles: TextStyleType[] = [
      'None', 'Shadow Soft', 'Shadow Hard', 'Long Shadow', 
      'Lift', 'Hollow', 'Splice', 'Glitch', 'Neon', 
      'Echo', 'Background', 'Curve', 'Duotone', 'Melt', 'Glossy'
  ];

  // Logic to manage Text Layers
  const handleAddLayer = () => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      visible: true,
      content: 'New Text',
      fontFamily: 'Impact',
      textColor: '#ffffff',
      effectMode: 'None',
      fxSpeed: 1.0,
      size: 60,
      opacity: 100,
      x: 50,
      y: 50,
      style: 'None',
      styleColor: '#000000',
      styleAmount: 50,
      styleOffset: 20
    };
    updateState({ 
        textLayers: [...state.textLayers, newLayer],
        activeLayerId: newLayer.id,
        activeOverlay: 'Text'
    });
  };

  const handleRemoveLayer = (id: string) => {
    const updated = state.textLayers.filter(l => l.id !== id);
    updateState({ 
        textLayers: updated,
        activeLayerId: updated.length > 0 ? updated[updated.length-1].id : null,
        activeOverlay: updated.length > 0 ? 'Text' : null
    });
  };

  const updateActiveLayer = (updates: Partial<TextLayer>) => {
     if (!state.activeLayerId) return;
     const activeL = state.textLayers.find(l => l.id === state.activeLayerId);
     if (!activeL) return; // Basic guard
     
     const updatedLayers = state.textLayers.map(layer => {
         if (layer.id === state.activeLayerId) {
             return { ...layer, ...updates };
         }
         return layer;
     });
     updateState({ textLayers: updatedLayers });
  };

  const activeLayer = state.textLayers.find(l => l.id === state.activeLayerId) || state.textLayers[0];

  // Helper labels for generic sliders based on selected style
  const getParam1Label = () => {
      const style = activeLayer?.style || 'None';
      switch(style) {
          case 'Shadow Soft': return 'Blur';
          case 'Shadow Hard': return 'Distance';
          case 'Long Shadow': return 'Length';
          case 'Lift': return 'Distance';
          case 'Hollow': return 'Stroke Width';
          case 'Splice': return 'Offset';
          case 'Glitch': return 'Intensity';
          case 'Neon': return 'Glow Strength';
          case 'Echo': return 'Count';
          case 'Background': return 'Padding';
          case 'Curve': return 'Radius';
          case 'Duotone': return 'Color Split';
          case 'Melt': return 'Drip Length';
          case 'Glossy': return 'Shine Opacity';
          default: return 'Parameter 1';
      }
  };

  const getParam2Label = () => {
      const style = activeLayer?.style || 'None';
      switch(style) {
          case 'Shadow Soft': return 'Opacity';
          case 'Shadow Hard': return 'Angle'; // Fake
          case 'Long Shadow': return 'Angle'; // Fake
          case 'Lift': return 'Blur';
          case 'Hollow': return 'Opacity'; // Fake
          case 'Splice': return 'Angle';
          case 'Glitch': return 'Speed';
          case 'Neon': return 'Inner Brightness';
          case 'Echo': return 'Distance';
          case 'Background': return 'Roundness'; // Fake
          case 'Curve': return 'Spacing';
          default: return 'Parameter 2';
      }
  };

  return (
    <div className="p-4 space-y-5 h-full flex flex-col">
       
       <div className="flex justify-between items-center bg-gray-900 border border-gray-800 p-2 rounded">
           <div className="text-xs font-bold text-gray-400 flex items-center gap-2">
                <Layers size={14} /> LAYERS ({state.textLayers.length})
           </div>
           <button 
                onClick={handleAddLayer}
                className="bg-blue-600 hover:bg-blue-500 text-white p-1 rounded transition-colors"
                title="Add Text Layer"
           >
               <Plus size={14} />
           </button>
       </div>

       {/* Layers List */}
       <div className="max-h-32 overflow-y-auto custom-scrollbar border border-gray-800 rounded bg-gray-900/50 p-1 space-y-1">
           {state.textLayers.map((layer, idx) => (
               <div 
                    key={layer.id}
                    onClick={() => updateState({ activeLayerId: layer.id, activeOverlay: 'Text' })}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs border ${
                        state.activeLayerId === layer.id 
                        ? 'bg-blue-900/30 border-blue-500/50 text-white' 
                        : 'bg-gray-800 border-transparent hover:bg-gray-700 text-gray-400'
                    }`}
               >
                   <div className="flex items-center gap-2 truncate">
                       <span className="font-mono text-[10px] opacity-50">{idx+1}.</span>
                       <span className="truncate max-w-[100px]">{layer.content}</span>
                   </div>
                   <div className="flex items-center gap-1">
                       <button 
                            onClick={(e) => { e.stopPropagation(); updateState({ textLayers: state.textLayers.map(l => l.id === layer.id ? {...l, visible: !l.visible} : l) }) }}
                            className={`p-1 hover:text-white ${layer.visible ? 'text-gray-400' : 'text-gray-600'}`}
                        >
                            {layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                       </button>
                       <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id) }}
                            className="p-1 hover:text-red-400 text-gray-500"
                       >
                            <Trash2 size={12}/>
                       </button>
                   </div>
               </div>
           ))}
       </div>

       {/* Edit Panel */}
       {activeLayer && state.activeOverlay === 'Text' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
             <div className="space-y-3">
                <textarea 
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none resize-none h-16"
                    value={activeLayer.content}
                    onChange={(e) => updateActiveLayer({ content: e.target.value })}
                    placeholder="Type text content here..."
                />
                
                <div className="flex gap-2 items-center">
                    <select 
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 h-8"
                        value={activeLayer.fontFamily}
                        onChange={(e) => updateActiveLayer({ fontFamily: e.target.value })}
                    >
                        <option value="Impact">Impact</option>
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Courier New">Courier</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times</option>
                        <option value="Comic Sans MS">Comic Sans</option>
                        <option value="Trebuchet MS">Trebuchet</option>
                    </select>
                    <ColorPicker value={activeLayer.textColor} onChange={(c) => updateActiveLayer({ textColor: c })} />
                </div>

                {/* --- STYLES SECTION --- */}
                <div className="border border-gray-800 rounded p-3 space-y-3 bg-gray-900/30">
                    <SectionLabel>Effects</SectionLabel>
                    
                    <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1 border border-gray-700">
                        <Palette size={14} className="text-purple-400" />
                        <select 
                            className="bg-transparent w-full text-xs text-gray-200 outline-none h-6"
                            value={activeLayer.style}
                            onChange={(e: any) => updateActiveLayer({ style: e.target.value })}
                        >
                            {styles.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {activeLayer.style !== 'None' && (
                        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Effect Color</span>
                                <ColorPicker value={activeLayer.styleColor} onChange={(c) => updateActiveLayer({ styleColor: c })} />
                            </div>
                            
                            <SliderControl 
                                label={getParam1Label()} 
                                value={activeLayer.styleAmount} 
                                onChange={(v: number) => updateActiveLayer({ styleAmount: v })} 
                            />
                            
                            {['Shadow Soft', 'Shadow Hard', 'Long Shadow', 'Lift', 'Splice', 'Glitch', 'Neon', 'Echo', 'Curve'].includes(activeLayer.style) && (
                                <SliderControl 
                                    label={getParam2Label()} 
                                    value={activeLayer.styleOffset} 
                                    onChange={(v: number) => updateActiveLayer({ styleOffset: v })} 
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Animation Section */}
                <div className="border border-gray-800 rounded p-3 space-y-3 bg-gray-900/30">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Animation</div>
                        <select 
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 mb-3"
                            value={activeLayer.effectMode}
                            onChange={(e) => updateActiveLayer({ effectMode: e.target.value })}
                        >
                            <option value="None">None</option>
                            <option value="Pulse">Pulse</option>
                            <option value="Slide">Slide</option>
                            <option value="Wiggle">Wiggle</option>
                        </select>
                        <SliderControl label="Anim Speed" value={activeLayer.fxSpeed} onChange={(v: number) => updateActiveLayer({ fxSpeed: v })} max={5} step={0.1} />
                    </div>
                </div>

                <div className="pt-2 border-t border-gray-800">
                    <SliderControl label="Font Size" value={activeLayer.size} onChange={(v: number) => updateActiveLayer({ size: v })} min={10} max={300} />
                    <SliderControl label="Opacity" value={activeLayer.opacity} onChange={(v: number) => updateActiveLayer({ opacity: v })} />
                    <div className="grid grid-cols-2 gap-4">
                        <SliderControl label="Pos X" value={activeLayer.x} onChange={(v: number) => updateActiveLayer({ x: v })} />
                        <SliderControl label="Pos Y" value={activeLayer.y} onChange={(v: number) => updateActiveLayer({ y: v })} />
                    </div>
                </div>
            </div>
        </div>
       ) : (
           <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">
               No text layer selected
           </div>
       )}
    </div>
  );
};

export const FXTab: React.FC<TabProps> = ({ state, updateState }) => {
    const effects = [
        { id: 'Rain', label: 'Rain', icon: '🌧️', color: 'text-blue-400' },
        { id: 'Snow', label: 'Snow', icon: '❄️', color: 'text-cyan-200' },
        { id: 'Sakura', label: 'Sakura', icon: '🌸', color: 'text-pink-400' },
        { id: 'Autumn', label: 'Autumn', icon: '🍂', color: 'text-orange-500' },
        { id: 'Orbs', label: 'Orbs', icon: '🟣', color: 'text-purple-400' },
        { id: 'Hex', label: 'Hex', icon: '💠', color: 'text-blue-300' },
        { id: 'Firefly', label: 'Firefly', icon: '✨', color: 'text-yellow-300' },
        { id: 'Star', label: 'Star', icon: '⭐', color: 'text-yellow-400' },
        { id: 'Bubble', label: 'Bubble', icon: '🫧', color: 'text-indigo-300' },
        { id: 'Party', label: 'Party', icon: '🎉', color: 'text-red-400' },
        { id: 'Notes', label: 'Notes', icon: '🎵', color: 'text-violet-400' },
        { id: 'Mist', label: 'Mist', icon: '🌫️', color: 'text-gray-300' },
      ];
    
      return (
        <div className="p-4">
          <SectionLabel>Pilih Efek</SectionLabel>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {effects.map((fx) => (
                <button 
                    key={fx.id}
                    onClick={() => updateState({ activeEffect: fx.id })}
                    className={`h-10 rounded text-xs flex items-center justify-center gap-1 border transition-all ${
                        state.activeEffect === fx.id 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                        : `bg-gray-800 border-gray-700 ${fx.color} hover:bg-gray-700 hover:text-white`
                    }`}
                >
                    <span className={state.activeEffect === fx.id ? 'opacity-100' : 'opacity-80'}>{fx.icon}</span> {fx.label}
                </button>
            ))}
            <button 
                onClick={() => updateState({ activeEffect: null })}
                className={`h-10 rounded text-xs flex items-center justify-center gap-1 border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 col-span-3 mt-2`}
            >
                MATIKAN EFEK
            </button>
          </div>
    
          <div className="border border-gray-800 rounded p-4 bg-gray-900/50">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                    <Sparkles size={14} /> Audio React
                </div>
                <input 
                    type="checkbox" 
                    checked={state.audioReactEnabled} 
                    onChange={(e) => updateState({ audioReactEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500" 
                />
            </div>
    
            <div className="flex justify-between items-center mb-4">
                 <span className="text-xs text-gray-400">Warna Partikel</span>
                 <ColorPicker value={state.particleColor} onChange={(c) => updateState({ particleColor: c })} />
            </div>
    
            <div className="grid grid-cols-2 gap-4">
                <SliderControl label="Opacity" value={state.fxOpacity} onChange={(v: number) => updateState({ fxOpacity: v })} unit="%" />
                <SliderControl label="Density" value={state.fxDensity} onChange={(v: number) => updateState({ fxDensity: v })} min={10} max={1000} />
            </div>
            
            <SliderControl label="Speed" value={state.fxParamSpeed} onChange={(v: number) => updateState({ fxParamSpeed: v })} min={0.1} max={5} step={0.1} />
            
            <SliderControl label="Ukuran Partikel" value={state.fxSize} onChange={(v: number) => updateState({ fxSize: v })} min={0.1} max={3.0} step={0.1} />
            <SliderControl label="Arah Angin (Direction)" value={state.fxDirection} onChange={(v: number) => updateState({ fxDirection: v })} min={-10} max={10} step={0.5} />
          </div>
        </div>
      );
};

export const EQTab: React.FC<TabProps> = ({ state, updateState }) => {
    // ... Existing EQ Logic
    return (
        <div className="p-4 space-y-5">
            <SectionLabel>Audio Visualizer</SectionLabel>
            
            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-800">
             <input 
                type="checkbox" 
                checked={state.eqEnabled} 
                onChange={(e) => updateState({ eqEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
             />
             <span className="font-bold text-sm">Aktifkan EQ</span>
           </div>
    
           <select 
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                value={state.eqType}
                onChange={(e: any) => updateState({ eqType: e.target.value })}
            >
                <option value="Bars">📊 Bars</option>
                <option value="Wave">〰 Wave</option>
                <option value="Circle">⭕ Circle</option>
                <option value="Shimmer">✨ Shimmer</option>
            </select>
    
            <div className="flex justify-between items-center px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={state.eqRainbow}
                        onChange={(e) => updateState({ eqRainbow: e.target.checked })}
                        className="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-xs text-gray-400">Rainbow</span>
                </label>
            </div>
    
            <div className="grid grid-cols-2 gap-4 pt-2">
                 <SliderControl label="Pos X" value={state.eqPosX} onChange={(v: number) => updateState({ eqPosX: v })} />
                 <SliderControl label="Pos Y" value={state.eqPosY} onChange={(v: number) => updateState({ eqPosY: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <SliderControl label="Scale" value={state.eqScale} onChange={(v: number) => updateState({ eqScale: v })} />
                 <SliderControl label="Gain" value={state.eqGain} onChange={(v: number) => updateState({ eqGain: v })} />
            </div>
            <SliderControl label="Opacity" value={state.eqOpacity} onChange={(v: number) => updateState({ eqOpacity: v })} />
    
        </div>
      );
};

export const LogoTab: React.FC<TabProps> = ({ state, updateState, onFileUpload }) => {
    // ... Existing Logo Logic
    return (
        <div className="p-4 space-y-6">
            <SectionLabel>Watermark</SectionLabel>
            
            <FileUploadButton 
                label={state.logoUrl ? "Ganti Logo (Loaded)" : "Upload Logo (PNG)"}
                icon={ImageIcon}
                accept="image/png,image/jpeg,image/webp"
                onUpload={(e) => onFileUpload && e.target.files && onFileUpload('logo', e.target.files)}
            />
    
            <div className="border border-gray-800 rounded p-4 space-y-2">
                <SliderControl label="Posisi X" value={state.logoPosX} onChange={(v: number) => updateState({ logoPosX: v })} unit="%" />
                <SliderControl label="Posisi Y" value={state.logoPosY} onChange={(v: number) => updateState({ logoPosY: v })} unit="%" />
                <SliderControl label="Ukuran" value={state.logoSize} onChange={(v: number) => updateState({ logoSize: v })} max={2} step={0.1} />
                <SliderControl label="Opacity" value={state.logoOpacity} onChange={(v: number) => updateState({ logoOpacity: v })} max={1} step={0.1} />
            </div>
        </div>
      );
};