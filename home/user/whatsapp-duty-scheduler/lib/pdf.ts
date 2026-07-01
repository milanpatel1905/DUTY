import pdf from 'pdf-parse'

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer)
    return data.text
  } catch (e) {
    console.error('PDF parse error', e)
    return ''
  }
}
