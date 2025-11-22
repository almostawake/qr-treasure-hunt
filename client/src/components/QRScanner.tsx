import { useState } from 'react'
import { Box, Typography, AppBar, Toolbar, IconButton, Alert } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { Scanner } from '@yudiel/react-qr-scanner'

export const QRScanner = () => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleScan = (result: string) => {
    if (result) {
      // Check if it's a valid URL
      try {
        const url = new URL(result)
        // Navigate to the scanned URL
        window.location.href = url.toString()
      } catch {
        // If it's not a valid URL, try treating it as a relative path
        if (result.startsWith('/')) {
          navigate(result)
        } else {
          setError('Scanned QR code does not contain a valid URL')
          setTimeout(() => setError(null), 3000)
        }
      }
    }
  }

  const handleError = (err: Error) => {
    console.error('QR Scanner error:', err)
    setError(`Camera error: ${err.message}`)
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'white',
          color: 'black',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate(-1)}
            aria-label="back"
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Scan QR Code
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          backgroundColor: '#000',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 600 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            width: '100%',
            maxWidth: 600,
            aspectRatio: '1',
            overflow: 'hidden',
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          <Scanner
            onScan={(result) => {
              if (result && result.length > 0) {
                handleScan(result[0].rawValue)
              }
            }}
            onError={handleError}
            constraints={{
              facingMode: 'environment',
            }}
            styles={{
              container: {
                width: '100%',
                height: '100%',
              },
            }}
          />
        </Box>

        <Typography
          variant="body2"
          sx={{ mt: 3, color: 'white', textAlign: 'center' }}
        >
          Position the QR code within the frame
        </Typography>
      </Box>
    </Box>
  )
}
