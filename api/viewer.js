const i_fs = require('fs');

const i_storage = require('../engine/storage');
const i_mimetype = require('../util/mimetype');

const api = async (req, res, options) => {
   if (options.path.length < 3) {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
   }
   const protocol = options.path[0];
   const host = options.path[1];
   const parts = options.path.slice(2);
   const url = `${protocol}://${host}/${parts.join('/')}`;
   if (await i_storage.doesDataExists(url)) {
      const dataname = await i_storage.getDataFilenameByUrl(url);
      const stream = i_fs.createReadStream(dataname);
      res.setHeader('Content-Type', i_mimetype.getMimeType(url));
      stream.pipe(res);
   } else {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
   }
};

module.exports = api;