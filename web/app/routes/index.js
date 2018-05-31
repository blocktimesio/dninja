const express = require('express');
const router = express.Router();

router.get(`/robots.txt`, (req, res, next) => {
  let robotsFile = (process.env.ENV_NAME == 'production') ? 'robots_prod' : 'robots_dev';
  res.sendFile(`${appRoot}/public/${robotsFile}.txt`);
});
router.get(`/sitemap.xml`, (req, res, next) => {
  return res.redirect(`/sitemap/sitemap.xml`);
});

router.use('/', require('./main'));
router.use('/', require('./apps'));
//router.use('/', require('./pages'));

module.exports = router;
