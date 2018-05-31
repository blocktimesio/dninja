const dotenv = require('dotenv');
dotenv.load();

const path = require('path');
global.appRoot = path.resolve(__dirname) + '/app';
global.appUrl = `https://dninja.io`;

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const passportConfig = require(`${appRoot}/config/passport`);
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const cookieParser = require('cookie-parser');
const winston = require('winston');
const moment = require('moment');
const _ = require('lodash');

const db = require(`${appRoot}/db`);

process.on('unhandledRejection', function (reason, p) {
  console.log('Possibly Unhandled Rejection at: Promise ', p, ' reason: ', reason);
  log(reason.stack);
});

global._l = new winston.Logger({
  transports: [
    new (winston.transports.Console)({
      colorize: true,
      prettyPrint: true,
      timestamp: function () {
        return new Date().toISOString().replace(/T/, ' ').// replace T with a space
        replace(/\..+/, '');
      }
    })
  ]
});
global._l.l = function (str) {
  console.log(str);
};
global.log = function (str) {
  console.log(str);
};

const port = process.env.PORT || 3010;

const app = createServer();

app.listen(port, async function () {
  _l.info(`Listening on port ${port}`);
  
  await db.init();
});

function createServer () {
  let app = express();

  app.use(express.static(`./app/public`, {
    maxAge: `1d`,
  }));

  app.set('view engine', `pug`);
  app.set('views', `${appRoot}/views`);
  
  app.locals.filters = require(`${appRoot}/views/filters`);
  app.locals = _.extend(app.locals, require(`${appRoot}/views/helpers`));
  
  passportConfig(passport); // pass passport for configuration
  
  app.use(cookieParser()); // read cookies (needed for auth)
  app.use(bodyParser.json({limit: '10mb'}));
  app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));

  app.set(`trust proxy`, `127.0.0.1`);
  
  app.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: {},
    expires: new Date(Date.now() + (30 * 86400 * 1000)),
    store: new MongoStore({
      url: `mongodb://${process.env.DB_HOST}/${process.env.DB_DATABASE}`,
    }),
    resave: false,
    saveUninitialized: true,
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  app.use(async (req, res, next) => {
    // redirect for www.
    if (req.headers.host.match(/^www\./)) {
      return res.redirect(301, req.protocol + '://' + req.headers.host.replace(/^www\./,'') + req.url);
    }
    
    next();
  });
  
  app.use(async (req, res, next) => {
    res.loc = {}; // for local vars

    res.locals.reqStartTime = new Date();

    let curUser = (req.user) ? req.user : { _id: ``, roleId: 0 };
    res.locals.curUser = curUser;
    
    const roles = require(`${appRoot}/config/roles`);
    const permsChecker = new roles.permsChecker(curUser.roleId);
    res.locals.userPerms = permsChecker;
    req.userPerms = permsChecker;
    
    // LOG ALL REQUESTS
    let clientReq = {
      startAt: moment.utc().toDate(),
      finishAt: null,
      duration: null,
      resCode: null,
      ip: req.ip,
      userId: curUser._id,
      req: req.url,
      method: req.method,
      ua: req.headers['user-agent'],
      referrer: req.get('Referrer'),
    };
    await db.mongo.collection(`requests`).insertOne(clientReq);
   
    res.on('finish', async function () {
      // do stuff here
      let resCode = this.statusCode;
      let finishAt = moment.utc().toDate();
      let reqDuration = moment.utc(finishAt).diff(clientReq.startAt);
      let reqContentLength = Math.round(this._contentLength / 1000);

      let reqUpd = {
        duration: moment.utc(finishAt).diff(clientReq.startAt),
        finishAt: finishAt,
        resCode: resCode,
      };
      
      if (this.req.resObjType) {
        reqUpd.resObjType = this.req.resObjType;
        reqUpd.resObjId = this.req.resObjId;
      }
      
      await db.mongo.collection(`requests`).updateOne({
        _id: clientReq._id,
      }, {
        $set: reqUpd,
      });

      log(`[req] ${this.req.method} ${this.req.url} ${this.statusCode} ${reqDuration}ms - ${reqContentLength}kb, ip = ${this.req.ip}, ua = ${this.req.headers['user-agent']}, ref = ${this.req.get('Referrer')}`);
    });

    res.locals.flashMsgs = {
      success: req.flash('success'),
      error: req.flash('error'),
    };

    // global view helper
    res.locals.pageActive = '';
    res.locals.menuActive = [];
    res.locals.pageDesc = ``;
    res.locals.pageTitle = [];
    res.locals.pageTitle.push(`dninja`);
    
    res.locals.ENV_NAME = process.env.ENV_NAME;
    
    if (process.env.ENV_NAME == `dev`) {
      res.locals.cssVersion = moment().format(`X`);
      res.locals.jsVersion = moment().format(`X`);
    } else {
      res.locals.cssVersion = 10;
      res.locals.jsVersion = 10;
    }

    next();
  });

  // routes
  app.use(require('./app/routes'));

  const errorPageRender = (req, res, errCode, errTitle) => {
    /*if (req.accepts('json')) {
      return res.send({error: 'Not found'});
    }*/

    return res.render('error', {
      errCode: errCode,
      errTitle: errTitle,
      url: req.url,
    });
  }
  
  app.use((req, res) => {
    res.status(404);
    return errorPageRender(req, res, 404, `Not found`);
  });

  app.use((err, req, res, next) => {

    if (err.code == 404) {
      res.status(404);
      return errorPageRender(req, res, 404, `Not Found`);
    }
    
    // handle error
    _l.error('[app] error:');
    //_l.info(err);

    function dumpError (err) {
      let out = '';

      if (typeof err === 'object') {
        if (err.message) {
          out += '\nMessage: ' + err.message;
        }

        if (err.error) {
          out += '\nError: [' + err.error.statusCode + '] ' + err.error.errorCode + ' ' + err.error.errorMessage;
        }

        if (err.stack) {
          out += '\nStacktrace:\n';
          out += err.stack;
        }
      } else {
        out += 'dumpError :: argument is not an object';
      }

      return out;
    }

    const errDesc = dumpError(err);
    _l.error(errDesc);

    const isAjax = (req.xhr || req.headers.accept.indexOf('json') > -1);
    if (isAjax) {
      res.status(500).json({
        error: 1,
        err: errDesc,
      });
    } else {
      res.status(500).render('error', {
        errDesc
      });
    }
  });

  return app;
}
