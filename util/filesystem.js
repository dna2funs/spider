const i_fs = require('fs');
const i_path = require('path');

const api = {
   sep: i_path.sep,
   open: async (filepath, flags) => new Promise((resolve, rejct) => {
      i_fs.open(filepath, flags, (err, fd) => {
         if (err) return rejct(err);
         resolve(fd);
      });
   }), // open
   close: async (fd) => new Promise((resolve, reject) => {
      i_fs.close(fd, (err) => {
         if (err) return reject(err);
         resolve();
      });
   }), // close
   create: async (filepath) => {
      await api.close(await api.open(filepath, 'w+'));
   }, // create
   rm: async (filepath) => new Promise((resolve, reject) => {
      i_fs.unlink(filepath, (err) => {
         if (err) return reject(err);
         resolve();
      });
   }), // remove
   stat: async (filepath) => new Promise((resolve, reject) => {
      i_fs.stat(filepath, (err, stat) => {
         if (err) return reject(err);
         resolve(stat);
      });
   }), // stat
   lstat: async (filepath) => new Promise((resolve, reject) => {
      i_fs.lstat(filepath, (err, stat) => {
         if (err) return reject(err);
         resolve(stat);
      });
   }), // lstat
   read: async (fd, offset, length) => new Promise((resolve, reject) => {
      const buf = Buffer.alloc(length);
      i_fs.read(fd, buf, 0, length, offset, (err, N, finalBuf) => {
         if (err) return reject(err);
         if (N < length) return resolve(finalBuf);
         resolve(buf);
      });
   }), // read
   readSmallFile: async (filepath) => new Promise((resolve, reject) => {
      i_fs.readFile(filepath, (err, data) => {
         if (err) return reject(err);
         resolve(data);
      });
   }),
   write: async (fd, data, offset) => new Promise((resolve, reject) => {
      if (offset === undefined) {
         i_fs.write(fd, data, post);
      } else {
         i_fs.write(fd, data, 0, data.length, offset, post);
      }

      function post(err, N) {
         if (err) return reject(err);
         resolve(N);
      }
   }), // write
   writeSmallFile: async (filepath, data) => new Promise((resolve, reject) => {
      i_fs.writeFile(filepath, data, (err) => {
         if (err) return reject(err);
         resolve();
      });
   }),
   readlink: async (filepath) => new Promise((resolve, reject) => {
      i_fs.readlink(filepath, (err, link) => {
         if (err) return reject(err);
         resolve(link);
      });
   }), // readlink
   readdir: async (filepath) => new Promise((resolve, reject) => {
      i_fs.readdir(filepath, (err, files) => {
         if (err) return reject(err);
         resolve(files);
      });
   }), // readdir
   mkdir: async (filepath) => new Promise((resolve, reject) => {
      i_fs.mkdir(filepath, (err) => {
         if (err) return reject(err);
         resolve();
      });
   }), // mkdir
   rmdir: async (filepath) => new Promise((resolve, reject) => {
      i_fs.rmdir(filepath, (err) => {
         if (err) return reject(err);
         resolve();
      });
   }), // rmdir
   mkdirP: async (filepath) => {
      if (await api.doesExist(filepath)) return;
      const dirname = i_path.dirname(filepath);
      if (!(await api.doesExist(dirname))) {
         await api.mkdirP(dirname);
      }
      return await api.mkdir(filepath);
   }, // mkdirP
   rmR: async (filepath) => {
      const stat = api.lstat(filepath);
      if (stat.isDirectory()) {
         const files = await api.readdir(filepath);
         for (let i = 0, n = files.length; i < n; i++) {
            const nextpath = i_path.join(filepath, files[i]);
            await api.rmR(nextpath);
         }
         return await api.rmdir(filepath);
      } else {
         return await api.rm(filepath);
      }
   }, // rmR
   doesExist: async (filepath) => {
      try {
         await api.lstat(filepath);
         return true;
      } catch(err) {
         // include(err.code === 'ENOENT')
         return false;
      }
   },
   isSymolLink: async (filepath) => {
      const stat = await api.lstat(filepath);
      return stat.isSymbolicLink();
   },
   isEmptyDirectory: async (filepath) => {
      if (!(await api.isDirectory(filepath))) return false;
      if ((await api.readdir(filepath)).length) return false;
      return true;
   },
   isDirectory: async (filepath) => {
      const stat = await api.stat(filepath);
      return stat.isDirectory();
   },
   isFile: async (filepath) => {
      const stat = await api.stat(filepath);
      return stat.isFile();
   },
   isBinaryFile: async (filepath) => {
      // fast version: read for first 4MB and check if is there \0
      // before call this, make sure filepath pointing to a file
      let fd = -1;
      try {
         fd = await api.open(filepath);
         const buf = (await api.read(fd, 0, 4 * 1024 * 1024)).toString();
         if (buf.indexOf('\0') >= 0) return true;
         return false;
      } finally {
         if (fd >= 0) await api.close(fd);
      }
   },
};

module.exports = api;