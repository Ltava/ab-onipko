// Шифрує шаблони для магазину: node tools/encrypt-docs.js <папка з .docx> <файл з ключем>
// Кожен <id>.docx з папки стає private/docs/<id>.enc (AES-256-GCM: IV | тег | шифротекст).
// Ключ (64 hex-символи) має збігатися зі змінною DOCS_KEY на Vercel.
// Незашифровані .docx у репозиторій НЕ додавати — він публічний.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [srcDir, keyFile] = process.argv.slice(2);
if (!srcDir || !keyFile) {
  console.error('Використання: node tools/encrypt-docs.js <папка з .docx> <файл з ключем DOCS_KEY>');
  process.exit(1);
}

const key = Buffer.from(fs.readFileSync(keyFile, 'utf8').match(/[0-9a-f]{64}/i)[0], 'hex');
const outDir = path.join(__dirname, '..', 'private', 'docs');
fs.mkdirSync(outDir, { recursive: true });

for (const name of fs.readdirSync(srcDir).filter(n => n.endsWith('.docx'))) {
  const plain = fs.readFileSync(path.join(srcDir, name));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const out = path.join(outDir, name.replace(/\.docx$/, '.enc'));
  fs.writeFileSync(out, Buffer.concat([iv, cipher.getAuthTag(), enc]));
  console.log('✓', name, '→', path.relative(process.cwd(), out));
}
