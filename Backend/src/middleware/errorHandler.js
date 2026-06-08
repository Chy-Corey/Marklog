// 全局错误处理中间件：捕获未处理的异常，返回统一的 500 响应
export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
}
