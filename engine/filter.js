const i_url = require('url');
const i_cheerio = require('cheerio');

const i_storage = require('./storage');

function pointToSelf(href) {
   if (!href) return true;
   // e.g. #/angularjs/style
   if (href.startsWith('#')) return true;
   // e.g. ?change=query
   if (href.startsWith('?')) return true;
   // e.g. javascript:clickButton()
   if (href.startsWith('javascript:')) return true;
   return false;
}

function resolveUrl(baseUrl, href) {
   const urlObj = i_url.parse(baseUrl);
   if (!urlObj.protocol) urlObj.protocol = 'file:';
   if (!href) href = '#';

   if (pointToSelf(href)) return href;
   // e.g. //fonts.google.com/xxx
   if (href.startsWith('//')) href = `${urlObj.protocol}${href}`;

   // complete url, e.g. file:///test, https://www.google.com
   if (href.indexOf('://') >= 0) return href;
   // absolute path, e.g. /
   if (href.startsWith('/')) return `${urlObj.protocol}//${urlObj.host}${href}`;
   // relative path, e.g. ./test/../test.html
   const parts = href.split('/');
   const cursor = (urlObj.pathname || '/').split('/');
   cursor.shift(); // pop empty head, e.g. /test -> ['', 'test'] ->(pop) ['test']
   cursor.pop();   // get directory name, pop base name
   parts.forEach((part) => {
      if (part === '.') return;
      if (part === '..') return cursor.pop();
      cursor.push(part);
   });
   return `${urlObj.protocol}//${urlObj.host}/${cursor.join('/')}`;
}

function filterByRules(rules, baseUrl, href) {
   for (let i = 0, n = rules.length; i < n; i++) {
      const bool = rules[i](baseUrl, href);
      if (!bool) return false;
   }
   return true;
}

const api = {
   loadHtml: async (filename) => {
      const html = (await i_storage.read(filename)).toString();
      return i_cheerio.load(html);
   },
   getBasicList: async (html) => {
      const a_list = html('a').map((i, elem) => {
         return html(elem).attr('href');
      }).get();
      const img_list = html('img').map((i, elem) => {
         return html(elem).attr('src');
      }).get();
      const link_list = html('link').map((i, elem) => {
         return html(elem).attr('href');
      }).get();
      const script_list = html('script').map((i, elem) => {
         return html(elem).attr('src');
      }).get();
      const list = a_list.concat(img_list).concat(link_list).concat(script_list);
      return list;
   },
   filterIn: async (list, baseUrl, rules) => {
      return list.filter((href) => filterByRules(rules, baseUrl, href));
   },
   filterOut: async (list, baseUrl, rules) => {
      return list.filter((href) => !filterByRules(rules, baseUrl, href));
   },
   util: {
      doesPointToSelf: pointToSelf,
      resolveUrl: resolveUrl,
   }
};

module.exports = api;