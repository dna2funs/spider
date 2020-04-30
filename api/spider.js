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

function processContents(url, metaObj) {
   let contentType = metaObj.contentType;
   contentType = contentType.split(';')[0].trim();
   switch(contentType) {
      case 'text/html':
         return processContentsForHtml(url);
      case 'text/css':
         return processContentsForCss(url);
   }
}

async function checkStatus(url) {
   if (await i_storage.doesDataExists(url)) {
      if (!downloadObj.status[url]) return;
      if (!downloadObj.status[url].download || downloadObj.status[url].download == 'x') {
         downloadObj.status[url].download = 'y';
      }
   }
}

async function processAddToList(list, url) {
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
      checkStatus(url);
   });
}

async function processContentsForHtml(url) {
   const dataname = await i_storage.getDataFilenameByUrl(url);
   const html = await i_filter.loadHtml(dataname);
   let list = await i_filter.getBasicList(html);
   await processAddToList(list, url);
}

async function processContentsForCss(url) {
   const dataname = await i_storage.getDataFilenameByUrl(url);
   const cssText = (await i_storage.read(dataname)).toString();
   const urlOps = cssText.match(/url\s*[(]\s*[^ \t);]+[ \t)]/g);
   let list = [];
   if (!urlOps) return;
   urlOps.forEach((op) => {
      let i = op.indexOf('(');
      // e.g. url(...) -> ...)
      op = op.substring(i + 1);
      let ch = op.charAt(0);
      i = 0;
      if (ch === '"' || ch === "'") i = op.lastIndexOf(ch);
      if (i > 0) {
         // e.g. "www.google.com")
         op = op.substring(1, i);
      } else {
         // e.g. www.googl.com)
         if (op.charAt(op.length - 1) === ')') op = op.substring(0, op.length - 1);
         op = op.trim();
      }
      if (op.startsWith('data:')) return;
      list.push(op);
   });
   await processAddToList(list, url);
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
            processContents(url, metaObj);
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
         res.end('ok');
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
         res.end('ok');
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