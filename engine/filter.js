const i_url = require('url');

const i_parser_html = require('../util/parser/html');

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
   getBasicList: async (htmlText) => {
      const list = i_parser_html.markUrlForHtml(htmlText).map((item) => item.href);
      return list;
   },
   getListInCSS: async (cssText) => {
      const list = i_parser_html.markUrlForCss(cssText).map((item) => item.href);
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