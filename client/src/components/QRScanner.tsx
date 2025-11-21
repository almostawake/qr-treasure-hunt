import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'

interface QRScannerProps {
  open: boolean
  onClose: () => void
  onScanSuccess: (url: string) => void
}

export const QRScanner = ({ open, onClose, onScanSuccess }: QRScannerProps) => {
  const [scanning, setScanning] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerId = 'qr-scanner'

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      // Stop scanning immediately
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null
            setScanning(false)
            setCameraActive(false)
            onScanSuccess(decodedText)
            onClose()
          })
          .catch(() => {
            scannerRef.current = null
            setScanning(false)
            setCameraActive(false)
            onScanSuccess(decodedText)
            onClose()
          })
      } else {
        setCameraActive(false)
        onScanSuccess(decodedText)
        onClose()
      }
    },
    [onScanSuccess, onClose]
  )

  useEffect(() => {
    if (!open) {
      // Cleanup when dialog closes
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null
          })
          .catch(() => {
            // Ignore errors during cleanup
            scannerRef.current = null
          })
      }
      setScanning(false)
      setError(null)
      setCameraActive(false)
      return
    }

    // Start scanning when dialog opens
    const startScanning = async () => {
      try {
        setError(null)
        setScanning(true)

        // Check if we're in a secure context (HTTPS or localhost)
        const isSecureContext =
          window.isSecureContext ||
          window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'

        if (!isSecureContext) {
          throw new Error(
            'Camera access requires HTTPS. Please access the app via HTTPS or localhost. ' +
              'In development, Vite should serve over HTTPS automatically.'
          )
        }

        // Check if camera is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Camera API not available. Your browser may not support camera access.'
          )
        }

        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        // Configuration for better mobile support
        const config = {
          fps: 10, // Frames per second - lower for better performance
          qrbox: { width: 250, height: 250 }, // Scanning area
          aspectRatio: 1.0, // Square aspect ratio
        }

        await scanner.start(
          { facingMode: 'environment' }, // Use rear camera
          config,
          (decodedText) => {
            // QR code detected
            handleScanSuccess(decodedText)
          },
          () => {
            // Ignore continuous scanning errors - only show initial errors
            // These are normal when scanning continuously
          }
        )

        // Camera started successfully - hide loading indicator and mark camera as active
        setScanning(false)
        setCameraActive(true)
      } catch (err) {
        let errorMessage: string
        if (err instanceof Error) {
          errorMessage = err.message
        } else if (typeof err === 'string') {
          errorMessage = err
        } else {
          errorMessage =
            'Failed to start camera. Please ensure camera permissions are granted and you are accessing the app via HTTPS or localhost.'
        }

        // Check for specific error types
        if (
          errorMessage.includes('Permission denied') ||
          errorMessage.includes('permission')
        ) {
          errorMessage =
            'Camera permission denied. Please allow camera access in your browser settings and try again.'
        } else if (
          errorMessage.includes('NotFoundError') ||
          errorMessage.includes('no camera')
        ) {
          errorMessage =
            'No camera found. Please ensure your device has a camera and try again.'
        }

        setError(errorMessage)
        setScanning(false)
        scannerRef.current = null
      }
    }

    startScanning()

    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null
          })
          .catch(() => {
            scannerRef.current = null
          })
      }
    }
  }, [open, handleScanSuccess])

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null
          setScanning(false)
          setCameraActive(false)
          onClose()
        })
        .catch(() => {
          scannerRef.current = null
          setScanning(false)
          setCameraActive(false)
          onClose()
        })
    } else {
      setCameraActive(false)
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'black',
          minHeight: '60vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', minHeight: '60vh' }}>
        {/* Close button */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Scanner container */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Scanner element */}
          <Box
            id={scannerId}
            sx={{
              width: '100%',
              minHeight: '60vh',
              '& video': {
                width: '100%',
                height: 'auto',
              },
            }}
          />

          {/* Loading/Error overlay */}
          {scanning && !error && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: 3,
                borderRadius: 2,
              }}
            >
              <CircularProgress size={40} sx={{ color: 'white' }} />
              <Typography variant="body1" sx={{ color: 'white' }}>
                Scanning for QR code...
              </Typography>
            </Box>
          )}

          {error && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 3,
                borderRadius: 2,
                maxWidth: '80%',
              }}
            >
              <Typography
                variant="body1"
                sx={{ color: 'white', textAlign: 'center' }}
              >
                {error}
              </Typography>
            </Box>
          )}

          {/* Instructions overlay - show when camera is active */}
          {!error && cameraActive && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: 2,
                borderRadius: 2,
                maxWidth: '90%',
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: 'white', textAlign: 'center' }}
              >
                Point your camera at the QR code
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
