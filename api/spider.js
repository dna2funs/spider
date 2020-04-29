const i_downloader = require('../engine/downloader');
const i_storage = require('../engine/storage');
const i_filter = require('../engine/filter');

function filterOutStatus(line) {
   // cmd should not be empty and startsWith #
   let cmd = line.split(' ')[0];
   let value = line.substring(cmd.length + 1).trim();
   if (!value) return;
   const inverse = cmd.startsWith('!');
   if (inverse) cmd = cmd.substring(1);
   switch (cmd) {
      case 'equal':
         value = encodeURI(value);
         Object.keys(downloadObj.status).forEach((url) => {
            const statusObj = downloadObj.status[url];
            if (statusObj.download === 'ing') return;
            if (inverse ^ (url === value)) {
               delete downloadObj.status[url];
            }
         });
         break;
      case 'prefix':
         value = encodeURI(value);
         Object.keys(downloadObj.status).forEach((url) => {
            const statusObj = downloadObj.status[url];
            if (statusObj.download === 'ing') return;
            if (inverse ^ url.startsWith(value)) {
               delete downloadObj.status[url];
            }
         });
         break;
      case 'suffix':
         value = encodeURI(value);
         Object.keys(downloadObj.status).forEach((url) => {
            const statusObj = downloadObj.status[url];
            if (statusObj.download === 'ing') return;
            if (inverse ^ url.endsWith(value)) {
               delete downloadObj.status[url];
            }
         });
         break;
      case 'regex':
         value = new RegExp(value);
         Object.keys(downloadObj.status).forEach((url) => {
            const statusObj = downloadObj.status[url];
            if (statusObj.download === 'ing') return;
            if (inverse ^ value.test(url)) {
               delete downloadObj.status[url];
            }
         });
         break;
   }
}

const downloadObj = {
   status: {
      // <url>: { download: 'x'/'ing'/'ed'/'err' }
   },
};

const api = {
   download: async (req, res, _options) => {
      if (req.method.toLowerCase() !== 'post') {
         res.writeHead(403, 'Forbidden');
         res.end();
         return;
      }
      let data = '';
      req.on('data', (chunk) => {
         data += chunk.toString();
      });
      req.on('end', async () => {
         if (!data) return res.end('empty');
         const url = encodeURI(data);
         let statusObj = downloadObj.status[url];
         if (!statusObj) statusObj = { download: 'x' };
         downloadObj.status[url] = statusObj;
         try {
            const filename = await i_storage.getDataFilenameByUrl(url);
            if (!filename) throw 'InvalidUrl';
            await i_storage.prepare(filename);
            statusObj.download = 'ing';
            /* parallel */ i_downloader.download(url, {}, filename).then((metaObj) => {
               postDownload(url, metaObj);
            }).catch((err) => {
               downloadObj.status[url].download = 'err';
            });
         } catch(err) {
            statusObj.download = 'err';
         }
         res.end('ok');

         async function postDownload(url, metaObj) {
            if (!metaObj) {
               downloadObj.status[url].download = 'err';
               return;
            }
            if (metaObj.redirect) {
               // TODO: handle with dead redirect loop
               //       A --> B, B --> C, C --> A
               try {
                  const filename = await i_storage.getDataFilenameByUrl(metaObj.redirect);
                  if (!filename) throw 'InvalidUrl';
                  await i_storage.prepare(filename);
                  let statusObj = downloadObj.status[metaObj.redirect];
                  if (!statusObj) statusObj = { download: 'ing' };
                  downloadObj.status[metaObj.redirect] = statusObj;
                  const anotherMetaObj = await i_storage.download(metaObj.redirect, {}, filename);
                  /* parallel */ postDownload(metaObj.redirect, anotherMetaObj);
               } catch(err) {
                  downloadObj.status[url].download = 'err';
               }
               delete downloadObj.status[url];
               return;
            }

            downloadObj.status[url].download = 'ed';
            const dataname = await i_storage.getDataFilenameByUrl(url);
            const html = await i_filter.loadHtml(dataname);
            let list = await i_filter.getBasicList(html);
            list = await i_filter.filterOut(list, url, [
               (_baseUrl, href) => i_filter.util.doesPointToSelf(href)
            ]);
            list = list.map((href) => i_filter.util.resolveUrl(url, href));
            list.forEach((url) => {
               let statusObj = downloadObj.status[url];
               if (!statusObj) {
                  statusObj = { download: 'x' };
                  downloadObj.status[url] = statusObj;
               }
            });
         } // postDownload
      });
   }, // download
   include: async (req, res, _options) => {
      if (req.method.toLowerCase() !== 'post') {
         res.writeHead(403, 'Forbidden');
         res.end();
         return;
      }
      let data = '';
      req.on('data', (chunk) => {
         data += chunk.toString();
      });
      req.on('end', () => {
         data.split('\n').forEach((line) => {
            if (!line || line.startsWith('#')) return;
            if (line.startsWith('!')) {
               line = line.substring(1);
            } else {
               line = `!${line}`;
            }
            filterOutStatus(line);
         });
      });
   }, // include
   exclude: async (req, res, _options) => {
      if (req.method.toLowerCase() !== 'post') {
         res.writeHead(403, 'Forbidden');
         res.end();
         return;
      }
      let data = '';
      req.on('data', (chunk) => {
         data += chunk.toString();
      });
      req.on('end', () => {
         data.split('\n').forEach((line) => {
            if (!line || line.startsWith('#')) return;
            filterOutStatus(line);
         });
      });
   }, // exclude
   empty: async (req, res, _options) => {
      if (req.method.toLowerCase() !== 'post') {
         res.writeHead(403, 'Forbidden');
         res.end();
         return;
      }
      if (Object.values(downloadObj.status).filter((item) => item.download === 'ing')[0]) {
         res.end('downloading');
         return;
      }
      downloadObj.status = {};
      res.end('ok');
   }, // empty
   status: async (_req, res, _options) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(downloadObj.status));
   }, // status
};

module.exports = api;