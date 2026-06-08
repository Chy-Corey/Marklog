import { Router } from 'express';
import { getFriends } from '../content/contentService.js';

const router = Router();

// GET /api/friends — 返回所有友链列表
router.get('/', (req, res) => {
  res.json(getFriends());
});

export default router;
