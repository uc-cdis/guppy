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
log.setLevel(log.levels.DEBUG);
log.info('log level set to', numLevels[log.getLevel()]);

log.rawOutput = (msg) => {
  console.log(msg);
};

export default log;
