import React, { useState, useEffect } from 'react';
import { Container, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

interface Log {
  id: number;
  article_id: number;
  reviewer_id: number;
  event: string;
  timestamp: string;
}

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/get_logs')
      .then(response => response.json())
      .then(data => setLogs(data))
      .catch(error => console.error('Logları çekerken hata oluştu:', error));
  }, []);

  const filteredLogs = logs.filter(log =>
    log.event.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container maxWidth="lg">
    <Paper elevation={3} sx={{ p: 4, mt: 4, position: 'relative' }}>
      <Typography variant="h4" gutterBottom>
        Log Kayıtları
      </Typography>
      <TextField
        label="Ara"
        variant="outlined"
        fullWidth
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Makale ID</TableCell>
              <TableCell>Hakem ID</TableCell>
              <TableCell>Olay</TableCell>
              <TableCell>Zaman Damgası</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.id}</TableCell>
                <TableCell>{log.article_id}</TableCell>
                <TableCell>{log.reviewer_id}</TableCell>
                <TableCell>{log.event}</TableCell>
                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>
    </Container>
  );
};

export default Logs;