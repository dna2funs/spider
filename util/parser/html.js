const i_text = require('../text');

function tokenIndexToOffset(tokens) {
   const offsets = [];
   let last = 0;
   tokens.forEach((token) => {
      offsets.push(last);
      last += token.length;
   });
   return offsets;
}

function gotoNext(tokens, start, value) {
   for (let i = start, n = tokens.length; i < n; i++) {
      if (tokens[i] === value) return i;
   }
   return -1;
}

function gotoNextEx(tokens, start, values) {
   for (let i = start, n = tokens.length; i < n; i++) {
      if (values.includes(tokens[i])) return i;
   }
   return -1;
}

function jumpToCStyleLineCommentEnd(tokens, start) {
   const a1 = tokens[start];
   const a2 = tokens[start + 1];
   if (a1 !== '/' || a2 !== '/') return start;
   const end = gotoNext(tokens, start + 2, '\n');
   if (end < 0) return tokens.length - 1;
   return end;
}

function jumpToCStyleBlockCommentEnd(tokens, start) {
   const a1 = tokens[start];
   const a2 = tokens[start + 1];
   if (a1 !== '/' || a2 !== '*') return start;
   start += 2;
   let end = start;
   while (end >= 0) {
      end = gotoNext(tokens, end, '*');
      if (end < 0) return tokens.length - 1;
      const b2 = tokens[end + 1];
      if (b2 === '/') return end + 1;
      end ++;
   }
   return tokens.length - 1;
}

function jumpToStringEnd(tokens, start) {
   const a = tokens[start];
   if (a !== '"') return start;
   start ++;
   for (let end = start, n = tokens.length; end < n; end ++) {
      const ch = tokens[end];
      if (ch === '\\') {
         end += 2;
         continue;
      }
      if (ch === '"') return end;
   }
   return tokens.length - 1;
}

function jumpToCharSeqEnd(tokens, start) {
   const a = tokens[start];
   if (a !== '\'') return start;
   start ++;
   for (let end = start, n = tokens.length; end < n; end ++) {
      const ch = tokens[end];
      if (ch === '\\') {
         end += 2;
         continue;
      }
      if (ch === '\'') return end;
   }
   return tokens.length - 1;
}

function jumpToSkipSpace(tokens, start) {
   for (let end = start, n = tokens.length; end < n; end ++) {
      const ch = tokens[end];
      if (ch === ' ') continue;
      if (ch === '\n') continue;
      if (ch === '\t') continue;
      if (ch === '\r') continue;
      return end;
   }
   return tokens.length;
}

function markUrlForCss(cssText, wantIndex) {
   const list = [ /* { st, ed, href } */ ];
   const tokens = i_text.codeTokenize(cssText);
   for (let i = 0, n = tokens.length; i < n; i++) {
      const ch = tokens[i];
      if (ch === '/') {
         i = jumpToCStyleLineCommentEnd(tokens, i);
         i = jumpToCStyleBlockCommentEnd(tokens, i);
      } else if (ch === '"') {
         i = jumpToStringEnd(tokens, i);
      } else if (ch === '\'') {
         i = jumpToCharSeqEnd(tokens, i);
      } else if (ch === 'url') {
         i = extractUrl(tokens, i, list);
      }
   }
   if (wantIndex) return list;
   const offsets = tokenIndexToOffset(tokens);
   list.forEach((item) => {
      item.st = offsets[item.st];
      item.ed = item.st + item.href.length;
   });
   return list;

   function extractUrl(tokens, start, list) {
      let t = tokens[start];
      if (t !== 'url') return start;
      let cur = jumpToSkipSpace(tokens, start + 1);
      t = tokens[cur];
      if (t !== '(') return start;
      cur = jumpToSkipSpace(tokens, cur + 1);
      t = tokens[cur];
      if (!t) return start;

      if (t === '"') {
         start = cur + 1;
         end = jumpToStringEnd(tokens, cur);
      } else if (t === '\'') {
         start = cur + 1;
         end = jumpToStringEnd(tokens, cur);
      } else {
         start = cur;
         end = gotoNextEx(tokens, cur + 1, [')', ' ', '\t', '\n']);
      }
      const obj = { st: start, ed: end, href: tokens.slice(start, end).join('') };
      list.push(obj);
      return end;
   }
}

function markUrlForHtml(htmlText, wantIndex) {
   const list = [ /* { st, ed, href } */ ];
   const tokens = i_text.codeTokenize(htmlText);
   for (let i = 0, n = tokens.length; i < n; i++) {
      const ch = tokens[i];
      if (ch === '<') {
         i = extractUrl(tokens, i, list);
      }
   }

   const offsets = tokenIndexToOffset(tokens);
   list.forEach((item) => {
      item.st = offsets[item.st];
      item.ed = item.st + item.href.length;
   });
   return list;

   function extractUrl(tokens, start, list) {
      let t1 = tokens[start];
      if (t1 !== '<') return start;
      let t2 = tokens[start+1];
      if (!t2) return start;
      t1 = t2.charAt(0);
      // <@... <你好 <02
      if (!/[A-Za-z!/?]/.test(t1)) return start;
      // <!-- -->  <![DATA[ ]]> <!doctype >
      if (t2 === '!') return skipBlockTag(tokens, start);
      // <?xml />
      if (t2 === '?') return skipTag(tokens, start);
      // </close>
      if (t2 === '/') return skipClosePair(tokens, start);
      if (t2 === 'style') return extractUrlForEmbeddedCss(tokens, start, list);
      return extractUrlForTag(tokens, start, list)
   }

   function skipBlockTag(tokens, start) {
      let end = start + 2;
      const a1 = tokens[end];
      const a2 = tokens[end + 1];
      if (a1 === '-' && a2 === '-') {
         // <!-- -->
         end += 2;
         while (end >= 0) {
            end = gotoNext(tokens, end, '-');
            if (end < 0) return tokens.length - 1;
            const b1 = tokens[end + 1];
            const b2 = tokens[end + 2];
            if (b1 === '-' && b2 == '>') return end + 2;
            end ++;
         }
         // should not be here
         return tokens.length - 1;
      } else if (a1 === '[' && a2 === 'CDATA') {
         const a3 = tokens[end + 2];
         if (a3 === '[') {
            // <![CDATA[ ]]>
            end += 3;
            while (env >= 0) {
               end = gotoNext(tokens, end, ']');
               if (end < 0) return tokens.length - 1;
               const b1 = tokens[end + 1];
               const b2 = tokens[end + 2];
               if (b1 === ']' && b2 == '>') return end + 2;
               end ++;
            }
            // should not be here
            return tokens.length - 1;
         }
         // fall back to normal <! ... >
      }
      return skipTag(tokens, start);
   }

   function skipTag(tokens, start) {
      let end = start;
      while (end >= 0) {
         end = gotoNextEx(tokens, end, ['>', '"', '\'']);
         const ch = tokens[end];
         if (ch === '>') return end;
         if (ch === '"') {
            end = jumpToStringEnd(tokens, end);
         } else {
            end = jumpToCharSeqEnd(tokens, end);
         }
         if (end < 0) return tokens.length - 1;
         end ++;
      }
      return tokens.length - 1;
   }

   function skipClosePair(tokens, start) {
      // </div> </ div> </div test="<>" >
      return skipTag(tokens, start);
   }

   function extractUrlForEmbeddedCss(tokens, start, list) {
      start = skipTag(tokens, start);
      let end = start;
      while (end >= 0) {
         end = gotoNext(tokens, end + 1, 'style');
         if (end < 0) {
            end = tokens.length;
            break;
         }
         // simply assume </style[^-] is enough
         if (tokens[end - 1] === '/' && tokens[end - 2] === '<' && tokens[end + 1] !== '-') {
            end -= 2;
            break;
         }
      }
      const embed = markUrlForCss(tokens.slice(start, end).join(''), true);
      embed.forEach((item) => {
         item.st += start;
         item.ed += start;
         list.push(item);
      });

      return end - 1;
   }

   function extractUrlForTag(tokens, start, list) {
      const tag = tokens[start + 1];
      let targetKeys = [];
      // TODO: <meta http-equiv="refresh" content="3;url=https://www.mozilla.org">
      if (['img', 'script', 'audio', 'video', 'source', 'track', 'iframe', 'embed', 'applet'].includes(tag)) {
         // src
         targetKeys.push('src');
      } else if (['a', 'link', /* map > area */ 'area'].includes(tag)) {
         // href
         targetKeys.push('href');
      } else {
         targetKeys.push('style');
      }
      // console.debug('tag:', tag);
      const space = [' ', '\n', '\t', '\r'];
      let end = start + 2, n = tokens.length;
      for (; end < n; end++) {
         const ch = tokens[end];
         if (ch === '>') break;
         if (space.includes(ch)) continue;
         end = extractUrlForKeyVal(tokens, end, targetKeys, list);
      }
      if (tag === 'script') {
         while (end >= 0) {
            end = gotoNext(tokens, end + 1, 'script');
            if (end < 0) {
               end = tokens.length - 1;
               break;
            }
            // </script, except </script-xx
            if (tokens[end - 1] === '/' && tokens[end - 2] === '<' && tokens[end + 1] === '>') {
               end = end - 3;
               break;
            }
         }
         //  </script>
         // ^--- goto here
      }
      return end;
   }

   function extractUrlForKeyVal(tokens, start, targetKeys, list) {
      // / can be in value like <div key=a/b/c>
      // but it should not be used in key like <div a/test=1 b=2> -> <div a b=2>
      const stops = [' ', '>', '\n', '\t', '\r'];
      let key = '';
      let sw = true;
      let value = '';

      let end = start, n = tokens.length;
      key = tokens[end];
      if (key === '/') {
         end = gotoNextEx(tokens, end + 1, stops);
         if (end < 0) end = n;
         return end - 1;
      }

      end ++;
      for (; end < n; end ++) {
         const ch = tokens[end];
         if (sw) {
            if (ch === '=') {
               sw = false;
               start = end + 1;
               continue;
            } else if (stops.includes(ch)) {
               if (key) return end - 1;
               continue;
            } else if (ch === '>') {
               return end - 1;
            }
            key += ch;
         } else {
            if (ch === '>') {
               end = start;
               break;
            }
            if (stops.includes(ch)) {
               if (value) break;
               start = end + 1;
               continue;
            }
            if (ch === '"') {
               end = jumpToStringEnd(tokens, end) + 1;
               value = tokens.slice(start + 1, end - 1).join('');
               break;
            } else if (ch === '\'') {
               end = jumpToCharSeqEnd(tokens, end) + 1;
               value = tokens.slice(start + 1, end - 1).join('');
               break;
            }
            value += ch;
         }
      } // for

      // console.debug('attribute:', key, value)
      if (targetKeys.includes(key)) {
         let st = start, ed = end;
         if (key === 'style') {
            if (tokens[st] === '"' || tokens[st] === '\'') {
               st ++;
               ed --;
            }
            const embed = markUrlForCss(value, true);
            embed.forEach((item) => {
               item.st += st;
               item.ed += st;
               list.push(item);
            });
         } else {
            if (tokens[st] === '"' || tokens[st] === '\'') {
               st ++;
               ed --;
            }
            const obj = { st: st, ed: ed, href: value };
            list.push(obj);
         }
      }
      return end - 1;
   }
}

module.exports = {
   markUrlForCss,
   markUrlForHtml,
};

if (require.main === module) {
   const i_fs = require('fs');

   const mimetype = process.argv[2];
   const filename = process.argv[3];
   const text = i_fs.readFileSync(filename).toString();
   let list;
   if (mimetype === 'html') {
      list = markUrlForHtml(text);
   } else if (mimetype === 'css') {
      list = markUrlForCss(text);
   }
   list.forEach((item) => {
      item.real = text.substring(item.st, item.ed);
   });
   console.log(`${mimetype}:`, JSON.stringify(list, null, 3));
}