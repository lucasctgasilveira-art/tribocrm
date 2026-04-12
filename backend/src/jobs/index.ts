import cron from 'node-cron'
import { runBirthdayJob } from './birthday.job'
import { runOverdueChargesJob } from './overdue-charges.job'
import { runInactiveLeadsJob } from './inactive-leads.job'
import { runGoalCheckJob } from './goal-check.job'
import { runAutomationJob } from './automation.job'
import { runExpiryAlertJob } from './expiry-alert.job'
import { runWonCardsArchiverJob } from './wonCardsArchiver.job'

/**
 * Initializes all scheduled jobs.
 * Cron expressions use the America/Sao_Paulo timezone.
 *
 * Schedule:
 *   - Birthday             : 08:00 daily
 *   - Overdue charges      : 09:00 daily
 *   - Goal check           : 10:00 daily
 *   - Inactive leads       : every 2 hours
 *   - Automation engine    : every 5 minutes
 *   - Expiry alert         : 11:00 daily
 *   - WON cards archiver   : 00:00 on day 1 of every month
 */
export function initJobs(): void {
  const tz = { timezone: 'America/Sao_Paulo' }

  cron.schedule('0 8 * * *', () => { runBirthdayJob().catch(e => console.error('[Job:birthday] uncaught:', e)) }, tz)
  console.log('[Jobs] birthday job scheduled — 08:00 daily')

  cron.schedule('0 9 * * *', () => { runOverdueChargesJob().catch(e => console.error('[Job:overdue-charges] uncaught:', e)) }, tz)
  console.log('[Jobs] overdue-charges job scheduled — 09:00 daily')

  cron.schedule('0 10 * * *', () => { runGoalCheckJob().catch(e => console.error('[Job:goal-check] uncaught:', e)) }, tz)
  console.log('[Jobs] goal-check job scheduled — 10:00 daily')

  cron.schedule('0 */2 * * *', () => { runInactiveLeadsJob().catch(e => console.error('[Job:inactive-leads] uncaught:', e)) }, tz)
  console.log('[Jobs] inactive-leads job scheduled — every 2 hours')

  cron.schedule('0 11 * * *', () => { runExpiryAlertJob().catch(e => console.error('[Job:expiry-alert] uncaught:', e)) }, tz)
  console.log('[Jobs] expiry-alert job scheduled — 11:00 daily')

  cron.schedule('*/5 * * * *', () => { runAutomationJob().catch(e => console.error('[Job:automation] uncaught:', e)) }, tz)
  console.log('[Jobs] automation job scheduled — every 5 minutes')

  cron.schedule('0 0 1 * *', () => { runWonCardsArchiverJob().catch(e => console.error('[Job:wonCardsArchiver] uncaught:', e)) }, tz)
  console.log('[Jobs] wonCardsArchiver job scheduled — 00:00 day 1 of every month')

  console.log('[Jobs] all scheduled jobs initialized')
}
