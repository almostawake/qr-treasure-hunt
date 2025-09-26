import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import { useEffect } from 'react'
import { useApplicationState } from './hooks/ApplicationState'
import { useUserService } from './hooks/UserService'

function App() {
  const { user, loading } = useApplicationState()
  const userService = useUserService()

  useEffect(() => {
    const initAuth = async () => {
      const unsubscribe = await userService.initialize()
      return unsubscribe
    }
    
    let unsubscribe: (() => void) | undefined
    initAuth().then(unsub => {
      unsubscribe = unsub
    })
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userService])

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', height: '100vh' }}>
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'white',
          color: 'black',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
          width: '100%',
        }}
      >
        <Toolbar sx={{ justifyContent: 'flex-end', width: '100%' }}>
          {user ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">
                Welcome, {user.displayName || user.email}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => userService.logout()}
                sx={{
                  color: 'black',
                  borderColor: 'black',
                  '&:hover': {
                    backgroundColor: 'black',
                    color: 'white',
                  },
                }}
              >
                Logout
              </Button>
            </Box>
          ) : (
            <Button
              variant="outlined"
              onClick={() => userService.login()}
              sx={{
                color: 'black',
                borderColor: 'black',
                '&:hover': {
                  backgroundColor: 'black',
                  color: 'white',
                },
              }}
            >
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>
    </Box>
  )
}

export default App
