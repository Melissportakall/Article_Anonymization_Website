import React, { ReactNode, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Container,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const SubmitPaper: React.FC = () => {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [institution, setInstitution] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: ReactNode } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !email || !title) {
      setMessage({ type: 'error', text: 'Lütfen tüm zorunlu alanları doldurun.' });
      return;
    }
    
    const formData = new FormData();
    formData.append('email', email);
    formData.append('title', title);
    formData.append('authors', authors);
    formData.append('file', file);
    formData.append('institution', institution);
  
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
      if (response.ok) {
        setMessage({
          type: 'success',
          text: (
            <>
              <strong>Takip Kodunuz: {data.tracking_code}</strong><br />
              <br />
              Makaleniz başarıyla yüklendi!
            </>
          ),
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Bir hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Sunucu bağlantısı başarısız!' });
    }
  };  

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Makale Yükleme
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            required
            fullWidth
            label="E-posta"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
          />
          <TextField
            required
            fullWidth
            label="Makale Başlığı"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
          />
          <TextField
            required
            fullWidth
            label="Yazarlar"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            margin="normal"
            helperText="Birden fazla yazar için virgül kullanın"
          />
          <TextField
            required
            fullWidth
            label="Kurum"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            margin="normal"
          />
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            sx={{ mt: 2, mb: 2 }}
          >
            PDF Dosyası Yükle
            <input
              type="file"
              hidden
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Button>
          {file && (
            <Typography variant="body2" sx={{ ml: 2 }}>
              Seçilen dosya: {file.name}
            </Typography>
          )}
          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
          >
            Makaleyi Yükle
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SubmitPaper;