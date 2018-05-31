const express = require(`express`);
const router = express.Router();
const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);
const helpers = require(`${appRoot}/helpers`);
const blocks = require(`${appRoot}/blocks`);

const getList = async (req, res, next) => {
  res.locals.pageTitle.push(`Apps`);
  res.locals.pageTitle.push(`List`);
  res.locals.menuActive.push(`apps`);
  res.locals.pageDesc = `dapps`;
  
  let queryWhere = {
    deletedAt: null,
  };
  let queryOpts = {
    sort: [[`dau24h`, `desc`]],
  };
  
  let objsTotal = await db.mongo.collection(`apps`).count(queryWhere);
  let pgOpts = await helpers.listPagination(req, res, {
    baseUrl: `/apps`,
    objsTotal: objsTotal,
    perPage: 50,
  });
  queryOpts = _.extend(queryOpts, {
    limit: pgOpts.perPage,
    skip: pgOpts.skip,
  });
  
  let apps = await db.mongo.collection(`apps`).find(queryWhere, queryOpts).toArray();
  res.locals.apps = apps;

  await blocks.loadPageBlocks(req, res, {
    page: `appsList`,
  });

  res.loc.outTpl = `apps/list`;
  next();
};


const getObjDetail = async (req, res, next) => {
  let objSlug = req.params.objSlug;

  res.locals.pageTitle.push(`Apps`);
  res.locals.menuActive.push(`apps`);

  let app = await db.mongo.collection(`apps`).findOne({
    slug: objSlug,
  });

  if (!app) {
    return next({code: 404});
  }
  
  let contracts = await db.mongo.collection(`apps_contracts`).find({
    appId: app._id,
  }).toArray();
  res.locals.contracts = contracts;
  
  let links = await db.mongo.collection(`apps_links`).find({
    appId: app._id,
  }).toArray();
  res.locals.links = links;
  
  res.locals.pageTitle.push(app.title);
  res.locals.pageDesc = `All information about ${app.title}`;
  
  req.resObjType = `apps`;
  req.resObjId = app._id;

  res.locals.app = app;
  
  await blocks.loadPageBlocks(req, res, {
    page: `appsDetail`,
  });

  res.loc.outTpl = `apps/detail`;
  next();
};

const getObjEdit = async (req, res, next) => {
  if (!req.userPerms.check(`coinsAdd`)) {
    req.flash(`error`, `No permissions`);
    return res.redirect(`/`);
  }

  let editData = {};

  let objData;
  let pageSubtitle;
  let editObjId;
  if (req.query.objId) {
    pageSubtitle = `Edit coin`;

    objData = await db.mongo.collection(`coins`).findOne({
      _id: db.mongo.ObjectId(req.query.objId),
    });
    if (!objData) {
      return next({code: 404});
    }

    editObjId = objData._id;
    editData = _.clone(objData);

    let actionsHistory = await helpers.actionsLoad(res, {
      objType: `coins`,
      objId: objData._id,
    });
    res.locals.actionsHistory = actionsHistory;
  } else {
    pageSubtitle = `New coin`;
    editObjId = null;

    editData = {

    };
  }
  
  let objLinksOpts = await helpers.objLinksOptsLoad(res, `coins`, editObjId, editData);

  let formErrors = {};
  if (Object.keys(req.body).length > 0) {

    if (editObjId && req.body.objDel && req.body.objDel == 1) {
      if (!req.userPerms.check(`coinsDel`)) {
        req.flash(`error`, `No permissions`);
      } else {

        await db.mongo.collection(`coins`).updateOne({
          _id: editObjId,
        }, {
          $set: {
            deletedAt: moment.utc().toDate(),
            deletedByUserId: req.user._id,
          },
        });

        await helpers.actionsLog(req, {
          action: `delete`,
          objType: `coins`,
          objId: objData._id,
        });

        req.flash(`success`, `Object successfully deleted.`);
        return res.redirect(`/coins`);
      }
    }

    // @TODO: validator approach
    let fields = [
      {
        name: `name`,
        required: true,
      },
      {
        name: `slug`,
        required: true,
      },
      {
        name: `symbol`,
        required: true,
      },
      {
        name: `about`,
      },
      {
        name: `blockchainExplorerUrl`,
      },
      {
        name: `whitepaperUrl`,
      },
    ];

    await helpers.formValidate(req, fields, formErrors, editData);

    if (editData.slug) {
      let slugEx = await db.mongo.collection(`coins`).findOne({
        slug: editData.slug,
      });
      
      if (slugEx && slugEx._id.toString() != editObjId.toString()) {
        formErrors.slug = `Object with such slug already exists - ${slugEx.slug}`;
      }
    }

    if (Object.keys(formErrors).length > 0) {
      req.flash(`error`, `Form contains errors.`);
    } else {
      let objUpdData = editData;
      objUpdData.updatedAt = moment.utc().toDate();
      objUpdData.updatedByUserId = req.user._id;

      // clear objLinks to prevent saving to db
      delete objUpdData.objLinks;
      
      let succMsg;
      if (editObjId) {
        succMsg = `Object was successfully edited.`;

        await db.mongo.collection(`coins`).updateOne({
          _id: editObjId,
        }, {
          $set: objUpdData,
        });
      } else {
        succMsg = `Object was successfully added.`;

        objUpdData.deletedAt = null;
        objUpdData.createdAt = moment.utc().toDate();
        objUpdData.authorUserId = req.user._id;

        await db.mongo.collection(`coins`).insertOne(objUpdData);
      }

      await helpers.objLinksSave(req, objLinksOpts, objUpdData);

      await helpers.actionsLog(req, {
        action: `edit`,
        objType: `coins`,
        objId: objUpdData._id,
      }, {
        old: objData,
        new: objUpdData,
        fields: fields,
      });

      req.flash(`success`, succMsg);

      return res.redirect(`/coins/${objUpdData.slug}`);
    }
  }

  res.locals.pageSubtitle = pageSubtitle;
  res.locals.editData = editData;
  res.locals.editObjId = editObjId;
  res.locals.formErrors = formErrors;

  res.locals.menuActive.push(`coins`);
  res.locals.pageTitle.push(`Coins`);
  res.locals.pageTitle.push(pageSubtitle);

  res.loc.outTpl = `coins/edit`;
  next();
};

const render = async (req, res, next) => {
  
  await helpers.lazyLoadGet(res);

  // render
  res.render(res.loc.outTpl);
};

router.get(`/apps`, getList, render);
//router.get(`/coins/edit`, getObjEdit, render);
//router.post(`/coins/edit`, getObjEdit, render);
router.get(`/apps/:objSlug`, getObjDetail, render);

module.exports = router;
