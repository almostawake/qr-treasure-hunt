import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Backdrop,
  Tooltip,
} from '@mui/material'
import {
  DragIndicator as DragIcon,
  Visibility as VisibilityIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  Photo as PhotoIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Clue } from '../types'
import type { HuntService } from '../hooks/HuntService'

interface ClueItemProps {
  clue: Clue
  huntService: HuntService
  onDelete: (clueId: string) => void
  sortedClues: Clue[]
}

const ClueItem = ({
  clue,
  huntService,
  onDelete,
  sortedClues,
}: ClueItemProps) => {
  const [clueText, setClueText] = useState(clue.text)
  const [hintText, setHintText] = useState(clue.hint)
  const [uploading, setUploading] = useState(false)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [mediaDisplayUrl, setMediaDisplayUrl] = useState<string | null>(null)

  // Resolve storage path to URL dynamically
  useEffect(() => {
    const resolveMediaUrl = async () => {
      if (!clue.mediaUrl) {
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
        const storageRef = ref(storage, clue.mediaUrl)
        const url = await getDownloadURL(storageRef)
        setMediaDisplayUrl(url)
      } catch {
        // If resolution fails, set to null
        setMediaDisplayUrl(null)
      }
    }

    resolveMediaUrl()
  }, [clue.mediaUrl])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clue.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleClueUpdate = async (field: 'text' | 'hint', value: string) => {
    try {
      await huntService.updateClue(clue.id, { [field]: value })
    } catch {
      // Silently fail
    }
  }

  const handleClueBlur = () => {
    if (clueText !== clue.text) {
      handleClueUpdate('text', clueText)
    }
  }

  const handleHintBlur = () => {
    if (hintText !== clue.hint) {
      handleClueUpdate('hint', hintText)
    }
  }

  const handleDelete = () => {
    onDelete(clue.id)
  }

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime',
    ]
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image or video file')
      return
    }

    // Validate file size (50MB limit for emulator)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size must be less than 50MB')
      return
    }

    setUploading(true)

    try {
      // Upload to Firebase Storage
      const { getFirebaseServices } = await import('../hooks/ApplicationState')
      const { storage } = await getFirebaseServices()

      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const storageRef = ref(
        storage,
        `hunt-media/${clue.huntId}/${clue.id}/${fileName}`
      )

      // Upload file
      const snapshot = await uploadBytes(storageRef, file)

      // Store the storage path (not the full URL) for dynamic resolution
      const storagePath = snapshot.ref.fullPath

      // Update clue with storage path
      const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
      await huntService.updateClue(clue.id, {
        mediaUrl: storagePath,
        mediaType: mediaType as 'image' | 'video',
      })

      // Close dialog after successful upload
      setMediaDialogOpen(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      alert(
        `Upload failed: ${errorMessage}\n\nFile: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`
      )
    } finally {
      setUploading(false)
    }
  }

  const handleMediaClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Always open dialog - for consistency
    setMediaDialogOpen(true)
  }

  const handleUploadMedia = () => {
    // Trigger file picker for new upload
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*,video/*'
    fileInput.capture = 'environment'
    fileInput.onchange = (e) => {
      handleFileUpload(e as React.ChangeEvent<HTMLInputElement>)
      // Dialog will close after successful upload
    }
    fileInput.click()
  }

  const handleDeleteMedia = async () => {
    try {
      await huntService.updateClue(clue.id, {
        mediaUrl: undefined,
        mediaType: undefined,
      })
      setMediaDialogOpen(false)
    } catch {
      alert('Failed to delete media. Please try again.')
    }
  }

  const handleReplaceMedia = () => {
    // Don't close dialog - keep it open for upload progress
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*,video/*'
    fileInput.capture = 'environment'
    fileInput.onchange = (e) => {
      handleFileUpload(e as React.ChangeEvent<HTMLInputElement>)
      // Dialog will close after successful upload
    }
    fileInput.click()
  }

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        mb: 2,
        overflow: 'hidden',
        border: isDragging ? '2px dashed #ccc' : '1px solid #e0e0e0',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
        {/* Left Column - Controls (3 equal rows) */}
        <Box
          sx={{
            width: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
          }}
        >
          {/* Row 1: Step Number Circle */}
          <Box
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {sortedClues.findIndex((c) => c.id === clue.id) + 1}
          </Box>

          {/* Row 2: Drag Handle (middle row) */}
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: 'grab',
              color: 'text.secondary',
              touchAction: 'none',
              userSelect: 'none',
              p: 1,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:active': {
                cursor: 'grabbing',
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            <DragIcon />
          </Box>

          {/* Row 3: Empty spacer for equal distribution */}
          <Box sx={{ height: 24, flexShrink: 0 }} />
        </Box>

        {/* Content Column */}
        <Box sx={{ flex: 1, p: 2, pl: 0 }}>
          <TextField
            fullWidth
            label="Clue"
            variant="outlined"
            value={clueText}
            onChange={(e) => setClueText(e.target.value)}
            onBlur={handleClueBlur}
            onKeyPress={(e) => e.key === 'Enter' && handleClueBlur()}
            onPointerDown={(e) => e.stopPropagation()}
            multiline
            minRows={2}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Hint"
            variant="outlined"
            value={hintText}
            onChange={(e) => setHintText(e.target.value)}
            onBlur={handleHintBlur}
            onKeyPress={(e) => e.key === 'Enter' && handleHintBlur()}
            onPointerDown={(e) => e.stopPropagation()}
            multiline
            minRows={1}
            placeholder="Optional hint for this clue..."
          />

          {/* Action Icons - Centered */}
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {/* Preview Icon */}
            <Tooltip
              title="Simulate playing this step in the hunt"
              enterDelay={1000}
              enterTouchDelay={0}
              leaveTouchDelay={3000}
            >
              <IconButton
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(`/hunt/${clue.huntId}/clue/${clue.id}`, '_blank')
                }}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Media Upload/Management */}
            <Tooltip
              title="Manage media hints (photos, videos)"
              enterDelay={1000}
              enterTouchDelay={0}
              leaveTouchDelay={3000}
            >
              <Badge
                variant="dot"
                color="success"
                invisible={!clue.mediaUrl}
                sx={{
                  '& .MuiBadge-dot': {
                    right: 2,
                    top: 2,
                  },
                }}
              >
                <IconButton
                  size="small"
                  disabled={uploading}
                  onClick={handleMediaClick}
                  sx={{
                    color: clue.mediaUrl ? 'primary.main' : 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  {clue.mediaUrl ? (
                    <PhotoIcon fontSize="small" />
                  ) : (
                    <AddPhotoAlternateIcon fontSize="small" />
                  )}
                </IconButton>
              </Badge>
            </Tooltip>

            {/* Delete Icon */}
            <Tooltip
              title="Delete this step"
              enterDelay={1000}
              enterTouchDelay={0}
              leaveTouchDelay={3000}
            >
              <IconButton
                size="small"
                onClick={handleDelete}
                onPointerDown={(e) => e.stopPropagation()}
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

          {uploading && (
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="primary">
                Uploading...
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Media Management Dialog */}
      <Dialog
        open={mediaDialogOpen}
        onClose={() => setMediaDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '80vh',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">Manage Media</Typography>
            <IconButton
              onClick={() => setMediaDialogOpen(false)}
              sx={{ color: 'grey.500' }}
            >
              ×
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            p: 0,
            position: 'relative',
          }}
        >
          {/* Upload Progress Overlay */}
          {uploading && (
            <Backdrop
              sx={{
                position: 'absolute',
                zIndex: 1,
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 1,
              }}
              open={uploading}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <CircularProgress color="inherit" size={60} />
                <Typography variant="h6">Uploading...</Typography>
              </Box>
            </Backdrop>
          )}

          {mediaDisplayUrl ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                backgroundColor: 'grey.50',
              }}
            >
              {clue.mediaType === 'image' ? (
                <img
                  src={mediaDisplayUrl}
                  alt="Clue media"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
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
                    maxHeight: '100%',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
              )}
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                backgroundColor: 'grey.50',
              }}
            >
              <AddPhotoAlternateIcon
                sx={{ fontSize: 80, color: 'grey.400', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No media uploaded yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload a photo or video to help with this clue
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2, justifyContent: 'center' }}>
          {clue.mediaUrl ? (
            <>
              <Button
                onClick={handleDeleteMedia}
                startIcon={<DeleteIcon />}
                variant="outlined"
                color="error"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading}
              >
                Delete
              </Button>
              <Button
                onClick={handleReplaceMedia}
                startIcon={<CloudUploadIcon />}
                variant="contained"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading}
              >
                Replace
              </Button>
            </>
          ) : (
            <Button
              onClick={handleUploadMedia}
              startIcon={<CloudUploadIcon />}
              variant="contained"
              size="large"
              sx={{ minWidth: 120 }}
              disabled={uploading}
            >
              Upload
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

interface ClueListProps {
  clues: Clue[]
  clueOrder: string[]
  onOrderChange: (newOrder: string[]) => void
  huntService: HuntService
}

export const ClueList = ({
  clues,
  clueOrder,
  onOrderChange,
  huntService,
}: ClueListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort clues based on the order array, with fallback to order property
  const sortedClues = [...clues].sort((a, b) => {
    const aIndex = clueOrder.indexOf(a.id)
    const bIndex = clueOrder.indexOf(b.id)

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }

    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1

    return a.order - b.order
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortedClues.findIndex((clue) => clue.id === active.id)
      const newIndex = sortedClues.findIndex((clue) => clue.id === over.id)

      const newSortedClues = arrayMove(sortedClues, oldIndex, newIndex)
      const newOrder = newSortedClues.map((clue) => clue.id)

      onOrderChange(newOrder)
    }
  }

  const handleDeleteClue = async (clueId: string) => {
    const clue = clues.find((c) => c.id === clueId)
    if (!clue) return

    try {
      await huntService.deleteClue(clue.huntId, clueId)
    } catch {
      // Silently fail
    }
  }

  return (
    <Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedClues.map((clue) => clue.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedClues.map((clue) => (
            <ClueItem
              key={clue.id}
              clue={clue}
              huntService={huntService}
              onDelete={handleDeleteClue}
              sortedClues={sortedClues}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Box>
  )
}
