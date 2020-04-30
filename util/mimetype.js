const i_url = require('url');
const i_path = require('path');

const i_mime = require('mime-db');

const mimeTypeMap = (() => {
   const map = {};
   Object.keys(i_mime).forEach((mimeType) => {
      const item = i_mime[mimeType];
      if (!item.extensions) return;
      if (Array.isArray(item.extensions)) {
         item.extensions.forEach((ext) => {
            map[ext] = mimeType;
         });
      }
   });
   return map;
})();

function getMimeType(url) {
   const urlObj = i_url.parse(url);
   if (urlObj.pathname && urlObj.pathname.endsWith('/')) return 'text/html';
   const extname = i_path.extname(urlObj.pathname).split('.').pop();
   return mimeTypeMap[extname] || 'text/plain';
}

module.exports = {
   getMimeType,
};