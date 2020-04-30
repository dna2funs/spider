const i_storage = require('./storage');
const i_filter = require('./filter');
const i_parser_html = require('../util/parser/html');

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
      if (await i_storage.doesDataExists(url)) {
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