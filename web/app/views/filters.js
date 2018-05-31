const moment = require(`moment`);

const formatDate = (str, opts) => {
  
  let out;
  log(str);
  if (opts.format == `relative`) {

    out = moment(str).fromNow();
  } else {

    out = moment(str).format(opts.format);
  }
  
  return out;
};

module.exports = {
  formatDate,
};
