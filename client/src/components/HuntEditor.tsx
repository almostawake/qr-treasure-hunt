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
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { useHuntService } from '../hooks/HuntService'
import { ClueList } from './ClueList'
import type { Hunt, Clue } from '../types'

export const HuntEditor = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const huntService = useHuntService()

  const [hunt, setHunt] = useState<Hunt | null>(null)
  const [clues, setClues] = useState<Clue[]>([])
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

    const setupSubscriptions = async () => {
      // Subscribe to hunt changes
      const huntUnsubscribe = await huntService.subscribeToHunts((hunts) => {
        const currentHunt = hunts.find((h) => h.id === id)
        if (currentHunt) {
          setHunt(currentHunt)
          setHuntName(currentHunt.displayName)
        } else {
          // Hunt doesn't exist - remove from known hunts and redirect
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

      // Subscribe to clues changes
      const cluesUnsubscribe = await huntService.subscribeToClues(
        id,
        (clues) => {
          setClues(clues)
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
  }, [id, huntService, navigate])

  const handleNameChange = async (newName: string) => {
    if (!id || !hunt) return

    try {
      await huntService.updateHuntName(id, newName)
    } catch (error) {
      // Revert on error
      setHuntName(hunt.displayName)
    }
  }

  const handleNameBlur = () => {
    setIsEditing(false)
    if (huntName.trim() !== hunt?.displayName) {
      handleNameChange(huntName.trim() || 'Untitled Hunt')
    }
  }

  const handleNameKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleNameBlur()
    }
  }

  const handleAddClue = async () => {
    if (!id) return

    try {
      await huntService.createClue(id)
    } catch (error) {
      // Silently fail
    }
  }

  const handleClueOrderChange = async (newOrder: string[]) => {
    if (!id) return

    try {
      await huntService.updateClueOrder(id, newOrder)
    } catch (error) {
      // Silently fail
    }
  }

  if (!hunt) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading hunt...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
                }}
                onClick={() => setIsEditing(true)}
              >
                {hunt.displayName}
              </Typography>
            )}

            {/* Clue Count Badge */}
            <Box
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                color: 'text.secondary',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {clues.length}
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 }, pb: 10 }}>
        {clues.length === 0 ? (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              backgroundColor: 'grey.50',
            }}
          >
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No clues yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first clue to get started!
            </Typography>
          </Paper>
        ) : (
          <ClueList
            clues={clues}
            clueOrder={hunt.clueOrder}
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
