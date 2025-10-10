import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  ToggleButtonGroup,
  ToggleButton,
  Button,
} from '@mui/material'
import { QrCodeScanner as QrCodeScannerIcon } from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { useHuntService } from '../hooks/HuntService'
import type { Hunt, Clue } from '../types'

export const CluePage = () => {
  const { huntId, clueId } = useParams<{ huntId: string; clueId: string }>()
  const navigate = useNavigate()
  const huntService = useHuntService()

  const [hunt, setHunt] = useState<Hunt | null>(null)
  const [clue, setClue] = useState<Clue | null>(null)
  const [clues, setClues] = useState<Clue[]>([])
  const [currentView, setCurrentView] = useState<'clue' | 'hint' | 'media'>(
    'clue'
  )
  const [mediaDisplayUrl, setMediaDisplayUrl] = useState<string | null>(null)

  // Resolve storage path to URL dynamically
  useEffect(() => {
    const resolveMediaUrl = async () => {
      if (!clue?.mediaUrl) {
        setMediaDisplayUrl(null)
        return
      }

      // If it's already a full URL (old format), use it directly
      if (clue.mediaUrl.startsWith('http://') || clue.mediaUrl.startsWith('https://')) {
        setMediaDisplayUrl(clue.mediaUrl)
        return
      }

      // It's a storage path - resolve it dynamically
      try {
        const { getFirebaseServices } = await import('../hooks/ApplicationState')
        const { storage } = await getFirebaseServices()
        const { ref, getDownloadURL } = await import('firebase/storage')
        const storageRef = ref(storage, clue.mediaUrl)
        const url = await getDownloadURL(storageRef)
        setMediaDisplayUrl(url)
      } catch {
        // If resolution fails, set to null
        setMediaDisplayUrl(null)
      }
    }

    resolveMediaUrl()
  }, [clue?.mediaUrl])

  const handleScanNext = () => {
    // Create file input to trigger camera
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.capture = 'environment' // Use rear camera for QR scanning
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // TODO: Process QR code from image
        // For now, just show that we got the image
        alert(`QR image captured: ${file.name}`)
      }
    }
    fileInput.click()
  }

  useEffect(() => {
    if (!huntId || !clueId) {
      navigate('/')
      return
    }

    // Add this hunt to known hunts when accessed via QR/link
    const addToKnownHunts = async () => {
      const { LocalHuntStorage } = await import('../hooks/LocalHuntStorage')
      LocalHuntStorage.addKnownHuntId(huntId)
    }
    addToKnownHunts()

    const setupSubscriptions = async () => {
      // Subscribe to hunt changes
      const huntUnsubscribe = await huntService.subscribeToHunts((hunts) => {
        const currentHunt = hunts.find((h) => h.id === huntId)
        if (currentHunt) {
          setHunt(currentHunt)
        } else {
          // Hunt doesn't exist - remove from known hunts and redirect
          const removeAndRedirect = async () => {
            const { LocalHuntStorage } = await import(
              '../hooks/LocalHuntStorage'
            )
            LocalHuntStorage.removeKnownHuntId(huntId)
            navigate('/')
          }
          removeAndRedirect()
        }
      })

      // Subscribe to clues changes
      const cluesUnsubscribe = await huntService.subscribeToClues(
        huntId,
        (clues) => {
          setClues(clues)
          const currentClue = clues.find((c) => c.id === clueId)
          if (currentClue) {
            setClue(currentClue)
          }
        }
      )

      return { huntUnsubscribe, cluesUnsubscribe }
    }

    let unsubscribes:
      | { huntUnsubscribe: () => void; cluesUnsubscribe: () => void }
      | undefined

    setupSubscriptions().then((unsubs) => {
      unsubscribes = unsubs
    })

    return () => {
      if (unsubscribes) {
        unsubscribes.huntUnsubscribe()
        unsubscribes.cluesUnsubscribe()
      }
    }
  }, [huntId, clueId, huntService, navigate])

  if (!hunt || !clue) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading clue...</Typography>
      </Box>
    )
  }

  // Find clue number in the sequence
  const clueNumber =
    hunt.clueOrder.indexOf(clueId || '') + 1 ||
    clues.findIndex((c) => c.id === clueId) + 1

  const totalClues = hunt.clueOrder.length || clues.length

  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    newView: 'clue' | 'hint' | 'media' | null
  ) => {
    if (newView !== null) {
      setCurrentView(newView)
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Always show hunt name and progress */}
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'white',
          color: 'black',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {hunt.displayName}
          </Typography>

          <Box
            sx={{
              backgroundColor: 'grey.700',
              color: 'white',
              borderRadius: 2,
              px: 2,
              py: 0.5,
              fontSize: '0.875rem',
              fontWeight: 500,
              minWidth: 'fit-content',
            }}
          >
            {clueNumber} of {totalClues}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 3, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* View Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ToggleButtonGroup
            value={currentView}
            exclusive
            onChange={handleViewChange}
            aria-label="content view"
            sx={{
              '& .MuiToggleButton-root': {
                px: { xs: 2, sm: 3 },
                py: 1,
                fontSize: '0.9rem',
                fontWeight: 500,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="clue" aria-label="show clue">
              Clue
            </ToggleButton>
            <ToggleButton
              value="hint"
              aria-label="show hint"
              disabled={!clue.hint || clue.hint.trim() === ''}
            >
              Hint
            </ToggleButton>
            <ToggleButton
              value="media"
              aria-label="show media"
              disabled={!clue.mediaUrl}
            >
              Media
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Content Area */}
        <Paper
          sx={{
            p: { xs: 3, sm: 4 },
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '50vh',
          }}
        >
          {currentView === 'clue' && (
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                fontWeight: 500,
                lineHeight: 1.3,
                maxWidth: '100%',
                wordWrap: 'break-word',
              }}
            >
              {clue.text || 'No clue text yet...'}
            </Typography>
          )}

          {currentView === 'hint' && (
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                fontWeight: 500,
                lineHeight: 1.3,
                maxWidth: '100%',
                wordWrap: 'break-word',
                color: 'text.primary',
              }}
            >
              {clue.hint || 'No hint available for this clue.'}
            </Typography>
          )}

          {currentView === 'media' && (
            <>
              {mediaDisplayUrl ? (
                clue.mediaType === 'image' ? (
                  <img
                    src={mediaDisplayUrl}
                    alt="Clue media hint"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  />
                ) : (
                  <video
                    src={mediaDisplayUrl}
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  />
                )
              ) : (
                <Typography
                  variant="h6"
                  sx={{
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  }}
                >
                  No media available for this clue.
                </Typography>
              )}
            </>
          )}
        </Paper>

        {/* Scan Next QR Code Button */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<QrCodeScannerIcon />}
            onClick={handleScanNext}
            sx={{
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              borderRadius: 3,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-1px)',
              },
            }}
          >
            Scan Next QR Code
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
