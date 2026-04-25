export const normalizePatientDocumentId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  const suffix = trimmed.replace(/^patient/i, '')
  return suffix ? `patient${suffix}` : 'patient'
}