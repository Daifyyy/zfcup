import DOMPurify from 'dompurify'

// Sanitizace HTML z rich-text editoru před dangerouslySetInnerHTML
// Povoluje bezpečné HTML tagy (bold, italic, links, lists) — blokuje skripty
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'a', 'blockquote', 'hr', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    ALLOW_DATA_ATTR: false,
  })
}
