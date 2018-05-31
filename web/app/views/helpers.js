const moment = require('moment')

const declOfNum = (number, titles) => {
  const cases = [2, 0, 1, 1, 1, 2];
  return number + ' ' + titles[ (number%100>4 && number%100<20)? 2 : cases[(number%10<5)?number%10:5] ];
}

const formatComment = (body) => {
  const escapeHtml = require(`escape-html`);
  body = escapeHtml(body);
  return body.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
};

const articleUrl = (article) => {
  let urlArticleType;
  if (article.type == `story`) {
    urlArticleType = `stories`;
  } else if (article.type == `news`) {
    urlArticleType = `news`;
  } else if (article.type == `post`) {
    urlArticleType = `posts`;
  }
  
  let url = `/${urlArticleType}/${article.idInt}-${article.slug}`;
  
  return url;
};

const profilePicUrl = (picData) => {
  let url;
  if (typeof(picData) === `string`) {
    url = picData;
  } else {
    let dateSuff = (picData.uploadedAt) ? moment(picData.uploadedAt).format(`X`).toString().substr(-3) : `0`;
    url = `${picData.path}?${dateSuff}`;
  }
  
  return url;
};

const formatDate = (origDate, format) => {
  let date;
  if (Number.isInteger(origDate)) {
    date = moment.unix(origDate);
  } else {
    date = moment.utc(origDate);
  }

  if (!format) {
    format = 'YYYY-MM-DD HH:mm:ss';
  }

  let out;
  if (format == `relative` || format == `relativeShort`) {
    let relDate = date.fromNow();
    if (format == `relativeShort`) {
      if (relDate == `a few seconds ago`) {
        relDate = `a minute ago`;
      }
      
      relDate = relDate.split(` `);
      if (relDate[0] == `an` || relDate[0] == `a`) {
        relDate[0] = 1;
      }
      relDate = `${relDate[0]}${relDate[1].substr(0, 1)}`;
    }
    
    out = `<span title="${date}" data-toggle="tooltip" data-placement="bottom">${relDate}</span>`;
  } else {
    out = date.format(format);
  }

  return out;
}


const formatBody = (str) => {
  let out = str;
  
  
  return out;
};

const priceFormat = (str, format) => {
  return numFormat(str, `0,0.00`);
};

const numFormat = (str, format) => {
  let num = Math.abs((str));

  let numFormat;
  if (typeof(format) !== 'undefined') {
    numFormat = format;
  } else {
    if (num < 1000) {
      numFormat = '0';
    } else {
      numFormat = '0.0a';
    }
  }

  var numeral = require('numeral');
  return numeral(str).format(numFormat);
};

const lazyDataGet = (lazyData, objType, field, fieldVal) => {
  let objData = null;
  
  if (typeof(lazyData[objType]) !== `undefined`) {
    if (typeof(lazyData[objType][field]) !== `undefined`) {
      if (typeof(lazyData[objType][field][fieldVal]) !== `undefined`) {
        objData = lazyData[objType][field][fieldVal];
      }
    }
  }
  
  return objData;
};

module.exports = {
  declOfNum,
  formatBody,
  formatDate,
  lazyDataGet,
  formatComment,
  numFormat,
  priceFormat,
  articleUrl,
  profilePicUrl,
};
