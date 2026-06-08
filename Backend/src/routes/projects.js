import { Router } from 'express';
import { getProjects } from '../content/contentService.js';

const router = Router();

// GET /api/projects — 返回所有项目列表，按 sort_order 升序排列
router.get('/', (req, res) => {
  res.json(getProjects());
});

export default router;
