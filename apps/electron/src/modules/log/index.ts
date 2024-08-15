import log from 'electron-log/main'

/**
 * Setup the log functions on the console object.
 */
export function setupLog() {
  Object.assign(console, log.functions)
}
