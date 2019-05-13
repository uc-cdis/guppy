import log from 'loglevel';

const originalFactory = log.methodFactory;
log.methodFactory = (methodName, logLevel, loggerName) => {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);

  return (message, ...args) => {
    let timeStr = (new Date()).toTimeString();
    timeStr = timeStr.substring(0, timeStr.indexOf(' '));
    const combinedMsg = args.reduce((acc, cur) => {
      if (typeof cur === 'string') {
        return `${acc} ${cur}`;
      }
      return `${acc} ${JSON.stringify(cur, null, 4)}`;
    }, message);
    rawMethod(`[${timeStr}] ${methodName.toUpperCase()}: ${combinedMsg}`);
  };
};

const numLevels = {
  0: 'TRACE',
  1: 'DEBUG',
  2: 'INFO',
  3: 'WARN',
  4: 'ERROR',
  5: 'SILENT',
};
log.levelEnums = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
};

log.setLogLevel = (level) => {
  if (!Object.keys(numLevels).includes(level) && !Object.keys(log.levelEnums).includes(level)) {
    throw new Error(`Invalid log level ${level}`);
  }
  log.setLevel(level);
  log.info('log level set to', numLevels[log.getLevel()]);
};

log.rawOutput = (level, msg) => {
  let parsedLevel = level;
  if (typeof level === 'string') {
    if (!Object.keys(log.levelEnums).includes(level)) {
      throw new Error(`Invalid log level ${level}`);
    }
    parsedLevel = log.levelEnums[level];
  }
  if (parsedLevel >= log.getLevel()) {
    console.log(msg); // eslint-disable-line no-console
  }
};

export default log;
