import dotenv from 'dotenv'
dotenv.config()

import app from './app'
import { initJobs } from './jobs'

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`[TriboCRM] Backend rodando na porta ${PORT}`)
  initJobs()
})
