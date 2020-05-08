const i_http = require('http');
const i_https = require('https');

const i_storage = require('./storage');
const i_filter = require('./filter');

async function download(url, options, filename) {
   return new Promise((resolve, reject) => {
      if (!options) options = {};

      // rebuild url
      const parts = url.split('//');
      if (parts[0] === '') {
         url = `https:${url}`;
         parts[0] = 'https:';
      } else if (parts.length === 1) {
         url = `https://${url}`;
         parts[0] = 'https:';
      }
      const protocol = parts[0];
      const lib = protocol === 'http:'?i_http:i_https;
      const obj = {};
      obj.url = url;
      obj.filename = filename;
      const req = lib.request(url, options, (res) => {
         switch (res.statusCode) {
            case 404:
               if (url.endsWith('/index.html')) {
                  obj.redirect = url.substring(0, url.lastIndexOf('/') + 1);
                  resolve(obj);
                  return;
               }
               break;
            case 301: case 302: case 304: case 307:
               obj.redirect = res.headers['location'];
               if (!obj.redirect) return reject(obj);
               if (obj.redirect.startsWith('//')) {
                  obj.redirect = `${protocol}${obj.redirect}`;
               } else if (obj.redirect.indexOf('://') < 0) {
                  obj.redirect = `${protocol}//${obj.redirect}`;
               }
               resolve(obj);
               return;
            case 200: case 201: case 204:
               obj.contentType = res.headers['content-type'] || 'application/octet-stream';
               let bufs = [];
               res.on('data', (data) => {
                  // TODO: limit buf size
                  bufs.push(data);
               });
               res.on('end', async () => {
                  await i_storage.write(filename, Buffer.concat(bufs));
                  resolve(obj);
               });
               res.on('error', (err) => {
                  stream.close();
                  obj.error = true;
                  obj.details = err;
                  reject(obj);
               });
               return;
         }
         obj.statusCode = res.statusCode;
         obj.error = true;
         reject(obj);
      });
      req.on('error', (err) => {
         obj.error = true;
         obj.details = err;
         reject(obj);
      });
      req.end();
   });
}

module.exports = {
   download,
};

if (require.main === module) {
   async function main () {
      const url = 'https://nodejs.org/docs/latest-v13.x/api/all.html';
      const dataname = await i_storage.getDataFilenameByUrl(url);
      i_storage.prepare(dataname);
      const metaname = await i_storage.getMetaFilennameByUrl(url);
      i_storage.prepare(metaname);
      console.log(
         dataname, metaname,
         await i_storage.getUrlByDataFilename(dataname),
         await i_storage.getUrlByMetaFilename(metaname + '/links'),
         await i_storage.getUrlByMetaFilename(metaname)
      );
      console.log(`downloading ${url} ...`);
      await download(url, {}, dataname);
      console.log(`loading ${url} HTML ...`);
      const htmlText = await i_storage.read(dataname);
      console.log(`get links ...`);
      let list = await i_filter.getBasicList(htmlText);
      console.log(`filter links ...`);
      list = await i_filter.filterOut(list, url, [
         (_baseUrl, href) => i_filter.util.doesPointToSelf(href)
      ]);
      list = list.map((href) => i_filter.util.resolveUrl(url, href));
   
      console.log(JSON.stringify(list, null, 3));
      console.log('Done.');
   }
   
   main();
}