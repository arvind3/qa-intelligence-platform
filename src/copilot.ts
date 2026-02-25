import type { TestCaseRow } from './types'

let webllmEngine: any = null
let hfGenerator: any = null
let activeMode: 'webgpu' | 'cpu-wasm' | 'unavailable' = 'unavailable'
let activeModel = ''

export type ModelProfile = 'ultra-light' | 'balanced' | 'quality'
let modelProfile: ModelProfile = 'balanced'

const WEBLLM_MODELS: Record<ModelProfile, string[]> = {
  'ultra-light': [
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  ],
  balanced: [
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    'gemma-2-2b-it-q4f16_1-MLC',
    'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
  ],
  quality: [
    'gemma-2-2b-it-q4f16_1-MLC',
    'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  ],
}

const HF_FALLBACK_MODELS: Record<ModelProfile, string[]> = {
  'ultra-light': [
    'Xenova/LaMini-Flan-T5-77M',
    'Xenova/distilgpt2',
  ],
  balanced: [
    'onnx-community/gemma-2-2b-it',
    'Xenova/LaMini-Flan-T5-77M',
    'Xenova/flan-t5-small',
    'Xenova/distilgpt2',
  ],
  quality: [
    'onnx-community/gemma-2-2b-it',
    'Xenova/flan-t5-small',
    'Xenova/distilgpt2',
  ],
}

function buildContext(context: TestCaseRow[]) {
  const unique = new Map<string, TestCaseRow>()
  for (const t of context) {
    const k = `${t.title}|${t.test_suite_id}`.toLowerCase()
    if (!unique.has(k)) unique.set(k, t)
    if (unique.size >= 8) break
  }

  return [...unique.values()]
    .map((t) => {
      const title = t.title.slice(0, 120)
      const tags = (t.tags || []).slice(0, 5).join(',')
      return `- id=${t.test_case_id}; suite=${t.test_suite_id}; title=${title}; tags=${tags}`
    })
    .join('\n')
}

function lowQuality(answer: string, question: string) {
  const a = (answer || '').trim().toLowerCase()
  const q = (question || '').trim().toLowerCase()
  if (!a) return true
  if (a.length < 90) return true
  if (a.includes('qa intelligence copilot') && a.length < 240) return true
  if (a === q || a.includes(q)) return true
  if (/^[-\s]*tc-/i.test(a) && a.length < 240) return true
  if (!/summary:|evidence:|recommended actions:/i.test(a)) return true
  return false
}

function composeDeterministicAnswer(question: string, context: TestCaseRow[]) {
  const items = context.slice(0, 8)
  const sample = items.map((t) => `${t.test_case_id} (${t.test_suite_id})`).join(', ') || 'No candidate tests found'

  const has = (w: string[]) => w.some((x) => question.toLowerCase().includes(x))

  let summary = 'Prioritize high-overlap semantic families and weak-governance areas first.'
  let actions = [
    'Create a consolidation backlog for top semantic duplicate families.',
    'Parameterize repetitive variants instead of keeping separate test cases.',
    'Assign ownership and normalize tags for tests with governance gaps.',
  ]

  if (has(['coverage', 'gap'])) {
    summary = 'Coverage risk is likely concentrated where feature families have thin representation and inconsistent tagging.'
    actions = [
      'Map underrepresented feature clusters and add 2-3 targeted tests per cluster.',
      'Review suites with low diversity and rebalance toward missing business intents.',
      'Track entropy and orphan-tag ratio after each cleanup sprint.',
    ]
  } else if (has(['duplicate', 'redundan', 'consolidate'])) {
    summary = 'Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families.'
    actions = [
      'Remove exact duplicates first (lowest risk, immediate runtime gain).',
      'Convert near-duplicate groups into parameterized test templates.',
      'Set a threshold policy so new duplicate candidates are flagged early.',
    ]
  } else if (has(['governance', 'tag'])) {
    summary = 'Governance quality can be improved quickly through tag normalization and ownership assignment.'
    actions = [
      'Standardize tags into a controlled taxonomy (lowercase + approved values).',
      'Assign owners for orphan tests and enforce metadata checks in CI.',
      'Add a weekly quality gate for orphan-tag ratio and naming drift.',
    ]
  } else if (has(['regression', 'runtime'])) {
    summary = 'Regression runtime can be reduced by removing low-value overlap while preserving intent coverage.'
    actions = [
      'Keep one representative test per semantic family for default regression.',
      'Run expanded family members only in nightly or risk-triggered runs.',
      'Measure runtime savings versus escaped defect trend to tune thresholds.',
    ]
  }

  return `Summary:\n${summary}\n\nEvidence:\nTop evidence IDs: ${sample}\n\nRecommended Actions:\n- ${actions.join('\n- ')}`
}

async function generateWithWebLLM(question: string, brief: string) {
  const res = await webllmEngine.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a QA Intelligence Copilot. Always return structured output with exactly these sections: Summary, Evidence, Recommended Actions. Keep concise and practical. Use evidence IDs from context. Do not echo the prompt.',
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nContext tests:\n${brief}`,
      },
    ],
    temperature: 0.1,
  })
  return res.choices?.[0]?.message?.content || ''
}

async function generateWithHF(question: string, brief: string) {
  const prompt = `You are QA Intelligence Copilot.\nReturn format:\nSummary:\nEvidence:\nRecommended Actions:\nQuestion: ${question}\nContext:\n${brief}\nAnswer:`

  const out = await hfGenerator(prompt, {
    max_new_tokens: 180,
    temperature: 0.1,
    do_sample: false,
  })

  const text = Array.isArray(out)
    ? out[0]?.generated_text || out[0]?.summary_text || out[0]?.text || ''
    : ''

  return text.replace(prompt, '').trim()
}

export function setModelProfile(profile: ModelProfile) {
  modelProfile = profile
  // force re-init for profile change
  webllmEngine = null
  hfGenerator = null
  activeMode = 'unavailable'
  activeModel = ''
}

export function getModelProfile() {
  return modelProfile
}

export async function initReasoningEngine() {
  if (webllmEngine || hfGenerator) return `${activeMode}:${activeModel}`

  const errors: string[] = []

  // 1) Try WebGPU local LLM first
  try {
    const webllm = await import('@mlc-ai/web-llm')
    for (const model of WEBLLM_MODELS[modelProfile]) {
      try {
        webllmEngine = await webllm.CreateMLCEngine(model)
        activeMode = 'webgpu'
        activeModel = model
        return `${activeMode}:${activeModel}`
      } catch (err: any) {
        errors.push(`${model} => ${err?.message || 'init failed'}`)
      }
    }
  } catch (err: any) {
    errors.push(`webllm import => ${err?.message || 'failed'}`)
  }

  // 2) CPU/WASM fallback local model (transformers.js)
  try {
    const mod = await import('@huggingface/transformers')
    for (const model of HF_FALLBACK_MODELS[modelProfile]) {
      try {
        hfGenerator = await mod.pipeline('text2text-generation', model)
        activeMode = 'cpu-wasm'
        activeModel = model
        return `${activeMode}:${activeModel}`
      } catch (err1: any) {
        try {
          hfGenerator = await mod.pipeline('text-generation', model)
          activeMode = 'cpu-wasm'
          activeModel = model
          return `${activeMode}:${activeModel}`
        } catch (err2: any) {
          errors.push(`hf fallback ${model} => ${err1?.message || 'seq2seq failed'} | ${err2?.message || 'causal failed'}`)
        }
      }
    }
  } catch (err: any) {
    errors.push(`hf import => ${err?.message || 'failed'}`)
  }

  activeMode = 'unavailable'
  activeModel = 'none'
  throw new Error(`llm-init-failed: ${errors.join(' | ')}`)
}

export function isReasoningReady() {
  return !!webllmEngine || !!hfGenerator
}

export function getReasoningMode() {
  return `${activeMode}:${activeModel}`
}

export async function askCopilot(question: string, context: TestCaseRow[]) {
  if (!isReasoningReady()) {
    throw new Error('copilot-not-initialized: local LLM runtime unavailable')
  }

  const brief = buildContext(context)

  let answer = ''
  if (webllmEngine) answer = await generateWithWebLLM(question, brief)
  else answer = await generateWithHF(question, brief)

  // quality guard + one retry with stricter instruction
  if (lowQuality(answer, question)) {
    const retryQ = `${question}\nPlease provide concrete, non-generic answer with at least 3 bullets under Recommended Actions.`
    const retry = webllmEngine ? await generateWithWebLLM(retryQ, brief) : await generateWithHF(retryQ, brief)
    if (!lowQuality(retry, question)) answer = retry
  }

  if (lowQuality(answer, question)) {
    return composeDeterministicAnswer(question, context)
  }

  return answer
}
