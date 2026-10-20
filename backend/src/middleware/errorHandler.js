export function notFound(_req, res) {
  res.status(404).json({ success: false, message: 'Route not found.' })
}

export function errorHandler(error, _req, res, _next) {
  if (error?.code === 11000) return res.status(409).json({ success: false, message: 'An account with that email already exists.' })
  if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
  if (error?.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 10 MB or smaller.' : 'Only one image can be uploaded.'
    return res.status(400).json({ success: false, message })
  }
  if (error?.message === 'Choose a JPG, PNG, or WebP image.') return res.status(400).json({ success: false, message: error.message })
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500
  if (status >= 500) console.error(`Unhandled request error (${error?.name || 'Error'}): ${error?.message || 'unknown error'}`)
  return res.status(status).json({ success: false, message: status === 500 ? 'The request could not be completed.' : error.message })
}