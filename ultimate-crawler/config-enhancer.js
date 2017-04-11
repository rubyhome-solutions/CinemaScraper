var async = require('async')
var parameterize = require('parameterize')
var path = require('path')
var utils = require('../utils')
var globalConfig = require('../config')
var requestsMaker = require('./requests-maker')
var responseParserHtml = require('./response-parser-html')
var responseParserJson = require('./response-parser-json')
var debug = require('./debug-methods')
var configValidator = require('./config-validator')
var _ = require('underscore')
var helper = require('./helper')
var outputValidator = require('./output-validator')
var parametersMaker = require('./parameters-maker')

function getCinemaFilePath(cinemaId, config) {
  var slug
  
  if (config.cinemaIdToSlug) {
    slug = config.cinemaIdToSlug(cinemaId)
  } else {
    slug = config.cinemas && config.cinemas[cinemaId] && config.cinemas[cinemaId].slug
      ? config.cinemas[cinemaId].slug
      : config.urlToFilename
        ? utils.urlToFilename(cinemaId)
        : parameterize(cinemaId.replace(/_/g, '-'))
  }

  var prefix = config.outputFilenamePrefix === false
    ? ''
    : config.outputFilenamePrefix
      ? config.outputFilenamePrefix
      : config.crawler.id + '_'

  if (prefix === '' && !!slug.match(/^(\D{2}-\D)/)) {
    slug = slug.replace('-', '_')
  }

  var outputDir = config.outputDir || globalConfig.outputDir
  var filePath = outputDir + '/' + prefix + slug + '.json'
  return filePath
}

function saveCinemaFile (cinemaId, data, config, cb) {
  var filePath = getCinemaFilePath(cinemaId, config)

  if (config.outputWarnings === undefined) {
    config.outputWarnings = []
  }

  var warnings = _.map(outputValidator.validate(data), (w) => {
    var file = { path: filePath }
    if (w.details) {
      file.details = w.details
      delete w.details
    }
    w.files = [file]
    return w
  })

  warnings.forEach((curWarning) => {
    var existingWarning = _.find(config.outputWarnings, (ew) => ew.code === curWarning.code)
    if (existingWarning) {
      existingWarning.files = existingWarning.files.concat(curWarning.files)
    } else {
      config.outputWarnings.push(curWarning)
    }
  })

  utils.saveJsonFile(filePath, data, config.saveCinemaConfig, function () {
    cb()
  })
}

function addCinemas (config, cb) {
  if (config.cinemaIds) {
    var cinemas = config.cinemaIds.reduce(function (result, cinemaId) {
      result[cinemaId] = {}
      return result
    }, {})

    cb(null, Object.assign({}, config, {cinemas: cinemas}))

    return
  }

  async.waterfall([
    (callback) => {
      if (config.cityListUrl) {
        requestsMaker.getCities(config, function (err, cities) {
          configValidator.validateKeyIsSet('cinemasListUrlTemplate', config)
          callback(null, Object.assign({}, config, {cities: cities}))
        })
      } else {
        callback(null, config)
      }
    },
    (newConfig, callback) => {
      requestsMaker.getCinemas(newConfig, function (err, cinemas) {
        console.log('Found ' + Object.keys(cinemas).length + ' cinemas')

        if (config.cliOptions.limit) {
          console.log('Limiting to %s cinemas', config.cliOptions.limit)
          cinemas = _.object(_.pairs(cinemas).slice(0, config.cliOptions.limit))
        }

        if (process.env.DEBUG) {
          var cinemasForLogging = Object.keys(cinemas).map(function (key) {
            return Object.assign({id: key}, cinemas[key]) // join the id for logging
          })
          debug.logFirstItemsOfList(cinemasForLogging, 5, debug.logResultCinemas)
        }
        cb(err, Object.assign({}, newConfig, {cinemas: cinemas}))
      })
    }
  ], cb)
}

function addCinemaDetails (cinemaId, config, cb) {
  if (!config.cinemaDetailsUrlTemplate) {
    return cb(null, config)
  }

  requestsMaker.getCinemaDetails(parametersMaker.getCinemaParams(cinemaId, config), config, function (err, response) {
    if (err) {
      console.warn('Cinema data page error')
      cb(null, config)
      return
    }

    var responseParser = config.cinemaDetailsPageFormat === 'json' ? responseParserJson : responseParserHtml
    var cinemaDetails = responseParser.parseCinemaDetails(response, cinemaId, config)
    if (config.cinemaDetailsResponseParser) {
      cinemaDetails = Object.assign({}, cinemaDetails, config.cinemaDetailsResponseParser(response, config))
    }

    config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], cinemaDetails)
    cb(err, config)
  })
}

function addDefaults (config) {
  config.concurrentRequests = config.concurrentRequests || globalConfig.concurrentRequests
  return config
}

function addDefaultModules (config) {
  if (!config.modules) { config.modules = {} }
  if (!config.modules.saveCinemaFile) { config.modules.saveCinemaFile = saveCinemaFile }

  config._cache = {movieTitles: {}}

  return config
}

function addCrawlerMeta (config) {
  if (!config.crawler) {
    config.crawler = {}
  }

  if (config.crawler.id === undefined) {
    config.crawler.id = path.basename(require.main.filename).replace('.js', '')
  }

  if (config.crawler.is_booking_link_capable === undefined) {
    config.crawler.is_booking_link_capable = !!(
      config.bookingIdSelector 
      || config.bookingLinkTemplate
      || config.bookingIdAttribute
      || config.bookingDataAttribute
      || helper.isLinkTagSelector(config.showtimeSelector)
    )
  }

  return config
}

module.exports = {
  addCinemas: addCinemas,
  addCinemaDetails: addCinemaDetails,
  getCinemaFilePath: getCinemaFilePath,
  saveCinemaFile: saveCinemaFile,
  addDefaults: addDefaults,
  addDefaultModules: addDefaultModules,
  addCrawlerMeta: addCrawlerMeta
}
