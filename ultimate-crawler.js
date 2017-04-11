var async = require('async')
var nock = require('nock')
var fs = require('fs')
var path = require('path')
var _ = require('underscore')
var utils = require('./utils')
var program = require('commander')
var colors = require('colors')
var responseParserHtml = require('./ultimate-crawler/response-parser-html')
var responseParserJson = require('./ultimate-crawler/response-parser-json')
var requestsMaker = require('./ultimate-crawler/requests-maker')
var parametersMaker = require('./ultimate-crawler/parameters-maker')
var configEnhancer = require('./ultimate-crawler/config-enhancer')
var configValidator = require('./ultimate-crawler/config-validator')
var proxy = require('./ultimate-crawler/proxy')
var debug = require('./ultimate-crawler/debug-methods')
var ConfigError = require('./ultimate-crawler/config-error')
var globalConfig = require('./config')

program
  .option('-c, --cinemas-limit <n>', 'Number of cinemas to crawl (e.g. limit to only 1 cinema during development)', parseInt)
  .option('--cache-dir <dir>', 'Caches requests in a local files stored in the given directory to save requests and speed up development')
  .option('-s, --suppressed-warnings', 'Suppressed warnings you during development')
  .option('-l, --limit <n>', 'Limits any iteration of list to the given number. (e.g. limit crawling to only 1 cinema during development)', parseInt)
  .parse(process.argv)

function getShowtimes (pagesParameters, config, cb) {
  async.mapLimit(pagesParameters, config.concurrentRequests, function (pageParameters, cb) {
    requestsMaker.getShowtimes(pageParameters, config, function (err, response) {
      if (err) {
        console.warn('Ignoring showtimes due to previous errors')
        utils.rollbar.handleError(err)
        cb(null, [])
        return
      }
      var showtimes = []
      var skipParsing = false
      if (config.showtimesResponseParser) {
        var parserResult = config.showtimesResponseParser(response, pageParameters, config)
        if (parserResult.showtimes === undefined || parserResult.showtimes.constructor !== Array) {
          throw new ConfigError('result of showtimesResponseParser must include a showtimes array')
        }
        if (parserResult.isAdditional === undefined || parserResult.isAdditional.constructor !== Boolean) {
          throw new ConfigError('result of showtimesResponseParser must include a isAdditional flag')
        }
        showtimes = parserResult.showtimes
        skipParsing = skipParsing || !parserResult.isAdditional
      }
      if (!skipParsing) {
        var responseParser = config.format === 'json' ? responseParserJson : responseParserHtml
        showtimes = responseParser.parseShowtimes(response, pageParameters, config).concat(showtimes)
      }
      cb(null, showtimes)
    })
  }, cb)
}

function workOutShowtimesOnPage (cinemaOrPageId, config, cb) {
  async.waterfall([
    function (cb) { parametersMaker.pages(cinemaOrPageId, config, cb) },
    function (pagesParameters, cb) { getShowtimes(pagesParameters, config, cb) },
    function (showtimes, cb) { cb(null, _.flatten(showtimes)) }
  ], cb)
}

function cleanupCinemaData(cinema) {
  if (!cinema.latlon && cinema.lat && cinema.lon) {
    cinema.latlon = [cinema.lat, cinema.lon].map(l => Number(l))
  } else if (cinema.latlon && cinema.latlon.constructor === String) {
    cinema.latlon = cinema.latlon.split(/;|,/).map(l => Number(l))
  }

  return _.omit(cinema, ['filterByAuditorium', 'lat', 'lon', 'cinemaMappedId', 'citySlug'])
}

function saveOutputFile (filenameParam, cinema, showtimes, config, cb) {
  cinema = _.pick(cinema, _.identity) // clean empty keys, see http://stackoverflow.com/a/26295351/1879171
  var output = {crawler: config.crawler, cinema: cinema, showtimes: showtimes}
  if (config.beforeSaveOutputFilter) {
    output = config.beforeSaveOutputFilter(output)
  }
  config.modules.saveCinemaFile(filenameParam, output, config, cb)
}

function workOnCinema (cinemaId, config, cb) {
  workOutShowtimesOnPage(cinemaId, config, function (err, showtimes) {
    if (err) { throw new Error(err) }

    var cinema = cleanupCinemaData(config.cinemas[cinemaId])

    if (Object.keys(cinema).length === 0) {
      cinema = undefined
    }

    saveOutputFile(cinemaId, cinema, showtimes, config, cb)
  })
}

function workOnMultiCinemaPage (pageId, config, cb) {
  workOutShowtimesOnPage(pageId, config, function (err, showtimes) {
    if (err) { throw new Error(err) }
    var showtimesByCinema = _.groupBy(showtimes, function (showtime) {
      return showtime.cinema_name
    })

    async.forEachOfSeries(showtimesByCinema, function (showtimes, cinemaName, cb) {
      showtimes = showtimes.map(function (showtime) {
        return _.omit(showtime, 'cinema_name')
      })

      var filenameParam = cinemaName
      var cinema = {
        name: cinemaName
      }
      if (config.areMutliCinemaPagesAreCityPages && config.cinemaPages[pageId].name) {
        var city = config.cinemaPages[pageId].name
        filenameParam = city + '-' + filenameParam
        cinema.city = city
      }

      saveOutputFile(filenameParam, cinema, showtimes, config, cb)
    }, cb)
  })
}

function setCrawlerTimeout (config) {
  const timeoutInHours = config.crawler.timeoutInHours || globalConfig.timeoutInHours
  const timeoutInMs = timeoutInHours * 3600 * 1000
  return setTimeout(() => {
    const errorMsg = 'Execution of crawler took to long'
    console.error(errorMsg)
    console.log('Reporting error to rollbar …')
    utils.rollbar.reportMessageWithPayloadData(
      errorMsg,
      {
        level: 'error',
        custom: {
          timeout: timeoutInMs,
          crawlerId: config.crawler.id
        }
      },
      null, // no request object
      (err, payload) => {
        if (err) {
          console.error('Failed to report error to rollbar:\n', err, '\n\nPayload:', payload)
        }
        process.exit(1)
      }
    )
  }, timeoutInMs)
}

function main (config, done) {
  utils.setupRollbar()

  configValidator.validateConfig(config)

  config = configEnhancer.addDefaultModules(config)
  config = configEnhancer.addCrawlerMeta(config)
  config = configEnhancer.addDefaults(config)
  config.cliOptions = program

  var timer = setCrawlerTimeout(config)
  var origDone = done
  done = (err, result) => {
    clearTimeout(timer)
    origDone && origDone(err, result)
  }

  var nockFile = null

  if (program.cacheDir) {
    nockFile = path.resolve() + '/' + program.cacheDir + '/' + config.crawler.id + '.nock.json'
    if (fs.existsSync(nockFile)) {
      console.info('Using cache requests from ', nockFile)
      nock.load(nockFile)
    } else {
      console.info('Start recording requests')
      nock.recorder.rec({
        dont_print: true,
        output_objects: true
      })
    }
  }

  if (config.hasMultiCinemaPages) {
    var pageIds = Object.keys(config.cinemaPages)
    async.eachLimit(pageIds, 1, function (pageId, cb) {
      workOnMultiCinemaPage(pageId, config, cb)
    }, done)
    return
  }

  configEnhancer.addCinemas(config, function (err, config) {
    if (err) { throw new Error(err) }

    var cinemaIds = _.difference(Object.keys(config.cinemas), config.cinemaIdBlacklist || [])
    if (program.cinemasLimit) {
      cinemaIds = cinemaIds.slice(0, program.cinemasLimit)
    }

    async.mapLimit(cinemaIds, 1, function (cinemaId, cb) {
      configEnhancer.addCinemaDetails(cinemaId, config, function(err, config) {
        if (config.cinemaDetailsUrlTemplate) {
          debug.logResultCinemas(config.cinemas[cinemaId])
        }

        workOnCinema(cinemaId, config, cb)
      })
    }, function (err, result) {
      if (config.outputWarnings && config.outputWarnings.length > 0 && !program.suppressedWarnings) {
        config.outputWarnings.forEach((warning) => {
          var msg = `Found ${warning.title} in output files: \n\n`
          msg = msg + _.map(warning.files, (file) => {
            var str = ` - ${file.path}`
            if (warning.code === 1) {
              str = str + '\n   Links:\n'
              str = str + _.map(file.details.bookingLinks.slice(0, 3), (link) => `   - ${link}`).join('\n')
              if (file.details.bookingLinks.length > 3) {
                str = str + `\n   - ${file.details.bookingLinks.length - 3} more ...`
              }
              str = str + '\n'
            }
            return str
          }).join('\n')
          if (warning.recoveryHint) {
            msg = msg + '\n\n '
            msg = msg + warning.recoveryHint
          }
          msg = msg + '\n\n'
          // warning = warning + '\n\n If you finished all configurations and still see this warning please add the follwing to the top of the config object.'
          // warning = warning + '\n\n\  crawler: {is_booking_link_capable: true},\n\n'
          console.warn(msg)
        })
        console.log('If you are still working on the crawler you can suppress the warnings above by passing calling the crawler with `-s`')
      }

      if (program.cacheDir && !fs.existsSync(nockFile)) {
        var nockObjects = nock.recorder.play()
        try {
          fs.mkdirSync(program.cacheDir)
        } catch (e) {
          if (e.code !== 'EEXIST') { throw e }
        }
        fs.writeFileSync(nockFile, JSON.stringify(nockObjects, null, 2))
        console.info('Saved recorded request: ' + nockFile)
      }

      if (config.rollbarWarnings && config.rollbarWarnings.length > 0) {
        var rollbarWarningsWithCount = _.countBy(config.rollbarWarnings, (w) => w)
        async.eachOfLimit(rollbarWarningsWithCount, 1, (count, rollbarWarning, cb) => {
          console.log('Sending warning to rollbar:', rollbarWarning, '…')
          utils.rollbar.reportMessageWithPayloadData(rollbarWarning, {
            level: 'warning',
            custom: {
              count: count,
              crawlerId: config.crawler.id
            }
          }, null, cb)
        },
        (error) => {
          done(error || err, result)
        })
      } else {
        done(err, result)
      }
    })
  })
}

function proxyAdd (config, done, cb) {
  const onCallbackDone = () => {
    if (config.proxyRemoveWhenDone) {
      proxy.remove(config.proxyId, (err) => {
        done && done()
      })
    } else {
      done && done()
    }
  }

  proxy.setup(config, (err, configWithProxy) => {
    cb(configWithProxy, onCallbackDone)
  })
}

module.exports = {
  crawl: (config, done) => proxyAdd(config, done, main)
}
