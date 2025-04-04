import express from 'express';
import { 
  getRetroBoardHistory, 
  getHistorySnapshot
} from '../db/history.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../logger.js'; // Import the logger

const router = express.Router();

// Get history for a retro board
// Add 'next'
router.get('/retro/:boardId', authenticateToken, async (req, res, next) => {
  try {
    const boardId = req.params.boardId;

    // Add permissions check here if needed
    const history = await getRetroBoardHistory(boardId);
    res.json(history);
  } catch (error) {
    logger.error('Get retro history error:', { error: error.message, stack: error.stack, boardId: req.params.boardId, userId: req.user?.userId });
    // Pass error to the centralized handler
    next(error);
  }
});

// Get a specific history snapshot
// Add 'next'
router.get('/snapshot/:id', authenticateToken, async (req, res, next) => {
  try {
    const snapshotId = req.params.id;

    // Add permissions check here if needed
    
    const snapshot = await getHistorySnapshot(snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'History snapshot not found' });
    }
    res.json(snapshot);
  } catch (error) {
    logger.error('Get snapshot error:', { error: error.message, stack: error.stack, snapshotId: req.params.id, userId: req.user?.userId });
    // Pass error to the centralized handler
    next(error);
  }
});

export default router;
