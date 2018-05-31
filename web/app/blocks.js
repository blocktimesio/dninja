const moment = require(`moment`);
const _ = require(`lodash`);

const db = require(`${appRoot}/db`);
const helpers = require(`${appRoot}/helpers`);

const loadPageBlocks = async (req, res, opts) => {
  // opts.page
  
  let blocksList = [
    //`trendingPersons`,
    //`advertising`,
  ];
  
  let blocksPerPage = (process.env.ENV_NAME == `dev`) ? 100 : 1;
  let blocksListFinal = _.sampleSize(blocksList, blocksPerPage);
  let blocksOut = [];
  for (let blockType of blocksListFinal) {
    
    let blockData;
    let blockTitle;
    let blockUrl;
    
    if (blockType == `coinsGainerLoser`) {
      blockData = await blockCoinsGainerLoser(req, res);
      blockTitle = `Top gainers & losers`;
      blockUrl = `/coins`;
      blockIcon = `icons8-sorting_arrows`;
    } else if (blockType == `topPosts`) {
      blockData = await blockTopArticles(req, res, {
        type: `post`,
      });
      blockTitle = `Top Posts`;
      blockUrl = `/posts`;
      blockIcon = `icons8-align_left`;
    } else if (blockType == `trendingCoins`) {
      blockData = await blockTrendingCoins(req, res);
      blockTitle = `Trending Coins`;
      blockUrl = `/coins`;
      blockIcon = `icons8-coins`;
    } else if (blockType == `trendingPersons`) {
      blockData = await blockTrendingPersons(req, res);
      blockTitle = `Trending People`;
      blockUrl = `/people`;
      blockIcon = `icons8-user`;
    } else if (blockType == `topTweets`) {
      blockData = await blockTopTweets(req, res);
      blockTitle = `Top Tweets`;
      blockUrl = `/twitter`;
      blockIcon = `icons8-twitter`;
    } else if (blockType == `advertising`) {
      blockData = await blockAdvertising(req, res);
      blockTitle = `Advertising`;
      blockUrl = ``;
      blockIcon = `icons8-advertising` }
    
    let blockOut = {
      type: blockType,
      title: blockTitle,
      url: blockUrl,
      data: blockData,
      icon: blockIcon,
    };
    
    blocksOut.push(blockOut);
  }
  
  res.locals.pageBlocks = blocksOut;
};

let blockTopArticles = async (req, res, opts) => {
  let dataOut = {};
  
  let articlesIds = [];
  
  let periodsList;
  if (opts.type == `news`) {
    periodsList = [`1`, `7`, `31`];
  } else if (opts.type == `story`) {
    periodsList = [`7`, `31`];
  } else if (opts.type == `post`) {
    periodsList = [`7`, `31`];
  }
  
  for (let period of periodsList) {
    let periodData = [];
    
    let dateRange = moment.utc();
    dateRange = dateRange.subtract(period, `days`);
    dateRange = dateRange.toDate();
    
    let rows = await db.mongo.collection(`articles`).find({
      type: opts.type,
      statusId: 1,
      deletedAt: null,
      publishedAt: {
        $gte: dateRange,
      },
    }, {
      sort: [[`rank`, `desc`]],
      limit: 3,
    }).toArray();
    
    for (let row of rows) {
      articlesIds.push(row._id);

      if (row.authorUserId) {
        helpers.lazyLoadAdd(res, `users`, `_id`, row.authorUserId);
      }
    }
    
    periodData = rows;

    dataOut[period] = periodData;
  }

  await helpers.articlesObjsLinksLoad(res, {
    toObjIds: articlesIds,
  });

  await helpers.likesLoad(req, res, {
    objType: `articles`,
    objsIds: articlesIds,
  });
  
  return dataOut;
};

let blockTrendingCoins = async (req, res, opts) => {
  let dataOut;

  let rows = await db.mongo.collection(`coins`).find({
    deletedAt: null,
  }, {
    sort: [[`rank`, `asc`]],
    limit: 3,
  }).toArray();
  
  dataOut = rows;
  
  return dataOut;
};

let blockTopTweets = async (req, res, opts) => {
  let dataOut = {};

  let tweetsIds = [];
  let periodsList = [`1`, `7`, `31`];

  for (let period of periodsList) {
    let periodData = [];

    let dateRange = moment.utc();
    dateRange = dateRange.subtract(period, `days`);
    dateRange = dateRange.toDate();

    let rows = await db.mongo.collection(`twitter_tweets`).find({
      tweetCreatedAt: {
        $gte: dateRange,
      },
    }, {
      sort: [[`likesCount`, `desc`]],
      limit: 3,
    }).toArray();

    for (let row of rows) {
      tweetsIds.push(row._id);

      helpers.lazyLoadAdd(res, `twitter_usernames`, `profile.twitterId`, row.authorTwitterId);
    }

    periodData = rows;
    dataOut[period] = periodData;
  }
  
  return dataOut;
};

let blockTrendingPersons = async (req, res, opts) => {
  let dataOut;

  let rows = await db.mongo.collection(`persons`).find({
    deletedAt: null,
  }, {
    sort: [[`rank`, `desc`]],
    limit: 3,
  }).toArray();
  
  dataOut = rows;
  
  return dataOut;
};

let blockAdvertising = async (req, res, opts) => {
  let dataOut;
  
  dataOut = [];

  return dataOut;
};

let blockCoinsGainerLoser = async (req, res, opts) => {
  let topCoinsDiff = {};
  
  topCoinsDiff.positive = await db.mongo.collection(`coins`).find({
    percentChange24h: {
      $ne: NaN,
    }
  }, {
    sort: [[`percentChange24h`, `desc`]],
    limit: 3,
  }).toArray();
  
  topCoinsDiff.negative = await db.mongo.collection(`coins`).find({
    percentChange24h: {
      $ne: NaN,
    }
  }, {
    sort: [[`percentChange24h`, `asc`]],
    limit: 3,
  }).toArray();
  
  return topCoinsDiff;
};

module.exports = {
  loadPageBlocks,
};
