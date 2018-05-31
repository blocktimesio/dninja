const sleep = require(`sleep-promise`);
const moment = require(`moment`);
const _ = require(`lodash`);
const rp = require(`request-promise`);
const slug = require('slug');

const db = require(`./db`);
const utils = require(`./utils`);

const dappradarGrab = async () => {
  let url = `https://dappradar.com/api/dapps`;

  let rpOpts = {
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36',
    }
  };

  if (0) {
    try {
      let res = await rp(rpOpts);
      res = JSON.parse(res);

      for (let row of res) {
        let updData = {
          title: row.title,
          slug: row.slug,
          description: row.description,
          url: row.url,
          category: row.category,
          createdAt: moment(row.createdAt).toDate(),
          volume24h: parseFloat(row.volumeLastDay),
          volume7d: parseFloat(row.volumeLastWeek),
          tx24h: parseInt(row.txLastDay),
          tx7d: parseInt(row.txLastWeek),
          dau24h: parseInt(row.dauLastDay),
          updatedAt: moment.utc().toDate(),
          dappradarId: row.id,
          deletedAt: null,
        };

        let appId;
        let ex = await db.mongo.collection(`apps`).findOne({
          dappradarId: updData.dappradarId,
        });
        if (ex) {
          await db.mongo.collection(`apps`).updateOne({
            _id: ex._id,
          }, {
            $set: updData,
          });

          appId = ex._id;
        } else {
          updData.dappradarLastUpdatedAt = moment(`2016-01-01`).toDate();

          await db.mongo.collection(`apps`).insertOne(updData);

          appId = updData._id;
        }

        log(`app: ${updData.title} `)
      }

    } catch (err) {
      log(`[coinsCollect] ERROR: caught err`);
      log(err.stack);

      await sleep(10000);
    }
  }
  
  log(`update apps...`);
  
  let rows = await db.mongo.collection(`apps`).find({
    dappradarLastUpdatedAt: {
      $lte: moment.utc().subtract(30, `days`).toDate(),
    }
  }).toArray();
  log(`rows.len = ${rows.length}`);
  for (let appRow of rows) {
    
    try {
      rpOpts.url = `https://dappradar.com/api/dapp/${appRow.dappradarId}/links`;
      let res = await rp(rpOpts);
      res = JSON.parse(res);

      if (appRow.url) {
        res.push({
          title: `Website`,
          url: appRow.url,
        });
      }
      for (let row of res) {
        let updData = {
          appId: appRow._id,
          title: row.title,
          url: row.url,
          updatedAt: moment.utc().toDate(),
        };

        let ex = await db.mongo.collection(`apps_links`).findOne({
          appId: updData.appId,
          url: updData.url,
        });
        if (ex) {
          await db.mongo.collection(`apps_links`).updateOne({
            _id: ex._id,
          }, {
            $set: updData,
          });
        } else {
          updData.createdAt = moment().utc().toDate();

          await db.mongo.collection(`apps_links`).insertOne(updData);
        }

        log(`[${appRow.title} (${appRow.dappradarId})] app link: ${updData.url} - ${updData.title} `)
      }

      rpOpts.url = `https://dappradar.com/api/dapp/${appRow.dappradarId}/contracts`;
      res = await rp(rpOpts);
      res = JSON.parse(res);

      for (let row of res) {
        let updData = {
          appId: appRow._id,
          title: row.title,
          address: row.address,
          updatedAt: moment.utc().toDate(),
        };

        let ex = await db.mongo.collection(`apps_contracts`).findOne({
          appId: updData.appId,
          address: updData.address,
        });
        if (ex) {
          await db.mongo.collection(`apps_contracts`).updateOne({
            _id: ex._id,
          }, {
            $set: updData,
          });
        } else {
          updData.createdAt = moment().utc().toDate();

          await db.mongo.collection(`apps_contracts`).insertOne(updData);
        }

        log(`[${appRow.title} (${appRow.dappradarId})] app contract: ${updData.url} - ${updData.address} `)
      }

      await db.mongo.collection(`apps`).updateOne({
        _id: appRow._id,
      }, {
        $set: {
          dappradarLastUpdatedAt: moment.utc().toDate(),
        },
      });
    } catch (err) {
      log(`[coinsCollect] ERROR: caught err`);
      log(err.stack);

      await sleep(10000);
    }
  }
 
  let sleepTime = 10 * 60 * 1000;
  log(`finished, sleeping ${sleepTime}`);
  await sleep(sleepTime);
};

const sitemapGenerate = async () => {
  const fs = require(`fs`);

  //let sitemapDir = `${appRoot}../web/app/public/sitemap`;
  let sitemapDir = `${appRoot}../../production/web/app/public/sitemap`;
  if (!fs.existsSync(sitemapDir)) {
    fs.mkdirSync(sitemapDir);
  }
  
  function buffWrite(sitemapDir, sitemapBuff, sitemapCurNum) {
    log(`buffWrite`);

    let filename = `${sitemapDir}/${sitemapCurNum}-sitemap.xml`;

    let out = sitemapBuff;
    out = `<?xml version="1.0" encoding="UTF-8"?>
	<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${out}</urlset>`;
    fs.writeFileSync(filename, out);
  }

  let sitemapRowsLimitPerFile = 49500;
  let sitemapBuff = ``;
  let sitemapCurRows = 0;
  let sitemapRows = 0;
  let sitemapCurNum = 0;
  let siteUrl = `https://blocktimes.io`;
  
  let otherPages = [
    `/`,
    `/posts`,
    `/news`,
    `/coins`,
    `/people`,
    `/twitter`,
  ];
  for (let otherPage of otherPages) {
    sitemapBuff += `<url><loc>${siteUrl}${otherPage}</loc></url>`;
    sitemapRows++;
    sitemapCurRows++;
  }

  let cols = [
    {
      colName: `articles`,
      pref: `/posts/`,
      whereOpts: {
        type: `post`,
        deletedAt: null,
        statusId: 1,
      },
      urlField: `slug`,
      suffs: [
        ``,
      ],
    },
    {
      colName: `articles`,
      pref: `/news/`,
      whereOpts: {
        type: `news`,
        deletedAt: null,
        statusId: 1,
      },
      urlField: `slug`,
      suffs: [
        ``,
      ],
    },
    {
      colName: `coins`,
      pref: `/coins/`,
      whereOpts: {
        deletedAt: null,
      },
      urlField: `slug`,
      suffs: [
        ``,
      ],
    },
    {
      colName: `persons`,
      pref: `/people/`,
      whereOpts: {
        deletedAt: null,
      },
      urlField: `slug`,
      suffs: [
        ``,
      ],
    },
  ];

  let cursor;
  let rowsCounter;
  let rowsLim;
  
  for (let col of cols) {
    
    rowsCounter = 0;
    rowsLim = 10000;
    cursor = await db.mongo.collection(col.colName).find(col.whereOpts, {
      sort: [[`_id`, `desc`]],
    });
    while (1) {
      let data;

      try {
        data = await cursor.next();
      } catch (e) {
        log(`CAUGHT IN CURSOR:`);
        log(e.stack);
      }

      if (data === null) {
        //log(`cursor is finished, break`);
        break;
      }

      rowsCounter++;

      if (0 && rowsCounter >= rowsLim) {
        log(`rowsLim, break!`);
        break;
      }

      let baseUrl = `${col.pref}`;
      if (col.colName == `articles`) {
        baseUrl = `${baseUrl}${data.idInt}-${data[col.urlField]}`;
      } else {
        baseUrl = `${baseUrl}${data[col.urlField]}`;
      }
    
      for (let suff of col.suffs) {
        sitemapBuff += `<url><loc>${siteUrl}${baseUrl}${suff}</loc></url>`;
        sitemapRows++;
        sitemapCurRows++;
      }

      if (sitemapCurRows >= sitemapRowsLimitPerFile) {
        buffWrite(sitemapDir, sitemapBuff, sitemapCurNum);
        sitemapCurNum++;
        sitemapBuff = [];
        sitemapCurRows = 0;
      }

      //log(data);

      if (rowsCounter % 1000 == 0) {
        log(`[${col.colName}] ${rowsCounter}... _id = ${data._id.toString()}, sitemapRows=${sitemapRows}`);
      }
    }
    log(``);
  }

  if (sitemapBuff.length > 0) {
    buffWrite(sitemapDir, sitemapBuff, sitemapCurNum);
  }

  let finalSitemap = ``;
  for (let i=0;i<=sitemapCurNum; i++) {
    finalSitemap += `<sitemap><loc>${siteUrl}/sitemap/${i}-sitemap.xml</loc></sitemap>`
  }
  finalSitemap = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/siteindex.xsd">${finalSitemap}</sitemapindex>`;
  fs.writeFileSync(`${sitemapDir}/sitemap.xml`, finalSitemap);

  //log(sitemapBuff)
  log(`sitemapRows=${sitemapRows}, sitemapCurNum=${sitemapCurNum}`);
  
  log(`finished!`);
  process.exit(0);
};

module.exports = {
  dappradarGrab, 
  sitemapGenerate, 
};
