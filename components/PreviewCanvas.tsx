import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { VJState, TextLayer, OverlayLayer } from '../types';

interface PreviewCanvasProps {
  state: VJState;
  resolution: { w: number, h: number };
  videoRefA: React.RefObject<HTMLVideoElement | null>;
  videoRefB: React.RefObject<HTMLVideoElement | null>;
  audioAnalyser: AnalyserNode | null;
  updateState: (updates: Partial<VJState>) => void;
}

interface HitArea {
  type: 'Text' | 'EQ' | 'Logo' | 'Layer';
  id?: string; // Specific ID for layers
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasHandle {
    captureFrame: (time: number) => void;
    getCanvas: () => HTMLCanvasElement | null;
}

export const PreviewCanvas = forwardRef<CanvasHandle, PreviewCanvasProps>(({ state, resolution, videoRefA, videoRefB, audioAnalyser, updateState }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fixed: Initialize with 0 to satisfy TypeScript definition expecting 1 argument
  const animationRef = useRef<number>(0);
  
  // DUAL IMAGE REFS
  const imageRefA = useRef<HTMLImageElement>(new Image());
  const imageRefB = useRef<HTMLImageElement>(new Image());
  const logoRef = useRef<HTMLImageElement>(new Image());
  
  // Overlay Layer Media Refs (Dynamic)
  const layerMediaRefs = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>(new Map());

  // Particles state
  const particlesRef = useRef<any[]>([]);
  // Buffer for audio frequency data
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Interaction State
  const hitAreasRef = useRef<HitArea[]>([]);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const [cursor, setCursor] = useState('default');

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      captureFrame: (time: number) => {
          if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) drawFrame(ctx, canvasRef.current, time);
          }
      }
  }));

  // --- PRELOAD ASSETS ---
  useEffect(() => {
    const activeItem = state.backgroundPlaylist[state.currentBackgroundIndex];
    if (activeItem && activeItem.type === 'image') {
        const targetImg = state.activeVideoSlot === 'A' ? imageRefA.current : imageRefB.current;
        if (targetImg.src !== activeItem.url) targetImg.src = activeItem.url;
    }
  }, [state.currentBackgroundIndex, state.backgroundPlaylist, state.activeVideoSlot]);

  useEffect(() => {
    const nextItem = state.backgroundPlaylist[state.nextBackgroundIndex];
    if (nextItem && nextItem.type === 'image') {
        const targetImg = state.activeVideoSlot === 'A' ? imageRefB.current : imageRefA.current;
        if (targetImg.src !== nextItem.url) targetImg.src = nextItem.url;
    }
  }, [state.nextBackgroundIndex, state.backgroundPlaylist, state.activeVideoSlot]);

  useEffect(() => {
    if (state.logoUrl) logoRef.current.src = state.logoUrl;
  }, [state.logoUrl]);

  // Sync Overlay Layer Media Elements
  useEffect(() => {
    // Remove stale refs
    for (const id of layerMediaRefs.current.keys()) {
        if (!state.overlayLayers.find(l => l.id === id)) {
            const el = layerMediaRefs.current.get(id);
            if(el instanceof HTMLVideoElement) {
                el.pause();
                el.removeAttribute('src');
                el.load();
            }
            layerMediaRefs.current.delete(id);
        }
    }

    // Add new refs
    state.overlayLayers.forEach(layer => {
        if (!layerMediaRefs.current.has(layer.id)) {
            if (layer.type === 'video') {
                const vid = document.createElement('video');
                vid.src = layer.url;
                vid.loop = true;
                vid.muted = true;
                vid.playsInline = true;
                vid.crossOrigin = "anonymous";
                layerMediaRefs.current.set(layer.id, vid);
            } else {
                const img = new Image();
                img.src = layer.url;
                layerMediaRefs.current.set(layer.id, img);
            }
        }
    });
  }, [state.overlayLayers]);

  // Handle Play/Pause for overlay videos
  useEffect(() => {
    layerMediaRefs.current.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
            if (state.isPlaying) {
                 // Try play
                 el.play().catch(e => { /* ignore */ });
            } else {
                 el.pause();
            }
        }
    });
  }, [state.isPlaying]);

  // Setup Analyser Data
  useEffect(() => {
    if (audioAnalyser) {
        const bufferLength = audioAnalyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
    }
  }, [audioAnalyser]);

  // --- MOUSE HANDLERS FOR INTERACTION ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check hit areas (Reverse order to select top-most element first)
    const hit = [...hitAreasRef.current].reverse().find(area => 
        clickX >= area.x && clickX <= area.x + area.w &&
        clickY >= area.y && clickY <= area.y + area.h
    );

    if (hit) {
        const updates: Partial<VJState> = { activeOverlay: hit.type };
        if (hit.type === 'Text' && hit.id) {
            updates.activeLayerId = hit.id;
        } else if (hit.type === 'Layer' && hit.id) {
            updates.activeOverlayLayerId = hit.id;
        }
        updateState(updates);
        isDraggingRef.current = true;
        dragStartRef.current = { x: clickX, y: clickY };
    } else {
        updateState({ activeOverlay: null, activeLayerId: null, activeOverlayLayerId: null });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Hover effect
    if (!isDraggingRef.current) {
        const hit = hitAreasRef.current.some(area => 
            mouseX >= area.x && mouseX <= area.x + area.w &&
            mouseY >= area.y && mouseY <= area.y + area.h
        );
        setCursor(hit ? 'move' : 'default');
    }

    // Drag Logic
    if (isDraggingRef.current && state.activeOverlay) {
        const deltaX = mouseX - dragStartRef.current.x;
        const deltaY = mouseY - dragStartRef.current.y;
        
        // Convert pixel delta to absolute values or percentage based on type
        // For Text, Layer, EQ, Logo -> use existing logic logic
        
        if (state.activeOverlay === 'Text' && state.activeLayerId) {
             const deltaPctX = (deltaX / canvasRef.current.width) * 100;
             const deltaPctY = (deltaY / canvasRef.current.height) * 100;
             const updatedLayers = state.textLayers.map(l => {
                 if(l.id === state.activeLayerId) {
                     return { ...l, x: l.x + deltaPctX, y: l.y + deltaPctY };
                 }
                 return l;
             });
             updateState({ textLayers: updatedLayers });
        } else if (state.activeOverlay === 'Layer' && state.activeOverlayLayerId) {
            const updatedLayers = state.overlayLayers.map(l => {
                if(l.id === state.activeOverlayLayerId) {
                    return { ...l, x: l.x + deltaX, y: l.y + deltaY };
                }
                return l;
            });
            updateState({ overlayLayers: updatedLayers });
        } else if (state.activeOverlay === 'EQ') {
            const deltaPctX = (deltaX / canvasRef.current.width) * 100;
            const deltaPctY = (deltaY / canvasRef.current.height) * 100;
            updateState({ 
                eqPosX: state.eqPosX + deltaPctX, 
                eqPosY: state.eqPosY + deltaPctY 
            });
        } else if (state.activeOverlay === 'Logo') {
            const deltaPctX = (deltaX / canvasRef.current.width) * 100;
            const deltaPctY = (deltaY / canvasRef.current.height) * 100;
            updateState({ 
                logoPosX: state.logoPosX + deltaPctX, 
                logoPosY: state.logoPosY + deltaPctY 
            });
        }

        // Reset drag start to current to avoid compounding
        dragStartRef.current = { x: mouseX, y: mouseY };
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!state.activeOverlay) return;
    
    // Determine scroll direction
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    
    if (state.activeOverlay === 'Text' && state.activeLayerId) {
        const updatedLayers = state.textLayers.map(l => {
            if(l.id === state.activeLayerId) {
                const newSize = Math.max(10, Math.min(300, l.size + (e.deltaY > 0 ? -5 : 5)));
                return { ...l, size: newSize };
            }
            return l;
        });
        updateState({ textLayers: updatedLayers });
    } else if (state.activeOverlay === 'Layer' && state.activeOverlayLayerId) {
        const updatedLayers = state.overlayLayers.map(l => {
            if (l.id === state.activeOverlayLayerId) {
                const newScale = Math.max(0.1, Math.min(5.0, l.scale + delta));
                return { ...l, scale: newScale };
            }
            return l;
        });
        updateState({ overlayLayers: updatedLayers });
    } else if (state.activeOverlay === 'EQ') {
        const newScale = Math.max(10, Math.min(200, state.eqScale + (e.deltaY > 0 ? -5 : 5)));
        updateState({ eqScale: newScale });
    } else if (state.activeOverlay === 'Logo') {
        const newSize = Math.max(0.1, Math.min(2.0, state.logoSize + delta));
        updateState({ logoSize: newSize });
    }
  };


  const drawFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
      // Clear Hit Areas for this frame
      hitAreasRef.current = [];

      // 0. Get Audio Data
      if (audioAnalyser && dataArrayRef.current) {
          audioAnalyser.getByteFrequencyData(dataArrayRef.current);
      }

      // 1. Clear Canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Background
      if (state.backgroundPlaylist.length > 0) {
          const activeItem = state.backgroundPlaylist[state.currentBackgroundIndex];
          const nextItem = state.backgroundPlaylist[state.nextBackgroundIndex];
          
          let primarySource: CanvasImageSource | null = null;
          if (activeItem) {
              if (activeItem.type === 'video') primarySource = state.activeVideoSlot === 'A' ? videoRefA.current : videoRefB.current;
              else primarySource = state.activeVideoSlot === 'A' ? imageRefA.current : imageRefB.current;
          }

          let secondarySource: CanvasImageSource | null = null;
          if (nextItem) {
               if (nextItem.type === 'video') secondarySource = state.activeVideoSlot === 'A' ? videoRefB.current : videoRefA.current;
               else secondarySource = state.activeVideoSlot === 'A' ? imageRefB.current : imageRefA.current;
          }

          if (primarySource) {
              ctx.globalAlpha = 1.0;
              drawCoverOrContain(ctx, primarySource, canvas.width, canvas.height, state.containFit, state.bgScale, state.bgPosX, state.bgPosY);
          }

          if (state.isTransitioning && secondarySource && state.seamlessFade) {
              const t = state.transitionProgress;
              const easedAlpha = -(Math.cos(Math.PI * t) - 1) / 2;
              ctx.globalAlpha = easedAlpha;
              drawCoverOrContain(ctx, secondarySource, canvas.width, canvas.height, state.containFit, state.bgScale, state.bgPosX, state.bgPosY);
              ctx.globalAlpha = 1.0;
          }
      }

      // 2.5 Draw Overlay Layers (Compositing)
      state.overlayLayers.forEach(layer => {
          if (!layer.visible) return;
          const media = layerMediaRefs.current.get(layer.id);
          if (media) {
               // Update speed for video if needed
               if (media instanceof HTMLVideoElement && media.playbackRate !== layer.speed) {
                   media.playbackRate = layer.speed;
               }
               
               // Draw the layer
               const bounds = drawLayer(ctx, media, canvas.width, canvas.height, layer);
               
               // Register Hit Area
               hitAreasRef.current.push({
                   type: 'Layer',
                   id: layer.id,
                   ...bounds
               });
          }
      });
      // Reset composite op after layers
      ctx.globalCompositeOperation = 'source-over';


      // 3. Draw FX
      if (state.activeEffect) {
        ctx.globalAlpha = state.fxOpacity / 100;
        
        // Initialize particles if needed
        if (particlesRef.current.length !== state.fxDensity) {
            particlesRef.current = [];
            for (let i = 0; i < state.fxDensity; i++) {
                particlesRef.current.push(createParticle(canvas.width, canvas.height, state.activeEffect));
            }
        }

        particlesRef.current.forEach((p, index) => {
           if (p.type !== state.activeEffect) p.type = state.activeEffect;
           updateParticle(p, canvas.width, canvas.height, state);
           drawParticle(ctx, p, state.activeEffect, state.particleColor, state);
           
           const isOffScreen = 
               p.y > canvas.height + 50 || p.y < -50 ||
               (state.fxDirection > 0 && p.x > canvas.width + 50) ||
               (state.fxDirection < 0 && p.x < -50) ||
               p.life <= 0;

           if (isOffScreen) {
               particlesRef.current[index] = createParticle(canvas.width, canvas.height, state.activeEffect);
               if (state.activeEffect === 'Rain' || state.activeEffect === 'Snow') {
                   if (state.fxDirection > 2) particlesRef.current[index].x = Math.random() * canvas.width - (canvas.width * 0.5); 
                   else if (state.fxDirection < -2) particlesRef.current[index].x = Math.random() * canvas.width + (canvas.width * 0.5);
               }
           }
        });
        ctx.globalAlpha = 1.0;
      }

      // 4. Draw EQ (Visualizer)
      if (state.eqEnabled) {
          const eqBounds = drawVisualizer(ctx, canvas, state, time, dataArrayRef.current);
          if (eqBounds) hitAreasRef.current.push({ type: 'EQ', ...eqBounds });
      }

      // 5. Draw Text (Multi-Layer)
      state.textLayers.forEach(layer => {
          if (!layer.visible || !layer.content) return;

          const x = (layer.x / 100) * canvas.width;
          const y = (layer.y / 100) * canvas.height;
          
          ctx.save();
          ctx.font = `bold ${layer.size}px ${layer.fontFamily}, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Calculate Bounding Box
          const metrics = ctx.measureText(layer.content);
          const txtW = metrics.width;
          const txtH = layer.size; // Approximate height
          
          hitAreasRef.current.push({
              type: 'Text',
              id: layer.id,
              x: x - txtW / 2,
              y: y - txtH / 2,
              w: txtW,
              h: txtH
          });

          let drawX = x;
          let drawY = y;
          
          if (layer.effectMode === 'Pulse') {
             const scale = 1 + Math.sin(time * 0.005 * layer.fxSpeed) * 0.1;
             ctx.translate(x, y);
             ctx.scale(scale, scale);
             drawX = 0; drawY = 0;
          } else if (layer.effectMode === 'Slide') {
             drawX = x + Math.sin(time * 0.002 * layer.fxSpeed) * 100;
          } else if (layer.effectMode === 'Wiggle') {
             drawX = x + (Math.random() - 0.5) * 5 * layer.fxSpeed;
             drawY = y + (Math.random() - 0.5) * 5 * layer.fxSpeed;
          }
          
          ctx.globalAlpha = layer.opacity / 100;
          drawStyledText(ctx, layer, drawX, drawY, time);
          ctx.restore();
      });

      // 6. Draw Logo
      if (state.logoUrl && logoRef.current.complete) {
          const lx = (state.logoPosX / 100) * canvas.width;
          const ly = (state.logoPosY / 100) * canvas.height;
          const baseSize = canvas.width * 0.2 * state.logoSize;
          const ratio = logoRef.current.width / (logoRef.current.height || 1);
          const lw = baseSize * (ratio > 1 ? 1 : ratio);
          const lh = baseSize / (ratio > 1 ? ratio : 1);

          ctx.save();
          ctx.globalAlpha = state.logoOpacity;
          ctx.translate(lx, ly);
          ctx.translate(-lw/2, -lh/2);
          ctx.drawImage(logoRef.current, 0, 0, lw, lh);
          ctx.restore();

          hitAreasRef.current.push({
              type: 'Logo',
              x: lx - lw/2,
              y: ly - lh/2,
              w: lw,
              h: lh
          });
      }

      // 7. Draw Selection Box (Interactive Feedback)
      if (state.activeOverlay && !state.isRendering) {
          // Find the active area based on overlay type and optional ID
          const area = hitAreasRef.current.find(a => {
              if (state.activeOverlay === 'Text') return a.id === state.activeLayerId;
              if (state.activeOverlay === 'Layer') return a.id === state.activeOverlayLayerId;
              return a.type === state.activeOverlay;
          });

          if (area) {
              ctx.save();
              ctx.strokeStyle = '#fbbf24'; // Amber-400
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(area.x - 5, area.y - 5, area.w + 10, area.h + 10);
              
              // Draw resize hint
              ctx.fillStyle = '#fbbf24';
              ctx.font = '10px monospace';
              const label = state.activeOverlay === 'Text' ? 'Text Layer' : (state.activeOverlay === 'Layer' ? 'Media Layer' : state.activeOverlay);
              ctx.fillText(`${label}`, area.x, area.y - 10);
              ctx.restore();
          }
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Standard Animation Loop (RequestAnimationFrame)
    // Run continuous loop regardless of rendering state to support Realtime capture
    const render = (time: number) => {
         drawFrame(ctx, canvas, time);
         animationRef.current = requestAnimationFrame(render);
    };
    
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [state, resolution.w, resolution.h, audioAnalyser]);

  return (
    <canvas 
        ref={canvasRef} 
        width={resolution.w} 
        height={resolution.h} 
        className="w-full h-full object-contain cursor-auto"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
    />
  );
});

// --- HELPER FUNCTIONS ---

function drawLayer(ctx: CanvasRenderingContext2D, img: CanvasImageSource, cw: number, ch: number, layer: OverlayLayer) {
    // @ts-ignore
    const iw = img.videoWidth || img.width;
    // @ts-ignore
    const ih = img.videoHeight || img.height;
    
    if (!iw || !ih) return { x:0, y:0, w:0, h:0 };

    ctx.save();
    ctx.globalCompositeOperation = layer.blendMode;
    ctx.globalAlpha = layer.opacity / 100;
    
    // Position
    const x = (cw / 2) + layer.x;
    const y = (ch / 2) + layer.y;
    
    ctx.translate(x, y);
    ctx.scale(layer.scale, layer.scale);

    // Apply Crop/Mask
    if (layer.cropShape !== 'Original') {
        ctx.beginPath();
        const size = Math.min(iw, ih);
        
        switch (layer.cropShape) {
            case '1:1':
                ctx.rect(-size/2, -size/2, size, size);
                break;
            case 'Circle':
                ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                break;
            case '3:4':
                ctx.rect(-size*0.375, -size/2, size*0.75, size);
                break;
            case '4:3':
                 ctx.rect(-size/2, -size*0.375, size, size*0.75);
                break;
            case '9:16':
                 ctx.rect(-size*0.28, -size/2, size*0.56, size);
                break;
            case '16:9':
                 ctx.rect(-size/2, -size*0.28, size, size*0.56);
                break;
        }
        ctx.clip();
    }

    // Draw centered
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();

    // Approximate bounds for hit testing (ignoring rotation/complex clip for simple hit box)
    const scaledW = iw * layer.scale;
    const scaledH = ih * layer.scale;
    return {
        x: x - scaledW/2,
        y: y - scaledH/2,
        w: scaledW,
        h: scaledH
    };
}

function drawVisualizer(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: VJState, time: number, audioData: Uint8Array | null) {
    const data = audioData || new Uint8Array(64).fill(0);
    const bufferLength = data.length;
    const bars = 40; 
    const step = Math.floor(bufferLength / bars);
    const width = canvas.width / bars;
    const centerX = (state.eqPosX / 100) * canvas.width;
    const centerY = (state.eqPosY / 100) * canvas.height;
    
    // Bounds calculation vars
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    
    ctx.save();
    ctx.globalAlpha = state.eqOpacity / 100;
    const gainMultiplier = (state.eqGain / 50); 

    if (state.eqType === 'Bars') {
        const totalW = bars * width;
        const maxH = canvas.height * 0.5 * gainMultiplier * (state.eqScale / 50);
        minX = centerX - totalW / 2;
        maxX = centerX + totalW / 2;
        minY = centerY - maxH;
        maxY = centerY;

        for (let i = 0; i < bars; i++) {
            const value = data[i * step] || 0;
            const h = (value / 255) * maxH;
            const x = centerX - (bars * width) / 2 + i * width;
            const y = centerY;
            
            ctx.fillStyle = state.eqRainbow ? `hsl(${i * 8 + time * 0.1}, 70%, 50%)` : '#10b981';
            ctx.fillRect(x, y - h, width - 2, h);
            ctx.globalAlpha = (state.eqOpacity / 100) * 0.3;
            ctx.fillRect(x, y, width - 2, h * 0.4);
            ctx.globalAlpha = state.eqOpacity / 100;
        }
    } else if (state.eqType === 'Circle') {
         ctx.translate(centerX, centerY);
         const radius = state.eqScale * 2;
         const maxExt = 150 * gainMultiplier;
         
         minX = centerX - (radius + maxExt);
         maxX = centerX + (radius + maxExt);
         minY = centerY - (radius + maxExt);
         maxY = centerY + (radius + maxExt);

         const circleBars = 60;
         const circleStep = Math.floor(bufferLength / circleBars);

         for (let i = 0; i < circleBars; i++) {
            const value = data[i * circleStep] || 0;
            const angle = (i / circleBars) * Math.PI * 2;
            const h = (value / 255) * maxExt;
            const x1 = Math.cos(angle) * radius;
            const y1 = Math.sin(angle) * radius;
            const x2 = Math.cos(angle) * (radius + h);
            const y2 = Math.sin(angle) * (radius + h);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = state.eqRainbow ? `hsl(${i * 6 + time * 0.2}, 70%, 50%)` : '#10b981';
            ctx.lineWidth = 4;
            ctx.stroke();
         }
    } else if (state.eqType === 'Wave') {
        minX = 0; maxX = canvas.width;
        minY = centerY - canvas.height/4; maxY = centerY + canvas.height/4;

        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        ctx.strokeStyle = state.eqRainbow ? `hsl(${time * 0.1}, 70%, 50%)` : '#10b981';
        ctx.lineWidth = 2;

        for(let i = 0; i < bufferLength; i++) {
             const v = data[i] / 128.0; 
             const y = (v * canvas.height/4) * gainMultiplier + (centerY - canvas.height/4); 
             if(i === 0) ctx.moveTo(x, y);
             else ctx.lineTo(x, y);
             x += sliceWidth;
        }
        ctx.stroke();
    } else if (state.eqType === 'Shimmer') {
        const totalW = bars * width * 1.5;
        minX = centerX - totalW / 2;
        maxX = centerX + totalW / 2;
        minY = centerY - canvas.height * 0.8 * gainMultiplier;
        maxY = centerY;

        ctx.shadowBlur = 15;
        for (let i = 0; i < bars; i++) {
            const value = data[i * step] || 0;
            if (value < 50) continue; 
            const normalized = value / 255;
            const h = normalized * canvas.height * 0.8 * gainMultiplier * (state.eqScale / 50);
            const x = centerX - totalW / 2 + i * (width * 1.5);
            const y = centerY;
            const hue = state.eqRainbow ? (i * 10 + time * 0.2) % 360 : 180; 
            ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
            ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${normalized})`;

            ctx.beginPath();
            ctx.roundRect(x, y - h, width, h, width/2);
            ctx.fill();

            if (value > 200) {
                 ctx.shadowBlur = 0;
                 ctx.fillStyle = '#ffffff';
                 ctx.beginPath();
                 ctx.arc(x + width/2, y - h - 5, 2, 0, Math.PI*2);
                 ctx.fill();
                 ctx.shadowBlur = 15;
            }
        }
        ctx.shadowBlur = 0;
    }
    
    ctx.restore();
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function drawStyledText(ctx: CanvasRenderingContext2D, layer: TextLayer, x: number, y: number, time: number) {
    const text = layer.content;
    const style = layer.style;
    const primaryColor = layer.textColor;
    const secondaryColor = layer.styleColor || '#000000';
    const amount = layer.styleAmount; 
    const offset = layer.styleOffset; 

    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = primaryColor;
    
    // Reset Shadows
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    switch (style) {
        case 'Shadow Soft':
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = amount * 0.5; 
            ctx.shadowOffsetX = (offset - 50) * 0.4;
            ctx.shadowOffsetY = (offset - 50) * 0.4;
            ctx.fillText(text, x, y);
            break;
        case 'Shadow Hard': {
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 0;
            const dist = amount * 0.2;
            ctx.shadowOffsetX = dist;
            ctx.shadowOffsetY = dist;
            ctx.fillText(text, x, y);
            break;
        }
        case 'Long Shadow': {
            ctx.fillStyle = secondaryColor;
            const len = amount; 
            const stepX = (offset - 50) * 0.05;
            const stepY = Math.abs(offset - 50) * 0.05 + 0.5; 
            for(let i=len; i>0; i--) {
                ctx.fillText(text, x + (i*stepX), y + (i*stepY));
            }
            ctx.fillStyle = primaryColor;
            ctx.fillText(text, x, y);
            break;
        }
        case 'Lift':
            ctx.shadowColor = 'black';
            ctx.shadowBlur = amount * 0.3;
            ctx.shadowOffsetY = offset * 0.5;
            ctx.fillText(text, x, y);
            break;
        case 'Hollow':
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = Math.max(1, amount * 0.1);
            ctx.strokeText(text, x, y);
            break;
        case 'Splice':
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 1000, y - 1000, 2000, 1000); 
            ctx.clip();
            ctx.fillText(text, x - (offset * 0.2), y);
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 1000, y, 2000, 1000); 
            ctx.clip();
            ctx.fillStyle = secondaryColor;
            ctx.fillText(text, x + (offset * 0.2), y);
            ctx.restore();
            break;
        case 'Glitch': {
            const shake = amount * 0.1;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = '#ff0000';
            ctx.fillText(text, x + (Math.random() - 0.5) * shake, y + (Math.random() - 0.5) * shake);
            ctx.fillStyle = '#0000ff';
            ctx.fillText(text, x - (Math.random() - 0.5) * shake, y - (Math.random() - 0.5) * shake);
            ctx.restore();
            ctx.fillStyle = primaryColor;
            ctx.fillText(text, x, y);
            if (Math.random() > 0.8) {
                const h = 5 + Math.random() * 20;
                const sliceY = y - 50 + Math.random() * 100;
                const shift = (Math.random() - 0.5) * 50;
                ctx.save();
                ctx.beginPath();
                ctx.rect(x - 500, sliceY, 1000, h);
                ctx.clip();
                ctx.clearRect(x-500, sliceY, 1000, h);
                ctx.fillText(text, x + shift, y);
                ctx.restore();
            }
            break;
        }
        case 'Neon': {
            ctx.shadowColor = secondaryColor;
            const glowBase = amount * 0.5;
            ctx.shadowBlur = glowBase;
            ctx.strokeText(text, x, y);
            ctx.shadowBlur = glowBase * 2;
            ctx.strokeText(text, x, y);
            ctx.shadowBlur = glowBase * 3;
            ctx.fillStyle = 'white';
            ctx.fillText(text, x, y);
            break;
        }
        case 'Echo': {
            const count = Math.floor(amount / 10) + 1;
            const echoDist = offset * 0.5;
            for(let i=count; i>0; i--) {
                ctx.globalAlpha = (1.0 / i) * (layer.opacity / 100);
                ctx.fillStyle = secondaryColor;
                ctx.fillText(text, x + (i * echoDist), y);
            }
            ctx.globalAlpha = layer.opacity / 100;
            ctx.fillStyle = primaryColor;
            ctx.fillText(text, x, y);
            break;
        }
        case 'Background': {
            const metrics = ctx.measureText(text);
            const padding = amount * 0.5;
            const h = layer.size; 
            const w = metrics.width;
            ctx.fillStyle = secondaryColor;
            ctx.fillRect(x - w/2 - padding, y - h/2 - padding, w + padding*2, h + padding*2);
            ctx.fillStyle = primaryColor;
            ctx.fillText(text, x, y);
            break;
        }
        case 'Curve': {
            const radius = 100 + (amount * 5);
            const spacing = offset * 0.05; 
            ctx.save();
            const len = text.length;
            const totalArc = len * 0.1; 
            ctx.translate(x, y + radius); 
            ctx.rotate(-totalArc / 2);
            for(let i=0; i<len; i++) {
                ctx.save();
                ctx.translate(0, -radius);
                ctx.fillText(text[i], 0, 0);
                ctx.restore();
                ctx.rotate(0.1 + (spacing * 0.01));
            }
            ctx.restore();
            break;
        }
        case 'Duotone': {
            const grad = ctx.createLinearGradient(x, y - layer.size/2, x, y + layer.size/2);
            grad.addColorStop(0, primaryColor);
            grad.addColorStop(1, secondaryColor);
            ctx.fillStyle = grad;
            ctx.fillText(text, x, y);
            break;
        }
        case 'Melt': {
             ctx.fillStyle = primaryColor;
             ctx.fillText(text, x, y);
             const dripCount = Math.floor(amount / 5);
             ctx.fillStyle = primaryColor;
             for(let i=0; i<dripCount; i++) {
                 const rand = Math.sin(i * 132.1 + time * 0.001); 
                 const dx = x + (rand * (layer.size * text.length * 0.3));
                 const len = Math.abs(Math.sin(i * 54.3 + time * 0.002)) * (layer.size * 1.5);
                 ctx.beginPath();
                 ctx.arc(dx, y + 10, 2 + amount * 0.05, 0, Math.PI);
                 ctx.rect(dx - (2 + amount*0.05), y+10, (2+amount*0.05)*2, len);
                 ctx.arc(dx, y + 10 + len, 4 + amount * 0.05, 0, Math.PI * 2);
                 ctx.fill();
             }
             break;
        }
        case 'Glossy': {
             ctx.fillStyle = primaryColor;
             ctx.fillText(text, x, y);
             ctx.globalCompositeOperation = 'source-atop';
             const shineGrad = ctx.createLinearGradient(x, y - layer.size, x, y + layer.size);
             shineGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
             shineGrad.addColorStop(0.49, 'rgba(255,255,255,0.1)');
             shineGrad.addColorStop(0.5, 'rgba(0,0,0,0.2)');
             shineGrad.addColorStop(1, 'rgba(0,0,0,0)');
             ctx.fillStyle = shineGrad;
             ctx.fillText(text, x, y);
             ctx.globalCompositeOperation = 'source-over';
             ctx.strokeStyle = 'white';
             ctx.lineWidth = 1;
             ctx.strokeText(text, x, y);
             break;
        }
        default:
            ctx.fillText(text, x, y);
    }
}

function drawCoverOrContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource, cw: number, ch: number, contain: boolean, scale: number, offX: number, offY: number) {
    // @ts-ignore
    const iw = img.videoWidth || img.width;
    // @ts-ignore
    const ih = img.videoHeight || img.height;
    if (!iw || !ih) return;

    const fitScale = contain ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    const nw = iw * fitScale;
    const nh = ih * fitScale;

    ctx.save();
    ctx.translate(cw / 2 + offX, ch / 2 + offY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -nw / 2, -nh / 2, nw, nh);
    ctx.restore();
}

function getRandomColor() {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getAutumnColor() {
    const colors = ['#d97706', '#b45309', '#78350f', '#f59e0b', '#dc2626'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createParticle(w: number, h: number, type: string | null) {
    const z = Math.random() * 0.8 + 0.2; 
    return {
        x: Math.random() * w,
        y: Math.random() * h,
        z: z,
        speed: (Math.random() * 5 + 5) * z,
        size: (Math.random() * 5 + 2) * z,
        vx: (Math.random() * 2 - 1) * z,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        life: 100,
        type,
        color: type === 'Party' ? getRandomColor() : (type === 'Autumn' ? getAutumnColor() : null)
    };
}

function updateParticle(p: any, w: number, h: number, state: VJState) {
    const speedMultiplier = state.fxParamSpeed;
    let windForce = state.fxDirection; 
    const effectiveWind = windForce * p.z;
    p.angle += p.rotationSpeed * speedMultiplier;

    if (state.activeEffect === 'Rain') {
        p.y += p.speed * 4 * speedMultiplier; 
        p.x += (p.vx + effectiveWind * 2) * speedMultiplier; 
    } else if (state.activeEffect === 'Snow') {
        p.y += p.speed * 0.5 * speedMultiplier;
        p.x += (Math.sin(p.y * 0.05) + effectiveWind * 0.5) * speedMultiplier;
    } else if (state.activeEffect === 'Mist') {
        p.x += (p.vx + effectiveWind) * 0.5 * speedMultiplier;
        p.y += (p.vx * 0.2) * speedMultiplier; 
    } else if (['Sakura', 'Autumn', 'Party'].includes(state.activeEffect || '')) {
        p.y += p.speed * 0.5 * speedMultiplier;
        p.x += (Math.sin(p.y * 0.02 + p.angle) + effectiveWind) * speedMultiplier;
    } else if (state.activeEffect === 'Bubble') {
        p.y -= p.speed * speedMultiplier;
        p.x += (Math.sin(p.y * 0.1) + effectiveWind) * 0.5;
    } else {
        p.y -= p.speed * 0.5 * speedMultiplier;
        p.x += (p.vx + effectiveWind) * speedMultiplier;
    }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: any, type: string | null, globalColor: string, state: VJState) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const scale = (state.fxSize || 1.0) * p.z;
    ctx.scale(scale, scale);

    if (p.color) {
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
    } else {
        ctx.fillStyle = globalColor;
        ctx.strokeStyle = globalColor;
    }

    if (type === 'Rain') {
        const wind = state.fxDirection * 2;
        const angle = Math.atan2(p.speed * 4, wind);
        ctx.rotate(Math.PI / 2 - angle);
        ctx.globalAlpha = (state.fxOpacity / 100) * p.z * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const length = p.speed * 3; 
        ctx.lineTo(0, length);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = state.particleColor === '#ffffff' ? 'rgba(174, 194, 224, 0.8)' : state.particleColor;
        ctx.stroke();
    } else {
        ctx.rotate(p.angle);
        if (type === 'Snow') {
            const grad = ctx.createRadialGradient(0,0,0,0,0,p.size/2);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'Sakura') {
            ctx.fillStyle = '#fbcfe8'; 
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fce7f3';
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'Autumn') {
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.quadraticCurveTo(p.size, 0, 0, p.size);
            ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
            ctx.fill();
            ctx.stroke();
        } else if (type === 'Orbs') {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
            gradient.addColorStop(0, globalColor);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'Hex') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(p.size * Math.cos(i * Math.PI / 3), p.size * Math.sin(i * Math.PI / 3));
            }
            ctx.closePath();
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha *= 0.3;
            ctx.fill();
            ctx.globalAlpha /= 0.3;
        } else if (type === 'Firefly') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#facc15'; 
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (type === 'Star') {
            ctx.beginPath();
            for(let i=0; i<5; i++){
                ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*p.size, -Math.sin((18+i*72)/180*Math.PI)*p.size);
                ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*p.size/2, -Math.sin((54+i*72)/180*Math.PI)*p.size/2);
            }
            ctx.closePath();
            ctx.fillStyle = '#facc15';
            ctx.fill();
        } else if (type === 'Bubble') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.strokeStyle = '#a5b4fc';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-p.size*0.3, -p.size*0.3, p.size*0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fill();
        } else if (type === 'Party') {
            ctx.fillRect(-p.size, -p.size/2, p.size*2, p.size);
        } else if (type === 'Notes') {
            ctx.font = `${p.size * 2}px Arial`;
            ctx.fillStyle = '#c084fc';
            ctx.fillText('♪', 0, 0);
        } else if (type === 'Mist') {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 10);
            gradient.addColorStop(0, 'rgba(200,200,200,0.1)');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 10, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        }
    }
    ctx.restore();
}