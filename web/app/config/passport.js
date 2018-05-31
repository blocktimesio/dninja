const LocalStrategy = require(`passport-local`).Strategy;

const bcrypt = require(`bcrypt-nodejs`);
const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);

const passwordHashGen = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

const passwordCheck = function (password, dbPassword) {
  return bcrypt.compareSync(password, dbPassword);
};

const updateOauthProfile = async (userId, oauthType, oauthId, oauthProfile) => {
  let oauthProfileData = {
    oauthType: oauthType,
    oauthId: oauthId,
    userId: userId,
    profile: oauthProfile,
    updatedAt: moment.utc().toDate(),
  };
  
  let ex = await db.mongo.collection(`users_oauth_profiles`).findOne({
    oauthType: oauthType,
    oauthId: oauthId,
  });
  if (ex) {
    await db.mongo.collection(`users_oauth_profiles`).updateOne({
      _id: ex._id,
    }, {
      $set: oauthProfileData,
    });
  } else {
    oauthProfileData.createdAt = moment.utc().toDate();
    
    await db.mongo.collection(`users_oauth_profiles`).insertOne(oauthProfileData);
  }
};

const loginViaOauth = async (req, oauthOpts, cb) => {
  let oauthData = {
    type: oauthOpts.type,
    id: oauthOpts.id,
    url: oauthOpts.url,
    name: oauthOpts.name,
    username: oauthOpts.username,
    email: oauthOpts.email,
    profilePic: oauthOpts.profilePic,
    about: oauthOpts.about,
    location: oauthOpts.location,
    lastLoginAt: moment.utc().toDate(),
  };

  oauthData.username = oauthData.username.toLowerCase();
  
  let ex = await db.mongo.collection(`users`).findOne({
    [`oauth.${oauthOpts.type}.id`]: oauthData.id,
  });

  if (ex) {
    await db.mongo.collection(`users`).updateOne({
      _id: ex._id,
    }, {
      $set: {
        [`oauth.${oauthOpts.type}`]: oauthData,
      },
    });
    
    await updateOauthProfile(ex._id, oauthOpts.type, oauthOpts.id, oauthOpts.profile);

    return cb(null, ex);
  }
  
  // check username
  let usernameEx = await db.mongo.collection(`users`).findOne({
    username: oauthData.username,
  });
  if (usernameEx) {
    oauthData.username = `${oauthData.username}-${moment().format(`SSS`)}`;
  }

  let newUserData = {
    name: oauthData.name,
    profilePic: oauthData.profilePic,
    email: oauthData.email,
    username: oauthData.username,
    about: oauthData.about,
    location: oauthData.location,
    password: null,
    createdAt: moment.utc().toDate(),
    regIp: req.ip,
    roleId: 1,
    oauth: {
      [`${oauthOpts.type}`]: oauthData,
    },
    commentsCount: 0,
    postsCount: 0,
  };
  
  if (oauthOpts.socialLinks) {
    newUserData.socialLinks = oauthOpts.socialLinks;
  }

  await db.mongo.collection(`users`).insertOne(newUserData);

  await updateOauthProfile(newUserData._id, oauthOpts.type, oauthOpts.id, oauthOpts.profile);

  return cb(null, newUserData);
};

module.exports = (passport) => {

  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // passport needs ability to serialize and unserialize users out of session

  // used to serialize the user for the session
  passport.serializeUser(function (user, done) {
    done(null, (user._id).toString());
  });

  // used to deserialize the user
  passport.deserializeUser(async function (id, done) {
    let userData = await db.mongo.collection(`users`).findOne({
      _id: db.mongo.ObjectId(id),
    });

    if (!userData) {
      return done(null, false);
    }

    done(null, userData);
  });

  // =========================================================================
  // LOCAL LOGIN =============================================================
  // =========================================================================
  passport.use('local-login', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true, // allows us to pass in the req from our route (lets us check if a user is logged in or not)
  }, async function (req, email, password, done) {

    if (req.user) {
      return done(null, req.user);
    }

    if (email) {
      email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
    }

    let userData = await db.mongo.collection(`users`).findOne({
      email: email,
    });

    if (!userData) {
      return done(null, false, req.flash('error', 'No user found with this email.'));
    }
    
    if (!userData.password) {
      return done(null, false, req.flash('error', `You cannot log in to this account using password.`));
    }

    if (!passwordCheck(password, userData.password)) {
      return done(null, false, req.flash('error', 'Oops! Wrong password.'));
    }

    return done(null, userData);
  }));

  // =========================================================================
  // LOCAL SIGNUP ============================================================
  // =========================================================================
  passport.use(`local-signup`, new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: `email`,
    passwordField: `password`,
    passReqToCallback: true, // allows us to pass in the req from our route (lets us check if a user is logged in or not)
  }, async function (req, email, password, done) {
    if (req.user) {
      return done(null, req.user);
    }

    if (email) {
      email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
    }

    let userData = await db.mongo.collection(`users`).findOne({
      email: email,
    });

    //log(`local-signup, userData:`);log(userData);
    // @TODO: refactor errors handling

    if (userData) {
      return done(null, false, req.flash(`error`, `This email is already taken.`));
    }
    
    let username = (req.body.username) ? req.body.username.trim().toLowerCase() : ``;
    if (!username || username.length < 3) {
      return done(null, false, req.flash(`error`, `Please enter username (min 3 characters).`));
    }
    
    let usernameIsValid = /^[a-zA-Z0-9_\-]{3,25}$/.test(username);
    if (!usernameIsValid) {
      return done(null, false, req.flash(`error`, `Username may contain only next characters: A-Z, 0-9, _, -.`));
    }
    
    let usernameEx = await db.mongo.collection(`users`).findOne({
      username: username,
    });
    if (usernameEx) {
      return done(null, false, req.flash(`error`, `This username is already taken.`));
    }

    let newUserData = {
      name: null,
      about: null,
      location: null,
      profilePic: null,
      email: email,
      username: username,
      password: passwordHashGen(password),
      createdAt: moment.utc().toDate(),
      regIp: req.ip,
      roleId: 1,
      commentsCount: 0,
      postsCount: 0,
    };

    await db.mongo.collection(`users`).insertOne(newUserData);

    return done(null, newUserData);
  }));
};

