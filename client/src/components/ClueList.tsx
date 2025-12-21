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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  Photo as PhotoIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material'
import {
  ref,
  uploadBytes,
  deleteObject,
} from 'firebase/storage'
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
  huntId: string
  huntService: HuntService
  onDelete: (clueId: string) => void
}

const ClueItem = ({
  clue,
  huntId,
  huntService,
  onDelete,
}: ClueItemProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [clueText, setClueText] = useState(clue.text)
  const [hintText, setHintText] = useState(clue.hint)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [mediaDisplayUrl, setMediaDisplayUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null
  )
  const [previousMediaDisplayUrl, setPreviousMediaDisplayUrl] = useState<
    string | null
  >(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showReplaceMode, setShowReplaceMode] = useState(false)
  const [clueFieldFocused, setClueFieldFocused] = useState(false)
  const [hintFieldFocused, setHintFieldFocused] = useState(false)

  // Sync local state with prop updates from Firestore
  useEffect(() => {
    setClueText(clue.text)
  }, [clue.text])

  useEffect(() => {
    setHintText(clue.hint)
  }, [clue.hint])

  // Resolve storage path to URL using cache
  useEffect(() => {
    let currentMediaUrl = clue.mediaUrl

    const resolveMediaUrl = async () => {
      if (!currentMediaUrl) {
        setMediaDisplayUrl(null)
        return
      }

      // If it's already a full URL (old format), use it directly
      if (
        currentMediaUrl.startsWith('http://') ||
        currentMediaUrl.startsWith('https://')
      ) {
        setMediaDisplayUrl(currentMediaUrl)
        return
      }

      // It's a storage path - resolve it using cache
      try {
        const { getFirebaseServices } = await import(
          '../hooks/ApplicationState'
        )
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
  }, [clue.mediaUrl])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl)
      }
    }
  }, [selectedPreviewUrl])

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
      await huntService.updateClue(huntId, clue.id, { [field]: value })
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

  const validateAndSelectFile = (file: File): boolean => {
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
      return false
    }

    // Validate file size (50MB limit for emulator)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size must be less than 50MB')
      return false
    }

    return true
  }

  const handleFileSelect = (file: File) => {
    if (!validateAndSelectFile(file)) return

    // Remember what was previously displayed so we can revert on cancel
    if (previousMediaDisplayUrl === null) {
      setPreviousMediaDisplayUrl(mediaDisplayUrl)
    }

    // Create a local preview and defer upload until user confirms
    const objectUrl = URL.createObjectURL(file)
    setSelectedFile(file)
    setSelectedPreviewUrl(objectUrl)
    setMediaDisplayUrl(objectUrl)
    setShowReplaceMode(false) // Exit replace mode if we were in it
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const cancelSelectedFile = () => {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl)
    }
    setSelectedFile(null)
    setSelectedPreviewUrl(null)
    // Only restore mediaDisplayUrl if we actually saved a previous value
    // (i.e., only if the user selected a file that changed the display)
    if (previousMediaDisplayUrl !== null) {
      setMediaDisplayUrl(previousMediaDisplayUrl)
      setPreviousMediaDisplayUrl(null)
    }
    setShowReplaceMode(false)
  }

  const handleDialogClose = () => {
    // Only cancel file selection if there's actually a file selected
    if (selectedFile) {
      cancelSelectedFile()
    }
    setMediaDialogOpen(false)
  }

  const performUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const file = selectedFile
      const { getFirebaseServices } = await import('../hooks/ApplicationState')
      const { storage, storageCache } = await getFirebaseServices()

      // Delete old file from storage if replacing
      const hasExistingMedia =
        clue.mediaUrl &&
        clue.mediaUrl.trim() !== '' &&
        !clue.mediaUrl.startsWith('http')
      if (hasExistingMedia) {
        try {
          const oldStorageRef = ref(storage, clue.mediaUrl)
          await deleteObject(oldStorageRef)
          // Invalidate old cache entry
          if (clue.mediaUrl) {
            await storageCache.invalidate(clue.mediaUrl)
          }
        } catch (deleteError) {
          // Continue even if deletion fails (file might not exist)
          console.warn('Failed to delete old media file:', deleteError)
        }
      }

      // Get file extension from original file
      const extension = file.name.split('.').pop() || 'bin'
      const fileName = `${clue.id}-${Date.now()}.${extension}`
      const storageRef = ref(
        storage,
        `hunt-media/${huntId}/${fileName}`
      )

      const snapshot = await uploadBytes(storageRef, file)
      const storagePath = snapshot.ref.fullPath

      const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
      await huntService.updateClue(huntId, clue.id, {
        mediaUrl: storagePath,
        mediaType: mediaType as 'image' | 'video',
      })

      // Prefetch the new file into cache in the background
      storageCache.prefetch([storagePath])

      // Cleanup the object URL preview; Firestore change will refresh the display
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl)
      }
      setSelectedFile(null)
      setSelectedPreviewUrl(null)
      setPreviousMediaDisplayUrl(null)
      setShowReplaceMode(false)

      // Close dialog after successful upload
      setMediaDialogOpen(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      alert(`Upload failed: ${errorMessage}`)
    } finally {
      setUploading(false)
    }
  }

  const handleMediaClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Reset state when opening dialog
    setShowReplaceMode(false)
    setSelectedFile(null)
    setSelectedPreviewUrl(null)
    // Don't reset previousMediaDisplayUrl - it should only be set when selecting a new file
    setMediaDialogOpen(true)
  }

  const handleFilePickerClick = () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*,video/*'
    fileInput.capture = 'environment'
    fileInput.onchange = (e) => {
      if (e.target && (e.target as HTMLInputElement).files) {
        handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>)
      }
    }
    fileInput.click()
  }

  const handleDeleteMedia = async () => {
    setDeleting(true)
    try {
      // Delete file from storage first
      if (clue.mediaUrl && !clue.mediaUrl.startsWith('http')) {
        try {
          const { getFirebaseServices } = await import(
            '../hooks/ApplicationState'
          )
          const { storage } = await getFirebaseServices()
          const storageRef = ref(storage, clue.mediaUrl)
          await deleteObject(storageRef)
        } catch (deleteError) {
          // Log error but continue - file might not exist or already deleted
          console.warn('Storage deletion warning:', deleteError)
          // Don't throw - continue to remove from DB even if storage deletion fails
        }
      }

      // Remove from database using deleteField()
      await huntService.deleteClueMedia(huntId, clue.id)

      setMediaDialogOpen(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to delete media: ${errorMessage}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleReplaceMedia = () => {
    // Reset to file picker mode
    setShowReplaceMode(true)
    // Remember current display URL for cancel
    if (previousMediaDisplayUrl === null) {
      setPreviousMediaDisplayUrl(mediaDisplayUrl)
    }
    // Clear any selected file
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl)
    }
    setSelectedFile(null)
    setSelectedPreviewUrl(null)
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
        {/* Left Column - Action buttons */}
        <Box
          {...attributes}
          {...listeners}
          sx={{
            width: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            gap: 1,
            py: 2,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            '&:active': {
              cursor: 'grabbing',
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
            },
          }}
        >
          {/* Visual Hint */}
          <Tooltip
            title="Manage visual hints (photos, videos)"
            enterDelay={1000}
            enterTouchDelay={0}
            leaveTouchDelay={3000}
          >
            <Badge
              variant="dot"
              color="success"
              invisible={!(clue.mediaUrl && clue.mediaUrl.trim() !== '')}
              sx={{
                '& .MuiBadge-dot': {
                  right: 2,
                  top: 2,
                },
              }}
            >
              <IconButton
                size="small"
                disabled={uploading || deleting}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMediaClick(e)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                sx={{
                  color:
                    clue.mediaUrl && clue.mediaUrl.trim() !== ''
                      ? 'primary.main'
                      : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                {clue.mediaUrl && clue.mediaUrl.trim() !== '' ? (
                  <PhotoIcon fontSize="small" />
                ) : (
                  <AddPhotoAlternateIcon fontSize="small" />
                )}
              </IconButton>
            </Badge>
          </Tooltip>

          {/* Preview */}
          <Tooltip
            title="Simulate playing this step in the hunt"
            enterDelay={1000}
            enterTouchDelay={0}
            leaveTouchDelay={3000}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                window.open(`/hunt/${huntId}/clue/${clue.id}`, '_blank')
              }}
              onPointerDown={(e) => e.stopPropagation()}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Delete */}
          <Tooltip
            title="Delete this step"
            enterDelay={1000}
            enterTouchDelay={0}
            leaveTouchDelay={3000}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
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

        {/* Content Column */}
        <Box sx={{ flex: 1, p: 2, pl: 0 }}>
          <TextField
            fullWidth
            label="Clue"
            variant="filled"
            value={clueText}
            onChange={(e) => setClueText(e.target.value)}
            onFocus={() => setClueFieldFocused(true)}
            onBlur={() => {
              setClueFieldFocused(false)
              handleClueBlur()
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleClueBlur()}
            multiline
            minRows={1}
            maxRows={clueFieldFocused ? 6 : 1}
            placeholder="A cryptic clue to find this step/location"
            sx={{
              mb: 2,
              '& .MuiInputBase-input': clueFieldFocused
                ? {}
                : {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
            }}
          />

          <TextField
            fullWidth
            label="Hint"
            variant="filled"
            value={hintText}
            onChange={(e) => setHintText(e.target.value)}
            onFocus={() => setHintFieldFocused(true)}
            onBlur={() => {
              setHintFieldFocused(false)
              handleHintBlur()
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleHintBlur()}
            multiline
            minRows={1}
            maxRows={hintFieldFocused ? 6 : 1}
            placeholder="Optional extra help if the hunter is stuck"
            sx={{
              '& .MuiInputBase-input': hintFieldFocused
                ? {}
                : {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
            }}
          />

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
        onClose={handleDialogClose}
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
            <Typography variant="h6">Manage Visual Hint</Typography>
            <IconButton
              onClick={handleDialogClose}
              sx={{ color: 'grey.500' }}
              disabled={uploading || deleting}
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
          {/* Upload/Delete Progress Overlay */}
          {(uploading || deleting) && (
            <Backdrop
              sx={{
                position: 'absolute',
                zIndex: 1,
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 1,
              }}
              open={uploading || deleting}
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
                <Typography variant="h6">
                  {deleting ? 'Deleting...' : 'Uploading...'}
                </Typography>
              </Box>
            </Backdrop>
          )}

          {/* Case 1: File selected - show preview */}
          {selectedFile && selectedPreviewUrl ? (
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
              {selectedFile.type.startsWith('image/') ? (
                <img
                  src={selectedPreviewUrl}
                  alt="Preview"
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
                  src={selectedPreviewUrl}
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
          ) : showReplaceMode ||
            !clue.mediaUrl ||
            clue.mediaUrl.trim() === '' ? (
            // Case 2: File picker/drop zone mode (new or replace mode)
            <Box
              {...(!isMobile && {
                onDragOver: handleDragOver,
                onDragLeave: handleDragLeave,
                onDrop: handleDrop,
              })}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                backgroundColor:
                  isDragOver && !isMobile ? 'primary.light' : 'grey.50',
                border:
                  isDragOver && !isMobile
                    ? '3px dashed'
                    : '3px dashed transparent',
                borderColor:
                  isDragOver && !isMobile ? 'primary.main' : 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onClick={handleFilePickerClick}
            >
              <CloudUploadIcon
                sx={{
                  fontSize: 80,
                  color: isDragOver && !isMobile ? 'primary.main' : 'grey.400',
                  mb: 2,
                }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {isMobile ? 'Choose file' : 'Choose file or drag and drop'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload an image or video as a visual hint
              </Typography>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                sx={{ mt: 3 }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFilePickerClick()
                }}
              >
                Choose File
              </Button>
            </Box>
          ) : (
            // Case 3: Existing media - show as drop target (no hints)
            <Box
              {...(!isMobile && {
                onDragOver: handleDragOver,
                onDragLeave: handleDragLeave,
                onDrop: handleDrop,
              })}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                backgroundColor:
                  isDragOver && !isMobile ? 'primary.light' : 'grey.50',
                border:
                  isDragOver && !isMobile
                    ? '3px dashed'
                    : '3px dashed transparent',
                borderColor:
                  isDragOver && !isMobile ? 'primary.main' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {mediaDisplayUrl ? (
                clue.mediaType === 'image' ? (
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
                )
              ) : (
                <Typography color="text.secondary">
                  Loading media...
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 3,
            gap: 2,
            justifyContent: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
            },
          }}
        >
          {selectedFile ? (
            // File selected - show Cancel + Upload
            <>
              <Button
                onClick={cancelSelectedFile}
                variant="outlined"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading || deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={performUpload}
                startIcon={<CloudUploadIcon />}
                variant="contained"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading || deleting}
              >
                Upload
              </Button>
            </>
          ) : showReplaceMode ||
            !clue.mediaUrl ||
            clue.mediaUrl.trim() === '' ? (
            // File picker mode - only Cancel
            <Button
              onClick={handleDialogClose}
              variant="outlined"
              size="large"
              sx={{ minWidth: 120 }}
              disabled={uploading || deleting}
            >
              Cancel
            </Button>
          ) : (
            // Existing media - Cancel + Delete + Replace
            <>
              <Button
                onClick={handleDialogClose}
                variant="outlined"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading || deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteMedia}
                startIcon={<DeleteIcon />}
                variant="outlined"
                color="error"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading || deleting}
              >
                Delete
              </Button>
              <Button
                onClick={handleReplaceMedia}
                startIcon={<CloudUploadIcon />}
                variant="contained"
                size="large"
                sx={{ minWidth: 120 }}
                disabled={uploading || deleting}
              >
                Replace
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

interface ClueListProps {
  huntId: string
  clues: Clue[]
  onOrderChange: (reorderedClues: Clue[]) => void
  huntService: HuntService
}

export const ClueList = ({
  huntId,
  clues,
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

  // Clues are already in the correct order from the array
  const sortedClues = clues

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortedClues.findIndex((clue) => clue.id === active.id)
      const newIndex = sortedClues.findIndex((clue) => clue.id === over.id)

      const reorderedClues = arrayMove(sortedClues, oldIndex, newIndex)

      onOrderChange(reorderedClues)
    }
  }

  const handleDeleteClue = async (clueId: string) => {
    try {
      await huntService.deleteClue(huntId, clueId)
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
              huntId={huntId}
              huntService={huntService}
              onDelete={handleDeleteClue}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Box>
  )
}
