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

async function patchUrl(baseUrl, text, list, apiPrefix) {
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

   for (let i = 1, n = parts.length; i < n; i += 2) {
      if (i_filter.util.doesPointToSelf(parts[i])) continue;
      const url = i_filter.util.resolveUrl(baseUrl, parts[i]);
      let resolveable = false;
      if (parts[i].startsWith('/') && !parts[i].startsWith('//')) {
         // check if resovled (doesDataExists); so that we can do incremental resolve
         if (!(await isResolvedUrl(parts[i]))) resolveable = true;
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

const api = {
   patchUrl,
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