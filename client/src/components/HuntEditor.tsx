import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  IconButton,
  AppBar,
  Toolbar,
  Fab,
  Paper,
  Tooltip,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Print as PrintIcon,
  QrCodeScanner as QrCodeScannerIcon,
} from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { useHuntService } from '../hooks/HuntService'
import { ClueList } from './ClueList'
import type { Hunt, Clue } from '../types'
import { printQRCodes } from '../utils/printQRCodes'

export const HuntEditor = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const huntService = useHuntService()

  const [hunt, setHunt] = useState<Hunt | null>(null)
  const [huntName, setHuntName] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!id) {
      navigate('/')
      return
    }

    // Add this hunt to known hunts when accessed
    const addToKnownHunts = async () => {
      const { LocalHuntStorage } = await import('../hooks/LocalHuntStorage')
      LocalHuntStorage.addKnownHuntId(id)
    }
    addToKnownHunts()

    const setupSubscription = async () => {
      // Subscribe to this specific hunt (includes clues now)
      const unsubscribe = await huntService.subscribeToHunt(id, (hunt) => {
        if (hunt) {
          setHunt(hunt)
          setHuntName(hunt.displayName)
        } else {
          // Hunt was deleted by another user
          const removeAndRedirect = async () => {
            const { LocalHuntStorage } = await import(
              '../hooks/LocalHuntStorage'
            )
            LocalHuntStorage.removeKnownHuntId(id)
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
  }, [id, huntService, navigate])

  // Auto-focus hunt name field for empty hunts (desktop only)
  useEffect(() => {
    if (hunt && hunt.clues.length === 0 && !hunt.displayName) {
      // Only auto-focus on desktop - mobile browsers block programmatic keyboard opening
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (!isMobile) {
        setIsEditing(true)
      }
    }
  }, [hunt])

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

  const handleNameChange = async (newName: string) => {
    if (!id || !hunt) return

    try {
      await huntService.updateHuntName(id, newName)
    } catch {
      // Revert on error
      setHuntName(hunt.displayName)
    }
  }

  const handleNameBlur = () => {
    setIsEditing(false)
    if (huntName.trim() !== hunt?.displayName) {
      handleNameChange(huntName.trim())
    }
  }

  const handleNameKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      ;(event.target as HTMLElement).blur()
    }
  }

  const handleAddClue = async () => {
    if (!id) return

    try {
      await huntService.createClue(id)
    } catch {
      // Silently fail
    }
  }

  const handleClueOrderChange = async (reorderedClues: Clue[]) => {
    if (!id) return

    try {
      await huntService.updateClueOrder(id, reorderedClues)
    } catch {
      // Silently fail
    }
  }

  const handlePrint = () => {
    if (!hunt) return
    printQRCodes(hunt)
  }

  if (!hunt) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading hunt...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'white',
          color: 'black',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>

          <Box
            sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 2 }}
          >
            {isEditing ? (
              <TextField
                value={huntName}
                onChange={(e) => setHuntName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyPress={handleNameKeyPress}
                autoFocus
                variant="standard"
                label="Hunt name"
                sx={{
                  flexGrow: 1,
                  '& .MuiInput-underline:before': {
                    borderBottomColor: 'transparent',
                  },
                  '& .MuiInput-underline:hover:before': {
                    borderBottomColor: 'primary.main',
                  },
                }}
                InputProps={{
                  sx: {
                    fontSize: '1.25rem',
                    fontWeight: 500,
                  },
                }}
              />
            ) : (
              <Typography
                variant="h6"
                sx={{
                  flexGrow: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.04)',
                  },
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  color: hunt.displayName ? 'inherit' : 'text.secondary',
                }}
                onClick={() => setIsEditing(true)}
              >
                {hunt.displayName || 'Unnamed hunt'}
              </Typography>
            )}
          </Box>

          <Tooltip title="Print QR Codes">
            <IconButton onClick={handlePrint} sx={{ mr: 1 }}>
              <PrintIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Scan QR Code">
            <IconButton onClick={() => navigate('/scan')}>
              <QrCodeScannerIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 }, pb: 10 }}>
        {hunt.clues.length === 0 ? (
          <Paper
            sx={{
              p: { xs: 3, sm: 5 },
              maxWidth: 600,
              mx: 'auto',
              backgroundColor: 'grey.50',
            }}
          >
            <Typography
              variant="h6"
              sx={{ mb: 3, fontWeight: 500, textAlign: 'center' }}
            >
              Let's create your treasure hunt
            </Typography>

            <Box sx={{ textAlign: 'left', '& > *': { mb: 2.5 } }}>
              {/* Step 1 */}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  1. Name it
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>
                  Tap "Unnamed hunt" above. Something like "Burradoo Rd treasure hunt" or "Hunt for Alex"
                </Typography>
              </Box>

              {/* Step 2 */}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  2. Add steps (locations)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>
                  Use the + button below. You can give clues and hints to lead them to that location and even upload images/videos in case they get stuck
                </Typography>
              </Box>

              {/* Step 3 */}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  3. Customize as you go
                </Typography>
                <Box sx={{ pl: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    • Drag to reorder steps
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Hover over or long press icons to see what they do
                  </Typography>
                </Box>
              </Box>

              {/* Step 4 */}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  4. Preview each step
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>
                  Use 👁 to see what hunters will see to lead them to that location
                </Typography>
              </Box>

              {/* Step 5 */}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  5. Print the QR codes
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>
                  Cut them out, place them in their locations. Maybe add a prize at each location!
                </Typography>
              </Box>
            </Box>
          </Paper>
        ) : (
          <ClueList
            huntId={id!}
            clues={hunt.clues}
            onOrderChange={handleClueOrderChange}
            huntService={huntService}
          />
        )}
      </Box>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add clue"
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
        }}
        onClick={handleAddClue}
      >
        <AddIcon />
      </Fab>
    </Box>
  )
}
