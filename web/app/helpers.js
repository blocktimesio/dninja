const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);

const lazyLoadAdd = (res, type, field, objId) => {
  if (typeof(res.lazyLoad) === `undefined`) {
    res.lazyLoad = {};
  }
  
  if (typeof(res.lazyLoad[type]) === `undefined`) {
    res.lazyLoad[type] = {};
  }
  
  if (typeof(res.lazyLoad[type][field]) === `undefined`) {
    res.lazyLoad[type][field] = [];
  }

  res.lazyLoad[type][field].push(objId);
};

const lazyLoadGet = async (res) => {
  let lazyData = {};

  for (let objType in res.lazyLoad) {
    lazyData[objType] = {};
    
    for (let field in res.lazyLoad[objType]) {
      let rows = await db.mongo.collection(objType).find({
        [`${field}`]: {
          $in: res.lazyLoad[objType][field],
        }
      }).toArray();

      lazyData[objType][field] = _.keyBy(rows, field);
    }
  }
  
  //log(`lazyData: `); log(lazyData);

  res.locals.lazyData = lazyData;
};

const actionsLoad = async (res, actionData) => {
  let rows = await db.mongo.collection(`actions_logs`).find(actionData, {
    sort: [[`_id`, `desc`]],
  }).toArray();
  
  for (let row of rows) {
    lazyLoadAdd(res, `users`, `_id`, row.userId);
  }
  
  return rows;
};

const actionsLog = async (req, actionData, data) => {

  actionData = _.extend(actionData, {
    date: moment.utc().toDate(),
    userId: req.user._id,
    userIp: req.ip,
  });
  
  if (typeof(data) !== `undefined`) {
    let dataDiff = {};
    for (let field of data.fields) {
      let fieldName = field.name;
      let oldVal = (data.old) ? data.old[fieldName] : null;
      let newVal = data.new[fieldName];

      if (field.isDate) {
        if (oldVal) {
          oldVal = oldVal.getTime();
        }
        if (newVal) {
          newVal = newVal.getTime();
        }
      }

      if (oldVal != newVal) {
        dataDiff[fieldName] = {
          old: (data.old && typeof(data.old[fieldName]) !== `undefined`) ? data.old[fieldName] : null,
          new: data.new[fieldName],
        };
      }
    }
    actionData.dataDiff = dataDiff;
  }

  await db.mongo.collection(`actions_logs`).insertOne(actionData);
};

const objLinksSave = async (req, objLinksOpts, editData) => {
  for (let linkObjType in req.body.objLinks) {
    let linkObjs = req.body.objLinks[linkObjType];
    for (let linkId in linkObjs) {
      let linkData = linkObjs[linkId];
      if (!linkData.objId) {
        // empty or incorrect, skip
        continue;
      }
      
      let linkUpdData = {
        objType: linkObjType,
        objId: db.mongo.ObjectId(linkData.objId),
        toObjType: objLinksOpts.parentObjType,
        toObjId: editData._id,
      };
      
      if (linkData.params) {
        linkUpdData.params = linkData.params;
      }

      if (linkId < 0) {
        // it's a new link
        linkUpdData.createdAt = moment.utc().toDate();

        await db.mongo.collection(`objs_links`).insertOne(linkUpdData);
      } else {
        if (linkData.toDel == 1) {
          // delete this link
          await db.mongo.collection(`objs_links`).deleteOne({
            _id: db.mongo.ObjectId(linkId),
          });
        } else {
          // update the link
          linkUpdData.updatedAt = moment.utc().toDate();
          
          await db.mongo.collection(`objs_links`).updateOne({
            _id: db.mongo.ObjectId(linkId),
          }, {
            $set: linkUpdData,
          });
        }
      }
    }
  }
};

const formValidate = async (req, fields, formErrors, editData) => {
  for (let field of fields) {
    if (field.required) {
      if (!req.body[field.name]) {
        formErrors[field.name] = `This field cannot be empty`;
      }
    }

    editData[field.name] = req.body[field.name];
    if (field.isInt) {
      editData[field.name] = parseInt(editData[field.name]);
    }
    if (field.isCheckbox && !editData[field.name]) {
      editData[field.name] = 0;
    }
    if (field.isDate && editData[field.name]) {
      editData[field.name] = moment(editData[field.name]).toDate();
    }
  }
};

const listPagination = async (req, res, opts) => {
  let out = {
    perPage: opts.perPage,
    total: opts.objsTotal,
    totalPages: Math.ceil(opts.objsTotal / opts.perPage),
    curPage: 1,
    baseUrl: (opts.baseUrl) ? opts.baseUrl : res.locals.pageBaseUrl,
  };
  
  out.baseUrl += (out.baseUrl.indexOf(`?`) !== -1) ? `&` : `?`;
  
  if (req.query.page) {
    let tmpPage = parseInt(req.query.page);
    if (tmpPage >= 1 && tmpPage <= out.totalPages) {
      out.curPage = tmpPage;
    }
  }
  
  if (opts.maxPages && out.totalPages > opts.maxPages) {
    out.totalPages = opts.maxPages;
  }
  
  out.skip = out.perPage * (out.curPage - 1);
  
  res.locals.listPgOpts = out;
  
  return out;
};

const objLinksOptsLoad = async (res, objType, objId, editData) => {
  let out = {
    parentObjType: objType,
  };

  editData.objLinks = {};
  
  if (objType == `coins`) {
    out.possibleObjsTypes = [
      {
        objType: `persons`,
        title: `Persons`,
        titleField: `name`,
        params: [
          {
            key: `title`,
            title: `Title`,
          },
          {
            key: `isPast`,
            title: `Is Past`,
          },
          {
            key: `order`,
            title: `Order`,
          },
        ]
      },
    ];
  } else if (objType == `articles`) {
    out.possibleObjsTypes = [
      {
        objType: `coins`,
        title: `Coins`,
        titleField: `name`,
        params: [],
      },
      {
        objType: `persons`,
        title: `Persons`,
        titleField: `name`,
        params: [],
      },
    ];
  }
  
  for (let possibleType of out.possibleObjsTypes) {
    let emptyRow = {
      isEmpty: 1,
      _id: -1,
      objType: possibleType.objType,
      title: ``,
      objId: ``,
      params: {},
    };

    for (let param of possibleType.params) {
      emptyRow.params[param.key] = ``;
    }

    editData.objLinks[possibleType.objType] = [];
    editData.objLinks[possibleType.objType].push(emptyRow);
  }

  if (objId) {
    let needOrder = false;
    
    let rows = await db.mongo.collection(`objs_links`).find({
      toObjType: objType,
      toObjId: objId,
    }, {
      sort: [[`_id`, `desc`]],
    }).toArray();
    
    for (let row of rows) {
      editData.objLinks[row.objType].push(row);

      lazyLoadAdd(res, row.objType, `_id`, row.objId);
      
      if (!needOrder && row.params && row.params.order) {
        needOrder = true;
      }
    }
    
    if (needOrder) {
      for (let tmpObjType in editData.objLinks) {
        editData.objLinks[tmpObjType] = _.sortBy(editData.objLinks[tmpObjType], `params.order`);
      }
    }
  }

  res.locals.objLinksOpts = out;
  
  return out;
};

const articlesObjsLinksLoad = async (res, opts) => {
  let objsLinks = {
    
  };
  
  let whereOpts = {
    toObjType: `articles`,
    toObjId: {
      $in: opts.toObjIds,
    },
  };
  
  let rows = await db.mongo.collection(`objs_links`).find(whereOpts).toArray();
  for (let row of rows) {
    if (row.objType == `persons`) {
      lazyLoadAdd(res, `persons`, `_id`, row.objId);
    } else if (row.objType == `coins`) {
      lazyLoadAdd(res, `coins`, `_id`, row.objId);
    }
    
    let toObjId = row.toObjId.toString();
    if (typeof(objsLinks[toObjId]) === `undefined`) {
      objsLinks[toObjId] = [];
    }
    objsLinks[toObjId].push(row);
  }

  if (typeof(res.locals.articlesObjsLinks) === `undefined`) {
    res.locals.articlesObjsLinks = {};
  }
  
  res.locals.articlesObjsLinks = _.extend(res.locals.articlesObjsLinks, objsLinks);
};

const articlesMentionsLoad = async (req, res, objType, objId) => {
  let articlesIds = [];
  
  let rows = await db.mongo.collection(`objs_links`).find({
    toObjType: `articles`,
    objType: objType,
    objId: objId,
  }, {
    sort: [[`createdAt`, `desc`]],
  }).toArray();
  for (let row of rows) {
    lazyLoadAdd(res, `articles`, `_id`, row.toObjId);
    articlesIds.push(row.toObjId);
  }
  res.locals.articlesMentions = rows;

  await articlesObjsLinksLoad(res, {
    toObjIds: articlesIds,
  });

  await likesLoad(req, res, {
    objType: `articles`,
    objsIds: articlesIds,
  });
};

const commentsLoad = async (req, res, opts) => {
  let commentsOut = {};
  
  let whereOpts = {
    objType: opts.objType,
    objId: opts.objId,
  };
  
  if (!req.userPerms.check(`commentsSeeDeleted`)) {
    whereOpts.deletedAt = null;
  }
  
  let rows = await db.mongo.collection(`comments`).find(whereOpts, {
    sort: [[`_id`, `asc`]],
  }).toArray();

  let commentsIds = [];
  for (let row of rows) {
    row.canEdit = (req.userPerms.check(`commentsDel`)) ? 1 : 0;
    row.canDelete = (req.userPerms.check(`commentsDel`)) ? 1 : 0;

    row.children = [];
    if (row.rootParentCommentId) {
      commentsOut[row.rootParentCommentId.toString()].children.push(row);
    } else {
      commentsOut[row._id.toString()] = row;
    }
    
    lazyLoadAdd(res, `users`, `_id`, row.authorUserId);
    
    if (row.deletedByUserId) {
      lazyLoadAdd(res, `users`, `_id`, row.deletedByUserId);
    }

    commentsIds.push(row._id);
  }

  commentsOut = Object.values(commentsOut);

  await likesLoad(req, res, {
    objType: `comments`,
    objsIds: commentsIds,
  });
  
  res.locals.objComments = {
    objType: opts.objType,
    objId: opts.objId,
    commentsCount: (opts.objData.commentsCount) ? opts.objData.commentsCount : 0,
    comments: commentsOut,
  };
};

const likesLoad = async (req, res, opts) => {
  let likesOut = {};
  for (let objId of opts.objsIds) {
    likesOut[objId] = {
      userLiked: 0,
    };
  }

  if (req.user) {
    let whereOpts = {
      objType: opts.objType,
      objId: {
        $in: opts.objsIds,
      },
      authorUserId: req.user._id,
      deletedAt: null,
    };

    let rows = await db.mongo.collection(`likes`).find(whereOpts, {
      sort: [[`_id`, `asc`]],
    }).toArray();

    for (let row of rows) {
      likesOut[row.objId].userLiked = (row.value > 0) ? 1 : -1;
    }
  }

  if (typeof(res.locals.objsLikes) === `undefined`) {
    res.locals.objsLikes = {};
  }

  if (typeof(res.locals.objsLikes[opts.objType]) === `undefined`) {
    res.locals.objsLikes[opts.objType] = {};
  }

  res.locals.objsLikes[opts.objType] = _.extend(res.locals.objsLikes[opts.objType], likesOut);
};

const curFiltersParse = async (req, res, curFiltersOpts) => {
  let curFilters = {};
  let urlOpts = [];
  
  for (let curFiltersOptKey in curFiltersOpts) {
    let curFiltersOpt = curFiltersOpts[curFiltersOptKey];

    curFilters[curFiltersOptKey] = curFiltersOpt.defaultValue;
    
    if (req.query[curFiltersOptKey]) {
      let reqFilterVal = req.query[curFiltersOptKey];
      if (typeof(curFiltersOpt.values[reqFilterVal]) !== `undefined`) {
        curFilters[curFiltersOptKey] = reqFilterVal;
        urlOpts.push(`${curFiltersOptKey}=${reqFilterVal}`);
      }
    }
  }

  if (urlOpts.length > 0) {
    res.locals.pageBaseUrl += `?${urlOpts.join(`&`)}`;
  }
  
  res.locals.curFilters = curFilters;
  res.locals.curFiltersOpts = curFiltersOpts;
};

module.exports = {
  actionsLoad,
  actionsLog,
  lazyLoadAdd,
  lazyLoadGet,
  formValidate,
  objLinksSave,
  listPagination,
  objLinksOptsLoad,
  articlesMentionsLoad,
  articlesObjsLinksLoad,
  curFiltersParse,
  commentsLoad,
  likesLoad,
};
