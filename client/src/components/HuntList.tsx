import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Fab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useHuntService } from '../hooks/HuntService'
import type { Hunt } from '../types'
import { printQRCodes } from '../utils/printQRCodes'

export const HuntList = () => {
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [huntToDelete, setHuntToDelete] = useState<Hunt | null>(null)
  const [hideDialogOpen, setHideDialogOpen] = useState(false)
  const [huntToHide, setHuntToHide] = useState<Hunt | null>(null)
  const huntService = useHuntService()
  const navigate = useNavigate()

  // Subscribe to known hunts
  useEffect(() => {
    const setupSubscription = async () => {
      const unsubscribe = await huntService.subscribeToKnownHunts((hunts) => {
        setHunts(hunts)
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
  }, [huntService])

  const handleCreateHunt = async () => {
    try {
      const huntId = await huntService.createHunt('')
      navigate(`/hunt/${huntId}`)
    } catch {
      // Silently fail
    }
  }

  const handleDeleteHunt = (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()
    setHuntToDelete(hunt)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteHunt = async () => {
    if (!huntToDelete) return

    try {
      await huntService.deleteHunt(huntToDelete.id)
    } catch {
      // Silently fail
    } finally {
      setDeleteDialogOpen(false)
      setHuntToDelete(null)
    }
  }

  const handleHideHunt = (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()
    setHuntToHide(hunt)
    setHideDialogOpen(true)
  }

  const confirmHideHunt = async () => {
    if (!huntToHide) return

    const { LocalHuntStorage } = await import('../hooks/LocalHuntStorage')
    LocalHuntStorage.removeKnownHuntId(huntToHide.id)

    // Trigger immediate re-render by updating the hunts list
    setHunts((currentHunts) => currentHunts.filter((h) => h.id !== huntToHide.id))

    setHideDialogOpen(false)
    setHuntToHide(null)
  }

  const handlePrintHunt = (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()
    printQRCodes(hunt)
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pb: 10 }}>
      {hunts.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No treasure hunts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first treasure hunt to get started!
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, sm: 3 },
          }}
        >
          {hunts.map((hunt) => (
            <Card
              key={hunt.id}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                },
                width: '100%',
              }}
              onClick={() => navigate(`/hunt/${hunt.id}`)}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    fontWeight: 500,
                    lineHeight: 1.3,
                    color: hunt.displayName ? 'inherit' : 'text.secondary',
                    mb: 2,
                  }}
                >
                  {hunt.displayName || 'Unnamed hunt'}
                </Typography>

                {/* Bottom Row - Action Icons */}
                <Box
                  sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}
                >
                  <Tooltip
                    title="Print QR codes"
                    enterDelay={1000}
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handlePrintHunt(hunt, e)}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip
                    title="Hide this hunt from your list"
                    enterDelay={1000}
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleHideHunt(hunt, e)}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip
                    title="Delete this hunt forever, for everyone"
                    enterDelay={1000}
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteHunt(hunt, e)}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add hunt"
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
        }}
        onClick={handleCreateHunt}
      >
        <AddIcon />
      </Fab>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Hunt?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{' '}
            <strong>"{huntToDelete?.displayName || 'this hunt'}"</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
            This action cannot be undone. The hunt will be deleted for everyone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteHunt}
            variant="contained"
            color="error"
            size="large"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hide Confirmation Dialog */}
      <Dialog
        open={hideDialogOpen}
        onClose={() => setHideDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Hide Hunt?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to hide{' '}
            <strong>"{huntToHide?.displayName || 'this hunt'}"</strong> from
            your list?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            This won't delete the hunt. You can access it again by visiting a
            direct link.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setHideDialogOpen(false)}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmHideHunt}
            variant="contained"
            size="large"
          >
            Hide
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
