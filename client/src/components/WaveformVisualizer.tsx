import { useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformVisualizerProps {
  audioUrl: string | null;
  isPlaying: boolean;
  onFinish?: () => void;
}

export function WaveformVisualizer({ audioUrl, isPlaying, onFinish }: WaveformVisualizerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
        cursorColor: 'transparent',
        barWidth: 2,
        barRadius: 3,
        barGap: 3,
        height: 40,
        normalize: true,
      });

      wavesurfer.current.on('finish', () => {
        onFinish?.();
      });

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, []);

  useEffect(() => {
    if (audioUrl && wavesurfer.current) {
      wavesurfer.current.load(audioUrl);
      if (isPlaying) {
        wavesurfer.current.play();
      }
    }
  }, [audioUrl]);

  useEffect(() => {
    if (wavesurfer.current) {
      if (isPlaying) {
        wavesurfer.current.play();
      } else {
        wavesurfer.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div className="w-full">
      <div ref={waveformRef} className="w-full" />
    </div>
  );
}
