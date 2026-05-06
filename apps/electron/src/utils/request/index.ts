import axios from 'axios'
// import { electronAdapter } from './electronAdapter'

export const request = axios.create({
  timeout: 15000,
  withCredentials: true,
  proxy: false,
  // adapter: electronAdapter,
})
