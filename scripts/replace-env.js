// 在构建前替换 public/env.js 中的环境变量占位符
const fs = require('fs');
const path = require('path');

const envJsPath = path.join(__dirname, '..', 'public', 'env.js');
let content = fs.readFileSync(envJsPath, 'utf8');

// 替换所有 %VAR% 占位符为实际环境变量
content = content.replace(/%([A-Z0-9_]+)%/g, (match, varName) => {
  return process.env[varName] || '';
});

fs.writeFileSync(envJsPath, content);
console.log(`Replaced environment variables in public/env.js`);
console.log(`NEXT_PUBLIC_PAYPAL_CLIENT_ID: ${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? '✓ configured' : '✗ missing'}`);
console.log(`NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL ? '✓ configured' : '✗ missing'}`);
