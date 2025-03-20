import express from 'express';
import { 
  getRetroBoardHistory, 
  getHistorySnapshot
} from '../db/history.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get history for a retro board
router.get('/retro/:boardId', authenticateToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    
    // Add permissions check here if needed
    
    const history = await getRetroBoardHistory(boardId);
    
    res.json(history);
  } catch (error) {
    console.error('Get retro history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific history snapshot
router.get('/snapshot/:id', authenticateToken, async (req, res) => {
  try {
    const snapshotId = req.params.id;
    
    // Add permissions check here if needed
    
    const snapshot = await getHistorySnapshot(snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'History snapshot not found' });
    }
    
    res.json(snapshot);
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;