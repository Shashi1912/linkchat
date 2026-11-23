// LinkChat feelings: suggest a feeling from the wording of a message.
// Runs entirely in the browser (no internet service). The sender always
// confirms; nothing is attached to a message unless they confirm it.
(function () {
  'use strict';

  var LIST = [
    { key: 'happy',   label: 'Happy',    emoji: '😊' },
    { key: 'excited', label: 'Excited',  emoji: '🤩' },
    { key: 'grateful',label: 'Grateful', emoji: '🙏' },
    { key: 'loving',  label: 'Loving',   emoji: '❤️' },
    { key: 'joking',  label: 'Joking',   emoji: '😄' },
    { key: 'calm',    label: 'Calm',     emoji: '😌' },
    { key: 'tired',   label: 'Tired',    emoji: '😮‍💨' },
    { key: 'sad',     label: 'Sad',      emoji: '😢' },
    { key: 'anxious', label: 'Anxious',  emoji: '😟' },
    { key: 'angry',   label: 'Angry',    emoji: '😠' },
    { key: 'sorry',   label: 'Sorry',    emoji: '🥺' },
  ];

  // Words and phrases that point to each feeling. Matched on whole words.
  var CUES = {
    happy:    ['happy', 'glad', 'good news', 'smile', 'nice', 'wonderful', 'great day', ':)', ':-)'],
    excited:  ['excited', 'cant wait', "can't wait", 'yay', 'woohoo', 'omg', 'amazing', 'finally', '!!!'],
    grateful: ['thank you', 'thanks', 'thank u', 'thx', 'appreciate', 'grateful'],
    loving:   ['love you', 'miss you', 'love u', 'miss u', 'hugs', 'hug you', '❤', 'darling'],
    joking:   ['lol', 'lmao', 'haha', 'hehe', 'joke', 'kidding', 'rofl', '😂', '🤣'],
    calm:     ['relax', 'relaxed', 'peaceful', 'all good', 'no worries', 'take it easy', 'chill'],
    tired:    ['tired', 'exhausted', 'sleepy', 'drained', 'worn out', 'so long day', 'need sleep', 'burnt out', 'burned out'],
    sad:      ['sad', 'unhappy', 'crying', 'cry', 'lonely', 'heartbroken', 'miss home', 'depressed', 'hurt'],
    anxious:  ['worried', 'worry', 'nervous', 'anxious', 'scared', 'afraid', 'stressed', 'stress', 'panic', 'fear'],
    angry:    ['angry', 'furious', 'annoyed', 'hate this', 'so mad', 'pissed', 'irritated', 'unacceptable', 'ridiculous'],
    sorry:    ['sorry', 'apologize', 'apologise', 'my fault', 'forgive me', 'my bad', 'regret'],
  };

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Count matching cues for each feeling; return the best one if it's clear.
  function suggest(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    if (t.trim().length < 3) return null;
    var best = null, bestScore = 0;
    LIST.forEach(function (f) {
      var score = 0;
      (CUES[f.key] || []).forEach(function (cue) {
        var c = cue.toLowerCase();
        var re = /^[a-z ']+$/.test(c)
          ? new RegExp('(^|[^a-z])' + escapeRe(c) + '([^a-z]|$)')
          : new RegExp(escapeRe(c));
        if (re.test(t)) score++;
      });
      if (score > bestScore) { best = f; bestScore = score; }
    });
    return best; // null when nothing matched
  }

  function find(key) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].key === key) return LIST[i];
    return null;
  }

  // Stored as a prefix on the message text, like the existing [reply:...] tag.
  function encode(key) { return find(key) ? '[feel:' + key + ']' : ''; }

  // Returns { feeling, rest } where rest is the text without the tag.
  function decode(content) {
    var s = String(content || '');
    var m = s.match(/^\[feel:([a-z]+)\]/);
    if (!m) return { feeling: null, rest: s };
    var f = find(m[1]);
    return { feeling: f, rest: s.substring(m[0].length) };
  }

  window.Feelings = { LIST: LIST, suggest: suggest, find: find, encode: encode, decode: decode };
})();
