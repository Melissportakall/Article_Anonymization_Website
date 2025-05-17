import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Button,
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  useScrollTrigger,
  Fade,
  Fab,
} from '@mui/material';
import { keyframes } from '@mui/system';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SubmitPaper from './components/SubmitPaper';
import PaperStatus from './components/PaperStatus';
import AdminDashboard from './components/AdminDashboard';
import ReviewerDashboard from './components/ReviewerDashboard';
import Logs from './components/Logs';


const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const theme = createTheme({
  palette: {
    primary: {
      main: '#2c3e50',
    },
    secondary: {
      main: '#e74c3c',
    },
    background: {
      default: '#f5f6fa',
    },
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h3: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          padding: '10px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 1200,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          zIndex: 1300,
          margin: '32px',
          position: 'relative',
        },
        container: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          zIndex: 1299,
        },
      },
    },
  },
});

function ScrollTop() {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Fade in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <Fab color="primary" size="small" aria-label="scroll back to top">
          <KeyboardArrowUpIcon />
        </Fab>
      </Box>
    </Fade>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="fixed" sx={{ zIndex: 1201 }}>
            <Toolbar>
              <Typography 
                variant="h6" 
                component={Link} 
                to="/" 
                sx={{ 
                  flexGrow: 1, 
                  textDecoration: 'none', 
                  color: 'inherit',
                  fontWeight: 600,
                }}
              >
                Akademik Makale Sistemi
              </Typography>
              <Button 
                color="inherit" 
                component={Link} 
                to="/submit"
                sx={{ mx: 1 }}
              >
                Makale Yükle
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/status"
                sx={{ mx: 1 }}
              >
                Durum Sorgula
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/reviewer"
                sx={{ mx: 1 }}
              >
                Hakem Paneli
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/admin"
                sx={{ mx: 1 }}
              >
                Yönetici Paneli
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/logs"
                sx={{ mx: 1 }}
              >
                Loglar
              </Button>
            </Toolbar>
          </AppBar>

          <Box sx={{ width: '100%', height: '100vh', pt: 8 }}>
            <Routes>
              <Route
                path="/"
                element={
                  <Box 
                    sx={{ 
                      height: '100vh',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${process.env.PUBLIC_URL + '/backgroundphoto.jpg'})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundAttachment: 'fixed',
                      color: 'white',
                      textAlign: 'center',
                      p: 4,
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        animation: `${fadeIn} 1s ease-out`,
                      }}
                    >
                      <Typography 
                        variant="h3" 
                        gutterBottom
                        sx={{
                          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                          mb: 3,
                          fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                          animation: `${fadeIn} 1s ease-out`,
                        }}
                      >
                        Hoş Geldiniz
                      </Typography>
                      <Typography 
                        variant="h5" 
                        sx={{
                          mb: 6,
                          maxWidth: '800px',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                          fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.8rem' },
                          animation: `${fadeIn} 1s ease-out 0.5s`,
                          opacity: 0,
                          animationFillMode: 'forwards',
                        }}
                      >
                        Akademik çalışmalarınızı paylaşın, değerlendirin ve bilime katkıda bulunun
                      </Typography>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          gap: 2,
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          animation: `${fadeIn} 1s ease-out 1s`,
                          opacity: 0,
                          animationFillMode: 'forwards',
                        }}
                      >
                        <Button
                          variant="contained"
                          size="large"
                          component={Link}
                          to="/submit"
                          sx={{
                            bgcolor: 'primary.main',
                            '&:hover': {
                              bgcolor: 'primary.dark',
                              transform: 'translateY(-2px)',
                              transition: 'all 0.3s ease',
                            },
                            px: 4,
                            py: 2,
                            transition: 'all 0.3s ease',
                          }}
                        >
                          Makale Yükle
                        </Button>
                        <Button
                          variant="outlined"
                          size="large"
                          component={Link}
                          to="/status"
                          sx={{
                            borderColor: 'white',
                            color: 'white',
                            '&:hover': {
                              borderColor: 'white',
                              bgcolor: 'rgba(255,255,255,0.1)',
                              transform: 'translateY(-2px)',
                              transition: 'all 0.3s ease',
                            },
                            px: 4,
                            py: 2,
                            transition: 'all 0.3s ease',
                          }}
                        >
                          Durum Sorgula
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                }
              />
              <Route path="/submit" element={<SubmitPaper />} />
              <Route path="/status" element={<PaperStatus />} />
              <Route path="/reviewer" element={<ReviewerDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/logs" element={<Logs />} />
            </Routes>
          </Box>

          <ScrollTop />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App; 