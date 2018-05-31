const express = require(`express`);
const router = express.Router();
const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);
const helpers = require(`${appRoot}/helpers`);
const blocks = require(`${appRoot}/blocks`);

const getMain = async (req, res, next) => {
  return res.redirect(`/apps`);
  
  
  res.locals.pageTitle.push(`Main`);
  res.locals.menuActive.push(`main`);
  res.locals.pageDesc = ``;

  let articlesIds = [];

  res.locals.pageBaseUrl = `/`;
  
  // posts
  let curFiltersOpts = {
    publishedAt: {
      title: `Date`,
      icon: `icons8-clock`,
      defaultValue: `0`,
      values: {
        0: {
          title: `Anytime`,
          value: `0`,
        },
        1: {
          title: `Today`,
          value: `1`,
        },
        7: {
          title: `Week`,
          value: `7`,
        },
        31: {
          title: `Month`,
          value: `31`,
        },
      }
    },
    sortBy: {
      title: `Sort By`,
      icon: `icons8-sorting_arrows`,
      defaultValue: `publishedAt`,
      values: {
        publishedAt: {
          title: `Date`,
          value: `publishedAt`,
        },
        rank: {
          title: `Rank`,
          value: `rank`,
        },
      },
    },
  };

  await helpers.curFiltersParse(req, res, curFiltersOpts);
  
  let queryWhere = {
    type: {
      $ne: `news`,
    },
    statusId: 1,
    deletedAt: null,
  };

  if (res.locals.curFilters.publishedAt != 0) {
    queryWhere.publishedAt = {
      $gte: moment.utc().subtract(res.locals.curFilters.publishedAt, `days`).toDate(),
    };
  }
  
  let queryOpts = {
    sort: [[`${res.locals.curFilters.sortBy}`, `desc`]],
  };

  let objsTotal = await db.mongo.collection(`articles`).count(queryWhere);
  let pgOpts = await helpers.listPagination(req, res, {
    objsTotal: objsTotal,
    perPage: 20,
  });
  queryOpts = _.extend(queryOpts, {
    limit: pgOpts.perPage,
    skip: pgOpts.skip,
  });
  
  let lastNews = await db.mongo.collection(`articles`).find(queryWhere, queryOpts).toArray();
  res.locals.lastNews = lastNews;
  _.forEach(lastNews, (el) => {
    articlesIds.push(el._id);
    
    if (el.authorUserId) {
      helpers.lazyLoadAdd(res, `users`, `_id`, el.authorUserId);
    }
  });
  
  // featured stories
  let featuredStories = [];
  /*
  let featuredStoriesIds = [];
  let featuredStories = await db.mongo.collection(`articles`).find({
    type: `story`,
    statusId: 1,
    deletedAt: null,
    isFeatured: 1,
  }, {
    sort: [[`publishedAt`, `desc`]],
  }).toArray();
  for (let story of featuredStories) {
    featuredStoriesIds.push(story._id);
    articlesIds.push(story._id);
    if (story.authorUserId) {
      helpers.lazyLoadAdd(res, `users`, `_id`, story.authorUserId);
    }
  }
  */
  res.locals.featuredStories = featuredStories;

  // other stories
  let newsPerStoryBlock = 5;
  let storiesPerBlock = 2;
  let storiesBlocks = Math.ceil(pgOpts.perPage / newsPerStoryBlock);
  let storiesPerPage = storiesBlocks * storiesPerBlock;
  let stories = [];
  /*
  let stories = await db.mongo.collection(`articles`).find({
    type: `story`,
    statusId: 1,
    deletedAt: null,
    _id: {
      $nin: featuredStoriesIds,
    },
  }, {
    sort: [[`publishedAt`, `desc`]],
    limit: storiesPerPage,
    skip: storiesPerPage * (pgOpts.curPage - 1),
  }).toArray();
  */
  res.locals.stories = stories;
  _.forEach(stories, (el) => {
    articlesIds.push(el._id);
    if (el.authorUserId) {
      helpers.lazyLoadAdd(res, `users`, `_id`, el.authorUserId);
    }
  });
  
  res.locals.newsPerStoryBlock = newsPerStoryBlock;
  res.locals.storiesPerBlock = storiesPerBlock;
  
  // load objs links for articles
  await helpers.articlesObjsLinksLoad(res, {
    toObjIds: articlesIds,
  });

  await helpers.likesLoad(req, res, {
    objType: `articles`,
    objsIds: articlesIds,
  });
  
  await blocks.loadPageBlocks(req, res, {
    page: `main`,
  });
  
  res.loc.outTpl = `main`;
  next();
};

const render = async (req, res, next) => {

  await helpers.lazyLoadGet(res);

  // render
  res.render(res.loc.outTpl);
};

router.get(`/`, getMain, render);

module.exports = router;
