import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Container,
  Alert,
  CircularProgress,
  Modal,
  Box as MuiBox,
  TableCell,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { CloudUploadIcon } from 'lucide-react';

const PaperStatus: React.FC = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paperDetails, setPaperDetails] = useState<{
    email?: string;
    title?: string;
    authors?: string;
    status?: string;
    reviewer?: string;
    institution?: string;
  } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ id: number; reviewer: string; comments: string; created_at: string; }[]>([]);
  const [messages, setMessages] = useState<{ sender: string | undefined; text: string; is_read: boolean }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [openPdfModal, setOpenPdfModal] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseTitle, setReviseTitle] = useState(paperDetails?.title || "");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackingNumber || !email) {
      setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun.' });
      return;
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Lütfen geçerli bir e-posta adresi girin.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/paper_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tracking_code: trackingNumber }),
      });
      const data = await response.json();

      if (response.ok) {
        setPaperDetails(data);
        fetchMessages();
        setOpenModal(true);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: data.message || 'Makale bulunamadı!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Sunucu bağlantısı başarısız!' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!trackingNumber || !(paperDetails?.status === "Kabul Edildi" || paperDetails?.status === "Reddedildi")) {
      return;
    }

    if (paperDetails?.title) {
      setReviseTitle(paperDetails.title);
    }
  
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/get_reviews/${trackingNumber}`);
        const data = await response.json();
        setReviews(data);
      } catch (error) {
        console.error("Yorumlar yüklenirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchReviews();
  }, [trackingNumber, paperDetails?.status, paperDetails?.title]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/get_messages/${trackingNumber}`);
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
      } else {
        console.error('Mesajlar alınamadı:', data.message);
      }
    } catch (error) {
      console.error('Sunucu hatası:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch('/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_code: trackingNumber,
          sender: paperDetails?.email,
          text: newMessage,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages([...messages, { sender: paperDetails?.email, text: newMessage , is_read: false}]);
        setNewMessage('');
      } else {
        console.error('Mesaj gönderilemedi:', data.message);
      }
    } catch (error) {
      console.error('Sunucu hatası:', error);
    }
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setPaperDetails(null);
  };

  const handleOpenPdf = async (articleId: string) => {
    try {
        const response = await fetch(`/get_article_pdf/${articleId}`);

        if (response.ok) {
            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            setPdfUrl(pdfUrl);
            setOpenPdfModal(true);
        } else {
            console.error("PDF yüklenemedi:", response);
        }
    } catch (error) {
        console.error("PDF alınırken hata oluştu:", error);
    }
  };

  const handleClosePdfModal = () => {
    setOpenPdfModal(false);
  };

  const handleReviseOpen = () => setReviseOpen(true);
  const handleReviseClose = () => setReviseOpen(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setFile(file);
    }
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!reviseTitle && !file) {
      setMessage({ type: 'error', text: 'En az bir alanı güncellemeniz gerekir.' });
      return;
    }
  
    const formData = new FormData();
    formData.append('title', reviseTitle);
  
    if (file) {
      formData.append('file', file);
    }
  
    try {
      const response = await fetch(`/revise_article/${trackingNumber}`, {
        method: 'PATCH',
        body: formData,
      });
  
      const data = await response.json();
      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Makale başarıyla revize edildi!',
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Bir hata oluştu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Sunucu bağlantısı başarısız!' });
    }
  };

  const getStatusChip = (status: keyof typeof statusConfig) => {
    const statusConfig = {
      'Beklemede': { label: 'Beklemede', color: 'default' as const },
      'İncelemede': { label: 'İncelemede', color: 'primary' as const },
      'Kabul Edildi': { label: 'Kabul Edildi', color: 'success' as const },
      'Reddedildi': { label: 'Reddedildi', color: 'error' as const },
      'Onay Bekliyor': { label: 'Onay Bekliyor', color: 'warning' as const },
    };
  
    const config = statusConfig[status] || { label: 'Onay Bekliyor', color: 'warning' };
  
    return <Chip label={config.label} color={config.color} size="small" />;
  };
  

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Makale Durumu Sorgulama
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            required
            fullWidth
            label="Makale Takip Numarası"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            margin="normal"
            helperText="Makale yükledikten sonra size verilen takip numarasını girin"
          />
          <TextField
            required
            fullWidth
            label="E-posta"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            helperText="Makaleyi yüklerken kullandığınız e-posta adresini girin"
          />
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
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          >
            {loading ? 'Sorgulanıyor...' : 'Sorgula'}
          </Button>
        </Box>
      </Paper>

      {/* Modal for Paper Details */}
      <Modal open={openModal} onClose={handleCloseModal}>
      <MuiBox
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          width: paperDetails?.status === 'Kabul Edildi' || paperDetails?.status === 'Reddedildi' ? '50%' : '35%',
          maxHeight: '80vh',
          overflowY: 'auto',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
        }}
      >
          {/* Makale Detayları */}
          <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Makale Detayları
            </Typography>
            {paperDetails ? (
              <>
                <Typography variant="body1" gutterBottom>
                  <strong>Başlık:</strong> {paperDetails.title}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Yazarlar:</strong> {paperDetails.authors}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Kurum:</strong> {paperDetails.institution}
                </Typography>
                <Typography variant="body1" gutterBottom>
                <strong>Durum:</strong> {getStatusChip((paperDetails.status ?? 'Beklemede') as 'Beklemede' | 'İncelemede' | 'Onay Bekliyor' | 'Kabul Edildi' | 'Reddedildi')}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Hakem:</strong> {paperDetails.reviewer ? paperDetails.reviewer : "Henüz Atanmadı"}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" gutterBottom>
                Makale bilgileri yükleniyor...
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => handleOpenPdf(trackingNumber)}
                  sx={{ width: paperDetails?.status === 'Reddedildi' ? '50%' : '100%', height: paperDetails?.status === 'Reddedildi' ? '55px' : '40px' }}
                >
                  PDF Görüntüle
                </Button>

                {paperDetails?.status === 'Reddedildi' && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleReviseOpen}
                    sx={{ width: '50%', height: '55px' }}
                  >
                    Revize Et
                  </Button>
                )}
              </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleCloseModal}
                  sx={{ width: '100%', height: '40px' }}
                >
                  Kapat
                </Button>
            </Box>
          </Box>

          {/* Yorum */}
          <Box 
            sx={{ 
              width: "50%", 
              display: paperDetails?.status === "Kabul Edildi" || paperDetails?.status === "Reddedildi" ? "flex" : "none", 
              flexDirection: "column", 
              borderLeft: "1px solid #ddd", 
              pl: 2 
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold", textAlign: "center" }}>
              Yorumlar:
            </Typography>

            {loading ? (
              <CircularProgress size={24} />
            ) : reviews.length > 0 ? (
              reviews.map((review) => (
                <Box key={review.id} sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: "5px" }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                    {review.reviewer}:
                  </Typography>
                  <Typography variant="body1">{review.comments}</Typography>
                  <Typography variant="caption" color="gray">
                    {new Date(review.created_at).toLocaleString()}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body1" gutterBottom>
                Henüz yorum yapılmamış.
              </Typography>
            )}
          </Box>

          {/* Mesajlar Bölümü */}
          <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ddd', pl: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: "center" }}>
              Mesajlar
            </Typography>
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                maxHeight: '300px',
                border: '1px solid #ddd',
                borderRadius: 2,
                p: 2,
              }}
            >
              {messages.map((msg, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography sx={{ mb: 0 }}>
                    <strong>{msg.sender === paperDetails?.email ? 'You' : msg.sender}: </strong>
                    {msg.text}
                  </Typography>
                  {msg.sender === paperDetails?.email && (
                    <Typography
                      sx={{
                        fontSize: '10px',
                        color: 'gray',
                        mt: 0.5,
                      }}
                    >
                      {msg.is_read ? 'read' : 'not read'}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', mt: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Mesaj yaz..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    handleSendMessage();
                    e.preventDefault();
                  }
                }}
              />
              <Button variant="contained" color="primary" onClick={handleSendMessage} sx={{ ml: 1 }}>
                Gönder
              </Button>
            </Box>
          </Box>
        </MuiBox>
      </Modal>
                
      {/* Modal for PDF */}
      <Modal open={openPdfModal} onClose={handleClosePdfModal}>
        <MuiBox
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: 24,
            p: 2,
            width: '80%',
            height: '80vh',
            overflow: 'hidden',
            borderRadius: 2,
          }}
        >
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
            ></iframe>
          )}
          <Button variant="contained" color="secondary" onClick={handleClosePdfModal} sx={{ mt: 2 }}>
            Kapat
          </Button>
        </MuiBox>
      </Modal>
      
      {/* Modal for Revise */}
      <Modal open={reviseOpen} onClose={handleReviseClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "background.paper",
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Makale Revize Et
          </Typography>

          <TextField 
            label="Makale Başlığı" 
            fullWidth 
            variant="outlined" 
            value={reviseTitle} 
            onChange={(e) => setReviseTitle(e.target.value)} 
            sx={{ mb: 2 }} 
          />

          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<CloudUploadIcon />}
            sx={{ mt: 2, mb: 2 }}
          >
            PDF Dosyası Yükle
            <input
              type="file"
              hidden
              accept=".pdf"
              onChange={handleFileChange}
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

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
            <Button variant="contained" color="primary" onClick={handleReviseSubmit}>
              Gönder
            </Button>

            <Button variant="outlined" onClick={handleReviseClose}>
              İptal
            </Button>
          </Box>
        </Box>
      </Modal>
    </Container>
  );
};

export default PaperStatus;
