import { exportFM001 } from './src/lib/pdfExport.ts';

const mockRecord = {
  id: 'test-123',
  docNo: 'FM-IT-001-TEST',
  attachments: ['https://via.placeholder.com/150'],
};

exportFM001(mockRecord).then(() => console.log('Done')).catch(e => console.error('Error:', e));
