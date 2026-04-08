// 运行时注入环境变量，用于 Cloudflare Pages
// Cloudflare Pages 会自动替换 {{NAME}} 占位符
window.__env = window.__env || {};
window.__env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = '{{NEXT_PUBLIC_PAYPAL_CLIENT_ID}}';
window.__env.NEXT_PUBLIC_BASE_URL = '{{NEXT_PUBLIC_BASE_URL}}';
window.__env.PAYPAL_ENVIRONMENT = '{{PAYPAL_ENVIRONMENT}}';
