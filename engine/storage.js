const i_path = require('path');
const i_url = require('url');

const i_env = require('../env');
const i_filesytem = require('../util/filesystem');

const api = {
   doesDataExists: async (url) => {
      const filename = await api.getDataFilenameByUrl(url);
      return i_filesytem.doesExist(filename);
   },
   getDataFilenameByUrl: async (url) => {
      // e.g. http://www.nothing.com:8080/test.txt => <base>/_data/http/www.nothing.com$3A8080/test.txt
      const database = i_path.join(i_env.storage.base, '_data');
      const urlObj = i_url.parse(url);

      if (!urlObj.protocol) urlObj.protocol = 'file:';
      urlObj.protocol = urlObj.protocol.substring(0, urlObj.protocol.length - 1);
      if (!urlObj.host) urlObbj.host = '';
      if (!urlObj.pathname) urlObj.pathname = '/';
      if (urlObj.pathname.endsWith('/')) urlObj.pathname += 'index.html';
      let filename = i_path.join(
         database,
         urlObj.protocol,
         encodeURIComponent(urlObj.host),
         ...urlObj.pathname.split('/').filter((x) => !!x).map((x) => encodeURIComponent(x))
      );
      filename += (
         encodeURIComponent(urlObj.search || '') +
         encodeURIComponent(urlObj.hash || '')
      );
      return filename;
   },
   getMetaFilennameByUrl: async (url) => {
      // e.g. http://www.nothing.com:8080/test.txt => <base>/_data/http/www.nothing.com$3A8080/test.txt/_
      // e.g. http://www.nothing.com/_/test.txt => <base>/_data/http/www.nothing.com$3A8080/__/test.txt/_
      const metabase = i_path.join(i_env.storage.base, '_meta');
      const urlObj = i_url.parse(url);

      if (!urlObj.protocol) urlObj.protocol = 'file:';
      urlObj.protocol = urlObj.protocol.substring(0, urlObj.protocol.length - 1);
      if (!urlObj.host) urlObbj.host = '';
      if (!urlObj.pathname) urlObj.pathname = '/';
      if (urlObj.pathname.endsWith('/')) urlObj.pathname += 'index.html';
      let filename = i_path.join(
         metabase,
         urlObj.protocol,
         encodeURIComponent(urlObj.host),
         ...urlObj.pathname.split('/').filter(
            (x) => !!x
         ).map(
            (x) => /^_+$/.test(x)?`_${x}`:encodeURIComponent(x)
         )
      );
      filename += (
         encodeURIComponent(urlObj.search || '') +
         encodeURIComponent(urlObj.hash || '')
      );
      filename = i_path.join(filename, '_');
      return filename;
   },
   getUrlByDataFilename: async (filename) => {
      if (!filename) return '';
      const database = i_path.join(i_env.storage.base, '_data') + i_filesytem.sep;
      filename = i_path.resolve(filename);
      if (!filename.startsWith(database)) return '';
      filename = filename.substring(database.length);
      const parts = filename.split(i_filesytem.sep);
      const protocol = parts.shift();
      const host = parts.shift();
      if (!protocol || !host) return '';
      const urlPath = parts.map(
         (x) => decodeURIComponent(x)
      ).join('/');
      let url = `${decodeURIComponent(host)}/${urlPath}`;
      if (protocol === 'file') {
         url = `file:///${url}`;
      } else {
         url = `${protocol}://${url}`;
      }
      return url;
   },
   getUrlByMetaFilename: async (filename) => {
      if (!filename) return '';
      const metabase = i_path.join(i_env.storage.base, '_meta') + i_filesytem.sep;
      filename = i_path.resolve(filename);
      if (!filename.startsWith(metabase)) return '';
      filename = filename.substring(metabase.length);

      // get file name _ or folder name _
      // e.g. <base>/_meta/http/test.com/test.html/_/links => http/test.com/test.html/_
      if (!filename.endsWith(`${i_filesytem.sep}_`)) {
         const tmp_parts = filename.split(`${i_filesytem.sep}_${i_filesytem.sep}`);
         if (tmp_parts.length !== 2) return '';
         filename = i_path.join(tmp_parts[0], '_');
      }

      const parts = filename.split(i_filesytem.sep);
      const last = parts.pop();
      if (last !== '_') return '';
      const protocol = parts.shift();
      const host = parts.shift();
      if (!protocol || !host) return '';
      const urlPath = parts.map(
         (x) => /^_+$/.test(x)?x.substring(1):decodeURIComponent(x)
      ).join('/');
      let url = `${decodeURIComponent(host)}/${urlPath}`;
      if (protocol === 'file') {
         url = `file:///${url}`;
      } else {
         url = `${protocol}://${url}`;
      }
      return url;
   },
   prepare: async (filename) => {
      const dirname = i_path.dirname(filename);
      await i_filesytem.mkdirP(dirname);
   },
   read: async (filename) => {
      api.prepare(filename);
      return await i_filesytem.readSmallFile(filename);
   },
   write: async (filename, data) => {
      api.prepare(filename);
      return await i_filesytem.writeSmallFile(filename, data);
   }
};

module.exports = api;