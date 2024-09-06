import express from 'express'

const router = express.Router()

/* 创建窗口 */
router.get('/browser/create', (req, res) => {
  res.send('respond with a resource')
})

export default router
