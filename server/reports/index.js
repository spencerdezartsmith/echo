import express from 'express'

import {userCan} from 'src/common/util'
import logger from 'src/server/util/logger'

const app = new express.Router()

app.get('/reports/:reportName', requestHandler)

export default app

const SENSITIVE_REPORTS = [
  'projectTeams',
  'playerStats',
  'playerCycleStats',
]
const PUBLIC_REPORTS = [
  'countActivePlayersByLevel',
]

function requestHandler(req, res, next) {
  const {reportName} = req.params

  assertReportNameIsValid(reportName)
  assertUserCanViewReport(req.user)

  const reportHandler = require(`./${reportName}`)
  const handleReport = typeof reportHandler === 'function' ? reportHandler : reportHandler.default

  res.set('Content-Type', 'text/csv')
  return handleReport(req, res).catch(err => {
    logger.error(err)
    next()
  })
}

function assertUserCanViewReport(user, reportName) {
  if (SENSITIVE_REPORTS.includes(reportName)) {
    if (!user || !userCan(user, 'viewSensitiveReports')) {
      throw new Error('You are not authorized to do that.')
    }
  }
}

function assertReportNameIsValid(name) {
  const validReportNames = SENSITIVE_REPORTS.concat(PUBLIC_REPORTS)
  if (!validReportNames.includes(name)) {
    throw new Error(`Invalid report name: "${name}". Valid reports are ${validReportNames.join(', ')}`)
  }
}
