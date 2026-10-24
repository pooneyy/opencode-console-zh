// ==UserScript==
// @name         OpenCode Console 汉化
// @name:en      OpenCode Console Chinese Localization
// @namespace    https://github.com/pooneyy/opencode-console-zh
// @version      1.0.0
// @description    将 opencode.ai/console 界面自动翻译为简体中文，覆盖导航、按钮、表单、提示与报错信息，支持 SPA 动态渲染，可随时一键切换中英文。如有任何问题，请前往 https://github.com/pooneyy/opencode-console-zh 提交 Issue。
// @description:en Translate the opencode.ai console UI into Simplified Chinese automatically, with SPA support and a one-key toggle. If you have any questions, please go to https://github.com/pooneyy/opencode-console-zh and submit an Issue.
// @author       pooneyy
// @copyright    2026, pooneyy (https://github.com/pooneyy)
// @match        https://opencode.ai/console*
// @match        https://www.opencode.ai/console*
// @icon         https://opencode.ai/console/favicon.svg
// @require      https://fastly.jsdelivr.net/gh/pooneyy/opencode-console-zh@main/local.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @run-at       document-end
// @license      AGPL-3.0
// ==/UserScript==

(function () {
  "use strict";
  /* ================ 挂载外联词库与规则 =============== */

  // 挂载外联词库与规则
  var DICT_RAW = (typeof window !== "undefined" && window.OPENCODE_ZH_DICT) || {};
  var RULES = (typeof window !== "undefined" && window.OPENCODE_ZH_RULES) || [];

  /* ==================== 翻译引擎 ==================== */

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, CODE: 1, PRE: 1,
    KBD: 1, SAMP: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, CANVAS: 1, SVG: 1, MATH: 1
  };
  var ATTRS = ["title", "placeholder", "aria-label", "alt", "aria-description", "label"];

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 去掉首尾空白
  var DICT = {};
  for (var __k in DICT_RAW) {
    if (own(DICT_RAW, __k)) {
      var __v = DICT_RAW[__k].trim();
      if (!own(DICT, __k.trim())) DICT[__k.trim()] = __v;
    }
  }
  // 尾部分隔符命中时先剥离分隔符
  var TRAILING_SEP = /^(.*?)((?:\s*[·•|●|/]\s*)+)$/;
  var LEADING_SEP = /^([ \u00a0]*[·•|●|/][ \u00a0]+)([\s\S]+)$/;

  function normalizeSpace(text) {
    return text.replace(/[\s\u00a0]+/g, " ").trim();
  }

  var DICT_NORM = {};
  var DICT_CI = {};
  function buildDictNorm() {
    for (var k in DICT) {
      if (!own(DICT, k)) continue;
      var nk = normalizeSpace(k);
      if (nk && !own(DICT_NORM, nk)) DICT_NORM[nk] = DICT[k];
      var ck = nk.toLowerCase();
      if (ck && !own(DICT_CI, ck)) DICT_CI[ck] = DICT[k];
    }
  }
  buildDictNorm();

  // 翻译核心：返回翻译结果，未命中返回 null
  function trCore(text) {
    var r = trCoreEx(text);
    return r ? r.text : null;
  }

  // 带元信息的翻译核心
  function trCoreEx(text) {
    if (!text) return null;
    if (own(DICT, text)) return { text: DICT[text], normalized: false };
    var alt = text.charAt(0).toLowerCase() + text.slice(1);
    if (alt !== text && own(DICT, alt)) return { text: DICT[alt], normalized: false };
    var cap = text.charAt(0).toUpperCase() + text.slice(1);
    if (cap !== text && own(DICT, cap)) return { text: DICT[cap], normalized: false };
    var low = text.toLowerCase();
    if (low !== text && own(DICT, low)) return { text: DICT[low], normalized: false };
    var norm = normalizeSpace(text);
    if (norm && norm !== text) {
      if (own(DICT, norm)) return { text: DICT[norm], normalized: true };
      if (own(DICT_NORM, norm)) return { text: DICT_NORM[norm], normalized: true };
    }
    var ciKey = normalizeSpace(text).toLowerCase();
    if (ciKey && own(DICT_CI, ciKey)) {
      return { text: DICT_CI[ciKey], normalized: true };
    }
    var lead = LEADING_SEP.exec(text);
    if (lead && lead[2]) {
      var lb = trCore(lead[2]);
      if (lb !== null && lb !== lead[2]) return { text: lead[1] + lb, normalized: false };
    }
    var sep = TRAILING_SEP.exec(text);
    if (sep && sep[1]) {
      var base = trCore(sep[1]);
      if (base !== null && base !== sep[1]) return { text: base + sep[2], normalized: false };
    }
    for (var i = 0; i < RULES.length; i++) {
      var re = RULES[i][0], rep = RULES[i][1];
      re.lastIndex = 0;
      if (re.test(text)) {
        var rr = applyRuleWithResidual(text, re, rep);
        return { text: rr.text, normalized: false, rule: true, uncovered: rr.uncovered };
      }
    }
    return null;
  }

  var RESIDUAL_WORD = /[A-Za-z]{2,}/g;

  function trDictOnly(seg) {
    if (own(DICT, seg)) return DICT[seg];
    var alt = seg.charAt(0).toLowerCase() + seg.slice(1);
    if (alt !== seg && own(DICT, alt)) return DICT[alt];
    var cap = seg.charAt(0).toUpperCase() + seg.slice(1);
    if (cap !== seg && own(DICT, cap)) return DICT[cap];
    var low = seg.toLowerCase();
    if (low !== seg && own(DICT, low)) return DICT[low];
    var norm = normalizeSpace(seg);
    if (norm && norm !== seg) {
      if (own(DICT, norm)) return DICT[norm];
      if (own(DICT_NORM, norm)) return DICT_NORM[norm];
    }
    var ciKey = normalizeSpace(seg).toLowerCase();
    if (ciKey && own(DICT_CI, ciKey)) return DICT_CI[ciKey];
    return null;
  }

  function translateResidual(segment) {
    if (!/[A-Za-z]/.test(segment)) return segment;
    var words = [];
    segment.replace(RESIDUAL_WORD, function (seg, offset) {
      var before = offset > 0 ? segment.charAt(offset - 1) : "";
      var after = offset + seg.length < segment.length ? segment.charAt(offset + seg.length) : "";
      if (/[A-Za-z0-9_-]/.test(before) || /[A-Za-z0-9_-]/.test(after)) return seg;
      words.push({ s: offset, e: offset + seg.length, t: trDictOnly(seg) });
      return seg;
    });
    if (!words.length) return segment;
    for (var i = 0; i < words.length; i++) {
      if (words[i].t === null) return segment;
    }
    var out = "";
    var pos = 0;
    for (var j = 0; j < words.length; j++) {
      out += segment.slice(pos, words[j].s) + words[j].t;
      pos = words[j].e;
    }
    return out + segment.slice(pos);
  }

  function applyRuleWithResidual(text, re, rep) {
    var spans = [];
    re.lastIndex = 0;
    var mm;
    while ((mm = re.exec(text)) !== null) {
      spans.push(mm);
      if (!re.global) break;
      if (mm[0].length === 0) re.lastIndex++;
    }
    var out = "";
    var pos = 0;
    var uncovered = false;
    for (var i = 0; i < spans.length; i++) {
      var m = spans[i];
      if (m.index > pos) {
        var seg = text.slice(pos, m.index);
        var tr = translateResidual(seg);
        if (tr === seg && /[A-Za-z]/.test(seg)) uncovered = true;
        out += tr;
      }
      out += rep.replace(/\$(\d)/g, function (ph, d) {
        if (d === "0") return ph;
        var g = m[+d];
        if (g === undefined) return ph;
        var tg = trCore(g);
        return tg === null ? g : tg;
      });
      pos = m.index + m[0].length;
    }
    if (pos < text.length) {
      var tail = text.slice(pos);
      var trTail = translateResidual(tail);
      if (trTail === tail && /[A-Za-z]/.test(tail)) uncovered = true;
      out += trTail;
    }
    return { text: out, uncovered: uncovered };
  }

  function reapplyLineBreaks(translated, source) {
    var srcLines = source.split(/\r?\n/);
    if (srcLines.length < 2) return translated;
    var zhLines = translated.split(/\r?\n/);
    if (zhLines.length === srcLines.length) return translated;
    var chars = Array.from(translated);
    var punct = /[，。、；：！？,.;:!?）)」』】]/;
    var weights = srcLines.map(function (l) {
      return Math.max(1, l.trim().length);
    });
    var total = weights.reduce(function (a, b) {
      return a + b;
    }, 0);

    // 逐行确定切分点
    var cuts = [];
    var pos = 0;
    for (var i = 0; i < srcLines.length - 1; i++) {
      var ideal = pos + Math.round((chars.length * weights[i]) / total);
      var best = -1;
      for (var d = 0; d <= 6 && best < 0; d++) {
        for (var s = 1; s <= d; s++) {
          var back = ideal - s;
          var fwd = ideal + (d - s + 1);
          if (back > pos && back < chars.length && punct.test(chars[back])) {
            best = back + 1;
            break;
          }
          if (fwd > pos && fwd < chars.length && punct.test(chars[fwd])) {
            best = fwd + 1;
            break;
          }
        }
      }
      if (best < 0 || best <= pos || best >= chars.length) best = ideal;
      if (best < pos) best = pos;
      if (best > chars.length) best = chars.length;
      cuts.push(best);
      pos = best;
    }

    var out = [];
    var prev = 0;
    for (var k = 0; k < cuts.length; k++) {
      out.push(chars.slice(prev, cuts[k]).join(""));
      prev = cuts[k];
    }
    out.push(chars.slice(prev).join(""));
    return out.join("\n");
  }

  function trTrimmed(text) {
    var m = /^([\s\u00a0]*)([\s\S]*?)([\s\u00a0]*)$/.exec(text);
    if (!m[2]) return null;
    var r = trCoreEx(m[2]);
    if (!r) return null;
    var t = r.text;
    if (t === m[2]) return null;
    if (r.normalized && /\r?\n/.test(m[2])) {
      t = reapplyLineBreaks(t, m[2]);
    }
    return m[1] + t + m[3];
  }

  function shouldSkipEl(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS[(el.tagName || "").toUpperCase()]) return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute && el.getAttribute("translate") === "no") return true;
    if (el.closest && el.closest("[translate=no],[data-oc-zh-skip]")) return true;
    return false;
  }

  /* ==================== 节点处理 ==================== */

  function collectBrSegments(el) {
    if (!el || el.nodeType !== 1) return null;
    var segs = [];
    var texts = [];
    var node = el.firstChild;
    var hasBr = false;
    while (node) {
      if (node.nodeType === 3) {
        if (node.nodeValue.trim() === "") { node = node.nextSibling; continue; }
        texts.push(node);
        segs.push({ type: "text", node: node });
      } else if (node.nodeType === 1) {
        var t = (node.tagName || "").toUpperCase();
        if (t === "BR") {
          segs.push({ type: "br", node: node });
          hasBr = true;
        } else {
          return null;
        }
      }
      node = node.nextSibling;
    }
    if (!hasBr) return null;
    if (texts.length < 2) return null;
    return { segs: segs, texts: texts };
  }

  function splitTranslation(translated, texts) {
    var srcLens = texts.map(function (n) {
      return Math.max(1, n.nodeValue.replace(/^\s+|\s+$/g, "").length);
    });
    var total = srcLens.reduce(function (a, b) { return a + b; }, 0);
    var chars = Array.from(translated);
    var cuts = [];
    var acc = 0;
    var pos = 0;
    for (var i = 0; i < srcLens.length - 1; i++) {
      acc += srcLens[i];
      var ideal = Math.round((chars.length * acc) / total);
      if (ideal > pos && ideal < chars.length) {
        var best = -1;
        for (var d = 0; d <= 8 && best < 0; d++) {
          for (var s = 1; s <= d; s++) {
            var back = ideal - s;
            var fwd = ideal + (d - s + 1);
            var punct = /[，。、；：！？,.;:!?）)」』】]/;
            if (back > pos && back < chars.length && punct.test(chars[back])) { best = back + 1; break; }
            if (fwd > pos && fwd < chars.length && punct.test(chars[fwd])) { best = fwd + 1; break; }
          }
        }
        if (best < 0) best = ideal;
        cuts.push(best);
        pos = best;
      } else {
        cuts.push(pos);
      }
    }
    var out = [];
    var prev = 0;
    for (var k = 0; k < cuts.length; k++) {
      out.push(chars.slice(prev, cuts[k]).join(""));
      prev = cuts[k];
    }
    out.push(chars.slice(prev).join(""));

    var res = [];
    for (var j = 0; j < texts.length; j++) {
      var m = /^([\s\u00a0]*)([\s\S]*?)([\s\u00a0]*)$/.exec(texts[j].nodeValue);
      var seg = out[j] || "";
      res.push(m[1] + seg + m[3]);
    }
    return res;
  }

  function processBrGroup(el) {
    var info = collectBrSegments(el);
    if (!info) return false;
    var joined = "";
    for (var i = 0; i < info.texts.length; i++) {
      var v = info.texts[i].nodeValue.replace(/[\s\u00a0]+/g, " ").trim();
      joined += v + " ";
    }
    joined = joined.trim();
    if (!joined) return false;
    var t = trCore(joined);
    if (t === null || t === joined) return false;
    var parts = splitTranslation(t, info.texts);
    for (var j = 0; j < info.texts.length; j++) {
      var n = info.texts[j];
      if (n.__ocEn === undefined) n.__ocEn = n.nodeValue;
      n.nodeValue = parts[j];
      n.__ocZh = parts[j];
    }
    return true;
  }

  function recordSource(node, cur) {
    if (node.__ocZh === undefined || node.__ocZh !== cur) node.__ocEn = cur;
  }

  function processTextNode(node) {
    if (node.nodeType !== 3) return;
    var parent = node.parentNode;
    if (!parent || shouldSkipEl(parent)) return;
    var cur = node.nodeValue;
    if (node.__ocZh !== undefined && node.__ocZh === cur) return; // 已是译文
    var out = trTrimmed(cur);
    if (out !== null) {
      recordSource(node, cur);
      node.nodeValue = out;
      node.__ocZh = out;
    } else {
      if (processBrGroup(parent)) return;
      recordSource(node, cur);
      node.__ocZh = undefined;
    }
  }

  function collectTextRuns(el) {
    if (!el || el.nodeType !== 1) return null;
    var runs = [];
    var cur = null;
    var child = el.firstChild;
    while (child) {
      var t = child.nodeType;
      if (t === 3) {
        if (cur === null) { cur = []; runs.push(cur); }
        cur.push(child);
      } else if (t === 8) {
      } else {
        cur = null;
      }
      child = child.nextSibling;
    }
    var out = [];
    for (var i = 0; i < runs.length; i++) {
      var hasContent = false;
      for (var j = 0; j < runs[i].length; j++) {
        if (runs[i][j].nodeValue.replace(/[\s\u00a0]+/g, "").length) { hasContent = true; break; }
      }
      if (hasContent) out.push(runs[i]);
    }
    return out.length ? out : null;
  }

  function slotWeight(n) {
    var src = n.__ocEn !== undefined ? n.__ocEn : n.nodeValue;
    return src.replace(/^[\s\u00a0]+/, "").replace(/[\s\u00a0]+$/, "").length;
  }

  function splitRunTranslation(translated, nodes) {
    var weights = nodes.map(slotWeight);
    var sub = [], subW = [], origIdx = [];
    for (var i = 0; i < nodes.length; i++) {
      if (weights[i] > 0) { sub.push(nodes[i]); subW.push(weights[i]); origIdx.push(i); }
    }
    var res = [];
    for (var z = 0; z < nodes.length; z++) {
      var mz = /^([\s\u00a0]*)([\s\S]*?)([\s\u00a0]*)$/.exec(nodes[z].nodeValue);
      res.push(mz[1] + mz[3]); // 空原文节点：仅保留原有空白，不参与分配
    }
    if (!sub.length) return res;
    var total = subW.reduce(function (a, b) { return a + b; }, 0);
    var chars = Array.from(translated);
    var cuts = [];
    var acc = 0;
    var pos = 0;
    for (var i2 = 0; i2 < subW.length - 1; i2++) {
      acc += subW[i2];
      var ideal = Math.round((chars.length * acc) / total);
      if (ideal > pos && ideal < chars.length) {
        var best = -1;
        for (var d = 0; d <= 10 && best < 0; d++) {
          for (var s = 1; s <= d; s++) {
            var back = ideal - s;
            var fwd = ideal + (d - s + 1);
            var punct = /[，。、；：！？,.;:!?）)」』】→\s]/;
            if (back > pos && back < chars.length && punct.test(chars[back])) { best = back + 1; break; }
            if (fwd > pos && fwd < chars.length && punct.test(chars[fwd])) { best = fwd + 1; break; }
          }
        }
        if (best < 0) {
          var isWord = function (c) { return /[0-9A-Za-z]/.test(c); };
          var isHan = function (c) { return /[一-鿿]/.test(c); };
          for (var d2 = 0; d2 <= 12 && best < 0; d2++) {
            for (var s2 = 1; s2 <= d2; s2++) {
              var b2 = ideal - s2;
              var f2 = ideal + (d2 - s2 + 1);
              if (b2 > pos && b2 < chars.length &&
                  isWord(chars[b2 - 1]) && isHan(chars[b2])) { best = b2; break; }
              if (f2 > pos && f2 < chars.length &&
                  isHan(chars[f2 - 1]) && isWord(chars[f2])) { best = f2; break; }
              if (b2 > pos && b2 < chars.length && /\s/.test(chars[b2 - 1]) && /\s/.test(chars[b2])) { best = b2; break; }
            }
          }
        }
        if (best < 0) best = ideal;
        cuts.push(best);
        pos = best;
      } else {
        cuts.push(pos);
      }
    }
    var out = [];
    var prev = 0;
    for (var k = 0; k < cuts.length; k++) {
      out.push(chars.slice(prev, cuts[k]).join(""));
      prev = cuts[k];
    }
    out.push(chars.slice(prev).join(""));

    for (var j = 0; j < sub.length; j++) {
      var m = /^([\s\u00a0]*)([\s\S]*?)([\s\u00a0]*)$/.exec(sub[j].nodeValue);
      var seg = (out[j] || "").replace(/^[\s\u00a0]+/, "").replace(/[\s\u00a0]+$/, "");
      res[origIdx[j]] = m[1] + seg + m[3];
    }
    return res;
  }

  function translateEachNode(nodes) {
    var parts = [];
    var anyTranslated = false;
    for (var i = 0; i < nodes.length; i++) {
      var raw = nodes[i].__ocEn !== undefined ? nodes[i].__ocEn : nodes[i].nodeValue;
      var m = /^([\s\u00a0]*)([\s\S]*?)([\s\u00a0]*)$/.exec(raw);
      if (!m[2]) return null;
      var t = trCore(m[2]);
      if (t === null || t === m[2]) {
        if (!/^[\s\u00a0·•●|/—–\-→.,:;'"()[\]{}]*$/.test(m[2])) return null;
        parts.push(m[1] + m[2] + m[3]);
        continue;
      }
      anyTranslated = true;
      parts.push(m[1] + t + m[3]);
    }
    return anyTranslated ? parts : null;
  }

  function applyRun(nodes, translated) {
    var parts = splitRunTranslation(translated, nodes);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.__ocEn === undefined) n.__ocEn = n.nodeValue;
      n.nodeValue = parts[i];
      n.__ocZh = parts[i];
    }
  }

  // 处理一个元素下的各 run。返回 true 表示至少有一个 run 被翻译。
  function processRuns(el) {
    if (processTransparentSentence(el)) return true;
    var runs = collectTextRuns(el);
    if (!runs) return false;
    var any = false;
    for (var i = 0; i < runs.length; i++) {
      var nodes = runs[i];
      var allDone = true;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].__ocZh === undefined || nodes[j].__ocZh !== nodes[j].nodeValue) { allDone = false; break; }
      }
      if (allDone) continue;
      var raw = "";
      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        var cur = n.nodeValue;
        if (n.__ocZh !== undefined && n.__ocZh === cur) {
          if (n.__ocEn !== undefined) raw += n.__ocEn;
        } else {
          n.__ocEn = cur;
          raw += cur;
        }
      }
      if (!raw.replace(/[\s\u00a0]+/g, "").length) continue;
      var joined = raw.replace(/[\s\u00a0]+/g, " ").trim();
      if (!joined) continue;
      var each = translateEachNode(nodes);
      if (each) {
        for (var m2 = 0; m2 < nodes.length; m2++) {
          var nd = nodes[m2];
          if (nd.__ocEn === undefined) nd.__ocEn = nd.nodeValue;
          nd.nodeValue = each[m2];
          nd.__ocZh = each[m2];
        }
        any = true;
        continue;
      }
      var t = trCore(joined);
      if (t === null || t === joined) continue;
      applyRun(nodes, t);
      any = true;
    }
    return any;
  }

  /* ============ 行内元素透明：整句翻译 + 锚点对齐回填 ============ */

  var INLINE_TAGS = {
    A: 1, B: 1, STRONG: 1, EM: 1, I: 1, U: 1, S: 1, STRIKE: 1, SPAN: 1,
    SMALL: 1, MARK: 1, ABBR: 1, CITE: 1, Q: 1, TIME: 1, DATETIME: 1,
    VAR: 1, FONT: 1, BIG: 1, TT: 1, NOBR: 1, DATA: 1, OUTPUT: 1, BDI: 1, BDO: 1
  };

  function isInlineTag(el) {
    return !!el && el.nodeType === 1 && INLINE_TAGS[(el.tagName || "").toUpperCase()] === 1;
  }

  function inlineSlotEligible(el) {
    if (!isInlineTag(el)) return false;
    if (shouldSkipEl(el)) return false;
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var t = kids[i].nodeType;
      if (t !== 3 && t !== 8) return false;
    }
    return true;
  }

  function collectDescendantTexts(el, out) {
    var c = el.firstChild;
    while (c) {
      if (c.nodeType === 3) out.push(c);
      else if (c.nodeType === 8) { /* 注释透明 */ }
      else {
        var sub = [];
        collectDescendantTexts(c, sub);
        for (var i = 0; i < sub.length; i++) out.push(sub[i]);
      }
      c = c.nextSibling;
    }
  }

  function collectInlineSlots(el) {
    if (!el || el.nodeType !== 1) return null;
    var slots = [];
    var hasElSlot = false;
    var child = el.firstChild;
    while (child) {
      var t = child.nodeType;
      if (t === 3) {
        slots.push({ kind: "text", node: child, texts: [child] });
      } else if (t === 8) {
      } else if (t === 1) {
        if (!inlineSlotEligible(child)) return null;
        var texts = [];
        collectDescendantTexts(child, texts);
        slots.push({ kind: "el", el: child, texts: texts });
        hasElSlot = true;
      } else {
        return null;
      }
      child = child.nextSibling;
    }
    if (!hasElSlot) return null;
    if (slots.length < 2) return null;
    var anyContent = false;
    for (var i = 0; i < slots.length && !anyContent; i++) {
      for (var j = 0; j < slots[i].texts.length; j++) {
        if (slots[i].texts[j].nodeValue.replace(/[\s\u00a0]+/g, "").length) { anyContent = true; break; }
      }
    }
    if (!anyContent) return null;
    return slots;
  }

  function findBoundaryMatch(tr, cand, from, expected) {
    if (!cand) return -1;
    var pos = from, idx, best = -1, bestDist = -1;
    while ((idx = tr.indexOf(cand, pos)) >= 0) {
      var before = idx > 0 ? tr.charAt(idx - 1) : "";
      var after = idx + cand.length < tr.length ? tr.charAt(idx + cand.length) : "";
      if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) {
        if (expected === undefined) return idx;
        var d = Math.abs(idx - expected);
        if (best < 0 || d < bestDist) { best = idx; bestDist = d; }
      }
      pos = idx + 1;
    }
    return best;
  }

  // 寻找安全切点：标点（优先）或中英/数字-汉字/空白边界。
  // 返回切点下标（左段 = chars[0..cut)），找不到返回 -1。
  function findSafeCut(chars, ideal, pos) {
    var SENT_END = /[。！？；]/;
    var PUNCT = /[，。、；：！？,.;:!?）)」』】\s]/;
    if (ideal > pos && ideal < chars.length) {
      if (SENT_END.test(chars[ideal])) return ideal;
      if (PUNCT.test(chars[ideal])) return ideal + 1;
    }
    var d, back, fwd;
    for (d = 1; d <= 10; d++) {
      back = ideal - d;
      fwd = ideal + d;
      if (back > pos && back < chars.length) {
        if (SENT_END.test(chars[back])) return back;
        if (PUNCT.test(chars[back])) return back + 1;
      }
      if (fwd > pos && fwd < chars.length) {
        if (SENT_END.test(chars[fwd])) return fwd;
        if (PUNCT.test(chars[fwd])) return fwd + 1;
      }
    }
    var isWord = function (c) { return /[0-9A-Za-z]/.test(c); };
    var isHan = function (c) { return /[\u4e00-\u9fff]/.test(c); };
    for (d = 1; d <= 12; d++) {
      back = ideal - d;
      fwd = ideal + d;
      if (back > pos && back < chars.length &&
          ((isWord(chars[back - 1]) && isHan(chars[back])) || (isHan(chars[back - 1]) && isWord(chars[back])))) return back;
      if (fwd > pos && fwd < chars.length &&
          ((isWord(chars[fwd - 1]) && isHan(chars[fwd])) || (isHan(chars[fwd - 1]) && isWord(chars[fwd])))) return fwd;
      if (back > pos && back < chars.length && /\s/.test(chars[back - 1]) && /\s/.test(chars[back])) return back;
      if (fwd > pos && fwd < chars.length && /\s/.test(chars[fwd - 1]) && /\s/.test(chars[fwd])) return fwd;
    }
    return -1;
  }

  // 按权重比例把译文切给多个槽位；任一必需切点不安全即整体失败（返回 null）
  function splitByRatioSafe(text, weights) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    var chars = Array.from(text);
    var cuts = [];
    var acc = 0, pos = 0;
    for (i = 0; i < weights.length - 1; i++) {
      acc += weights[i];
      var ideal = Math.round((chars.length * acc) / total);
      if (ideal <= pos || ideal >= chars.length) { cuts.push(pos); continue; }
      var best = findSafeCut(chars, ideal, pos);
      if (best < 0) return null;
      cuts.push(best);
      pos = best;
    }
    var out = [], prev = 0;
    for (var k = 0; k < cuts.length; k++) { out.push(chars.slice(prev, cuts[k]).join("")); prev = cuts[k]; }
    out.push(chars.slice(prev).join(""));
    for (var q = 0; q < out.length; q++) {
      if (out[q] === "" && weights[q] > 0) return null;
    }
    return out;
  }

  function cjkRatio(s) {
    var cjk = 0, total = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (/\s/.test(ch)) continue;
      total++;
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) cjk++;
    }
    return total ? cjk / total : 0;
  }

  // 还原文本节点的英文原文
  function restoreSlotText(n) {
    var cur = n.nodeValue;
    if (n.__ocZh !== undefined && n.__ocZh === cur) {
      return n.__ocEn !== undefined ? n.__ocEn : cur;
    }
    n.__ocEn = cur;
    return cur;
  }

  function writeSlotText(n, seg) {
    if (n.__ocEn === undefined) n.__ocEn = n.nodeValue;
    n.nodeValue = seg;
    n.__ocZh = seg;
  }

  function writeSlot(slot, seg) {
    var texts = slot.texts;
    if (!texts.length) return;
    if (texts.length === 1) { writeSlotText(texts[0], seg); return; }
    var weights = texts.map(slotWeight);
    var sub = [], subW = [], origIdx = [];
    for (var i = 0; i < texts.length; i++) {
      if (weights[i] > 0) { sub.push(texts[i]); subW.push(weights[i]); origIdx.push(i); }
    }
    var segs = [];
    for (var z0 = 0; z0 < texts.length; z0++) segs.push("");
    if (sub.length) {
      var total = subW.reduce(function (a, b) { return a + b; }, 0);
      var chars = Array.from(seg);
      var cuts = [], acc = 0, pos = 0;
      for (var i2 = 0; i2 < subW.length - 1; i2++) {
        acc += subW[i2];
        var ideal = Math.round((chars.length * acc) / total);
        if (ideal > pos && ideal < chars.length) { cuts.push(ideal); pos = ideal; } else { cuts.push(pos); }
      }
      var prev = 0;
      for (var k = 0; k < cuts.length; k++) { segs[origIdx[k]] = chars.slice(prev, cuts[k]).join(""); prev = cuts[k]; }
      segs[origIdx[origIdx.length - 1]] = chars.slice(prev).join("");
    }
    for (var j = 0; j < texts.length; j++) writeSlotText(texts[j], segs[j]);
  }

  function alignTranslation(joined, parts, slots, tr) {
    var n = slots.length, i, j;
    var bounds = [];
    var pos = 0;
    for (i = 0; i < n; i++) {
      bounds.push({ s: pos, e: pos + parts[i].length });
      pos += parts[i].length;
    }
    var forced = parts.map(function (p) { return p.replace(/[\s\u00a0]+/g, "").length === 0; });

    var cands = [];
    var re = /[A-Za-z0-9]+(?:[.'’@:_%$\/\\-][A-Za-z0-9]+)*|[$￥€£₹][0-9][0-9,.]*|[→←↑↓·•●|\/%+#]/g;
    var m;
    while ((m = re.exec(joined))) {
      if (m[0].length === 1 && /[A-Za-z]/.test(m[0])) continue; // 单字母噪声
      cands.push({ srcS: m.index, srcE: m.index + m[0].length, text: m[0], hint: false });
    }
    for (i = 0; i < n; i++) {
      if (forced[i]) continue;
      var st = parts[i].replace(/^\s+|\s+$/g, "");
      if (!st) continue;
      var h = trCore(st);
      if (h !== null && h !== st) {
        cands.push({ srcS: bounds[i].s, srcE: bounds[i].e, text: h, hint: true });
      }
    }
    cands.sort(function (a, b) {
      if (a.srcS !== b.srcS) return a.srcS - b.srcS;
      return (a.hint ? -1 : 1) - (b.hint ? -1 : 1);
    });

    var anchors = [];
    var lastTr = 0, lastSrc = 0;
    for (i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.srcS < lastSrc) continue;
      var owner = -1;
      for (j = 0; j < n; j++) {
        if (c.srcS >= bounds[j].s && c.srcS < bounds[j].e) { owner = j; break; }
      }
      if (owner < 0 || c.srcE > bounds[owner].e) continue; // 跨槽锚点不用
      var expected = Math.round(tr.length * (c.srcS + c.srcE) / 2 / joined.length);
      var idx = findBoundaryMatch(tr, c.text, lastTr, expected);
      if (idx < 0) continue;
      anchors.push({ srcS: c.srcS, srcE: c.srcE, trS: idx, trE: idx + c.text.length });
      lastTr = idx + c.text.length;
      lastSrc = c.srcE;
    }
    if (!anchors.length) {
      if (n > 4) return null;
      if (cjkRatio(tr) < 0.3) return null;
    }

    var segs = [];
    for (i = 0; i < n; i++) segs.push("");

    function distributeGap(srcFrom, srcTo, trFrom, trTo) {
      if (srcTo <= srcFrom) {
        if (trTo > trFrom) return false;
        return true;
      }
      var idxs = [];
      var i2;
      for (i2 = 0; i2 < n; i2++) {
        if (bounds[i2].e > srcFrom && bounds[i2].s < srcTo) idxs.push(i2);
      }
      if (!idxs.length) return true;
      var real = [];
      for (var q = 0; q < idxs.length; q++) if (!forced[idxs[q]]) real.push(idxs[q]);
      if (!real.length) {
        if (trTo > trFrom) return false;
        return true;
      }
      if (trTo <= trFrom) return false;
      var gapTr = tr.slice(trFrom, trTo);
      if (real.length === 1) { segs[real[0]] += gapTr; return true; }
      var weights = real.map(function (ix) {
        var ov = Math.min(bounds[ix].e, srcTo) - Math.max(bounds[ix].s, srcFrom);
        return Math.max(1, ov);
      });
      var subs = splitByRatioSafe(gapTr, weights);
      if (!subs) return false;
      for (var k = 0; k < real.length; k++) segs[real[k]] += subs[k];
      return true;
    }

    var srcPos = 0, trPos = 0;
    for (i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (!distributeGap(srcPos, a.srcS, trPos, a.trS)) return null;
      var owner2 = -1;
      for (j = 0; j < n; j++) {
        if (a.srcS >= bounds[j].s && a.srcS < bounds[j].e) { owner2 = j; break; }
      }
      segs[owner2] += tr.slice(a.trS, a.trE);
      srcPos = a.srcE;
      trPos = a.trE;
    }
    if (!distributeGap(srcPos, joined.length, trPos, tr.length)) return null;
    return segs;
  }

  function processTransparentSentence(el) {
    var slots = collectInlineSlots(el);
    if (!slots) return false;
    var allDone = true, i, j;
    for (i = 0; i < slots.length && allDone; i++) {
      for (j = 0; j < slots[i].texts.length; j++) {
        var nn = slots[i].texts[j];
        if (nn.__ocZh === undefined || nn.__ocZh !== nn.nodeValue) { allDone = false; break; }
      }
    }
    if (allDone) return false;

    var rawParts = [];
    for (i = 0; i < slots.length; i++) {
      var src = "";
      for (j = 0; j < slots[i].texts.length; j++) src += restoreSlotText(slots[i].texts[j]);
      // 内容中含换行 → 不透明（保持老路的行结构处理）
      if (/[\r\n]/.test(src.replace(/^\s+|\s+$/g, ""))) return false;
      rawParts.push(src.replace(/[\s\u00a0]+/g, " "));
    }

    function sentenceHit(s) {
      if (!s) return null;
      var r = trCoreEx(s);
      if (!r) return null;
      if (r.rule && r.uncovered) return null;
      return r.text;
    }
    var parts = rawParts;
    var joined = parts.join("");
    var lookup = joined.replace(/^\s+|\s+$/g, "");
    var t = sentenceHit(lookup);
    if (t === null || t === lookup) {
      var spaced = rawParts.map(function (p, ix) {
        return (ix > 0 && !/^\s/.test(p) ? " " : "") + p;
      });
      var joined2 = spaced.join("");
      var lookup2 = joined2.replace(/^\s+|\s+$/g, "");
      t = sentenceHit(lookup2);
      if (t === null || t === lookup2) return false;
      parts = spaced;
      joined = joined2;
    }
    if (!t) return false;

    var segs = alignTranslation(joined, parts, slots, t);
    if (!segs) return false;
    for (i = 0; i < slots.length; i++) writeSlot(slots[i], segs[i]);
    return true;
  }

  /* ==================== 调试：打印指定文本的 DOM 结构 ==================== */
  // 用法：控制台执行 ocZhDump("<待查文本>")，回车后看输出。
  // 将会把相关节点的结构打到控制台。
  function dumpTree(el, indent, out) {
    indent = indent || "";
    out = out || [];
    var tag = (el.tagName || "").toLowerCase();
    if (el.nodeType === 3) {
      out.push(indent + "TEXT " + JSON.stringify(el.nodeValue) +
        (el.__ocEn !== undefined ? "   [en=" + JSON.stringify(el.__ocEn) + "]" : "") +
        (el.__ocZh !== undefined ? "   [zh=" + JSON.stringify(el.__ocZh) + "]" : ""));
      return out;
    }
    var attrs = "";
    if (el.getAttributeNames) {
      var names = el.getAttributeNames();
      if (names.length) {
        attrs = " " + names.map(function (n) {
          return n + "=" + JSON.stringify(el.getAttribute(n));
        }).join(" ");
      }
    }
    out.push(indent + "<" + tag + attrs + ">");
    for (var c = el.firstChild; c; c = c.nextSibling) dumpTree(c, indent + "  ", out);
    return out;
  }

  var ocZhDumpFunc = function (needle) {
    var all = document.body ? document.body.getElementsByTagName("*") : [];
    var found = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var txt = "";
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) txt += c.nodeValue;
      }
      if (txt.indexOf(needle) < 0) continue;
      found++;
      console.log("=== #" + found + " <" + (el.tagName || "").toLowerCase() + "> ===");
      console.log(dumpTree(el, "").join("\n"));
      console.log("");
    }
    console.log("ocZhDump: found " + found + " element(s) containing " + JSON.stringify(needle));
  };
  
  window.ocZhDump = ocZhDumpFunc;
  
  try {
    if (typeof unsafeWindow !== "undefined") {
      unsafeWindow.ocZhDump = ocZhDumpFunc;
    }
  } catch (e) {
    console.warn("[opencode-console-zh] unsafeWindow access failed, ocZhDump may not be available in page console");
  }

  var attrStore = new WeakMap();

  function processAttrs(el) {
    if (!el || el.nodeType !== 1 || shouldSkipEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(name)) continue;
      var cur = el.getAttribute(name);
      if (!cur) continue;
      var store = attrStore.get(el);
      if (!store) { store = {}; attrStore.set(el, store); }
      if (own(store, name)) {
        if (store[name + "::zh"] === cur) continue; // 已是译文
        if (store[name] === cur) {                  // 仍是英文
          var t = trTrimmed(cur);
          if (t !== null) { el.setAttribute(name, t); store[name + "::zh"] = t; }
          continue;
        }
      }
      var t2 = trTrimmed(cur);
      if (t2 !== null) {
        store[name] = cur;
        store[name + "::zh"] = t2;
        el.setAttribute(name, t2);
      }
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { processTextNode(root); return; }
    if (root.nodeType !== 1) return;
    var accept;
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      { acceptNode: function (n) {
          if (n.nodeType === 1) return NodeFilter.FILTER_ACCEPT;
          var p = n.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (shouldSkipEl(p)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        } }
    );
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 1) {
        if (!shouldSkipEl(node)) processRuns(node);
      } else {
        if (node.parentNode) processRuns(node.parentNode);
        processTextNode(node);
      }
    }
  }

  function walkAttrs(root) {
    if (!root || root.nodeType !== 1) return;
    var els = root.querySelectorAll ? root.querySelectorAll("[title],[placeholder],[aria-label],[alt]") : [];
    for (var i = 0; i < els.length; i++) processAttrs(els[i]);
    processAttrs(root);
  }

  /* ==================== 页面标题 ==================== */

  var titleEn = null, titleZh = null;

  function updateTitle() {
    if (!enabled) return;
    var cur = document.title;
    if (titleZh !== null && cur === titleZh) return;   // 已是译文
    if (titleEn !== null && cur === titleEn) {
      var t = trCore(cur);
      if (t !== null && t !== cur) { titleZh = t; document.title = t; }
      return;
    }
    titleEn = cur; titleZh = null;
    var t2 = trCore(cur);
    if (t2 !== null && t2 !== cur) { titleZh = t2; document.title = t2; }
  }

  /* ==================== 全量扫描 ==================== */

  function fullPass() {
    walk(document.documentElement);
    walkAttrs(document.documentElement);
    if (enabled) {
      updateTitle();
      document.documentElement.setAttribute("lang", "zh-CN");
    }
  }

  /* ==================== 开关与持久化 ==================== */

  var LS_KEY = "opencode-console-zh-enabled";
  var LS_BTN = "opencode-console-zh-btn-hidden";

  function gmGet(key, def) {
    try { if (typeof GM_getValue === "function") { var v = GM_getValue(key, def); return v; } } catch (e) {}
    try { var v2 = localStorage.getItem(key); return v2 === null ? def : v2; } catch (e2) {}
    return def;
  }
  function gmSet(key, val) {
    try { if (typeof GM_setValue === "function") { GM_setValue(key, val); return; } } catch (e) {}
    try { localStorage.setItem(key, val); } catch (e2) {}
  }

  var enabled = gmGet(LS_KEY, true) !== false && gmGet(LS_KEY, true) !== "false";

  /* ====================== 切回英文 ====================== */

  function restoreAll() {
    var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.__ocEn !== undefined) {
        node.nodeValue = node.__ocEn;
        node.__ocZh = undefined;
        node.__ocEn = undefined;
      }
    }
    var els = document.documentElement.querySelectorAll("[title],[placeholder],[aria-label],[alt]");
    for (var i = 0; i < els.length; i++) {
      var store = attrStore.get(els[i]);
      if (!store) continue;
      for (var name in store) {
        if (name.slice(-4) === "::zh") {
          var real = name.slice(0, -4);
          els[i].setAttribute(real, store[real]);
          delete store[real];
          delete store[name];
        }
      }
    }
    if (titleEn !== null) document.title = titleEn;
    document.documentElement.setAttribute("lang", "en");
  }

  /* ==================== MutationObserver ==================== */

  var pending = [];
  var scheduled = false;
  var rafId = null;
  var timerId = null;

  function flush() {
    scheduled = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (timerId !== null) { clearTimeout(timerId); timerId = null; }
    var list = pending;
    pending = [];
    if (!enabled) return;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.nodeType === 3) processTextNode(n);
      else if (n.nodeType === 1) { walk(n); walkAttrs(n); }
    }
    for (var j = 0; j < list.length; j++) {
      var t = list[j];
      if (t && t.nodeType === 3 && t.parentNode) {
        processRuns(t.parentNode);
        var p = t.parentNode;
        while (p && isInlineTag(p)) p = p.parentNode;
        if (p && p.nodeType === 1 && p !== t.parentNode) processRuns(p);
      }
    }
    updateTitle();
  }

  function schedule(node) {
    if (!enabled) return;
    pending.push(node);
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(function () { rafId = null; flush(); });
    }
    timerId = setTimeout(function () { timerId = null; flush(); }, 50);
  }

  function onMutations(muts) {
    if (!enabled) return;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === "characterData") {
        if (m.target.__ocZh !== undefined && m.target.__ocZh === m.target.nodeValue) continue;
        schedule(m.target);
      } else if (m.type === "attributes") {
        schedule(m.target);
      } else if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var an = m.addedNodes[j];
          schedule(an);
          if (an.nodeType === 1 && isInlineTag(an) && an.parentNode) schedule(an.parentNode);
        }
      }
    }
  }

  var observer = null;
  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["title", "placeholder", "aria-label", "alt", "aria-description", "label"]
    });
  }

  /* ==================== 悬浮按钮 & 菜单 ==================== */

  var btn = null;
  var btnHidden = gmGet(LS_BTN, false) === true || gmGet(LS_BTN, false) === "true";

  // 当前状态下点击会切换到的语言
  function targetLangLabel() {
    return enabled ? "英文" : "中文";
  }

  // 油猴菜单项：标签随当前语言变化（"切换为英文" / "切换为中文"）
  var menuCmdId = null;

  function registerMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    if (menuCmdId !== null) {
      try {
        if (typeof GM_unregisterMenuCommand === "function") GM_unregisterMenuCommand(menuCmdId);
      } catch (e) {}
      menuCmdId = null;
    }
    menuCmdId = GM_registerMenuCommand("切换为" + targetLangLabel(), function () {
      setEnabled(!enabled);
    });
  }

  function ensureBtn() {
    if (btn && document.body.contains(btn)) return btn;
    btn = document.createElement("div");
    btn.id = "oc-zh-toggle";
    btn.textContent = enabled ? "中" : "EN";
    btn.title = "OpenCode 控制台汉化：点击切换为" + targetLangLabel() + "（Alt+Shift+Z，双击隐藏按钮）";
    btn.style.cssText = [
      "position:fixed", "right:12px", "bottom:12px", "z-index:2147483647",
      "min-width:34px", "height:34px", "padding:0 8px",
      "display:flex", "align-items:center", "justify-content:center",
      "font:600 13px/1 system-ui,-apple-system,sans-serif",
      "color:#fafafa", "background:rgba(20,20,20,.82)", "border:1px solid rgba(255,255,255,.18)",
      "border-radius:8px", "cursor:pointer", "user-select:none",
      "box-shadow:0 2px 10px rgba(0,0,0,.25)", "backdrop-filter:blur(4px)", "opacity:.85"
    ].join(";");
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      setEnabled(!enabled);
    });
    btn.addEventListener("dblclick", function (e) {
      e.preventDefault(); e.stopPropagation();
      btnHidden = true; gmSet(LS_BTN, true);
      if (btn) btn.style.display = "none";
    });
    return btn;
  }

  function showBtn() {
    if (btnHidden) { btnHidden = false; gmSet(LS_BTN, false); }
    var b = ensureBtn();
    b.textContent = enabled ? "中" : "EN";
    b.title = "OpenCode 控制台汉化：点击切换为" + targetLangLabel() + "（Alt+Shift+Z，双击隐藏按钮）";
    b.style.display = "flex";
    if (document.body && !document.body.contains(b)) document.body.appendChild(b);
  }

  /* ==================== 状态切换 ==================== */

  function setEnabled(on) {
    enabled = !!on;
    gmSet(LS_KEY, enabled);
    if (enabled) {
      startObserver();
      fullPass();
      showBtn();
    } else {
      restoreAll();
      showBtn();
    }
    registerMenu(); // 菜单项文案随当前语言更新
  }

  /* ==================== 启动 ==================== */

  function boot() {
    if (enabled) {
      updateTitle();
      document.documentElement.setAttribute("lang", "zh-CN");
    }
    startObserver();
    fullPass();
    showBtn();
    registerMenu();
    document.addEventListener("keydown", function (e) {
      if (e.altKey && e.shiftKey && (e.key === "Z" || e.key === "z" || e.code === "KeyZ")) {
        e.preventDefault();
        setEnabled(!enabled);
      }
    });
    var fire = function () { if (enabled) setTimeout(fullPass, 60); };
    ["pushState", "replaceState"].forEach(function (name) {
      var orig = history[name];
      if (typeof orig !== "function") return;
      history[name] = function () {
        var r = orig.apply(this, arguments);
        fire();
        return r;
      };
    });
    window.addEventListener("popstate", fire);
  }

  // document-start 阶段即开始监听
  if (enabled) startObserver();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
