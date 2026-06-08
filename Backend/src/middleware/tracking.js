import db from '../content/db.js';

// 预编译插入语句
const stmtInsertView = db.prepare(
  'INSERT INTO page_views (path) VALUES (?)'
);

// 统计中间件：记录页面访问
export function trackPageView(req, res, next) {
  // 只统计 GET 请求的页面访问，排除 API 和静态资源
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
    stmtInsertView.run(req.path);
  }
  next();
}
