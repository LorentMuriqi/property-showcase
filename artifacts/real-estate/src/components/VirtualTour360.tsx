import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import { Maximize, Minimize, Map as MapIcon, X } from 'lucide-react';

interface VirtualTour360Props {
  scenes: Array<{
    id: number;
    title: string;
    imageUrl: string;
    thumbnailUrl?: string | null;
    isDefault: boolean;
    sortOrder: number;
    positionX?: number | null;
    positionY?: number | null;
    hotspots: Array<{
      id: number;
      fromSceneId: number;
      toSceneId: number;
      yaw: number;
      pitch: number;
      label?: string | null;
    }>;
  }>;
  defaultSceneId?: number | null;
  onClose?: () => void;
}

export function VirtualTour360({ scenes, defaultSceneId, onClose }: VirtualTour360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<number | null>(defaultSceneId || scenes.find(s => s.isDefault)?.id || scenes[0]?.id || null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasMap = scenes.some(s => s.positionX != null && s.positionY != null);

  useEffect(() => {
    if (!containerRef.current || scenes.length === 0) return;

    const viewer = new Viewer({
      container: containerRef.current,
      panorama: scenes.find(s => s.id === currentSceneId)?.imageUrl || scenes[0].imageUrl,
      caption: scenes.find(s => s.id === currentSceneId)?.title || scenes[0].title,
      navbar: ['autorotate', 'zoom', 'caption', 'fullscreen'],
      defaultYaw: 0,
      defaultPitch: 0,
      plugins: [
        [VirtualTourPlugin, {
          positionMode: 'manual',
          renderMode: '3d',
          nodes: scenes.map(scene => ({
            id: String(scene.id),
            panorama: scene.imageUrl,
            thumbnail: scene.thumbnailUrl || scene.imageUrl,
            name: scene.title,
            links: scene.hotspots.map(hotspot => ({
              nodeId: String(hotspot.toSceneId),
              yaw: hotspot.yaw,
              pitch: hotspot.pitch,
              name: hotspot.label || undefined,
            }))
          }))
        }],
        [MarkersPlugin, {}]
      ]
    });

    viewerRef.current = viewer;

    const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;
    
    vtPlugin.setNodes(scenes.map(scene => ({
      id: String(scene.id),
      panorama: scene.imageUrl,
      thumbnail: scene.thumbnailUrl || scene.imageUrl,
      name: scene.title,
      links: scene.hotspots.map(hotspot => ({
        nodeId: String(hotspot.toSceneId),
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        name: hotspot.label || undefined,
      }))
    })), String(currentSceneId));

    viewer.addEventListener('ready', () => {
      viewer.navbar.hide();
    }, { once: true });

    vtPlugin.addEventListener('node-changed', ({ node }: any) => {
      setCurrentSceneId(Number(node.id));
    });

    return () => {
      viewer.destroy();
    };
  }, [scenes]);

  const handleSceneChange = (id: number) => {
    if (viewerRef.current) {
      const vtPlugin = viewerRef.current.getPlugin(VirtualTourPlugin) as any;
      vtPlugin.setCurrentNode(String(id));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (scenes.length === 0) {
    return <div className="w-full h-full flex items-center justify-center bg-black text-white">Asnjë skenë e disponueshme.</div>;
  }

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col bg-black overflow-hidden font-sans group">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 hover:bg-primary text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md"
        >
          <X size={20} />
        </button>
      )}

      {/* Main Viewer */}
      <div ref={containerRef} className="w-full h-full flex-1" />

      {/* Custom Title overlay */}
      <div className="absolute top-6 left-6 z-40 bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 pointer-events-none">
        <h2 className="text-white font-display text-xl">{scenes.find(s => s.id === currentSceneId)?.title || 'Tur 360°'}</h2>
      </div>

      {/* Controls */}
      <div className="absolute bottom-24 right-6 z-40 flex flex-col gap-3">
        {hasMap && (
          <button 
            onClick={() => setShowMap(!showMap)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg ${showMap ? 'bg-primary text-black' : 'bg-black/50 text-white hover:bg-black/70'}`}
            title="Plani i Katit"
          >
            <MapIcon size={20} />
          </button>
        )}
        <button 
          onClick={toggleFullscreen}
          className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {/* Map Overlay */}
      {hasMap && (
        <div className={`absolute bottom-24 right-20 z-40 w-64 h-48 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 transform origin-bottom-right ${showMap ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
          <div className="w-full h-full relative border border-white/5 rounded-xl overflow-hidden bg-white/5" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
            {scenes.filter(s => s.positionX != null && s.positionY != null).map(scene => (
              <button
                key={scene.id}
                onClick={() => handleSceneChange(scene.id)}
                className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 transition-all ${currentSceneId === scene.id ? 'bg-primary border-white scale-125 z-10' : 'bg-white border-transparent hover:scale-110'}`}
                style={{ left: `${scene.positionX}%`, top: `${scene.positionY}%` }}
                title={scene.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* Thumbnails */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-4 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex gap-2 overflow-x-auto max-w-full pb-2 hide-scrollbar">
          {scenes.map(scene => (
            <button
              key={scene.id}
              onClick={() => handleSceneChange(scene.id)}
              className={`relative shrink-0 w-24 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentSceneId === scene.id ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              <img src={scene.thumbnailUrl || scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-end p-1">
                <span className="text-[10px] text-white font-medium truncate drop-shadow-md">{scene.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .psv-virtual-tour-link {
          color: #D4AF37 !important;
        }
      `}} />
    </div>
  );
}
