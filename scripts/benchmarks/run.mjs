import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const module = await server.ssrLoadModule('/scripts/benchmarks/search.ts');
  await module.main(process.argv.slice(2));
} finally { await server.close(); }
