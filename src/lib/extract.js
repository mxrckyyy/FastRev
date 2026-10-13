// legacy build: works in browsers AND Node (pdfjs warns the modern build is browser-only)
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export const SUPPORTED_INPUTS = 'PDF, .txt, .md, .docx'

function inputError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pageCount = doc.numPages
  const pages = []
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines = content.items
      .map((item) => (item.str || '') + (item.hasEOL ? '\n' : ''))
      .join('')
    pages.push(lines.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim())
    page.cleanup()
  }
  await doc.destroy?.()
  return {
    text: pages.filter(Boolean).join('\n\n').trim(),
    kind: 'pdf',
    meta: `${pageCount} page${pageCount === 1 ? '' : 's'}`,
  }
}

async function extractDocx(file) {
  const mammoth = await import('mammoth')
  const extractRawText = mammoth.extractRawText || mammoth.default?.extractRawText
  if (!extractRawText) {
    throw inputError('failed', 'Could not read the .docx file.')
  }
  const arrayBuffer = await file.arrayBuffer()
  // mammoth's browser build reads `arrayBuffer`, its Node build reads `buffer`
  const input = { arrayBuffer }
  if (typeof Buffer !== 'undefined') input.buffer = Buffer.from(arrayBuffer)
  const result = await extractRawText(input)
  return { text: (result?.value || '').trim(), kind: 'docx', meta: '' }
}

/**
 * Extract plain study text from a user-supplied file.
 * PDFs are parsed locally (pdfjs); .txt/.md read directly; .docx via
 * mammoth. No file content ever leaves the browser during import —
 * generation happens server-side only after the user presses Generate.
 * Returns { text, kind, meta } — throws an Error with `.code` on failure.
 */
export async function extractFromFile(file) {
  const name = (file.name || '').toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractPdf(file)
  }
  if (name.endsWith('.docx')) {
    return extractDocx(file)
  }
  if (file.type.startsWith('text/') || /\.(txt|md|markdown)$/.test(name)) {
    const text = (await file.text()).trim()
    return { text, kind: 'text', meta: '' }
  }
  throw inputError(
    'unsupported',
    `That file type isn't supported. Supported: ${SUPPORTED_INPUTS}.`,
  )
}
