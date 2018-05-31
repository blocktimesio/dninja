const winston = require(`winston`);
const moment = require(`moment`);

function MyObject (logFileName, enableLogInFile) {
  if (typeof(enableLogInFile) === `undefined`) {
    enableLogInFile = 0;
  }

  this.logFileName = logFileName;
  this.profilingTimes = {};

  console.log(`enableLogInFile = ${enableLogInFile}, logFileName = ${logFileName}`);

  let winstonConf = {
    transports: [
      new (winston.transports.Console)({
        colorize: true,
        timestamp: function () {
          return moment().format('YYYY-M-DD HH:mm:ss');
        },
        formatter: function (options) {
          return options.timestamp() + ' ' + (options.message ? options.message : '') + (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
        }
      }),
      new (winston.transports.File)({
        filename: `${__dirname}/logs/errs.log`,
        json: false,
        timestamp: function () {
          return moment().format('YYYY-M-DD HH:mm:ss');
        },
        formatter: function (options) {
          return options.timestamp() + ' ' + options.level.toUpperCase() + ' ** ERR ** ' + (options.message ? options.message : '') + (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
        },
        level: 'error',
      }),
    ]
  };

  if (enableLogInFile) {
    winstonConf.transports.push(new (winston.transports.File)({
      name: 'info-file',
      filename: logFileName,
      timestamp: function () {
        return moment().format('YYYY-M-DD HH:mm:ss');
      },
      json: false,
      formatter: function (options) {
        // Return string will be passed to logger.
        return options.timestamp() + ' ' + (options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
      }
    }));
  }

  this.logger = new (winston.Logger)(winstonConf);

  this.profilingTimes = {};

  this.consoleLog = (str) => {
    this.logger.info(str);
  };
  this.consoleLogErr = (str) => {
    this.logger.error(str);
  };
};

MyObject.prototype.consoleTime = function foo (str) {
  if (typeof(this.profilingTimes) === 'undefined') {
    this.profilingTimes = {};
  }
  this.profilingTimes[str] = new Date();
};
MyObject.prototype.consoleTimeEnd = function foo (str) {
  let end = new Date() - this.profilingTimes[str];
  end = end / 1000;
  console.log(`! [profiling] ${str} - ${end}s`);
};

module.exports = MyObject;
