const express = require(`express`);
const router = express.Router();
const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);
const helpers = require(`${appRoot}/helpers`);

const getObjDetail = async (req, res, next) => {
  let objSlug = req.params.objSlug;

  let page = await db.mongo.collection(`pages`).findOne({
    slug: objSlug,
  });

  if (!page) {
    return next({code: 404});
  }

  if (page.deletedAt && !req.userPerms.check(`settings`)) {
    req.flash(`error`, `No permissions`);
    return res.redirect(`/`);
  }
  
  res.locals.pageTitle.push(page.title);

  req.resObjType = `pages`;
  req.resObjId = page._id;

  res.locals.page = page;

  res.loc.outTpl = `pages/detail`;
  next();
};

const getObjMng = async (req, res, next) => {
  if (!req.userPerms.check(`settings`)) {
    req.flash(`error`, `No permissions`);
    return res.redirect(`/`);
  }

  res.locals.menuActive.push(`pages`);
  res.locals.pageTitle.push(`Pages`);
  res.locals.pageTitle.push(`List`);

  let pages = await db.mongo.collection(`pages`).find({

  }, {
    sort: [[`_id`, `desc`]],
  }).toArray();

  for (let page of pages) {
    helpers.lazyLoadAdd(res, `users`, `_id`, page.authorUserId);

    if (page.updatedByUserId) {
      helpers.lazyLoadAdd(res, `users`, `_id`, page.updatedByUserId);
    }
  }

  res.locals.pages = pages;

  res.loc.outTpl = `pages/mng`;
  next();
};

const getObjEdit = async (req, res, next) => {
  if (!req.userPerms.check(`settings`)) {
    req.flash(`error`, `No permissions`);
    return res.redirect(`/`);
  }

  let editData = {};

  let objData;
  let pageSubtitle;
  let editObjId;
  if (req.query.objIdInt && req.query.objIdInt > 0) {
    pageSubtitle = `Edit page`;

    objData = await db.mongo.collection(`pages`).findOne({
      idInt: parseInt(req.query.objIdInt),
    });
    if (!objData) {
      return next({code: 404});
    }

    editObjId = objData.idInt;
    editData = _.clone(objData);

    let actionsHistory = await helpers.actionsLoad(res, {
      objType: `pages`,
      objId: objData._id,
    });
    res.locals.actionsHistory = actionsHistory;
  } else {
    pageSubtitle = `New page`;
    editObjId = 0;

    editData = {
      
    };
  }

  let formErrors = {};
  if (Object.keys(req.body).length > 0) {

    if (editObjId > 0 && req.body.objDel && req.body.objDel == 1) {
      if (!req.userPerms.check(`pageDel`)) {
        req.flash(`error`, `No permissions`);
      } else {

        await db.mongo.collection(`pages`).updateOne({
          idInt: editObjId,
        }, {
          $set: {
            deletedAt: moment.utc().toDate(),
            deletedByUserId: req.user._id,
          },
        });

        await helpers.actionsLog(req, {
          action: `delete`,
          objType: `pages`,
          objId: objData._id,
        });

        req.flash(`success`, `Object successfully deleted.`);
        return res.redirect(`/pages/mng`);
      }
    }

    // @TODO: validator approach
    let fields = [
      {
        name: `title`,
        required: true,
      },
      {
        name: `slug`,
        required: true,
      },
      {
        name: `body`,
        required: true,
      },
    ];

    await helpers.formValidate(req, fields, formErrors, editData);

    if (editData.slug) {
      let slugEx = await db.mongo.collection(`pages`).findOne({
        slug: editData.slug,
      });
      if (slugEx && slugEx.idInt != editObjId) {
        formErrors.slug = `Page with such slug already exists - ${slugEx.title} (${slugEx.slug})`;
      }
    }

    if (Object.keys(formErrors).length > 0) {
      req.flash(`error`, `Form contains errors.`);
    } else {
      let objUpdData = editData;
      objUpdData.updatedAt = moment.utc().toDate();
      objUpdData.updatedByUserId = req.user._id;

      let succMsg;
      if (editObjId) {
        succMsg = `Page was successfully edited.`;

        await db.mongo.collection(`pages`).updateOne({
          idInt: editObjId,
        }, {
          $set: objUpdData,
        });
      } else {
        succMsg = `Page was successfully added.`;

        objUpdData.deletedAt = null;
        objUpdData.createdAt = moment.utc().toDate();
        objUpdData.authorUserId = req.user._id;

        let lastObj = await db.mongo.collection(`pages`).findOne({}, {
          sort: [[`idInt`, `desc`]],
        });
        let idIntNew = (lastObj) ? (lastObj.idInt+1) : 1;
        objUpdData.idInt = idIntNew;

        await db.mongo.collection(`pages`).insertOne(objUpdData);
      }

      await helpers.actionsLog(req, {
        action: `edit`,
        objType: `pages`,
        objId: objUpdData._id,
      }, {
        old: objData,
        new: objUpdData,
        fields: fields,
      });

      req.flash(`success`, succMsg);

      return res.redirect(`/${objUpdData.slug}`);
    }
  }

  res.locals.pageSubtitle = pageSubtitle;
  res.locals.editData = editData;
  res.locals.editObjId = editObjId;
  res.locals.formErrors = formErrors;

  res.locals.menuActive.push(`news`);
  res.locals.pageTitle.push(`Pages`);
  res.locals.pageTitle.push(pageSubtitle);

  res.loc.outTpl = `pages/edit`;
  next();
};

const render = async (req, res, next) => {

  await helpers.lazyLoadGet(res);

  // render
  res.render(res.loc.outTpl);
};

router.get(`/pages/mng`, getObjMng, render);
router.get(`/pages/edit`, getObjEdit, render);
router.post(`/pages/edit`, getObjEdit, render);
router.get(`/pages/:objSlug`, getObjDetail, render);
router.get(`/:objSlug`, getObjDetail, render);

module.exports = router;
