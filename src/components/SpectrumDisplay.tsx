import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Spettro in tempo reale + indicatore di battito. Legge i dati da un
 * AnalyserNode del deck (solo file locali: YouTube non passa dal grafico Web
 * Audio, stesso limite di sempre). Il "battito" è calcolato dal BPM/fase
 * stimati offline (bpmDetect.ts), non da un'analisi live: è una stima, non
 * un vero beat-tracking in tempo reale.
 */
export function SpectrumDisplay({
  analyser,
  color,
  bpm,
  phase,
  currentTime,
  playbackRate,
}: {
  analyser: AnalyserNode | null;
  color: string;
  bpm: number | null;
  phase: number | null;
  currentTime: number;
  playbackRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const data = new Uint8Array(bufferLength);

    function draw() {
      const { width, height } = canvas!.getBoundingClientRect();
      canvas!.width = width * window.devicePixelRatio;
      canvas!.height = height * window.devicePixelRatio;
      ctx2d!.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx2d!.clearRect(0, 0, width, height);

      if (analyser) {
        analyser.getByteFrequencyData(data);
      } else {
        data.fill(0);
      }

      const barCount = 28;
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = data[dataIndex] / 255;
        const barHeight = value * height;
        ctx2d!.fillStyle = color;
        ctx2d!.globalAlpha = 0.25 + value * 0.75;
        ctx2d!.fillRect(i * barWidth + 1, height - barHeight, barWidth - 2, barHeight);
      }
      ctx2d!.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, color]);

  // Progresso nel battito corrente (0..1): usato per il lampo del pallino
  let beatProgress: number | null = null;
  if (bpm && phase != null) {
    const interval = 60 / bpm / Math.max(0.1, playbackRate);
    const raw = (currentTime - phase) % interval;
    const normalized = raw < 0 ? raw + interval : raw;
    beatProgress = normalized / interval;
  }
  const pulse = beatProgress != null && beatProgress < 0.15;

  return (
    <Box display="flex" alignItems="center" gap={1} mb={1}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          background: pulse ? color : '#181b20',
          border: `1px solid ${color}`,
          transition: 'background 40ms',
        }}
      />
      <Box
        sx={{
          flex: 1,
          height: 36,
          borderRadius: 1,
          overflow: 'hidden',
          background: '#0c0d10',
          border: '1px solid #24272e',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </Box>
      {!analyser && (
        <Typography variant="caption" sx={{ opacity: 0.4, fontSize: 9, whiteSpace: 'nowrap' }}>
          solo file locali
        </Typography>
      )}
    </Box>
  );
}
