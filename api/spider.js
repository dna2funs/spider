const i_path = require('path');

const i_env = require('../env');
const i_downloader = require('../engine/downloader');
const i_storage = require('../engine/storage');
const i_filter = require('../engine/filter');
const i_resolver = require('../engine/resolver');
const i_mimetype = require('../util/mimetype');

async function getMimeType(url) {
   const metaname = i_path.join(await i_storage.getMetaFilennameByUrl(url), '_mime');
   let mimetype;
   try {
      mimetype = (await i_storage.read(metaname)).toString().split(';')[0];
   } catch (err) {}
   mimetype = mimetype || i_mimetype.getMimeType(url) || 'text/plain';
   return mimetype;
}

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
      if (!downloadObj.status[url].download || downloadObj.status[url].download === 'x') {
         downloadObj.status[url].download = 'y';
      }
   }
}

function addUrl(url) {
   let statusObj = downloadObj.status[url];
   if (!statusObj) {
      statusObj = { download: 'x' };
      downloadObj.status[url] = statusObj;
   }
   checkStatus(url);
}

async function processAddToList(list, url) {
   list = await i_filter.filterOut(list, url, [
      (_baseUrl, href) => i_filter.util.doesPointToSelf(href)
   ]);
   for (let i = 0, n = list.length; i < n; i++) {
      if (await i_resolver.isResolvedUrl(list[i])) {
         list[i] = list[i].substring(i_env.apiPath.viewer.length + 1).replace('/', '://');
      } else if (list[i].startsWith(i_env.apiPath.viewer)) {
         list[i] = list[i].substring(i_env.apiPath.viewer.length + 1).replace('/', '://');
      } else {
         list[i] = i_filter.util.resolveUrl(url, list[i]);
      }
   }
   list.forEach((url) => {
      addUrl(url);
   });
}

async function processContentsForHtml(url) {
   const dataname = await i_storage.getDataFilenameByUrl(url);
   const htmlText = (await i_storage.read(dataname)).toString();
   let list = await i_filter.getBasicList(htmlText);
   await processAddToList(list, url);
}

async function processContentsForCss(url) {
   const dataname = await i_storage.getDataFilenameByUrl(url);
   const cssText = (await i_storage.read(dataname)).toString();
   const list = await i_filter.getListInCSS(cssText);
   await processAddToList(list, url);
}

const downloadObj = {
   status: {
      // <url>: { download: 'x'/'ing'/'ed'/'err' }
   },
};

const codeApi = {
   // currently load/save only support text file ...
   parseUrl: async (req) => {
      if (!req.url.startsWith(i_env.apiPath.code)) return '';
      const url = req.url.substring(i_env.apiPath.code.length + 1).replace('/', '://');
      return url;
   },
   extractUrls: async(req, res, _options) => {
      try {
         const url = await codeApi.parseUrl(req);
         const mimetype = await getMimeType(url);
         await processContents(url, { contentType: mimetype });
         addUrl(url);
         res.end('ok');
      } catch(err) {
         res.end('error');
      }
   },
   load: async (req, res, _options) => {
      const url = await codeApi.parseUrl(req);
      const dataname = await i_storage.getDataFilenameByUrl(url);
      res.setHeader('Content-Type', 'text/plain');
      res.end(await i_storage.read(dataname));
   },
   save: async (req, res, _options) => {
      const url = await codeApi.parseUrl(req);
      let data = '';
      req.on('data', (chunk) => {
         data += chunk.toString();
      });
      req.on('end', async () => {
         const dataname = await i_storage.getDataFilenameByUrl(url);
         await i_storage.write(dataname, data);
         res.end('ok');
      });
   },
   remove: async (req, res, _options) => {
      const url = await codeApi.parseUrl(req);
      const dataname = i_storage.getDataFilenameByUrl(url);
      const metaname = i_storage.getMetaFilennameByUrl(url);
      if (await i_storage.remove(dataname)) {
         if (await i_storage.remove(metaname)) {
            res.end('ok(with.meta)');
            return;
         }
         res.end('ok(without.meta)');
         return;
      }
      res.end('err');
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
         const url = data;
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
                  const dataname = await i_storage.getDataFilenameByUrl(metaObj.redirect);
                  if (!dataname) throw 'InvalidUrl';
                  await i_storage.prepare(dataname);
                  let statusObj = downloadObj.status[metaObj.redirect];
                  if (!statusObj) statusObj = { download: 'ing' };
                  downloadObj.status[metaObj.redirect] = statusObj;
                  const anotherMetaObj = await i_downloader.download(metaObj.redirect, {}, dataname);
                  /* parallel */ postDownload(url, anotherMetaObj);
               } catch(err) {
                  downloadObj.status[url].download = 'err';
               }
               return;
            }

            downloadObj.status[url].download = 'ed';
            if (metaObj.contentType) {
               const metaname = await i_storage.getMetaFilennameByUrl(url);
               const mimefile = i_path.join(metaname, '_mime');
               await i_storage.prepare(mimefile);
               await i_storage.write(mimefile, metaObj.contentType);
            }
            processContents(url, metaObj);
         } // postDownload
      });
   }, // download
   resolve: async (req, res, _options) => {
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
         if (!data) return res.end('emtpy');
         if (!downloadObj.status[data]) return res.end('notfound');
         if (!(await i_storage.doesDataExists(data))) return res.end('notfound');
         const mimetype = await getMimeType(data);
         let resolver = null;
         switch (mimetype) {
            case 'text/html':
               resolver = i_resolver.resolveUrlForHtml;
               break;
            case 'text/css':
               resolver = i_resolver.resolveUrlForCss;
               break;
            default:
               res.end('notsupport');
               return;
         }
         let step = 'start';
         try {
            const dataname = await i_storage.getDataFilenameByUrl(data);
            step = 'read';
            let text = (await i_storage.read(dataname)).toString();
            step = 'resolve';
            // to make things simple, assume this api attached to /viewer
            // and we can use env var to change it
            text = await resolver(text, data, i_env.apiPath.viewer);
            step = 'write';
            await i_storage.write(dataname, text);
            step = 'status';
            downloadObj.status[data].resolve = 'ok';
            res.end('ok');
         } catch(err) {
            res.end(`error:${step}`);
         }
      });
   }, // resolve
   restore: async (req, res, _options) => {
      // TODO: localized url -> normal
      let data = '';
      req.on('data', (chunk) => {
         data += chunk.toString();
      });
      req.on('end', async () => {
         const mimetype = await getMimeType(data);
         let restorer = null;
         switch (mimetype) {
            case 'text/html':
               restorer = i_resolver.restoreUrlForHtml;
               break;
            case 'text/css':
               restorer = i_resolver.restoreUrlForCss;
               break;
            default:
               res.end('notsupport');
               return;
         }
         let step = 'start';
         try {
            const dataname = await i_storage.getDataFilenameByUrl(data);
            step = 'read';
            let text = (await i_storage.read(dataname)).toString();
            step = 'restore';
            text = await restorer(text, data, i_env.apiPath.viewer);
            step = 'write';
            await i_storage.write(dataname, text);
            res.end('ok');
         } catch(err) {
            res.end(`error:${step}`);
         }
      });
   }, // restore
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
   code: async (req, res, _options) => {
      const method = req.method.toLowerCase();
      if (method === 'get') {
         if (req.headers['spider-extract-urls']) {
            return codeApi.extractUrls(req, res, _options);
         }
         return codeApi.load(req, res, _options);
      } else if (method === 'post') {
         return codeApi.save(req, res, _options);
      } else if (method === 'delete') {
         return codeApi.remove(req, res, _options);
      } else {
         res.writeHead(403, 'Forbidden');
         res.end();
      }
   }
};

module.exports = api;