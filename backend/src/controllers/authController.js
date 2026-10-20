import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const publicUser = (user) => ({ _id: user._id, name: user.name, email: user.email })
const issueToken = (user) => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

export async function register(req, res) {
  const { name, email, password } = req.body || {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' })
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' })
  const user = new User({ name: name.trim(), email: email.trim().toLowerCase() })
  await user.setPassword(password)
  await user.save()
  return res.status(201).json({ user: publicUser(user), token: issueToken(user) })
}

export async function login(req, res) {
  const { email, password } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' })
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
  if (!user || !(await user.verifyPassword(password))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  return res.json({ user: publicUser(user), token: issueToken(user) })
}

export async function currentUser(req, res) {
  const user = await User.findById(req.userId)
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  return res.json({ user: publicUser(user) })
}

export async function updateCurrentUser(req, res) {
  const updates = {}
  if (typeof req.body?.name === 'string') {
    if (req.body.name.trim().length < 2 || req.body.name.trim().length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' })
    updates.name = req.body.name.trim()
  }
  if (typeof req.body?.email === 'string') {
    const email = req.body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
    updates.email = email
  }
  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true })
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  return res.json({ user: publicUser(user) })
}