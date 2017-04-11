var moment = require('moment-timezone'),
  momentRange = require('moment-range'),
  superagent = require('superagent-charset'),
  random_useragent = require('random-useragent'),
  rollbar = require('rollbar'),
  config = require('./config'),
  fs = require('fs'),
  assert = require('assert'),
  _ = require('underscore'),
  utils = require('util'),
  urlParse = require('url'), 
  ConfigError = require('./ultimate-crawler/config-error'),
  colors = require('colors')

require('es6-shim')
require('superagent-proxy')(superagent)
require('superagent-retry')(superagent)

// agent for use with cookies saved between requests
var agent = superagent.agent()

function deleteCookies() {
  agent = superagent.agent()
}

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1)
}

const yellowForground = '\x1b[33m'
const redForground = '\x1b[31m'
const reset = '\x1b[0m'
console.old_warn = console.warn
console.warn = function () {
  // console.old_warn('⚠️', yellowForground, utils.format(...arguments), reset)
}
console.old_error = console.error
console.error = function () {
  // console.old_error('❗️', redForground, utils.format(...arguments), reset)
}

if (process.env.NODE_ENV !== 'test') {
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')
}

var configureRequest = function (request, options) {
  if (typeof options === 'undefined') options = {
      useProxy: true
  }
  if (options.useProxy == 'undefined') {
    options.useProxy = true
  }

  if (!process.env.NODE_ENV === 'test' || process.env.VERBOSE === 'true') {
    console.log('Request options: ' + JSON.stringify(options))
  }

  if (options && options.proxyUri) {
    request = request.proxy(options.proxyUri)
  } else if (config.proxyUri && options.useProxy) {
    request = request.proxy(config.proxyUri)
  }

  if (config.randomUserAgentEnabled) {
    request.set('user-agent', getRandomUserAgent())
  }

  if (options.headers) {
    Object.keys(options.headers).forEach(function (header) {
      request.set(header, options.headers[header])
    })
  }

  request.retry(3) // retry before responding
  return request
}

var getRandomUserAgent = function () {
  var userAgent = ''
  try {
    var osBlacklist = config.randomUserAgentConfig.osNameBlacklist
    userAgent = random_useragent.getRandom(function (ua) {
      return !_.some(osBlacklist, function (osBlackElement) {
        return ua.userAgent.match(osBlackElement)
      }) && ua.deviceType != 'mobile'
    })
  } catch (e) {
    console.log(e)
    userAgent = random_useragent.getRandom()
  }
  return userAgent
}

var runWithRetry = function (job, max_attempts, retry_counter) {
  retry_counter = typeof retry_counter !== 'undefined' ? retry_counter : 0
  try {
    result = job()
  } catch (e) {
    console.error('Error: ' + e)
    if (retry_counter < max_attempts) {
      retry_counter += 1
      console.log('Trying again (%s)...', retry_counter)
      result = runWithRetry(job, max_attempts, retry_counter)
    } else {
      console.log('Max attempts (%s) tried', max_attempts)
      throw e
    }
  }
  return result
}

var runWithRetryAsync = function (job, callback, maxAttempts, errCallback, retryCounter) {
  retryCounter = typeof retryCounter !== 'undefined' ? retryCounter : 0
  job(function () {
    try {
      switch (arguments.length) {
        case 0:
          callback()
          break
        case 1:
          callback(arguments[0])
          break
        case 2:
          callback(arguments[0], arguments[1])
          break
        case 3:
          callback(arguments[0], arguments[1], arguments[1])
          break
        default:
          throw new Error('callbacks with more than 3 arguments are not supported')
      }
    } catch (e) {
      // if it is a ConfigError it makes no sense to retry
      if (e instanceof ConfigError) {
        throw e
      }
      console.error('Error: ' + e)
      console.error(e.stack)
      if (retryCounter < maxAttempts) {
        retryCounter += 1
        console.log('Trying again (%s)...', retryCounter)
        runWithRetryAsync(job, callback, maxAttempts, errCallback, retryCounter)
      } else {
        console.log('Max attempts (%s) tried', maxAttempts)
        if (typeof errCallback !== 'undefined') {
          errCallback(e)
        } else {
          throw e
        }
      }
    }
  })
}

var saveJsonFile = function (filePath, result, config, cb) {
  if (typeof config === 'function') {
    cb = config
    config = {}
  }
  if (typeof config === 'undefined') {
    config = {}
  }

  if (config.skipIfEmpty && result.showtimes.length == 0) {
    console.log(`Skipping '${filePath}' due to empty showtimes array`)
    return cb(null)
  }

  // Step 1. JSON.stringify the result with JSON validation
  var jsonString = runWithRetry(function () {
    var jsonStr = JSON.stringify(result, null, '  ')
    JSON.parse(jsonStr); // check if the json is correct by parsing it back, if it failes runWithRetry will catch the error and call this again
    return jsonStr
  }, 5)

  // Step 2. write the json to file with JSON validation, be reading the file
  runWithRetryAsync(
    function (callback) {
      const fileName = _.last(filePath.split('/'))
      const regex = new RegExp(/^(\D{2}_\D)\S*(\.json$)/)
      console.log(colors.green('Saving file: ' + filePath))
      if (!regex.test(fileName)) {
        // throw new Error('Invalid output filename (' + fileName + '): must match ' + regex)
      }
      fs.writeFile(filePath, jsonString, callback)
    },
    function (err) {
      if (err) throw err
      console.log('Checking file: ' + filePath)
      var jsonString = fs.readFileSync(filePath, 'utf8')
      jsonObject = JSON.parse(jsonString) // check if the json was correctly written by parsing it back, if it failes runWithRetryAsync will catch the error and call this again
      if (!config.allowEmptyShowtimes) {
        assert((jsonObject.showtimes.length > 0), 'showtimes should not be empty')
      }
      cb(err)
    },
    5,
    cb)
}

function setupRollbar () {
  if (!config.rollbarAccessToken) {
    return
  }

  rollbar.init(config.rollbarAccessToken)

  rollbar.handleUncaughtExceptions(config.rollbarAccessToken, {
    exitOnUncaughtException: true
  })

  // TODO: Consider overwriting console.error to log on rollbar
  const rollbarIgnoredErrors = [
    'showtimes should not be empty'
  ]
  const defaultConsoleError = console.error
  console.error = (e) => {
    const message = e.constructor === String ? e : e.message

    if (e.constructor !== String) {
      // rollbar.handleError(e)
    }

    if (e.constructor === String && !rollbarIgnoredErrors.find(ignoredMessage => message && message.match(ignoredMessage))) {
      // rollbar.reportMessage(message)
    }

  defaultConsoleError(e)
}
}

function parseLatlonFromUrl(url, param, delimiter) {
  url = url.replace(/&amp;/ig, '&')
  var latlonParam = urlParse.parse(url, true).query[param]
  if (!latlonParam) { return null }
  var latlon = latlonParam.split(delimiter).map((str) => parseFloat(str))
  return { lat: latlon[0], lon: latlon[1] }
}

module.exports = {
  deleteCookies: deleteCookies,
  daysList: function (howMany, startDate) {
    if (!startDate) {
      startDate = moment()
    }
    var days = []

    moment.range(startDate, moment(startDate).add(howMany, 'day')).by('days', function (date) {
      days.push(date)
    })

    return days
  },

  daysMap: function (fromFormat , toFormat) {
    return this.daysList(7, moment().subtract(1, 'day')).reduce(function (result, day) {
      result[day.format(fromFormat)] = day.format(toFormat)
      return result
    }, {})
  },

  requestGet: function (url, options) {
    return configureRequest((options && options.preserveCookies ? agent : superagent).get(url), options)
  },

  requestPost: function (url, options) {
    return configureRequest((options && options.preserveCookies ? agent : superagent).post(url), options)
  },

  isNumeric: function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n)
  },

  runWithRetry: runWithRetry,
  runWithRetryAsync: runWithRetryAsync,
  saveJsonFile: saveJsonFile,
  setupRollbar: setupRollbar,
  rollbar: rollbar,

  urlToFilename: function (url) {
    urlParts = /^(?:\w+\:\/\/)?([^\/]+)(.*)$/.exec(url)
    hostname = urlParts[1]
    hostParts = hostname.split('.')
    hostParts = hostParts.filter(function (str) {
      return str !== 'www'
    })

    var slug = hostParts.reverse().join('-')

    // exception for Admit One cinemas
    var parsedUrl = urlParse.parse(url)
    var extraSlugByQuery = parsedUrl.query
    var extraSlugByPath = parsedUrl.pathname
    if (extraSlugByQuery) {
      extraSlugByQuery = extraSlugByQuery.replace('__site=', '').toLowerCase()
      if (extraSlugByQuery.length > 0) {
        slug = slug.concat('_' + extraSlugByQuery)
      }
      return slug
    }

    if (extraSlugByPath) {
      extraSlugByPath = extraSlugByPath.replace(new RegExp('/', 'g'), '')
      if (extraSlugByPath) {
        slug = slug.concat('_' + extraSlugByPath)
      }
    }
    return slug
  },

  parseLatlonFromGoogleMapsUrl: function (url) {
    if (url == null) return null
    if (!url.match(/maps.google.com/i)) { return null }
    return parseLatlonFromUrl(url, 'q', ' ')
  },

  parseLatlonFromBingMapsUrl: function (url) {
    if (url == null) return null
    if (!url.match(/bing.com/i)) { return null }
    return parseLatlonFromUrl(url, 'cp', '~')
  },

}
