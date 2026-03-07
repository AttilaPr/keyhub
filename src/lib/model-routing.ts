export function parseModel(model: string): { provider: string; modelId: string } {
  const [provider, ...rest] = model.split('/')
  if (!rest.length) throw new Error('Invalid model format. Use "provider/model-name"')
  return { provider, modelId: rest.join('/') }
}
