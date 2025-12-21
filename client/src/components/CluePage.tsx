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
  const [currentView, setCurrentView] = useState<'clue' | 'hint' | 'media'>(
    'clue'
  )
  const [mediaDisplayUrl, setMediaDisplayUrl] = useState<string | null>(null)

  // Resolve storage path to URL using cache
  useEffect(() => {
    let currentMediaUrl = clue?.mediaUrl

    const resolveMediaUrl = async () => {
      if (!currentMediaUrl) {
        setMediaDisplayUrl(null)
        return
      }

      // If it's already a full URL (old format), use it directly
      if (currentMediaUrl.startsWith('http://') || currentMediaUrl.startsWith('https://')) {
        setMediaDisplayUrl(currentMediaUrl)
        return
      }

      // It's a storage path - resolve it using cache
      try {
        const { getFirebaseServices } = await import('../hooks/ApplicationState')
        const { storageCache } = await getFirebaseServices()
        const url = await storageCache.getFileUrl(currentMediaUrl)
        setMediaDisplayUrl(url)
      } catch (error) {
        // If resolution fails, set to null
        console.error('Failed to resolve media URL:', currentMediaUrl, error)
        setMediaDisplayUrl(null)
      }
    }

    resolveMediaUrl()

    // Cleanup: revoke object URL when component unmounts or mediaUrl changes
    return () => {
      if (currentMediaUrl && !currentMediaUrl.startsWith('http')) {
        import('../hooks/ApplicationState').then(({ getFirebaseServices }) => {
          getFirebaseServices().then(({ storageCache }) => {
            storageCache.revokeFileUrl(currentMediaUrl)
          })
        })
      }
    }
  }, [clue?.mediaUrl])

  const handleScanNext = () => {
    navigate('/scan')
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

    const setupSubscription = async () => {
      // Subscribe to this specific hunt (includes clues now)
      const unsubscribe = await huntService.subscribeToHunt(huntId, (hunt) => {
        if (hunt) {
          setHunt(hunt)
          // Find the current clue from the hunt's clues
          const currentClue = hunt.clues.find((c) => c.id === clueId)
          if (currentClue) {
            setClue(currentClue)
          }
        } else {
          // Hunt was deleted by another user
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

      return unsubscribe
    }

    let unsubscribe: (() => void) | undefined

    setupSubscription().then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [huntId, clueId, huntService, navigate])

  // Prefetch all media files when hunt loads
  useEffect(() => {
    if (!hunt) return

    const prefetchMedia = async () => {
      const mediaPaths = hunt.clues
        .filter((clue) => clue.mediaUrl && !clue.mediaUrl.startsWith('http'))
        .map((clue) => clue.mediaUrl!)

      if (mediaPaths.length > 0) {
        const { getFirebaseServices } = await import(
          '../hooks/ApplicationState'
        )
        const { storageCache } = await getFirebaseServices()
        storageCache.prefetch(mediaPaths)
      }
    }

    prefetchMedia()
  }, [hunt])

  if (!hunt || !clue) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading clue...</Typography>
      </Box>
    )
  }

  // Find clue number in the sequence
  const clueNumber = hunt.clues.findIndex((c) => c.id === clueId) + 1

  const totalClues = hunt.clues.length

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
              aria-label="show visual"
              disabled={!clue.mediaUrl}
            >
              Visual
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
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={handleScanNext}
          >
            Scan Next QR Code
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
