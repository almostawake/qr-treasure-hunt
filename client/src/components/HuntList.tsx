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

  const handlePrintHunt = async (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()

    // Clues are already embedded in the hunt and in the correct order
    const sortedClues = hunt.clues

    // Generate QR code data
    const baseUrl = window.location.origin
    const qrCodes = []

    // Starting QR code (points to first clue) - labeled with star
    if (sortedClues.length > 0) {
      qrCodes.push({
        url: `${baseUrl}/hunt/${hunt.id}/clue/${sortedClues[0].id}`,
        label: '★',
        clueText: 'Starting QR Code',
        hintText: '',
      })
    }

    // Clue QR codes (each points to next clue) - numbered 1, 2, 3...
    for (let i = 0; i < sortedClues.length; i++) {
      const currentClue = sortedClues[i]
      const nextClueIndex = i + 1
      if (nextClueIndex < sortedClues.length) {
        qrCodes.push({
          url: `${baseUrl}/hunt/${hunt.id}/clue/${sortedClues[nextClueIndex].id}`,
          label: `${i + 1}`,
          clueText: currentClue.text || 'No clue text',
          hintText: currentClue.hint || '',
        })
      } else {
        // Final QR - points to completion page
        qrCodes.push({
          url: `${baseUrl}/hunt/${hunt.id}/complete`,
          label: `${i + 1}`,
          clueText: currentClue.text || 'No clue text',
          hintText: currentClue.hint || '',
        })
      }
    }

    // Create print window
    const printWindow = window.open('', '_blank', 'width=800,height=600')

    if (!printWindow) {
      alert('Please allow popups to use the print feature')
      return
    }

    // Create the print document with working QR codes
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Codes - ${hunt.displayName}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            
            body {
              margin: 0;
              padding: 15mm;
              font-family: Arial, sans-serif;
              background: white;
            }
            
            .hunt-title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 30px;
              color: black;
            }
            
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(4, 39mm);
              column-gap: 8mm;
              row-gap: 12mm;
              justify-content: center;
              grid-auto-flow: row;
            }

            .qr-item {
              width: 39mm;
              text-align: center;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              justify-self: start;
            }
            
            .qr-content {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            
            .clue-text {
              font-size: 10px;
              font-weight: bold;
              margin: 8px 0 4px 0;
              color: black;
              line-height: 1.2;
              word-wrap: break-word;
              hyphens: auto;
              max-width: 39mm;
            }

            .hint-text {
              font-size: 9px;
              color: #666;
              margin: 0;
              line-height: 1.2;
              word-wrap: break-word;
              font-style: italic;
              hyphens: auto;
              max-width: 39mm;
            }
            
            .qr-overlay {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              border: 2px solid black;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              font-weight: bold;
              color: black;
            }

          </style>
        </head>
        <body>
          <div class="hunt-title">${hunt.displayName}</div>
          <div class="qr-grid" id="qr-grid">
            ${qrCodes
              .map(
                (qr) => `
              <div class="qr-item">
                <div class="qr-content">
                  <div style="position: relative; width: 120px; height: 120px; margin: 0 auto;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr.url)}&ecc=H" 
                         style="width: 120px; height: 120px; border: 2px solid black; border-radius: 4px; background: white;"
                         alt="QR Code ${qr.label}" />
                    <div class="qr-overlay">${qr.label}</div>
                  </div>
                  <div class="clue-text">${qr.clueText.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</div>
                  ${qr.hintText ? `<div class="hint-text">Hint: ${qr.hintText.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</div>` : ''}
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          
          <script>
            // Close window after print dialog is dismissed
            window.onafterprint = function() {
              window.close();
            };

            window.onload = function() {
              // Wait for all QR code images to load before printing
              const images = document.querySelectorAll('img');
              let loadedCount = 0;
              const totalImages = images.length;

              if (totalImages === 0) {
                window.print();
                return;
              }

              function checkAllLoaded() {
                loadedCount++;
                if (loadedCount === totalImages) {
                  // Small delay to ensure rendering is complete
                  setTimeout(() => {
                    window.print();
                  }, 100);
                }
              }

              images.forEach(img => {
                if (img.complete) {
                  checkAllLoaded();
                } else {
                  img.onload = checkAllLoaded;
                  img.onerror = checkAllLoaded; // Still print even if an image fails
                }
              });
            };
          </script>
        </body>
      </html>
    `

    // Write content to new window
    printWindow.document.write(printContent)
    printWindow.document.close()
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
