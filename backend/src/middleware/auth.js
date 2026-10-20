import jwt from 'jsonwebtoken'

export default function requireAuth(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session.' })
  }
}