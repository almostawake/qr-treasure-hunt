import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  CircularProgress,
  ThemeProvider,
} from '@mui/material'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { theme } from './theme'
import { useApplicationState } from './hooks/ApplicationState'
import { HuntList } from './components/HuntList'
import { HuntEditor } from './components/HuntEditor'
import { CluePage } from './components/CluePage'

function App() {
  const { loading } = useApplicationState()

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
    <ThemeProvider theme={theme}>
      <Router>
        <Box
          sx={{ width: '100%', minHeight: '100vh', backgroundColor: '#f5f5f5' }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <AppBar
                    position="static"
                    sx={{
                      backgroundColor: 'white',
                      color: 'black',
                      boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
                      width: '100%',
                    }}
                  >
                    <Toolbar>
                      <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1 }}
                      >
                        QR Treasure Hunts
                      </Typography>
                    </Toolbar>
                  </AppBar>
                  <HuntList />
                </>
              }
            />
            <Route path="/hunt/:id" element={<HuntEditor />} />
            <Route path="/hunt/:huntId/clue/:clueId" element={<CluePage />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  )
}

export default App
