import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#424242', // Grey 700 - off-black for buttons
      dark: '#212121', // Grey 900 - darker for hover
      contrastText: '#ffffff',
    },
  },
  components: {
    // Override all contained buttons to use consistent off-black styling
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: '#424242', // Grey 700 - off-black
          color: '#ffffff',
          fontWeight: 600,
          '&:hover': {
            backgroundColor: '#212121', // Grey 900 - darker on hover
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          },
        },
      },
    },
  },
})







