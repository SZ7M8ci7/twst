import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { normalizePath, transformWithEsbuild, type Plugin } from 'vite'

const PUBLIC_ID = 'virtual:exam-auto-best-worker-host'
const RESOLVED_ID = normalizePath(fileURLToPath(new URL('../src/generated/examAutoBestWorkerHost.ts', import.meta.url)))

export function examAutoBestWorkerHostPlugin(): Plugin {
  return {
    name: 'exam-auto-best-worker-host',
    enforce: 'pre',
    resolveId(id) {
      return id === PUBLIC_ID ? RESOLVED_ID : null
    },
    async load(id) {
      const normalizedId = normalizePath(id).split('?', 1)[0]
      if (normalizedId !== RESOLVED_ID) return null

      const filename = fileURLToPath(new URL('../src/views/examSimulator.vue', import.meta.url))
      const source = readFileSync(filename, 'utf8')
      const { descriptor, errors } = parse(source, { filename })
      if (errors.length) throw errors[0]

      let code = compileScript(descriptor, {
        id: 'exam-auto-best-worker-host',
        genDefaultAs: '__examAutoBestWorkerHost',
      }).content

      code = code
        .replace("import { Bar } from 'vue-chartjs';", 'const Bar = null;')
        .replace("import { Chart, registerables } from 'chart.js';", 'const Chart = null; const registerables = [];')
        .replace(/import defaultImg from '@\/assets\/img\/default\.webp';/, "const defaultImg = '';")
        .replace(/import fireIcon from '@\/assets\/img\/fire\.webp';/, "const fireIcon = '';")
        .replace(/import waterIcon from '@\/assets\/img\/water\.webp';/, "const waterIcon = '';")
        .replace(/import floraIcon from '@\/assets\/img\/flora\.webp';/, "const floraIcon = '';")
        .replace(/import cosmicIcon from '@\/assets\/img\/cosmic\.webp';/, "const cosmicIcon = '';")
        .replace(
          "import { loadCachedImageUrl, loadCharacterImageUrl } from '@/utils/characterAssets';",
          "const loadCachedImageUrl = async () => ''; const loadCharacterImageUrl = async () => '';",
        )
        .replace("import SimCharaModal from '@/components/SimCharaModal.vue';", 'const SimCharaModal = null;')
        .replace("import SimCharaDetailModal from '@/components/SimCharaDetailModal.vue';", 'const SimCharaDetailModal = null;')
        .replace('Chart.register(...registerables);', '')
        .replace(
          /onMounted\(\(\) => \{[\s\S]*?savedExamSettings\.value = loadSavedExamSimulatorSettings\(\);[\s\S]*?\}\);/,
          '',
        )
        .replace(
          /watch\(simulationMode, \(mode\) => \{[\s\S]*?(?=function markEnemyConditionsTouched)/,
          '',
        )
        .replace(
          /function createAutoBestWorkerClient\(\)[\s\S]*?(?=async function runAutoBestSimulation)/,
          '',
        )
        .replace(
          /async function runAutoBestSimulation\([^)]*\)[\s\S]*?(?=async function searchAutoBestSeed)/,
          '',
        )
        .replace(/\b(?:createAutoBestWorkerClient|ensureAutoBestWorkerPool|searchAutoBestSeedParallel|runAutoBestSimulation),\s*/g, '')
        .replace(/autoBestWorkerPool\?\.forEach\([^;]+;/, '')

      const forbiddenWorkerHostReferences = [
        'examAutoBest.worker.ts',
        'createAutoBestWorkerClient',
        'ensureAutoBestWorkerPool',
        'searchAutoBestSeedParallel',
      ].filter((reference) => code.includes(reference))
      if (forbiddenWorkerHostReferences.length > 0) {
        throw new Error(`Worker host still contains recursive UI worker references: ${forbiddenWorkerHostReferences.join(', ')}`)
      }

      return (await transformWithEsbuild(
        `${code}\nexport default __examAutoBestWorkerHost;`,
        filename,
        { loader: 'ts', target: 'es2020' },
      )).code
    },
  }
}
