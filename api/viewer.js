const i_fs = require('fs');
const i_path = require('path');

const i_env = require('../env');
const i_storage = require('../engine/storage');
const i_mimetype = require('../util/mimetype');

const api = async (req, res, options) => {
   if (options.path.length < 3) {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
   }
   // to make things simple, assume this api attached to /viewer
   // and we can use env var to change it
   // e.g. /veiwer/https//google.com/?q=test -> https://google.com/?q=test
   const url = req.url.substring(i_env.apiPath.viewer.length + 1).replace('/', '://');
   if (await i_storage.doesDataExists(url)) {
      const dataname = await i_storage.getDataFilenameByUrl(url);
      const stream = i_fs.createReadStream(dataname);
      const metaname = i_path.join(await i_storage.getMetaFilennameByUrl(url), '_mime');
      let mimetype;
      try {
         mimetype = (await i_storage.read(metaname)).toString().split(';')[0];
      } catch (err) {}
      mimetype = mimetype || i_mimetype.getMimeType(url) || 'text/plain';
      res.setHeader('Content-Type', mimetype);
      stream.pipe(res);
   } else {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
   }
};

module.exports = api;