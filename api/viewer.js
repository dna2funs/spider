const i_fs = require('fs');
const i_path = require('path');

const i_storage = require('../engine/storage');
const i_mimetype = require('../util/mimetype');

const api = async (req, res, options) => {
   if (options.path.length < 3) {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
   }
   // to make things simple, assume this api attached to /viewer
   // and change the first / to ://
   // e.g. /veiwer/https//google.com/?q=test -> https://google.com/?q=test
   const url = req.url.substring('/viewer/'.length).replace('/', '://');
   if (await i_storage.doesDataExists(url)) {
      const dataname = await i_storage.getDataFilenameByUrl(url);
      const stream = i_fs.createReadStream(dataname);
      const metaname = i_path.join(await i_storage.getMetaFilennameByUrl(url), '_mime');
      let mimetype;
      try {
         mimetype = (await i_storage.read(metaname)).toString();
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