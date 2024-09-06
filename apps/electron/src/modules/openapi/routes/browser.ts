import express from 'express'
import { API } from '/@/api'

const router = express.Router()

/* 创建窗口 */
router.get('/create', (req, res) => {
  res.send('respond with a resource')
})

/* 获取浏览器窗口列表 */
router.get('/list', async (req, res) => {
  const { page_index = 1, page_size = 15, dirId } = req.query as Record<string, any>
  const result = await API.window.userGetWindowInfoV2List({ page_index, page_size, dirId })
  res.send(result)
})

export default router
