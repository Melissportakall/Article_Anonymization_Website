import React, { ChangeEvent, useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Modal,
  Box,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';


const ReviewerDashboard: React.FC = () => {
  const [reviewerName, setReviewerName] = useState<string>('');
  const [papers, setPapers] = useState<any[]>([]);
  const [search, setSearch] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [messages, setMessages] = useState<{ sender: string | undefined; text: string; is_read: boolean }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [openPdfModal, setOpenPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [comment, setComment] = useState<string>('');
  const [status, setStatus] = useState(selectedPaper?.status || "İncelemede");

  const handleReviewerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReviewerName(e.target.value);
  };

  const fetchAssignedPapers = async () => {
    if (!reviewerName) {
      setSearch('Lütfen hakem adı girin.');
      return;
    }

    try {
      const response = await fetch(`/reviewer_articles?name=${reviewerName}`);
      if (!response.ok) {
        throw new Error('Hakem veya makale bulunamadı.');
      }
      const data = await response.json();
      setPapers(data);
      setSearch(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      setSearch(errorMessage);
    }
  };

  const handleViewDetails = async (paper: any) => {
    setSelectedPaper(paper);
    try {
      const response = await fetch(`/get_article_pdf/${paper.id}`);
      if (!response.ok) {
        throw new Error('PDF alınırken hata oluştu.');
      }
      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(pdfUrl);
      setSelectedPaper({ ...paper });
    } catch (error) {
      console.error('PDF alınırken hata oluştu', error);
      setSearch('PDF alınırken bir hata oluştu.');
    }

    fetchMessages(paper.id);
    setOpenModal(true);
  };

  const fetchMessages = async (paperId: number) => {
    try {
      const response = await fetch(`/get_messages_for_reviewer/${paperId}`);
      if (!response.ok) {
        throw new Error('Mesajlar alınamadı.');
      }
      const data = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('Mesajlar alınırken hata oluştu', error);
      setSearch('Mesajlar alınırken bir hata oluştu.');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch('/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_code: selectedPaper.id,
          sender: reviewerName,
          text: newMessage,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages([...messages, { sender: reviewerName, text: newMessage, is_read: false }]);
        setNewMessage('');
      } else {
        console.error('Mesaj gönderilemedi:', data.message);
      }
    } catch (error) {
      console.error('Sunucu hatası:', error);
    }
  };

  const handleOpenPdf = () => {
    setOpenPdfModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedPaper(null);
    setComment('');
  };

  const handleClosePdfModal = () => {
    setOpenPdfModal(false);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  const handleSendComment = async () => {
    if (!comment.trim() || !selectedPaper) return;
  
    try {
      const response = await fetch('/submit_review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: selectedPaper.id,
          comments: comment,
          status: status,
        }),
      });
  
      const data = await response.json();
      if (response.ok) {
        alert('Yorum başarıyla kaydedildi ve PDF güncellendi!');
        setComment('');
        setSelectedPaper({
          ...selectedPaper,
          status: status,
        });
      } else {
        console.error('Yorum gönderilemedi:', data.message);
      }
    } catch (error) {
      console.error('Sunucu hatası:', error);
    }
  };

  const handleStatusChange = (status: String) => {
    setStatus(status);
  }

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mt: 4, position: 'relative' }}>
        <Typography variant="h4" gutterBottom>
          Hakem Paneli
        </Typography>

        {/* Hakem adı girişi */}
        <TextField
          label="Hakem Adı"
          variant="outlined"
          fullWidth
          value={reviewerName}
          onChange={handleReviewerNameChange}
          sx={{ mb: 2 }}
        />
        <Button variant="contained" color="primary" onClick={fetchAssignedPapers} sx={{ mb: 3 }}>
          Atanan Makaleleri Getir
        </Button>

        {search && <Typography color="error">{search}</Typography>}

        {/* Makaleler Listesi */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Başlık</TableCell>
                <TableCell>Yazarlar</TableCell>
                <TableCell>E-posta</TableCell>
                <TableCell>Kurum</TableCell>
                <TableCell>Durum</TableCell>
                <TableCell>Gönderim Tarihi</TableCell>
                <TableCell>Son Tarih</TableCell>
                <TableCell>Özet</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {papers.map((paper) => (
                <TableRow key={paper.id} onClick={() => handleViewDetails(paper)} style={{ cursor: 'pointer' }}>
                  <TableCell>{paper.title}</TableCell>
                  <TableCell>{paper.authors}</TableCell>
                  <TableCell>{paper.email}</TableCell>
                  <TableCell>{paper.institution}</TableCell>
                  <TableCell>{paper.status}</TableCell>
                  <TableCell>{new Date(paper.created_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(paper.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal for Paper Details */}
      <Modal open={openModal} onClose={handleCloseModal}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            width: '750px', 
            maxHeight: '80vh',
            overflowY: 'auto',
            borderRadius: 2,
            display: 'flex', 
            flexDirection: 'row', 
            gap: 2, 
          }}
        >
          {/* Sol taraf - Makale Detayları */}
          <Box sx={{ width: "50%", display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", textAlign: "center" }}>
              Makale Detayları
            </Typography>

            {selectedPaper ? (
              <>
                <Typography variant="body1">
                  <strong>Başlık:</strong> {selectedPaper.title}
                </Typography>
                <Typography variant="body1">
                  <strong>Durum:</strong> {selectedPaper.status}
                </Typography>
                <Typography variant="body1">
                  <strong>Durumu Güncelle:</strong>
                </Typography>
                <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} fullWidth>
                  <MenuItem value="İncelemede">İncelemede</MenuItem>
                  <MenuItem value="Kabul Edildi">Kabul Edildi</MenuItem>
                  <MenuItem value="Reddedildi">Reddedildi</MenuItem>
                </Select>
                {/* Yorum Alanı */}
                <Typography variant="body1">
                  <strong>Yorum:</strong>
                </Typography>
                <textarea
                  value={comment}
                  onChange={handleCommentChange}
                  style={{
                    width: "100%",
                    height: "100px",
                    resize: "vertical",
                    padding: "8px",
                    fontSize: "14px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
                {/* Butonlar */}
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleOpenPdf}
                    sx={{ minWidth: "120px", padding: "6px 12px" }}
                  >
                    PDF Görüntüle
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSendComment}
                    sx={{ minWidth: "120px", padding: "6px 12px", ml: 2 }}
                  >
                    Yorumu Gönder
                  </Button>
                </Box>
              </>
            ) : (
              <Typography variant="body2" gutterBottom>
                Makale bilgileri yükleniyor...
              </Typography>
            )}
          </Box>
          <Box sx={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #ddd',
            pl: 2,
            gap: 2,
          }}>

            {/* Mesajlar */}
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
                    <strong>{msg.sender === selectedPaper?.email ? msg.sender : 'You'}: </strong>
                    {msg.text}
                  </Typography>
                  {msg.sender !== selectedPaper?.email && (
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
        </Box>
      </Modal>
      {/* Modal for PDF */}
      <Modal open={openPdfModal} onClose={handleClosePdfModal}>
        <Box
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
        </Box>
      </Modal>
    </Container>
  );
};

export default ReviewerDashboard;