import log from 'loglevel';

log.methodFactory = () => () => {};
log.levelEnums = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
};
log.setLogLevel = () => {};
log.rawOutput = () => {};

export default log;
