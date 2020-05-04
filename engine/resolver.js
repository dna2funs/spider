const i_storage = require('./storage');
const i_filter = require('./filter');
const i_parser_html = require('../util/parser/html');
const i_env = require('../env');

async function isResolvedUrl(resolvedUri) {
   if (!resolvedUri) return false;
   if (!resolvedUri.startsWith(i_env.apiPath.viewer)) return false;
   const url = resolvedUri.substring(i_env.apiPath.viewer.length + 1).replace('/', '://');
   return await i_storage.doesDataExists(url);
}

async function splitTextByUrlList(text, list) {
   let last = 0;
   const parts = [];
   list.forEach((item) => {
      parts.push(text.substring(last, item.st));
      parts.push(text.substring(item.st, item.ed));
      last = item.ed;
   });
   const len = text.length;
   if (last < len);
   parts.push(text.substring(last));
   return parts;
}

async function patchUrl(baseUrl, text, list, apiPrefix) {
   const parts = await splitTextByUrlList(text, list);
   for (let i = 1, n = parts.length; i < n; i += 2) {
      if (i_filter.util.doesPointToSelf(parts[i])) continue;
      const url = i_filter.util.resolveUrl(baseUrl, parts[i]);
      let resolveable = false;
      if (parts[i].startsWith('/') && !parts[i].startsWith('//')) {
         // check if resovled (doesDataExists); so that we can do incremental resolve
         if (!(await isResolvedUrl(parts[i]))) resolveable = true;
         // make sure url is available
         if (!(await i_storage.doesDataExists(url))) {
            // we can uncomment out below line to convert a local absolute path to full url path; e.g. /lib -> https://somehost/lib
            // parts[i] = url;
            resolveable = false;
         }
      } else if (await i_storage.doesDataExists(url)) {
         resolveable = true;
      }
      if (resolveable) {
         // e.g. apiPrefix = /viewer
         const resolved = `${apiPrefix}/${url.split('://').join('/')}`;
         parts[i] = resolved;
      }
   }
   const patched = parts.join('');
   return patched;
}

async function restoreUrl(baseUrl, text, list, apiPrefix) {
   const parts = await splitTextByUrlList(text, list);
   for (let i = 1, n = parts.length; i < n; i += 2) {
      if (i_filter.util.doesPointToSelf(parts[i])) continue;
      if (!(await isResolvedUrl(parts[i]))) continue;
      const url = parts[i].substring(apiPrefix.length + 1).replace('/', '://');
      if (getSitePrefix(url) === getSitePrefix(baseUrl)) {
         parts[i] = `/${url.split('/').slice(3).join('/')}`;
      } else {
         parts[i] = url;
      }
   }
   const patched = parts.join('');
   return patched;

   function getSitePrefix(url) {
      // e.g. http://www.google.com/
      //        0   1       2        3 
      return url.split('/').slice(0, 3).join('/');
   }
}

const api = {
   isResolvedUrl,
   patchUrl,
   restoreUrl,
   restoreUrlForHtml: async (htmlText, baseUrl, apiPrefix) => {
      const list = i_parser_html.markUrlForHtml(htmlText);
      return await restoreUrl(baseUrl, htmlText, list, apiPrefix);
   },
   restoreUrlForCss: async (cssText, baseUrl, apiPrefix) => {
      const list = i_parser_html.markUrlForCss(cssText);
      return await restoreUrl(baseUrl, cssText, list, apiPrefix);
   },
   resolveUrlForHtml: async (htmlText, baseUrl, apiPrefix) => {
      const list = i_parser_html.markUrlForHtml(htmlText);
      return await patchUrl(baseUrl, htmlText, list, apiPrefix);
   },
   resolveUrlForCss: async (cssText, baseUrl, apiPrefix) => {
      const list = i_parser_html.markUrlForCss(cssText);
      return await patchUrl(baseUrl, cssText, list, apiPrefix);
   },
};

module.exports = api;