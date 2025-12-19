import { useEffect } from 'react'
import { Box, Typography, Paper, AppBar, Toolbar } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { useHuntService } from '../hooks/HuntService'
import { useState } from 'react'
import type { Hunt } from '../types'
import confetti from 'canvas-confetti'

export const CompletionPage = () => {
  const { huntId } = useParams<{ huntId: string }>()
  const navigate = useNavigate()
  const huntService = useHuntService()
  const [hunt, setHunt] = useState<Hunt | null>(null)

  useEffect(() => {
    if (!huntId) {
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
      const unsubscribe = await huntService.subscribeToHunt(huntId, (hunt) => {
        if (hunt) {
          setHunt(hunt)
        } else {
          navigate('/')
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
  }, [huntId, huntService, navigate])

  // Fireworks effect
  useEffect(() => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  if (!hunt) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading...</Typography>
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
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {hunt.displayName}
          </Typography>
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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                fontWeight: 700,
                color: 'primary.main',
              }}
            >
              Congratulations!
            </Typography>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
                my: 3,
              }}
            >
              🎉
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                fontWeight: 500,
                color: 'text.primary',
              }}
            >
              You've completed the hunt!
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
