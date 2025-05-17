import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Modal,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Visibility, Edit, Delete, PersonAdd, Close as CloseIcon } from '@mui/icons-material';
import { Eye, EyeOff } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  authors: string;
  email: string;
  status: 'Beklemede' | 'İncelemede' | 'Kabul Edildi' | 'Reddedildi';
  created_at: string;
  updated_at: string;
  reviewer?: string;
  is_authors_anonymous: boolean;
  is_mail_anonymous: boolean;
  pdf_data: string;
  reviewer_name: string;
  interests?: string[];
  institution: string;
  is_institution_anonymous: boolean;
}

const AdminDashboard: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newReviewer, setNewReviewer] = useState({ name: '', interests: '' });
  const [openReviewerDialog, setOpenReviewerDialog] = useState(false);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reviews, setReviews] = useState<{ id: number; reviewer: string; comments: string; created_at: string; }[]>([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openPdfModal, setOpenPdfModal] = useState(false);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await fetch('/get_papers');
        if (!response.ok) {
          throw new Error('Makaleler alınırken hata oluştu.');
        }
        const data = await response.json();
        setPapers(data);
      } catch (error) {
        console.error('Makaleler alınırken hata oluştu', error);
        setMessage({ type: 'error', text: 'Makaleler alınırken hata oluştu.' });
      }
    };

    fetchPapers();
  }, []);

  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const response = await fetch('/get_reviewers');
        if (!response.ok) {
          throw new Error('Makaleler alınırken hata oluştu.');
        }
        const data = await response.json();
        setReviewers(data);
      } catch (error) {
        console.error('Makaleler alınırken hata oluştu', error);
        setMessage({ type: 'error', text: 'Makaleler alınırken hata oluştu.' });
      }
    };

    fetchReviewers();
  }, []);

  useEffect(() => {
    if (selectedPaper) {  
      const updatedPapers = papers.map((paper) => {
        return paper.id === selectedPaper.id
          ? { ...paper, is_authors_anonymous: selectedPaper.is_authors_anonymous, is_mail_anonymous: selectedPaper.is_mail_anonymous }
          : paper;
      });
      setPapers(updatedPapers);
    }
  }, [selectedPaper]);

  const handleAddReviewer = async () => {
    if (!newReviewer.name || !newReviewer.interests) {
      setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun.' });
      return;
    }

    try {
      const response = await fetch('/add_reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReviewer),
      });

      if (!response.ok) {
        throw new Error('Hakem eklenirken hata oluştu.');
      }

      setMessage({ type: 'success', text: 'Hakem başarıyla eklendi!' });
      setOpenReviewerDialog(false);
      setNewReviewer({ name: '', interests: '' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Hakem eklenemedi.' });
    }
  };

  const handleReviewerChange = async (e: React.ChangeEvent<HTMLSelectElement>, paperId: string) => {
    const selectedReviewerId = e.target.value;

    try {
      const response = await fetch(`/assign_reviewer/${paperId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: selectedReviewerId }),
      });

      if (!response.ok) {
        throw new Error('Hakem ataması yapılırken hata oluştu.');
      }

      setMessage({ type: 'success', text: 'Hakem başarıyla atandı!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Hakem ataması yapılamadı.' });
    }
  };

  const handleToggleAnonymity = async (
    paperId: number,
    field: 'is_authors_anonymous' | 'is_mail_anonymous' | 'is_institution_anonymous',
    value: boolean
  ) => {
    try {
      const response = await fetch(`/update_article/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
  
      if (!response.ok) {
        throw new Error('Anonimlik durumu güncellenirken hata oluştu.');
      }
  
      setPapers((prevPapers) =>
        prevPapers.map((paper) =>
          paper.id === String(paperId) ? { ...paper, [field]: value } : paper
        )
      );
  
      if (value) {
        await handleBlurPdf(paperId, field);
      }
      else {
        await handleUnblurPdf(paperId, field);
      }
  
      setMessage({ type: 'success', text: 'Anonimlik durumu güncellendi!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Anonimlik güncellenemedi.' });
    }
  };
  
  const handleViewDetails = async (paper: Paper) => {
    setSelectedPaper(paper);
    try {
      const response = await fetch(`/get_article_pdf/${paper.id}`);
      if (response.ok) {
        const pdfBlob = await response.blob();
        paper.pdf_data = URL.createObjectURL(pdfBlob);
      } else {
        console.error("PDF yüklenemedi:", response);
      }

      fetchReviews(paper.id)

      setOpenModal(true);
    } catch (error) {
      console.error("Detaylar alınırken hata oluştu:", error);
    }
  };
  const filteredPapers = papers.filter((paper) =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBlurPdf = async (paperId: number, field: 'is_authors_anonymous' | 'is_mail_anonymous' | 'is_institution_anonymous') => {
    try {
      const response = await fetch(`/blur_article_pdf/${paperId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
  
      if (!response.ok) {
        throw new Error('PDF blurlanırken hata oluştu.');
      }
      
      const data = await response.json();
      setPapers((prevPapers) =>
        prevPapers.map((paper) =>
          Number(paper.id) === paperId ? { ...paper, pdf_data: data.pdf_data } : paper
        )
      );
  
      setMessage({ type: 'success', text: 'PDF başarıyla blurlandı!' });
    } catch (error) {
      console.error('PDF blurlanırken hata oluştu', error);
      setMessage({ type: 'error', text: 'PDF blurlanırken hata oluştu.' });
    }
  };

  const handleUnblurPdf = async (paperId: number, field: 'is_authors_anonymous' | 'is_mail_anonymous' | 'is_institution_anonymous') => {
    try {
      const response = await fetch(`/unblur_article_pdf/${paperId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
  
      if (!response.ok) {
        throw new Error('PDF unblurlanırken hata oluştu.');
      }
  
      const data = await response.json();
      setPapers((prevPapers) =>
        prevPapers.map((paper) =>
          Number(paper.id) === paperId ? { ...paper, pdf_data: data.pdf_data } : paper
        )
      );
  
      setMessage({ type: 'success', text: 'PDF başarıyla unblurlandı!' });
    } catch (error) {
      console.error('PDF unblurlanırken hata oluştu', error);
      setMessage({ type: 'error', text: 'PDF unblurlanırken hata oluştu.' });
    }
  };

  const fetchReviews = async (paperId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/get_reviews/${paperId}`);
      const data = await response.json();
      setReviews(data);
    } catch (error) {
      console.error("Yorumlar yüklenirken hata oluştu:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAuthor = async () => {
    if (!selectedPaper?.id) return;
  
    try {
      
      const updateResponse = await fetch(`/update_article/${selectedPaper.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_authors_anonymous: false,
          is_mail_anonymous: false,
          is_institution_anonymous: false,
        }),
      });
  
      const updateResult = await updateResponse.json();
  
      if (!updateResponse.ok) {
        alert(`Hata: ${updateResult.error}`);
        return;
      }
  
      
      const fields = ["is_authors_anonymous", "is_mail_anonymous", "is_institution_anonymous"];
  
      for (const field of fields) {
        const unblurResponse = await fetch(`/unblur_article_pdf/${selectedPaper.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ field }),
        });
  
        const unblurResult = await unblurResponse.json();
  
        if (!unblurResponse.ok) {
          alert(`Unblur işlemi başarısız (${field}): ${unblurResult.error}`);
          return;
        }
      }
  
      alert("Makale anonimlik bilgisi kaldırıldı ve PDF güncellendi.");
  
    } catch (error) {
      console.error("İşlem sırasında hata oluştu:", error);
      alert("Bağlantı hatası! Lütfen tekrar deneyin.");
    }
  };  

  const maskName = (name: string) => {
    if (!name) return '';
    return name[0] + '***';
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedPaper(null);
  };

  const handleOpenPdf = (pdfData: string) => {
    setOpenPdfModal(true);
  };

  const handleClosePdfModal = () => {
    setOpenPdfModal(false);
  };

  const getStatusChip = (status: Paper['status']) => {
    const statusConfig = {
      'Beklemede': { label: 'Beklemede', color: 'default' as const },
      'İncelemede': { label: 'İncelemede', color: 'primary' as const },
      'Kabul Edildi': { label: 'Kabul Edildi', color: 'success' as const },
      'Reddedildi': { label: 'Reddedildi', color: 'error' as const },
    };

    const config = statusConfig[status];
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  return (
    <Container maxWidth={false}>
      <Paper elevation={3} sx={{ p: 4, mt: 4, position: 'relative' }}>

        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => setOpenReviewerDialog(true)}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: '#FFFFFF',
            boxShadow: 'none',
            color: '#0D47A1',
            textTransform: 'none',
            fontSize: '16px',
            borderRadius: '25px',
            '&:hover': {
              boxShadow: 'none',
              backgroundColor: '#BBDEFB',
            },
          }}
        >
          Hakem Ekle
        </Button>

        <Typography variant="h4" gutterBottom>
          Yönetici Paneli
        </Typography>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
          <TextField
            label="Makale, Yazar veya E-posta Ara..."
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 300 }}
          />
        </Box>

        <TableContainer component={Paper} sx={{ mt: 3, width: '100%', overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Başlık</TableCell>
                <TableCell>Yazar</TableCell>
                <TableCell>E-posta</TableCell>
                <TableCell>Kurum</TableCell>
                <TableCell>Durum</TableCell>
                <TableCell>Hakem</TableCell>
                <TableCell>Tarih</TableCell>
                <TableCell>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPapers.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell>{paper.title}</TableCell>
                  <TableCell>
                    {paper.is_authors_anonymous ? (
                      <Tooltip title="Yazarlar gizli">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_authors_anonymous', false)}>
                          <EyeOff size={20} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Yazarlar görünür">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_authors_anonymous', true)}>
                          <Eye size={20} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {paper.is_authors_anonymous ? maskName(paper.authors) : paper.authors}
                  </TableCell>
                  <TableCell>
                    {paper.is_mail_anonymous ? (
                      <Tooltip title="E-posta adresi gizli">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_mail_anonymous', false)}>
                          <EyeOff size={20} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="E-posta adresi görünür">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_mail_anonymous', true)}>
                          <Eye size={20} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {paper.is_mail_anonymous ? maskName(paper.email) : paper.email}
                  </TableCell>
                  <TableCell>
                    {paper.is_institution_anonymous ? (
                      <Tooltip title="Kurum gizli">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_institution_anonymous', false)}>
                          <EyeOff size={20} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Kurum görünür">
                        <IconButton onClick={() => handleToggleAnonymity(Number(paper.id), 'is_institution_anonymous', true)}>
                          <Eye size={20} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {paper.is_institution_anonymous ? maskName(paper.institution) : paper.institution}
                  </TableCell>
                  <TableCell>{getStatusChip(paper.status)}</TableCell>
                  <TableCell>
                    <select
                      value={paper.reviewer || ""}
                      onChange={(e) => handleReviewerChange(e, paper.id)}
                      style={{ padding: "8px", borderRadius: "4px", width: "100%" }}
                    >
                      <option value="">Hakem Seçin</option>
                      {reviewers.length > 0 ? (
                        reviewers
                          .filter((reviewer) => {
                            if (Array.isArray(paper.interests) && paper.interests.length > 0) {
                              return paper.interests.some(
                                (interest) => reviewer.interests?.toLowerCase() === interest.toLowerCase()
                              );
                            }
                            return true;
                          })
                          .map((reviewer) => (
                            <option key={reviewer.id} value={reviewer.id}>
                              {reviewer.name} ({reviewer.interests})
                            </option>
                          ))
                      ) : (
                        <option disabled>İlgili hakem bulunamadı</option>
                      )}
                    </select>
                  </TableCell>
                  <TableCell>{new Date(paper.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleViewDetails(paper)}>
                      <Visibility />
                    </IconButton>
                    <IconButton size="small">
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Hakem Ekleme Dialog */}
        <Dialog open={openReviewerDialog} onClose={() => setOpenReviewerDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Yeni Hakem Ekle</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Hakem Adı"
              value={newReviewer.name}
              onChange={(e) => setNewReviewer({ ...newReviewer, name: e.target.value })}
              sx={{ mt: 2 }}
            />
            <TextField
              fullWidth
              label="İlgi Alanları"
              value={newReviewer.interests}
              onChange={(e) => setNewReviewer({ ...newReviewer, interests: e.target.value })}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenReviewerDialog(false)}>İptal</Button>
            <Button onClick={handleAddReviewer} color="primary">
              Kaydet
            </Button>
          </DialogActions>
        </Dialog>

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
              width: selectedPaper?.status === 'Kabul Edildi' || selectedPaper?.status === 'Reddedildi' ? '35%' : '20%',
              maxHeight: '80vh',
              overflowY: 'auto',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'row',
              gap: 2,
            }}
          >

            <Box sx={{ width: selectedPaper?.status === 'Kabul Edildi' || selectedPaper?.status === 'Reddedildi' ? '50%' : '100%', display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center', flexGrow: 1 }}>
                  Makale Detayları
                </Typography>
                <CloseIcon
                  onClick={handleCloseModal}
                  sx={{ cursor: 'pointer', color: 'gray', '&:hover': { color: 'black' } }}
                />
              </Box>
              {selectedPaper ? (
                <>
                  <Typography variant="body1" gutterBottom>
                    <strong>Başlık:</strong> {selectedPaper.title}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Yazarlar:</strong> {selectedPaper.authors}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Durum:</strong> {selectedPaper.status}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Hakem:</strong> {selectedPaper.reviewer_name ? selectedPaper.reviewer_name : 'Henüz Atanmadı'}
                  </Typography>
                  {selectedPaper.interests && selectedPaper.interests.length > 0 && (
                    <Typography variant="body1" gutterBottom>
                      <strong>İlgi Alanları:</strong> {selectedPaper.interests.join(", ")}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" gutterBottom>
                  Makale bilgileri yükleniyor...
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="contained" color="secondary" onClick={handleCloseModal}>
                  Kapat
                </Button>
                {selectedPaper?.pdf_data && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => selectedPaper?.pdf_data && handleOpenPdf(selectedPaper.pdf_data)}
                  >
                    PDF Görüntüle
                  </Button>
                )}
              </Box>
            </Box>
            <Box 
            sx={{ 
              width: "50%", 
              display: selectedPaper?.status === "Kabul Edildi" || selectedPaper?.status === "Reddedildi" ? "flex" : "none",
              flexDirection: "column", 
              borderLeft: "1px solid #ddd", 
              pl: 3,
              height: "100%", 
              maxHeight: "100vh", 
              position: "relative",
            }}
          >
              <Typography variant="h6" sx={{ fontWeight: "bold", textAlign: "center", mb: 2 }}>
                Yorumlar:
              </Typography>

              {/* Yorumlar için dikey scroll alanı */}
              <Box
                sx={{
                  maxHeight: "60vh",
                  pr: 1,
                  "& > *": {
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }
                }}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : reviews.length > 0 ? (
                  reviews.map((review) => (
                    <Box key={review.id} sx={{ 
                      mb: 2, 
                      p: 1, 
                      bgcolor: "#f5f5f5", 
                      borderRadius: "5px",
                      maxWidth: "100%",
                      maxHeight: "220px",
                      display: "flex",
                      flexDirection: "column"
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                        {review.reviewer}:
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          wordWrap: "break-word",
                          overflow: "auto",
                          flexGrow: 1,
                          py: 1
                        }}
                      >
                        {review.comments}
                      </Typography>
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

              {/* Sabit buton */}
              <Box 
                sx={{
                  position: "sticky",
                  bottom: 0,
                  bgcolor: "background.paper",
                  p: 2,
                  borderTop: "1px solid #ddd",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  size="small" 
                  sx={{ 
                    width: "auto", 
                    px: 2, 
                  }}
                  onClick={handleSendToAuthor}
                >
                  Anonimliği Kaldır ve Gönder
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
            {selectedPaper?.pdf_data && (
              <iframe
                src={selectedPaper.pdf_data}
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
      </Paper>
    </Container>
  );
};

export default AdminDashboard;