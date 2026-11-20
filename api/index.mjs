import app from '../server/dist/index.js'

/**
 * Vercel serverless adapter. The Express app is a Node request listener, so it
 * can be invoked directly with Vercel's req/res objects without adding a
 * framework-specific dependency.
 */
export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    const done = () => resolve()
    res.once('finish', done)
    res.once('close', done)
    req.once('error', reject)
    res.once('error', reject)
    try {
      app(req, res)
    } catch (error) {
      reject(error)
    }
  })
}
