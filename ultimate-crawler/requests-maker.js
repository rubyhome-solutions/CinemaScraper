var utils = require('../utils')
var globalConfig = require('../config')
var templateEvaluator = require('./template-evaluator')
var responseParserHtml = require('./response-parser-html')
var responseParserJson = require('./response-parser-json')
var url = require('url')
var sleep = require('sleep')
var ConfigError = require('./config-error')
var async = require('async')
var _ = require('underscore')
var configValidator = require('./config-validator')

function getCities (config, cb) {
  configValidator.validateKeyIsSet('cityListUrl', config)
  console.log('Request:', config.cityListUrl, '...')
  newRequest({ url: config.cityListUrl }, config)
  .charset(config.cityListCharset || config.charset || 'utf-8')
  .send()
  .end(function (err, res) {
    if (err) {
      console.error('Request error for :', config.cityListUrl, '... ' + err)
      return cb(err)
    }
    var responseParser = config.cityListPageFormat === 'json' ? responseParserJson : responseParserHtml
    var cities = responseParser.parseCities(res, config)
    cb(null, cities)
  })
}

function getCinemas (config, cb) {
  if (config.cinemas) {
    cb(null, config.cinemas)
    return
  }

  var callback = function (err, cinemas) {
    var cinemasMap = {}
    cinemas.forEach(function (subCinemas) {
      _.extend(cinemasMap, subCinemas)
    })
    cb(err, cinemasMap)
  }

  if (config.cities) {
    configValidator.validateKeyIsSet('cinemasListUrlTemplate', config)

    var cities = config.cities
    if (config.cliOptions.limit) {
      console.log('Limiting to %s cities', config.cliOptions.limit)
      cities = cities.slice(0, config.cliOptions.limit)
    }

    async.mapLimit(cities, config.concurrentRequests, function (city, callback) {
      var url = config.cinemasListUrlTemplate.replace(':cityId', city.id)
      console.log('Request:', url, '...')
      newRequest({url: url}, config)
        .charset(config.cinemasListCharset || config.charset || 'utf-8')
        .send()
        .end(function (err, res) {
          if (err) {
            console.error('Request error for : ', url, '... ' + err)
            return callback(null, [])
          }
          var responseParser = config.cinemasListPageFormat === 'json' ? responseParserJson : responseParserHtml
          var cinemas = responseParser.parseCinemas(res.text, config)
          Object.keys(cinemas).forEach(function (key) {
            cinemas[key]['cityId'] = city.id
          })
          callback(null, cinemas)
        })
    }, callback)
  } else {
    configValidator.validateKeyIsSet('cinemasListUrl', config)

    var cinemasListUrls = []
    if (typeof config.cinemasListUrl === 'string') {
      cinemasListUrls.push(config.cinemasListUrl)
    } else {
      cinemasListUrls = config.cinemasListUrl
    }

    async.mapLimit(cinemasListUrls, config.concurrentRequests, function (url, callback) {
      console.log('Request:', url, '...')

      newRequest({url: url}, config)
        .charset(config.cinemasListCharset || config.charset || 'utf-8')
        .send()
        .end(function (err, res) {
          if (err) {
            console.error('Request error for :', url, '... ' + err)
            return callback(null, [])
          }
          var responseParser = config.cinemasListPageFormat === 'json' ? responseParserJson : responseParserHtml
          var cinemas = responseParser.parseCinemas(res.text, config)
          callback(null, cinemas)
        })
    }, callback)
  }
}

function getCinemaDetails (pageParameters, config, addDataCb) {
  async.waterfall([
    function(cb) {
      if (config.beforeGetCinemaDetails) {
        config.beforeGetCinemaDetails(pageParameters, config, cb)
      } else {
        cb(null, pageParameters, config)
      }
    },
    function(pageParameters, config, cb) {
      var requestObject = {
        url: templateEvaluator.evaluate(pageParameters, config.cinemaDetailsUrlTemplate),
        cookie: config.cinemaDetailsCookieTemplate && templateEvaluator.evaluate(pageParameters, config.cinemaDetailsCookieTemplate),
        postParams: config.cinemaDetailsPostParamsTemplate && templateEvaluator.evaluate(pageParameters, config.cinemaDetailsPostParamsTemplate)
      }

      console.log('Request:', requestObject.url, requestObject.postParams || '', requestObject.cookie || '', '...')

      var requestType = config.rawJsonPost ? 'json' : 'form'

      utils.runWithRetryAsync(
        function (cb) {
          newRequest(requestObject, config)
            .type(requestType)
            .set('Cookie', requestObject.cookie || null)
            .charset(config.cinemaDetailsCharset || config.charset || 'utf-8')
            .send(requestObject.postParams || null)
            .end(cb)
        },
        function (err, res) {
          if (err) {
            throw ('Error parsing cinema details ' + requestObject.url + ' with error: ' + err)
          }

          addDataCb(null, res.text)
        },
        globalConfig.maxRequestAttempts,
        function (err) {
          console.error('Failed to get cinema details data at: ' + requestObject.url)
          addDataCb(err, null)
        }
      )
    }
  ])
}

function getMovieIds (params, config, cb) {
  if (!config.moviesListUrl) {
    cb(null, [])
    return
  }

  var movieIdsResult = []

  var isPageParameter = !!(config.moviesListUrl.match(':page')) || !!(config.moviesListPostParamsTemplate && config.moviesListPostParamsTemplate.match(':page'))
  var pagesCount = isPageParameter ? 100 : 1

  var page = 1
  async.whilst(
    function() {
      return page <= pagesCount
    },
    function(cb) {
      var pageValue = page
      if (config.moviesPageMapper) {
        pageValue = config.moviesPageMapper(pageValue)
      }
      params.page = pageValue

      var requestObject = {
        url: templateEvaluator.evaluate(params, config.moviesListUrl),
        cookie: config.moviesListCookieTemplate && templateEvaluator.evaluate(params, config.moviesListCookieTemplate),
        postParams: config.moviesListPostParamsTemplate && templateEvaluator.evaluate(params, config.moviesListPostParamsTemplate)
      }

      console.log('Request:', requestObject.url, requestObject.postParams || '', requestObject.cookie || '', '...')

      var requestType = config.rawJsonPost ? 'json' : 'form'
      utils.runWithRetryAsync(
        function (cb) {
          newRequest(requestObject, config)
          .type(requestType)
          .set('Cookie', requestObject.cookie || null)
          .charset(config.moviesListCharset || config.charset || 'utf-8')
          .send(requestObject.postParams || null)
          .end(cb)
        },
        function (err, res) {
          if (err) {
            throw ('Error parsing movies list ' + requestObject.url + ' with error: ' + err)
          }

          var movieIds = []
          if (config.moviesListResponseParser) {
            movieIds = config.moviesListResponseParser(res.text, params, config)
          } else {
            var responseParser = config.moviesListPageFormat === 'json' ? responseParserJson : responseParserHtml
            movieIds = responseParser.parseMovieIds(res, config)
          }

          var oldLength = movieIdsResult.length
          movieIdsResult = _.union(movieIdsResult, movieIds)
          if (oldLength == movieIdsResult.length) {
            page = pagesCount + 1
          } else {
            page++
          }
          cb()
        },
        globalConfig.maxRequestAttempts,
        function (err) {
          console.error('Failed to get movies list data at: ' + requestObject.url)
          cb(err, null)
        }
      )
    },
    function(err) {
      cb(null, _.uniq(movieIdsResult))
    }
  )
}

function newRequest (requestObject, config) {
  if (config.delayEveryRequestInSeconds) {
    if (process.env.NODE_ENV !== 'test' || process.env.VERBOSE === 'true') {
      console.info('Delaying request for ' + config.delayEveryRequestInSeconds + ' seconds…')
    }
    sleep.usleep(config.delayEveryRequestInSeconds * 1000000)
  }

  if (requestObject.postParams) {
    return utils.requestPost(requestObject.url, { proxyUri: config.proxyUri, headers: config.headers, preserveCookies: config.preserveCookies })
  } else {
    return utils.requestGet(requestObject.url, { proxyUri: config.proxyUri, headers: config.headers, preserveCookies: config.preserveCookies })
  }
}

function getShowtimes (pageParameters, config, cb) {
  var cinemaId = pageParameters.cinemaId
  var urlTemplate = config.urlTemplate || config.cinemas[cinemaId].program

  if (!urlTemplate) {
    console.error('missing urlTemplate, either configure `urlTemplate` key in config or `program` key on cinemas in config.')
    throw new ConfigError('missing urlTemplate')
  }

  if (config.cinemas) {
    urlTemplate = urlTemplate.replace(':cityId', config.cinemas[cinemaId].cityId)
  }
  
  var requestObject = {
    url: templateEvaluator.evaluate(pageParameters, urlTemplate),
    postParams: config.postParamsTemplate && templateEvaluator.evaluate(pageParameters, config.postParamsTemplate),
    cookie: config.cookieTemplate && templateEvaluator.evaluate(pageParameters, config.cookieTemplate)
  }

  console.log('Request:', requestObject.url, requestObject.postParams || '', requestObject.cookie || '', '...')

  var requestType = config.rawJsonPost ? 'json' : 'form'

  utils.runWithRetryAsync(
    function (cb) {
      var req = newRequest(requestObject, config).type(requestType).charset(config.charset || 'utf-8')
      if (requestObject.cookie) {
        req.set('Cookie', requestObject.cookie)
      }
      req.send(requestObject.postParams || null)
      req.end(cb)
    },
    function (err, res) {
      if (err) {
        throw ('Error parsing cinema ' + requestObject.url + ' with error: ' + err)
      }

      cb(null, res.text)
    },
    globalConfig.maxRequestAttempts,
    function (err) {
      console.error('Failed to get showtime data at: ' + requestObject.url)
      cb(err, null)
    }
  )
}

module.exports = {
  getCities: getCities,
  getShowtimes: getShowtimes,
  getCinemas: getCinemas,
  getCinemaDetails: getCinemaDetails,
  getMovieIds: getMovieIds
}
