import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 解析行内 Markdown（加粗、链接等），不解析块级元素（标题、段落等）
export function renderInlineMarkdown(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parseInline(text));
}
