const moment = require(`moment`);
const curTime = moment().format(`YYYY-MM-DD_HH-mm-ss`);
const logFileName = `${__dirname}/logs/err_${curTime}.log`;
let Logger = require(`./logger`);
let logger = new Logger(logFileName);
console.log = logger.consoleLog;
console.logErr = logger.consoleLogErr;
console.timeEnd = logger.consoleTimeEnd;
console.time = logger.consoleTime;
global.log = (str) => {
  console.log(str);
};

const path = require(`path`);
global.appRoot = path.resolve(__dirname) + '/';

process.on('unhandledRejection', function (reason, p) {
  console.log('Possibly Unhandled Rejection at: Promise ', p, ' reason: ', reason);
  log(reason);
  log(reason.stack);
});

global.SHUTDOWN_FLAG = 0;
process.on(`message`, (msg) => {
  if (msg.parentCmd == `shutdown`) {
    let waitForShutdown = 60 * 1000;
    log(`#### TIME TO RESTART... waitForShutdown = ${waitForShutdown}`);
    
    global.SHUTDOWN_FLAG = 1;
    
    setTimeout(() => {
      log(`#### shutdown waiting time EXPIRED, HARD SHUTDOWN NOW`);
      SHUTDOWN_DO(3, 0);
    }, waitForShutdown);
  }
});

const shutdownDo = (code, isGraceful) => {
  log(`#### SHUTDOWN NOW, code = ${code}, isGraceful = ${isGraceful}`);
  process.exit(code);
};
global.SHUTDOWN_DO = shutdownDo;

const shutdownCheck = (code) => {
  if (global.SHUTDOWN_FLAG) {
    SHUTDOWN_DO(code, 0);
  }
};
global.SHUTDOWN_CHECK = shutdownCheck;

const db = require(`./db`);

const run = async () => {
  await db.init();
  
  //log(`process.argv:`);log(process.argv);
  
  let filename = process.argv[2];
  let method = process.argv[3];
  if (!method) {
    method = `run`;
  }

  log(`filename = ${filename}, method = ${method}`);
  
  let Obj = require(`./${filename}`);
  Obj[method]();

};

run();

