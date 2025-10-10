import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Fab,
  IconButton,
  Tooltip,
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
  const huntService = useHuntService()
  const navigate = useNavigate()

  useEffect(() => {
    const setupSubscription = async () => {
      const unsubscribe = await huntService.subscribeToKnownHunts(setHunts)
      return unsubscribe
    }

    let unsubscribe: (() => void) | undefined
    setupSubscription().then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [huntService])

  const handleCreateHunt = async () => {
    try {
      const huntId = await huntService.createHunt('New Treasure Hunt')
      navigate(`/hunt/${huntId}`)
    } catch {
      // Silently fail
    }
  }

  const handleDeleteHunt = async (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()

    if (confirm(`Delete "${hunt.displayName}"? This cannot be undone.`)) {
      try {
        await huntService.deleteHunt(hunt.id)
      } catch {
        // Silently fail
      }
    }
  }

  const handleHideHunt = async (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()

    if (
      confirm(
        `Hide "${hunt.displayName}" from your list? You can access it again by visiting a direct link.`
      )
    ) {
      const { LocalHuntStorage } = await import('../hooks/LocalHuntStorage')
      LocalHuntStorage.removeKnownHuntId(hunt.id)

      // Trigger immediate re-render by updating the hunts list
      setHunts((currentHunts) => currentHunts.filter((h) => h.id !== hunt.id))
    }
  }

  const handlePrintHunt = async (hunt: Hunt, e: React.MouseEvent) => {
    e.stopPropagation()

    // Get clues for this hunt
    const clues = await new Promise<Clue[]>((resolve) => {
      huntService.subscribeToClues(hunt.id, (clues) => {
        resolve(clues)
      })
    })

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
              display: flex;
              flex-wrap: wrap;
              justify-content: space-between;
              gap: 10mm;
              align-items: flex-start;
            }
            
            .qr-item {
              width: 45mm;
              text-align: center;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              orphans: 1;
              widows: 1;
              margin-bottom: 15mm;
              flex: 0 0 45mm;
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
              max-width: 45mm;
            }
            
            .hint-text {
              font-size: 9px;
              color: #666;
              margin: 0;
              line-height: 1.2;
              word-wrap: break-word;
              font-style: italic;
              hyphens: auto;
              max-width: 45mm;
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

            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 8px 16px;
              background: #424242;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .print-button:hover {
              background: #212121;
            }

            @media print {
              .print-button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
            </svg>
            Print
          </button>
          
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
            window.onload = function() {
              // QR codes loaded via QR Server API
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
                {/* Header Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      flexGrow: 1,
                      fontSize: { xs: '1.1rem', sm: '1.25rem' },
                      fontWeight: 500,
                      lineHeight: 1.3,
                    }}
                  >
                    {hunt.displayName}
                  </Typography>

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
                    {hunt.clueOrder.length}
                  </Box>
                </Box>

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
    </Box>
  )
}
