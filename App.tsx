import React, { useState, useRef, useEffect } from 'react';
import { Film, Type, Sparkles, BarChart3, Image as ImageIcon, Monitor, Play, Pause, Volume2, Music, Download, Disc, Aperture, Lock, Unlock, AlertCircle, ShieldAlert, Zap, Loader2 } from 'lucide-react';
import { INITIAL_STATE, VJState, MediaItem, OverlayLayer } from './types';
import { MediaTab, TextTab, FXTab, EQTab, LogoTab } from './components/SidebarTabs';
import { PreviewCanvas, CanvasHandle } from './components/PreviewCanvas';
import { Timeline } from './components/Timeline';

// --- HELPER: AUDIO BUFFER TO WAV CONVERTER ---
function bufferToWave(abuffer: AudioBuffer, len: number) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;
    
    // Write WAV Header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"
    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit
    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // Interleave channels
    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    
    while(pos < len) {
      for(i = 0; i < numOfChan; i++) {             
        sample = Math.max(-1, Math.min(1, channels[i][pos])); 
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
        view.setInt16(44 + offset, sample, true);          
        offset += 2;
      }
      pos++;
    }
    
    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data: any) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: any) { view.setUint32(pos, data, true); pos += 4; }
}

const App = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState(false);

  // --- APP STATE ---
  const [state, setState] = useState<VJState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<'Media' | 'Text' | 'FX' | 'EQ' | 'Logo'>('Media');
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); 

  // CANVAS REF
  const canvasRef = useRef<CanvasHandle>(null);
  
  // DUAL VIDEO PLAYER REFS
  const videoPlayerA = useRef<HTMLVideoElement>(null);
  const videoPlayerB = useRef<HTMLVideoElement>(null);

  // DUAL AUDIO PLAYER REFS
  const audioDeckA = useRef<HTMLAudioElement>(null);
  const audioDeckB = useRef<HTMLAudioElement>(null);
  const sfxAudioRef = useRef<HTMLAudioElement>(null);

  // Web Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeARef = useRef<GainNode | null>(null);
  const gainNodeBRef = useRef<GainNode | null>(null);
  const gainNodeSFXRef = useRef<GainNode | null>(null); 
  const gainNodeMasterRef = useRef<GainNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Fixed: Initialize with 0 to satisfy TypeScript definition expecting 1 argument
  const transitionFrameRef = useRef<number>(0);

  // --- HELPER: SAFE PLAY ---
  const safePlay = async (element: HTMLMediaElement | null) => {
    if (!element) return;
    try {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        if (element.paused) {
            await element.play();
        }
    } catch (err) {
        if ((err as Error).name !== 'AbortError') {
            console.warn("Playback error:", err);
        }
    }
  };

  // --- AUTH HANDLER ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim().toUpperCase() === 'GAJIAN 1 MILYAR') {
        setIsAuthenticated(true);
        setAuthError(false);
        initAudioContext();
    } else {
        setAuthError(true);
    }
  };

  const updateState = (updates: Partial<VJState>) => {
    setState(prev => ({ ...prev, ...updates }));
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  // Initialize Audio Context and Mixer Graph
  const initAudioContext = () => {
      if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          audioContextRef.current = ctx;

          const masterGain = ctx.createGain();
          masterGain.connect(ctx.destination);
          gainNodeMasterRef.current = masterGain;

          const streamDest = ctx.createMediaStreamDestination();
          masterGain.connect(streamDest);
          mediaStreamDestRef.current = streamDest;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256; 
          analyser.smoothingTimeConstant = 0.85; 
          masterGain.connect(analyser); 
          analyserRef.current = analyser;

          const gainA = ctx.createGain();
          gainA.connect(masterGain);
          gainNodeARef.current = gainA;

          const gainB = ctx.createGain();
          gainB.connect(masterGain);
          gainNodeBRef.current = gainB;

          const gainSFX = ctx.createGain();
          gainSFX.connect(masterGain);
          gainNodeSFXRef.current = gainSFX;
      }

      const ctx = audioContextRef.current;
      if (ctx && ctx.state === 'suspended') {
          ctx.resume();
      }
      
      connectMediaElement(ctx, audioDeckA.current, gainNodeARef.current);
      connectMediaElement(ctx, audioDeckB.current, gainNodeBRef.current);
      connectMediaElement(ctx, videoPlayerA.current, gainNodeMasterRef.current);
      connectMediaElement(ctx, videoPlayerB.current, gainNodeMasterRef.current);
      connectMediaElement(ctx, sfxAudioRef.current, gainNodeSFXRef.current);
  };

  const connectMediaElement = (ctx: AudioContext | null, el: HTMLMediaElement | null, dest: AudioNode | null) => {
      if (!ctx || !el || !dest) return;
      if ((el as any)._isConnected) return;
      try {
          const source = ctx.createMediaElementSource(el);
          source.connect(dest);
          (el as any)._isConnected = true; 
      } catch(e) {
          console.log("Audio source connection info:", e);
      }
  };

  const getSupportedMimeType = () => {
    // Prioritize H.264 (MP4) for better compatibility
    const types = [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 High Profile
        'video/mp4',
        'video/webm;codecs=h264', // H.264 in WebM container
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log("Using MIME Type:", type);
            return type;
        }
    }
    return '';
  };

  // --- RENDER (RECORDING) LOGIC ---
  const handleToggleRender = async () => {
      if (state.isRendering) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
          }
          updateState({ isRendering: false, renderProgress: 0, renderStatus: '' });
          
          // Restore Audio Monitor
          if (gainNodeMasterRef.current && audioContextRef.current) {
              try { gainNodeMasterRef.current.connect(audioContextRef.current.destination); } catch(e){}
          }
      } else {
          await startRealtimeRendering();
      }
  };

  // --- OFFLINE AUDIO RENDERER UTILITY (KEPT FOR MERGING, NOT RENDERING) ---
  const renderAudioOffline = async (renderDuration: number) => {
    if (state.mainAudioPlaylist.length === 0 && !state.audioFxUrl) return null;

    try {
        const sampleRate = 44100;
        const offlineCtx = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);
        
        // 1. Load & Schedule Main Playlist
        if (state.mainAudioPlaylist.length > 0) {
             const buffers: AudioBuffer[] = [];
             // Fetch Buffers
             for(const item of state.mainAudioPlaylist) {
                 try {
                     const resp = await fetch(item.url);
                     const ab = await resp.arrayBuffer();
                     const audioBuf = await offlineCtx.decodeAudioData(ab);
                     buffers.push(audioBuf);
                 } catch(e) { console.warn("Skipped audio:", item.name); }
             }

             if (buffers.length > 0) {
                 const crossfade = state.audioCrossfadeDuration;
                 let currentTime = 0;

                 // Simple sequencing with crossfade
                 buffers.forEach((buf, i) => {
                     if (currentTime >= renderDuration) return;

                     const source = offlineCtx.createBufferSource();
                     source.buffer = buf;
                     
                     const gain = offlineCtx.createGain();
                     source.connect(gain);
                     gain.connect(offlineCtx.destination);
                     
                     source.start(currentTime);
                     
                     // Crossfade In
                     if (i > 0) {
                         gain.gain.setValueAtTime(0, currentTime);
                         gain.gain.linearRampToValueAtTime(1, currentTime + crossfade);
                     } else {
                         gain.gain.setValueAtTime(1, currentTime);
                     }
                     
                     // Crossfade Out (if not last)
                     const endTime = currentTime + buf.duration;
                     if (i < buffers.length - 1) {
                        gain.gain.setValueAtTime(1, endTime - crossfade);
                        gain.gain.linearRampToValueAtTime(0, endTime);
                        currentTime = endTime - crossfade; // Overlap
                     } else {
                        currentTime = endTime;
                     }
                 });
             }
        }

        const renderedBuffer = await offlineCtx.startRendering();
        return bufferToWave(renderedBuffer, renderedBuffer.length);

    } catch (e) {
        console.error("Audio Render Error:", e);
        return null;
    }
  };

  // --- REALTIME RENDER LOGIC ---
  const startRealtimeRendering = async () => {
    updateState({ isRendering: true, renderStatus: 'Recording Realtime...' });
    
    // 1. Resume Context
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }
    
    // 2. RESET PLAYBACK TO START (00:00)
    const vidA = videoPlayerA.current;
    const vidB = videoPlayerB.current;
    const audA = audioDeckA.current;
    const audB = audioDeckB.current;

    if (vidA) vidA.currentTime = 0;
    if (vidB) vidB.currentTime = 0;
    if (audA) audA.currentTime = 0;
    if (audB) audB.currentTime = 0;
    setCurrentTime(0);

    // Force Play Active Media from Start
    if (state.activeVideoSlot === 'A') safePlay(vidA);
    else safePlay(vidB);
    
    if (state.mainAudioPlaylist.length > 0) {
        if (state.activeAudioSlot === 'A') safePlay(audA);
        else safePlay(audB);
    }
    if (state.audioFxUrl) safePlay(sfxAudioRef.current);
    
    updateState({ isPlaying: true });

    // 3. Mute Monitor (Prevent Feedback during Render)
    if (gainNodeMasterRef.current && audioContextRef.current) {
        try {
            // Only disconnect from speakers, keep connection to Stream Destination
            gainNodeMasterRef.current.disconnect(audioContextRef.current.destination);
        } catch (e) { console.warn(e); }
    }

    // 4. Setup Streams
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    // Use selected FPS
    // @ts-ignore
    const videoStream = canvas.captureStream(state.targetFps);
    const audioStream = mediaStreamDestRef.current?.stream;
    
    const combinedTracks = [
        ...videoStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : [])
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // 5. Calculate Optimal Bitrate
    const { width, height } = getResolution();
    const pixelCount = width * height;
    // Factor: 0.2 for High Quality H.264
    const bitrate = Math.floor(pixelCount * state.targetFps * 0.2); 

    const options: MediaRecorderOptions = {
        mimeType: getSupportedMimeType() || 'video/webm',
        videoBitsPerSecond: bitrate
    };

    try {
        const recorder = new MediaRecorder(combinedStream, options);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: options.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Determine Extension based on MIME type
            let ext = 'webm';
            if (options.mimeType?.includes('mp4')) ext = 'mp4';
            else if (options.mimeType?.includes('h264')) ext = 'mp4'; // Often acceptable for h264/webm container
            
            // USE PROJECT NAME FOR FILENAME
            const safeName = state.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vj_render';
            a.download = `${safeName}_${Date.now()}.${ext}`;
            
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            
            // Restore Monitor
            if (gainNodeMasterRef.current && audioContextRef.current) {
                gainNodeMasterRef.current.connect(audioContextRef.current.destination);
            }
            updateState({ isRendering: false, renderStatus: '', renderProgress: 0 });
            console.log("Recording Saved");
        };

        recorder.start(100); // Collect in 100ms chunks
        
        // 6. AUTO STOP LOGIC
        // Determine duration based on active media
        let stopTime = 0;
        if (state.mainAudioPlaylist.length > 0) {
            const activeDeck = state.activeAudioSlot === 'A' ? audA : audB;
            if (activeDeck && isFinite(activeDeck.duration)) stopTime = activeDeck.duration;
        } else if (state.backgroundType === 'video') {
             const activeVid = state.activeVideoSlot === 'A' ? vidA : vidB;
             if (activeVid && isFinite(activeVid.duration)) stopTime = activeVid.duration;
        } else {
            // Default or Image duration
            stopTime = state.bgImageDuration > 0 ? state.bgImageDuration : 10;
        }

        if (stopTime > 0) {
            console.log(`Auto-stop scheduled for ${stopTime} seconds`);
            updateState({ renderStatus: `Recording (Auto-Stop: ${formatTime(stopTime)})` });
            
            // Set timeout to stop recording + small buffer
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                    updateState({ isPlaying: false }); // Pause playback after render
                }
            }, (stopTime * 1000) + 500); // 500ms buffer to ensure last frame
        }

    } catch (e) {
        console.error("Realtime Render Error:", e);
        updateState({ isRendering: false, renderStatus: 'Error' });
        alert("Recording failed. Browser may not support this resolution.");
    }
  };


  const handleFileUpload = (type: 'background' | 'audio' | 'sfx' | 'logo' | 'layer', files: FileList) => {
    if (!files.length) return;

    if (type === 'background') {
        const newItems: MediaItem[] = Array.from(files).map((f) => ({
            id: Math.random().toString(36).substr(2, 9),
            url: URL.createObjectURL(f),
            name: f.name,
            type: f.type.startsWith('video') ? 'video' : 'image'
        }));
        
        setState(prev => {
             const newPlaylist = [...prev.backgroundPlaylist, ...newItems];
             const newIndex = prev.currentBackgroundIndex === -1 ? 0 : prev.currentBackgroundIndex;
             const nextIndex = newPlaylist.length > 0 ? (newIndex + 1) % newPlaylist.length : -1;
             
             return {
                 ...prev,
                 backgroundPlaylist: newPlaylist,
                 currentBackgroundIndex: newIndex,
                 nextBackgroundIndex: nextIndex,
                 backgroundType: newPlaylist[newIndex].type as 'video' | 'image',
                 backgroundUrl: newPlaylist[newIndex].url,
                 activeVideoSlot: 'A',
                 isTransitioning: false,
                 lastBackgroundChangeTime: Date.now()
             };
        });
        
    } else if (type === 'audio') {
        const newItems: MediaItem[] = Array.from(files).map((f) => ({
            id: Math.random().toString(36).substr(2, 9),
            url: URL.createObjectURL(f),
            name: f.name,
            type: 'audio'
        }));

        setState(prev => {
            const newPlaylist = [...prev.mainAudioPlaylist, ...newItems];
            const newIndex = prev.currentAudioIndex === -1 ? 0 : prev.currentAudioIndex;
            let nextIdx = -1;
            if (newPlaylist.length > 0) {
                nextIdx = (newIndex + 1) % newPlaylist.length;
            }
            return {
                ...prev,
                mainAudioPlaylist: newPlaylist,
                currentAudioIndex: newIndex,
                nextAudioIndex: nextIdx,
                activeAudioSlot: 'A'
            };
        });
        
        if (state.isPlaying) {
            setTimeout(() => { 
                safePlay(audioDeckA.current);
                initAudioContext();
            }, 100);
        }
    } else if (type === 'sfx') {
        const file = files[0];
        const url = URL.createObjectURL(file);
        updateState({ audioFxUrl: url });
        initAudioContext();
    } else if (type === 'logo') {
        const file = files[0];
        const url = URL.createObjectURL(file);
        updateState({ logoUrl: url });
    } else if (type === 'layer') {
        // ADD NEW LAYER
        if (state.overlayLayers.length >= 10) return;
        const file = files[0];
        const url = URL.createObjectURL(file);
        const newLayer: OverlayLayer = {
            id: `layer-${Date.now()}`,
            name: file.name,
            type: file.type.startsWith('video') ? 'video' : 'image',
            url: url,
            visible: true,
            blendMode: 'source-over',
            opacity: 100,
            scale: 1.0,
            x: 0,
            y: 0,
            cropShape: 'Original',
            speed: 1.0
        };
        updateState({ 
            overlayLayers: [...state.overlayLayers, newLayer],
            activeOverlayLayerId: newLayer.id,
            activeOverlay: 'Layer'
        });
    }
  };

  useEffect(() => {
    const sfx = sfxAudioRef.current;
    if (sfx && state.audioFxUrl) {
        sfx.src = state.audioFxUrl;
        sfx.load();
        sfx.loop = state.audioFxLoop;
        if (state.isPlaying) {
            safePlay(sfx);
        }
    }
  }, [state.audioFxUrl]);

  useEffect(() => {
      const sfx = sfxAudioRef.current;
      const sfxGain = gainNodeSFXRef.current;
      if (sfx) {
          sfx.loop = state.audioFxLoop;
      }
      if (sfxGain) {
          sfxGain.gain.value = state.audioFxVolume / 100;
      }
  }, [state.audioFxLoop, state.audioFxVolume]);


  const getNextAudioIndex = (currentIndex: number, playlistLength: number, shuffle: boolean) => {
      if (playlistLength <= 1) return 0;
      if (shuffle) {
          let next;
          do {
              next = Math.floor(Math.random() * playlistLength);
          } while (next === currentIndex);
          return next;
      }
      return (currentIndex + 1) % playlistLength;
  };

  const handlePlaylistItemChange = (type: 'background' | 'audio', index: number) => {
      if (type === 'background') {
           const item = state.backgroundPlaylist[index];
          if (item) {
              const nextIdx = (index + 1) % state.backgroundPlaylist.length;
              updateState({
                  currentBackgroundIndex: index,
                  nextBackgroundIndex: nextIdx,
                  backgroundType: item.type as 'video' | 'image',
                  backgroundUrl: item.url,
                  activeVideoSlot: 'A',
                  isTransitioning: false,
                  transitionProgress: 0,
                  lastBackgroundChangeTime: Date.now()
              });
              
              if(item.type === 'video') {
                  if(videoPlayerA.current) {
                      videoPlayerA.current.src = item.url;
                      videoPlayerA.current.currentTime = 0;
                      if(state.isPlaying) safePlay(videoPlayerA.current);
                  }
              }
              if(state.backgroundPlaylist[nextIdx].type === 'video' && videoPlayerB.current) {
                   videoPlayerB.current.src = state.backgroundPlaylist[nextIdx].url;
                   videoPlayerB.current.load();
              }
          }
      } else {
          const nextIdx = getNextAudioIndex(index, state.mainAudioPlaylist.length, state.isAudioShuffle);
          updateState({
              currentAudioIndex: index,
              nextAudioIndex: nextIdx,
              activeAudioSlot: 'A', 
              isAudioTransitioning: false
          });

          if (gainNodeARef.current) gainNodeARef.current.gain.value = 1;
          if (gainNodeBRef.current) gainNodeBRef.current.gain.value = 0;

          if(audioDeckA.current && state.mainAudioPlaylist[index]) {
              audioDeckA.current.src = state.mainAudioPlaylist[index].url;
              audioDeckA.current.currentTime = 0;
              if (state.isPlaying) safePlay(audioDeckA.current);
          }
          if(audioDeckB.current && state.mainAudioPlaylist[nextIdx]) {
              audioDeckB.current.src = state.mainAudioPlaylist[nextIdx].url;
              audioDeckB.current.load();
          }
      }
  };

  const handleReorderPlaylist = (type: 'audio' | 'video', fromIndex: number, directionOrToIndex: 'up' | 'down' | number) => {
      if (type === 'audio') {
          const newPlaylist = [...state.mainAudioPlaylist];
          let toIndex = -1;
          if (typeof directionOrToIndex === 'number') {
             toIndex = directionOrToIndex;
          } else {
             toIndex = directionOrToIndex === 'up' ? fromIndex - 1 : fromIndex + 1;
          }
          if (toIndex < 0 || toIndex >= newPlaylist.length) return;
          const [movedItem] = newPlaylist.splice(fromIndex, 1);
          newPlaylist.splice(toIndex, 0, movedItem);
          let newCurrentIndex = state.currentAudioIndex;
          if (state.currentAudioIndex === fromIndex) newCurrentIndex = toIndex;
          else if (fromIndex < state.currentAudioIndex && toIndex >= state.currentAudioIndex) newCurrentIndex--;
          else if (fromIndex > state.currentAudioIndex && toIndex <= state.currentAudioIndex) newCurrentIndex++;
          const newNextIndex = getNextAudioIndex(newCurrentIndex, newPlaylist.length, state.isAudioShuffle);
          updateState({
              mainAudioPlaylist: newPlaylist,
              currentAudioIndex: newCurrentIndex,
              nextAudioIndex: newNextIndex
          });
      } else if (type === 'video') {
         const newPlaylist = [...state.backgroundPlaylist];
         let toIndex = -1;
         if (typeof directionOrToIndex === 'number') {
            toIndex = directionOrToIndex;
         } else {
            return; 
         }
         if (toIndex < 0 || toIndex >= newPlaylist.length) return;
         const [movedItem] = newPlaylist.splice(fromIndex, 1);
         newPlaylist.splice(toIndex, 0, movedItem);
         let newCurrent = state.currentBackgroundIndex;
         if (state.currentBackgroundIndex === fromIndex) newCurrent = toIndex;
         else if (fromIndex < state.currentBackgroundIndex && toIndex >= state.currentBackgroundIndex) newCurrent--;
         else if (fromIndex > state.currentBackgroundIndex && toIndex <= state.currentBackgroundIndex) newCurrent++;
         const newNext = (newCurrent + 1) % newPlaylist.length;
         updateState({
             backgroundPlaylist: newPlaylist,
             currentBackgroundIndex: newCurrent,
             nextBackgroundIndex: newNext
         });
      }
  };

  const handleRemoveItem = (type: 'audio', index: number) => {
      if (type === 'audio') {
          const newPlaylist = state.mainAudioPlaylist.filter((_, i) => i !== index);
          let newCurrent = state.currentAudioIndex;
          if (index < newCurrent) newCurrent--;
          else if (index === newCurrent) newCurrent = 0; 
          if (newPlaylist.length === 0) newCurrent = -1;
          updateState({
              mainAudioPlaylist: newPlaylist,
              currentAudioIndex: newCurrent,
              nextAudioIndex: newPlaylist.length > 0 ? getNextAudioIndex(newCurrent, newPlaylist.length, state.isAudioShuffle) : -1
          });
      }
  }

  const handleMergePlaylist = async () => {
    if (state.mainAudioPlaylist.length < 2 || state.isMerging) return;
    updateState({ isMerging: true });
    try {
        const blob = await renderAudioOffline(100000); // High limit, process handles actual duration
        if (!blob) throw new Error("Audio generation failed");
        
        const newUrl = URL.createObjectURL(blob);
        const newItem: MediaItem = {
            id: `merged-${Date.now()}`,
            url: newUrl,
            name: `Megamix (${state.mainAudioPlaylist.length} Songs)`,
            type: 'audio'
        };
        updateState({
            mainAudioPlaylist: [...state.mainAudioPlaylist, newItem],
            isMerging: false
        });
    } catch (err) {
        console.error("Merge error:", err);
        updateState({ isMerging: false });
        alert("Failed to merge audio.");
    }
  };

  useEffect(() => {
    const vidActive = state.activeVideoSlot === 'A' ? videoPlayerA.current : videoPlayerB.current;
    const vidBuffer = state.activeVideoSlot === 'A' ? videoPlayerB.current : videoPlayerA.current;
    const audActive = state.activeAudioSlot === 'A' ? audioDeckA.current : audioDeckB.current;
    const audBuffer = state.activeAudioSlot === 'A' ? audioDeckB.current : audioDeckA.current;
    const gainActive = state.activeAudioSlot === 'A' ? gainNodeARef.current : gainNodeBRef.current;
    const gainBuffer = state.activeAudioSlot === 'A' ? gainNodeBRef.current : gainNodeARef.current;

    const currentItem = state.backgroundPlaylist[state.currentBackgroundIndex];
    const nextItem = state.backgroundPlaylist[state.nextBackgroundIndex];

    if (currentItem && currentItem.type === 'video' && vidActive) {
         if (vidActive.src !== currentItem.url) {
             vidActive.src = currentItem.url;
             vidActive.load();
         }
         if (vidActive.playbackRate !== state.bgVideoSpeed) vidActive.playbackRate = state.bgVideoSpeed;
    }
    
    if (nextItem && nextItem.type === 'video' && vidBuffer) {
        if (vidBuffer.src !== nextItem.url) {
            vidBuffer.src = nextItem.url;
            vidBuffer.load();
        } else if (state.backgroundPlaylist.length === 1 && vidBuffer.readyState === 0) {
             vidBuffer.load();
        }
    }

    if (audActive && state.currentAudioIndex !== -1 && state.mainAudioPlaylist[state.currentAudioIndex]) {
        const currUrl = state.mainAudioPlaylist[state.currentAudioIndex].url;
        if (audActive.src !== currUrl && !state.isAudioTransitioning) {
             audActive.src = currUrl;
             audActive.load();
        }
    }
    if (audBuffer && state.nextAudioIndex !== -1 && state.mainAudioPlaylist[state.nextAudioIndex]) {
        const nextUrl = state.mainAudioPlaylist[state.nextAudioIndex].url;
        if (audBuffer.src !== nextUrl && !state.isAudioTransitioning) {
            audBuffer.src = nextUrl;
            audBuffer.load();
        }
    }

    const loop = () => {
        if (!state.isPlaying) {
            transitionFrameRef.current = requestAnimationFrame(loop);
            return;
        }

        if (!state.isTransitioning && state.backgroundPlaylist.length > 0) {
            let shouldTrigger = false;
            if (currentItem && currentItem.type === 'video' && vidActive) {
                 const timeLeft = (vidActive.duration - vidActive.currentTime) / state.bgVideoSpeed;
                 if (timeLeft < 1.0 && state.seamlessFade) {
                     shouldTrigger = true;
                 } else if (vidActive.ended || timeLeft <= 0) {
                     if(!state.seamlessFade) {
                         vidActive.currentTime = 0;
                         safePlay(vidActive);
                     }
                 }
            } else if (currentItem && currentItem.type === 'image') {
                const elapsed = Date.now() - state.lastBackgroundChangeTime;
                if (elapsed > state.bgImageDuration * 1000) shouldTrigger = true;
            }

            if (shouldTrigger && state.seamlessFade) {
                if (nextItem && nextItem.type === 'video' && vidBuffer) {
                    vidBuffer.currentTime = 0;
                    vidBuffer.playbackRate = state.bgVideoSpeed;
                    safePlay(vidBuffer);
                }
                triggerBackgroundTransition();
            }
        }

        if (state.mainAudioPlaylist.length > 1 && audActive && !state.isAudioTransitioning) {
             const timeLeft = audActive.duration - audActive.currentTime;
             if (timeLeft < state.audioCrossfadeDuration && timeLeft > 0) {
                 triggerAudioTransition(audActive, audBuffer, gainActive, gainBuffer);
             } else if (timeLeft <= 0 || audActive.ended) {
                 triggerAudioTransition(audActive, audBuffer, gainActive, gainBuffer); 
             }
        } else if (state.mainAudioPlaylist.length === 1 && audActive && audActive.ended) {
             audActive.currentTime = 0;
             safePlay(audActive);
        }

        transitionFrameRef.current = requestAnimationFrame(loop);
    };

    const triggerBackgroundTransition = () => {
        updateState({ isTransitioning: true, transitionProgress: 0 });
        const startTime = performance.now();
        const duration = 1000; 

        const animate = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1.0);
            updateState({ transitionProgress: progress });
            if (progress < 1.0) requestAnimationFrame(animate);
            else finishBackgroundTransition();
        };
        requestAnimationFrame(animate);
    };

    const finishBackgroundTransition = () => {
        const prevItem = state.backgroundPlaylist[state.currentBackgroundIndex];
        if (prevItem && prevItem.type === 'video') {
             const oldVid = state.activeVideoSlot === 'A' ? videoPlayerA.current : videoPlayerB.current;
             oldVid?.pause();
             if(oldVid) oldVid.currentTime = 0;
        }

        const nextActiveSlot = state.activeVideoSlot === 'A' ? 'B' : 'A';
        const nextBgIndex = state.nextBackgroundIndex;
        if (state.backgroundPlaylist.length === 0) return;
        const followingIndex = (nextBgIndex + 1) % state.backgroundPlaylist.length;
        const nextItem = state.backgroundPlaylist[nextBgIndex];
        const nextUrl = nextItem ? nextItem.url : (state.backgroundPlaylist[0]?.url || null);

        updateState({
            activeVideoSlot: nextActiveSlot,
            currentBackgroundIndex: nextBgIndex,
            nextBackgroundIndex: followingIndex,
            backgroundUrl: nextUrl,
            isTransitioning: false,
            transitionProgress: 0,
            lastBackgroundChangeTime: Date.now()
        });
    };

    const triggerAudioTransition = (active: HTMLAudioElement, buffer: HTMLAudioElement | null, gainA: GainNode | null, gainB: GainNode | null) => {
        if (!buffer || !gainA || !gainB) return;
        updateState({ isAudioTransitioning: true });
        buffer.currentTime = 0;
        safePlay(buffer);

        const ctx = audioContextRef.current;
        if (ctx) {
            const now = ctx.currentTime;
            const dur = state.audioCrossfadeDuration;
            gainA.gain.cancelScheduledValues(now);
            gainA.gain.setValueAtTime(gainA.gain.value, now);
            gainA.gain.linearRampToValueAtTime(0, now + dur);
            gainB.gain.cancelScheduledValues(now);
            gainB.gain.setValueAtTime(0, now);
            gainB.gain.linearRampToValueAtTime(1, now + dur);
        }
        setTimeout(() => { finishAudioTransition(active, gainA); }, state.audioCrossfadeDuration * 1000);
    };

    const finishAudioTransition = (oldActive: HTMLAudioElement, oldGain: GainNode | null) => {
        oldActive.pause();
        oldActive.currentTime = 0;
        const nextSlot = state.activeAudioSlot === 'A' ? 'B' : 'A';
        const nextIdx = state.nextAudioIndex;
        const followingIdx = getNextAudioIndex(nextIdx, state.mainAudioPlaylist.length, state.isAudioShuffle);
        updateState({
            activeAudioSlot: nextSlot,
            currentAudioIndex: nextIdx,
            nextAudioIndex: followingIdx,
            isAudioTransitioning: false
        });
    };

    if(state.isPlaying) {
        transitionFrameRef.current = requestAnimationFrame(loop);
    }
    return () => { if (transitionFrameRef.current) cancelAnimationFrame(transitionFrameRef.current); };
  }, [state, state.isPlaying, state.activeVideoSlot, state.activeAudioSlot, state.lastBackgroundChangeTime]);

  useEffect(() => {
    const videoA = videoPlayerA.current;
    const videoB = videoPlayerB.current;
    const audioA = audioDeckA.current;
    const audioB = audioDeckB.current;
    const sfx = sfxAudioRef.current;
    
    if (state.isPlaying) {
      initAudioContext();
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
      }
      if (state.backgroundPlaylist[state.currentBackgroundIndex]?.type === 'video') {
        if (state.activeVideoSlot === 'A') {
            safePlay(videoA);
            if (!state.isTransitioning) videoB?.pause();
        } else {
            safePlay(videoB);
            if (!state.isTransitioning) videoA?.pause();
        }
      }
      if (state.mainAudioPlaylist.length > 0) {
          if (state.activeAudioSlot === 'A') {
              safePlay(audioA);
              if (!state.isAudioTransitioning) audioB?.pause();
              if (gainNodeARef.current) gainNodeARef.current.gain.value = 1;
              if (gainNodeBRef.current) gainNodeBRef.current.gain.value = 0;
          } else {
              safePlay(audioB);
              if (!state.isAudioTransitioning) audioA?.pause();
              if (gainNodeBRef.current) gainNodeBRef.current.gain.value = 1;
              if (gainNodeARef.current) gainNodeARef.current.gain.value = 0;
          }
      }
      if (sfx && (state.audioFxLoop || (!sfx.ended && sfx.currentTime > 0) || (sfx.currentTime === 0 && state.audioFxUrl))) {
           safePlay(sfx);
      }
    } else {
      videoA?.pause();
      videoB?.pause();
      audioA?.pause();
      audioB?.pause();
      sfx?.pause();
    }
    if (gainNodeMasterRef.current) gainNodeMasterRef.current.gain.value = state.masterVolume / 100;
    if (gainNodeSFXRef.current) gainNodeSFXRef.current.gain.value = state.audioFxVolume / 100;

  }, [state.isPlaying, state.masterVolume, state.audioFxVolume, state.activeVideoSlot, state.activeAudioSlot]);

  const handleDurationChange = () => {
      if (state.mainAudioPlaylist.length > 0) {
          const activeDeck = state.activeAudioSlot === 'A' ? audioDeckA.current : audioDeckB.current;
          if (activeDeck && !isNaN(activeDeck.duration)) setDuration(activeDeck.duration);
      } else if (state.backgroundType === 'video') {
          const activeVid = state.activeVideoSlot === 'A' ? videoPlayerA.current : videoPlayerB.current;
          if (activeVid && !isNaN(activeVid.duration)) setDuration(activeVid.duration);
      }
  };

  useEffect(() => {
    const interval = setInterval(() => {
        if (state.isPlaying) {
             if (state.mainAudioPlaylist.length > 0) {
                  const activeDeck = state.activeAudioSlot === 'A' ? audioDeckA.current : audioDeckB.current;
                  if(activeDeck) setCurrentTime(activeDeck.currentTime);
             } else if (state.backgroundType === 'video') {
                 const activeVid = state.activeVideoSlot === 'A' ? videoPlayerA.current : videoPlayerB.current;
                 if(activeVid) setCurrentTime(activeVid.currentTime);
             } else {
                setCurrentTime(t => t + 0.1);
             }
        }
    }, 100);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.activeAudioSlot, state.activeVideoSlot]);

  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const newTime = pct * (duration || 60);
      setCurrentTime(newTime);
      if (state.mainAudioPlaylist.length > 0) {
           const activeDeck = state.activeAudioSlot === 'A' ? audioDeckA.current : audioDeckB.current;
           if (activeDeck) activeDeck.currentTime = newTime;
      }
      const activeVid = state.activeVideoSlot === 'A' ? videoPlayerA.current : videoPlayerB.current;
      if (activeVid) activeVid.currentTime = newTime % (activeVid.duration || 1);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResolution = () => {
      const match = state.resolution.match(/(\d+)x(\d+)/);
      if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
      return { width: 1920, height: 1080 };
  };
  const { width: canvasW, height: canvasH } = getResolution();

  const tabs = [
    { id: 'Media', icon: Film, label: 'Media' },
    { id: 'Text', icon: Type, label: 'Text' },
    { id: 'FX', icon: Sparkles, label: 'FX' },
    { id: 'EQ', icon: BarChart3, label: 'EQ' },
    { id: 'Logo', icon: ImageIcon, label: 'Logo' },
  ];

  if (!isAuthenticated) {
    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1f2937_0%,_#000000_100%)] z-0"></div>
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] z-0 pointer-events-none"></div>
            
            <div className="z-10 w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>

                <div className="mb-6 p-4 bg-blue-500/10 rounded-full border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Film size={48} className="text-blue-500" />
                </div>
                
                <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2 tracking-tight">
                    LAMBDA MAGIC STUDIO
                </h1>
                <p className="text-gray-400 text-xs font-bold mb-8 tracking-[0.2em] uppercase">Visual Performance Software V.1</p>

                <form onSubmit={handleLogin} className="w-full space-y-4">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input 
                            type="text" 
                            value={accessCode}
                            onChange={(e) => {
                                setAccessCode(e.target.value);
                                if(authError) setAuthError(false);
                            }}
                            placeholder="MASUKKAN KODE AKSES"
                            className={`w-full bg-black/50 border ${authError ? 'border-red-500 text-red-500 placeholder-red-500/50' : 'border-gray-700 text-white focus:border-blue-500'} rounded-lg py-3 pl-10 pr-4 outline-none transition-all placeholder:text-gray-600 font-mono text-center tracking-widest uppercase text-lg`}
                        />
                    </div>

                    {authError && (
                        <div className="flex items-center justify-center gap-2 text-red-400 text-xs animate-pulse font-bold bg-red-900/20 py-2 rounded">
                            <AlertCircle size={14} />
                            <span>KODE AKSES SALAH</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
                    >
                         MASUK SYSTEM <Unlock size={16} />
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t border-gray-800 w-full flex flex-col items-center gap-2">
                     <ShieldAlert size={24} className="text-yellow-600 mb-1" />
                     <p className="text-[11px] text-gray-400 uppercase leading-relaxed max-w-xs">
                        penggunaan pribadi dipersembahkan untuk <br/><span className="text-yellow-500 font-bold text-sm">youtuber Tegal</span>
                     </p>
                     <p className="text-[10px] text-red-500 mt-1 font-black bg-red-950/30 px-3 py-1 rounded border border-red-900/50 tracking-widest">
                        TIDAK DIPERJUAL BELIKAN !!!
                     </p>
                     <p className="text-[10px] text-gray-500 mt-3 text-center leading-relaxed">
                        APLIKASI INI MASIH DALAM TAHAP PENGEMBANGAN<br/>JIKA TERJADI KESALAHAN ATAU INGIN BERKONSULTASI<br/>HUBUNGI NO.WA 081318329175
                     </p>
                </div>
            </div>
            
            <div className="absolute bottom-4 text-[10px] text-gray-600 font-mono">
                BUILD 2024.1.0 // SECURE ACCESS REQUIRED
            </div>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 font-sans">
      <video ref={videoPlayerA} className="hidden" crossOrigin="anonymous" playsInline muted onLoadedMetadata={handleDurationChange} />
      <video ref={videoPlayerB} className="hidden" crossOrigin="anonymous" playsInline muted onLoadedMetadata={handleDurationChange} />
      
      <audio ref={audioDeckA} className="hidden" crossOrigin="anonymous" onLoadedMetadata={handleDurationChange} />
      <audio ref={audioDeckB} className="hidden" crossOrigin="anonymous" onLoadedMetadata={handleDurationChange} />
      <audio ref={sfxAudioRef} className="hidden" crossOrigin="anonymous" />

      <header className="h-12 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
           <Film className="text-blue-500" size={20} />
           <span className="font-bold text-base tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">LAMBDA MAGIC STUDIO V.1</span>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-2 py-1">
                <Monitor size={14} className="text-blue-400" />
                <select 
                    className="bg-transparent text-xs outline-none text-gray-300"
                    value={state.resolution}
                    onChange={(e) => updateState({ resolution: e.target.value })}
                    disabled={state.isRendering}
                >
                    <option>1920x1080 (FHD)</option>
                    <option>1280x720 (HD)</option>
                    <option>3840x2160 (4K)</option>
                    <option>1080x1920 (9:16)</option>
                </select>
            </div>

            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-2 py-1">
                <Aperture size={14} className="text-green-400" />
                <select 
                    className="bg-transparent text-xs outline-none text-gray-300"
                    value={state.targetFps}
                    onChange={(e) => updateState({ targetFps: parseInt(e.target.value) })}
                    disabled={state.isRendering}
                >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                </select>
            </div>

            <button 
                onClick={handleToggleRender}
                className={`flex items-center gap-1.5 px-3 py-1 rounded border transition-all ${
                    state.isRendering 
                    ? 'bg-red-600 border-red-500 text-white animate-pulse' 
                    : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
                }`}
            >
                {state.isRendering ? (
                    <>
                        <div className="w-2 h-2 rounded-full bg-white"></div> STOP & SAVE
                    </>
                ) : (
                    <>
                         <Download size={14} /> START RENDER
                    </>
                )}
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
           <div className="flex border-b border-gray-800">
             {tabs.map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative ${
                   activeTab === tab.id ? 'text-blue-400 bg-gray-900/50' : 'text-gray-500 hover:text-gray-300'
                 }`}
               >
                 <tab.icon size={18} />
                 <span className="text-[10px] font-medium">{tab.label}</span>
                 {activeTab === tab.id && <div className="absolute bottom-0 h-0.5 w-full bg-blue-500"></div>}
               </button>
             ))}
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'Media' && <MediaTab state={state} updateState={updateState} onFileUpload={handleFileUpload} onSelectPlaylistItem={handlePlaylistItemChange} onReorderPlaylist={handleReorderPlaylist} onRemoveItem={handleRemoveItem} onMergePlaylist={handleMergePlaylist} />}
              {activeTab === 'Text' && <TextTab state={state} updateState={updateState} />}
              {activeTab === 'FX' && <FXTab state={state} updateState={updateState} />}
              {activeTab === 'EQ' && <EQTab state={state} updateState={updateState} />}
              {activeTab === 'Logo' && <LogoTab state={state} updateState={updateState} onFileUpload={handleFileUpload} />}
           </div>
        </div>

        <div className="flex-1 flex flex-col bg-gray-900 relative">
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,_#1f2937_1px,_transparent_1px)] bg-[length:20px_20px] p-4">
                <div 
                    className="relative border border-gray-800 bg-black shadow-2xl rounded-lg overflow-hidden shrink-0"
                    style={{ aspectRatio: `${canvasW}/${canvasH}`, height: 'auto', maxHeight: '100%', width: 'auto', maxWidth: '100%' }}
                >
                    <PreviewCanvas 
                        ref={canvasRef}
                        state={state} 
                        resolution={{ w: canvasW, h: canvasH }} 
                        videoRefA={videoPlayerA}
                        videoRefB={videoPlayerB}
                        audioAnalyser={analyserRef.current}
                        updateState={updateState}
                    />
                     {state.mainAudioPlaylist[state.currentAudioIndex] && (
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-blue-200 flex items-center gap-2 pointer-events-none">
                            <Music size={10} /> {state.mainAudioPlaylist[state.currentAudioIndex].name}
                            {state.isAudioTransitioning && <span className="text-yellow-400">(Mixing)</span>}
                        </div>
                    )}
                    {state.isRendering && (
                        <div className="absolute inset-0 bg-red-900/10 border-4 border-red-600/50 pointer-events-none flex items-start justify-center pt-4 z-50">
                             <div className="bg-red-600 text-white text-xs font-bold px-4 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-2">
                                 <div className="w-2 h-2 bg-white rounded-full"></div> REC ● {state.renderStatus.replace("Recording Realtime...", "")}
                             </div>
                        </div>
                    )}
                </div>
            </div>

            <Timeline 
                items={state.backgroundPlaylist} 
                currentIndex={state.currentBackgroundIndex}
                nextIndex={state.nextBackgroundIndex}
                onReorder={(from, to) => handleReorderPlaylist('video', from, to)}
                onSelect={(idx) => handlePlaylistItemChange('background', idx)}
            />

            <div className="h-16 bg-gray-950 border-t border-gray-800 px-6 flex items-center gap-4 shrink-0">
                <span className="text-xs text-blue-400 font-mono w-20 text-center">{formatTime(currentTime)} / {formatTime(duration)}</span>
                
                <div className="flex-1 h-2 bg-gray-800 rounded-full relative cursor-pointer group" onClick={handleTimelineScrub}>
                    <div className="absolute left-0 top-0 bottom-0 bg-blue-600 rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}></div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => updateState({ isPlaying: !state.isPlaying })} className={`w-10 h-10 rounded-full border flex items-center justify-center text-white transition-all ${state.isPlaying ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
                        {state.isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                    </button>
                    <div className="flex items-center gap-2 group">
                        <Volume2 size={20} className="text-gray-400 group-hover:text-white" />
                        <div className="w-20"><input type="range" min="0" max="100" value={state.masterVolume} onChange={(e) => updateState({ masterVolume: parseFloat(e.target.value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" /></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;