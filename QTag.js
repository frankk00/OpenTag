var q = {};

q.html = {};

q.html.fileLoader = {};

/**
 * Load a file at url, optionally calling functions before and after it
 * is loaded
 * @param url The url to load
 * @param preLoadAction A function called before the url is loaded. If it
                        returns false or throws an exception it will
                        prevent the url from loading. Takes the url as
                        an argument.
 * @param postLoadHandler A function called after the url is loaded.
 *                        Takes the url as an argument.
 */
q.html.fileLoader.load = function (url, preLoadAction, postLoadHandler,
    parentNode, async) {
  var scriptEl, preLoadResult, loadError, oldOnError, doPostLoad;

  doPostLoad = function () {
    postLoadHandler(url, loadError);

    if (oldOnError) {
      window.onerror = oldOnError;
    }
  };

  try {
    if (preLoadAction) {
      preLoadResult = preLoadAction(url);
    }
  } catch (e) {
    preLoadResult = false;
  } finally {
    if (preLoadResult !== false) {
      scriptEl = q.html.fileLoader.createScriptEl(url, async);
      if (postLoadHandler) {
        scriptEl.onload = doPostLoad;
        scriptEl.onreadystatechange = function () {
          if ((this.readyState === "complete") ||
              (this.readyState === "loading")) {
            setTimeout(doPostLoad, 1);
          }
        };
      }
      if (!parentNode) {
        parentNode = window.document.getElementsByTagName("head")[0];
      }

      if (window.onerror) {
        oldOnError = window.onerror;
      }
      window.onerror = function (reason, url, lineNumber) {
        loadError = {
          reason: reason,
          url: url,
          lineNumber: lineNumber
        };
        return true;
      };

      parentNode.appendChild(scriptEl);

    }
  }
};
q.html.fileLoader.createScriptEl = function (path, async, forceReload) {
  var scriptEl = document.createElement("script");
  scriptEl.type = "text/javascript";
  scriptEl.src = q.html.fileLoader.tidyUrl(path) +
    (forceReload ? ("?" + new Date().getTime()) : "");
  if (async !== false) {
    scriptEl.async = "true";
    scriptEl.defer = "true";
  } else {
    scriptEl.async = "false";
    if (scriptEl !== false) {
      scriptEl.async = false;
    }
    scriptEl.defer = "false";
  }
  return scriptEl;
};

q.html.fileLoader.tidyUrl = function (path) {
  if (path.substring(0, 5) === 'http:') {
    return path;
  }
  if (path.substring(0, 6) === 'https:') {
    return path;
  }
  return "//" + path;
};

q.html.GlobalEval = {};


q.html.GlobalEval.globalEval = function (src) {
  if (window.execScript) {
    window.execScript(src);
  } else {
    var fn = function () {
      window["eval"].call(window, src);
    };
    fn();
  }
};

q.html.HtmlInjector = {};

q.html.HtmlInjector.inject = function (el, injectStart, str, cb, parentNode) {
  if (str.toLowerCase().indexOf("<script") >= 0) {
    var i, ii, d, scripts, script, contents;
    d = document.createElement("div");
    d.innerHTML = str;
    scripts = d.getElementsByTagName("script");
    contents = [];
    for (i = 0, ii = scripts.length; i < ii; i += 1) {
      script = scripts[i];
      if (script.src) {
        contents.push({src: script.src});
      } else {
        contents.push({script: script.innerHTML});
      }
      script.parentNode.removeChild(script);
    }
    if (d.innerHTML) {
      el.innerHTML = injectStart ? (d.innerHTML + el.innerHTML) :
        (el.innerHTML + d.innerHTML);
    }
    q.html.HtmlInjector.loadScripts(contents, 0, cb, el);
  } else {
    el.innerHTML = injectStart ? (str + el.innerHTML) : (el.innerHTML + str);
    cb();
  }
};
q.html.HtmlInjector.loadScripts = function (contents, i, cb, parentNode) {
  var ii, c;
  for (ii = contents.length; i < ii; i += 1) {
    c = contents[i];
    if (c.src) {
      q.html.fileLoader.load(
        c.src,
        null,
        q.html.HtmlInjector.loadScripts.apply(this,
          [contents, i + 1, cb, parentNode]),
        parentNode
      );
      break;
    } else {
      q.html.GlobalEval.globalEval(c.script);
    }
  }
  if (cb && (i === ii)) {
    cb();
  }
};

//Url filters is a number of url filters which are matched in order of priority. 1 is the highest priority.
//If a url filter matches, then if it is an include filterType, add the scripts in script loaders to the scripts that will be loaded.
//If it in an exclude filterType, then remove any scripts from the list of scripts that are to be lodded, through a lower priority.

var urlFilters = [{
    filterType: "1", //Matches QTag.FILTER_TYPE_INCLUDE/EXCLUDE
    patternType: "1", //Matches QTag.ALL/SUBSTRING/REGEX/EXACT_MATCH
    pattern: "*", //Pattern for pattern type.
    priority: 1,
    scriptLoaderKeys: ["1"] //Matches keys in scriptLoader
  }],
  scriptLoaders = {
    "1": {
      id: "1",
      name: "Name of the script to load",
      pre: "", //Javascript to run before the url is loaded
      url: "", //A url to load javascript from
      post: "", //Javascript to run after the url has loaded
      html: "", //If no url is specified, you can load some html through here.
      locationId: 1, //1 = HEAD, 2 = BODY, 3 = DIV
      positionId: 1, //1 = BEGINNING, 2 = HEAD
      locationDetail: "", //If specified 3 for locationId, then the id of the DIV to put the code in
      async: "" //If a url, whether the script element should be loaded asynchronously
    }
  };


function QTag(urlFilters, scriptLoaders) {
  var i, ii, qTagLoader;

  QTag.qTagLoaders = QTag.getLoaders(urlFilters, scriptLoaders, document.URL);
  QTag.loadersFinished = 0;

  for (i = 0, ii = QTag.qTagLoaders.length; i < ii; i += 1) {
    qTagLoader = QTag.qTagLoaders[i];
    if (qTagLoader.url) {
      q.html.fileLoader.load(
        qTagLoader.url,
        QTag.getTimerStarter(qTagLoader),
        QTag.getTimerEnder(qTagLoader),
        qTagLoader.parentNode,
        qTagLoader.async
      );
    } else if (qTagLoader.html) {
      QTag.waitCounts[qTagLoader.id] = 0;
      QTag.injectHtml(qTagLoader);
    }

  }
}

QTag.ALL = "1";
QTag.SUBSTRING = "2";
QTag.REGEX = "3";
QTag.EXACT_MATCH = "4";

QTag.FILTER_TYPE_INCLUDE = "1";
QTag.FILTER_TYPE_EXCLUDE = "2";

/**
 * @param urlFilter An array containing objects which have a pattern type and
 *   a filter type
 */
QTag.getLoaders = function (urlFilters, scriptLoaders, url) {
  var i, ii, urlFilter, loaderKeysSet = {}, matchedFilters = [],
    loaders = [];

  if ((!urlFilters) || (!url)) {
    return loaders;
  }
  for (i = 0, ii = urlFilters.length; i < ii; i += 1) {
    urlFilter = urlFilters[i];
    if (QTag.doesUrlFilterMatch(urlFilter, url)) {
      matchedFilters.push(urlFilter);
    }
  }
  matchedFilters.sort(function (a, b) {
    return b.priority - a.priority;
  });
  for (i = 0, ii = matchedFilters.length; i < ii; i += 1) {
    QTag.updateLoaders(matchedFilters[i], loaderKeysSet);
  }
  for (i in loaderKeysSet) {
    if (loaderKeysSet.hasOwnProperty(i)) {
      loaders.push(scriptLoaders[i]);
    }
  }
  return loaders;
};
  /**
   * Checks to see if a url filter matches a url
   */
QTag.doesUrlFilterMatch = function (urlFilter, url) {
  var matches = false;
  switch (urlFilter.patternType) {
  case QTag.EXACT_MATCH:
    if (url.toLowerCase() === urlFilter.pattern.toLowerCase()) {
      matches = true;
    }
    break;
  case QTag.SUBSTRING:
    if (url.toLowerCase().indexOf(urlFilter.pattern.toLowerCase()) >= 0) {
      matches = true;
    }
    break;
  case QTag.REGEX:
    if (new RegExp(urlFilter.pattern).test(url)) {
      matches = true;
    }
    break;
  case QTag.ALL:
    matches = true;
    break;
  }
  return matches;
};
/**
 * Update the loader key set with the given filter
 */
QTag.updateLoaders = function (urlFilter, loaderKeysSet) {
  var i, ii, scriptLoaderKeys = urlFilter.scriptLoaderKeys;
  if (urlFilter.filterType === QTag.FILTER_TYPE_INCLUDE) {
    for (i = 0, ii = scriptLoaderKeys.length; i < ii; i += 1) {
      if (scriptLoaderKeys.hasOwnProperty(i)) {
        loaderKeysSet[scriptLoaderKeys[i]] = true;
      }
    }
  } else if (urlFilter.filterType === QTag.FILTER_TYPE_EXCLUDE) {
    for (i = 0, ii = scriptLoaderKeys.length; i < ii; i += 1) {
      if (scriptLoaderKeys.hasOwnProperty(i)) {
        delete loaderKeysSet[scriptLoaderKeys[i]];
      }
    }
  }
};

QTag.waitCounts = {};
QTag.injectHtml = function (qTagLoader) {
  var el;

  if (QTag.waitCounts[qTagLoader.id] < 10) {
    if (qTagLoader.locationId === 1) {
      el = document.getElementsByTagName("head")[0];
    }
    if (qTagLoader.locationId === 2) {
      el = document.body;
    }
    if (qTagLoader.locationId === 3) {
      el = document.getElementById(qTagLoader.locationDetail);
    }
    if (el) {
      QTag.getTimerStarter(qTagLoader)();
      q.html.HtmlInjector.inject(el, qTagLoader.positionId === 1,
        qTagLoader.html, QTag.getTimerEnder(qTagLoader));
    } else {
      QTag.waitCounts[qTagLoader.id] += 1;
      setTimeout(function () {
        QTag.injectHtml(qTagLoader);
      }, 500);
    }
  }
};


QTag.getTimerStarter = function (qTagLoader) {
  return QTag.createStatementEvaluator(qTagLoader.pre);
};
QTag.getTimerEnder = function (qTagLoader) {
  return function (url, error) {
    return QTag.createStatementEvaluator(qTagLoader.post)();
  };
};

QTag.createStatementEvaluator = function (statement) {
  if ((!!statement) && (statement.length > 0)) {
    var fn, toRun = 'fn = function() {\n' +
      'q.html.GlobalEval.globalEval(statement);\n' +
      'QTag.incrementLoadCounter([]);\n' +
      '};';
    eval(toRun);
    return fn;
  } else {
    return function () {
      QTag.incrementLoadCounter([]);
    };
  }
};

QTag.incrementLoadCounter = function () {
  QTag.loadersFinished += 1;
  if (QTag.loadersFinished === QTag.qTagLoaders.length * 2) {
    if (window.qTag_allLoaded) {
      window.qTag_allLoaded();
    }
  }
};

var qTag = new QTag(urlFilters || [], scriptLoaders || {});
