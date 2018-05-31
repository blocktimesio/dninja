const forever = require(`forever-monitor`);

const child = new (forever.Monitor)(process.argv[2], {
  //max: 10,
  //silent: false,
  args: process.argv.slice(3),
  fork: true,
});

child.on(`restart`, function () {
  restartSent = 0;
  
  console.error(`[MONITOR] Forever restarting script for ` + child.times + ` time`);
  console.log(``);
});

child.on(`exit:code`, function (code) {
  restartSent = 0;
  
  console.error('[MONITOR] Forever detected script exited with code ' + code);
  if (3 !== code) {
    console.error(`[MONITOR] WONT RESTART, code = ${code}`);
    child.stop();
  } // don't restart the script on SIGTERM
});

child.start();

let restartAfter = 2 * 60 * 60 * 1000;
let restartSent = 0;

const restartCheck = () => {
  if (restartSent == 0) {
    child.send({
      parentCmd: `shutdown`,
    });
    console.log(`[MONITOR] #### restartCheck - cmd sent!`);
    restartSent = 1;
  }
  setTimeout(restartCheck, restartAfter);
};

setTimeout(restartCheck, restartAfter);
