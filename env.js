const i_path = require('path');

const env = {
   debug: !!process.env.SPIDER_DEBUG,
   server: {
      port: parseInt(process.env.SPIDER_PORT || '20202'),
      host: process.env.SPIDER_HOST || '0.0.0.0',
      staticDir: process.env.SPIDER_STATIC_DIR?i_path.resolve(process.env.SPIDER_STATIC_DIR):'',
      httpsCADir: process.env.SPIDER_HTTPS_CA_DIR?i_path.resolve(process.env.SPIDER_HTTPS_CA_DIR):'',
   },
   storage: {
      base: i_path.resolve(process.env.SPIDER_BASE_DIR || '.'),
      // <base>/_data
      // <base>/_meta
   },
   apiPath: {
      viewer: process.env.SPIDER_API_VIEWER || '/viewer',
      code: process.env.SPIDER_API_CODE || '/api/v1/code',
   },
};

module.exports = env;