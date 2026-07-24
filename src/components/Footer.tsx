import { Box, Typography } from '@mui/material';

export function Footer() {
  return (
    <Box component="footer" sx={{ mt: 'auto', pt: 4, pb: 2, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ opacity: 0.4 }}>
        © 2026 Filippo Morano - by SpikeCode AI
      </Typography>
    </Box>
  );
}
