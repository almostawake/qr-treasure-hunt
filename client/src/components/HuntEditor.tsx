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
      // Subscribe to this specific hunt
      const huntUnsubscribe = await huntService.subscribeToHunt(id, (hunt) => {
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

  // Auto-focus hunt name field for empty hunts (desktop only)
  useEffect(() => {
    if (hunt && clues.length === 0 && !hunt.displayName) {
      // Only auto-focus on desktop - mobile browsers block programmatic keyboard opening
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (!isMobile) {
        setIsEditing(true)
      }
    }
  }, [hunt, clues.length])

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

  const handleClueOrderChange = async (newOrder: string[]) => {
    if (!id) return

    try {
      await huntService.updateClueOrder(id, newOrder)
    } catch {
      // Silently fail
    }
  }

  const handlePrint = async () => {
    if (!hunt) return

    // Sort clues based on hunt order
    const sortedClues = [...clues].sort((a, b) => {
      const aIndex = hunt.clueOrder.indexOf(a.id)
      const bIndex = hunt.clueOrder.indexOf(b.id)

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }

      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1

      return a.order - b.order
    })

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
        {clues.length === 0 ? (
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
                    • Drag ⋮⋮ to reorder steps
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
