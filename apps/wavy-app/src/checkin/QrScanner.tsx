import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface QrScannerProps {
  onDetect: (payload: string) => void
  onClose: () => void
  // While true, frames are still captured but not decoded — used to freeze
  // scanning during an in-flight check-in submission so the same code (or a
  // different one drifting into frame) isn't fired a second time underneath it.
  paused?: boolean
}

// Renders a live camera feed and decodes QR codes from it via jsQR. Mount a
// fresh instance (e.g. via a `key` prop) to reset after a failed scan — this
// component itself only ever reports the first code it finds.
export function QrScanner({ onDetect, onClose, paused = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const hasFiredRef = useRef(false)
  const onDetectRef = useRef(onDetect)
  const pausedRef = useRef(paused)
  const [error, setError] = useState<string | null>(null)

  onDetectRef.current = onDetect
  pausedRef.current = paused

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Dieses Gerät unterstützt keinen Kamerazugriff.')
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null

    function tick() {
      frameRef.current = requestAnimationFrame(tick)
      if (hasFiredRef.current || pausedRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const result = jsQR(frame.data, frame.width, frame.height)
      if (result?.data && !hasFiredRef.current) {
        hasFiredRef.current = true
        onDetectRef.current(result.data)
      }
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          void videoRef.current.play()
        }
        frameRef.current = requestAnimationFrame(tick)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kamerazugriff wurde verweigert.')
      })

    return () => {
      cancelled = true
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // Intentionally mount-once: onDetect/paused are read via refs above so
    // that neither restarts the camera stream on every render.
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-neutral-900/80 px-3 py-1.5 text-sm text-neutral-100"
      >
        ✕ Schließen
      </button>

      {error ? (
        <p className="max-w-xs px-6 text-center text-sm text-neutral-300">{error}</p>
      ) : (
        <>
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute h-56 w-56 rounded-2xl border-2 border-cyan-400/80" />
          <p className="absolute bottom-10 px-6 text-center text-sm text-neutral-300">
            Halte den Check-in-QR-Code des Standorts vor die Kamera.
          </p>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
