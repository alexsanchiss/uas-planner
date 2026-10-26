import { planDefEn, planDefEs } from '../planDefinition'

/** Every leaf string with its path, e.g. "toast.saved". */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',')

describe('planDefinition i18n', () => {
  const en = leaves(planDefEn)
  const es = new Map(leaves(planDefEs))

  it('has the same keys in English and Spanish and no empty text', () => {
    expect(new Set(es.keys())).toEqual(new Set(en.map(([k]) => k)))
    for (const [key, text] of [...en, ...es]) expect({ key, empty: text.trim() === '' }).toEqual({ key, empty: false })
  })

  it('keeps the same {placeholders} in both languages', () => {
    for (const [key, text] of en) expect({ key, vars: placeholders(es.get(key) ?? '') }).toEqual({ key, vars: placeholders(text) })
  })
})
