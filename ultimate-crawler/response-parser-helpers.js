const moment = require('moment')
const debug = require('./debug-methods')
const ConfigError = require('./config-error')
const xregexp = require('xregexp')
require('../utils') // import capitalize() string function

function checkShowtime (showtime) {
  if (showtime.start_at.match('00:00:00') || !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(showtime.start_at)) {
    console.warn(`showtime start_at looks wrong: ${JSON.stringify(showtime, null, '  ')}`)
  }
}

function cleanMovieTitle (movieTitle) {
  return movieTitle
    .replace('(OV)', '')
    .replace('(OmU)', '')
    .replace('(3D)', '')
    .replace('(U)', '')
    .replace('(PG)', '')
    .replace('(12A)', '')
    .replace('(12A LIVE)', '')
    .replace('(12)', '')
    .replace('(15)', '')
    .replace('(18)', '')
    .replace('(R18)', '').trim()
}

function formatStartAt (dateString, timeString, config) {

  if (!timeString) {
    return undefined
  }

  if (config.showtimeFormat === 'YYYY-MM-DDTHH:mm:ssZ') {
    return timeString
  }

  var showtimeFormat = config.showtimeFormat
  if (!showtimeFormat) {
    throw new ConfigError('missing showtimeFormat in config')
  }

  if (showtimeFormat.constructor !== Array) {
    showtimeFormat = [showtimeFormat]
  }

  var dateFormat = config._tmpDateFormat || config.dateFormat || config.urlDateFormat

  if (dateString && dateString.constructor === String) {
    if (['today', 'heute'].indexOf(dateString.toLowerCase()) > -1) {
      dateString = moment(config._testBaseDate || undefined).format(dateFormat)
    } else if (dateString.toLowerCase() === 'tomorrow') {
      dateString = moment(config._testBaseDate || undefined).add(1, 'day').format(dateFormat)
    }
  }

  // custom date format: integer offset of day from today. 0,1,2,3,4...
  if (dateFormat === 'c') {
    var startDate = config._testBaseDate || undefined
    dateFormat = 'YYYY-MM-DD'
    dateString = moment(startDate).add(Number(dateString), 'days').format(dateFormat)
  }

  if (dateFormat === 'X') {
    dateString = moment(dateString, dateFormat).format('YYYY-MM-DD')
    dateFormat = 'YYYY-MM-DD'
  }

  var datetimeFormats = []
  if (dateFormat) {
    if (dateFormat.constructor === String) {
      dateFormat = [dateFormat]
    }
    for (var iShow = 0; iShow < showtimeFormat.length; iShow++) {
      for (var iDate = 0; iDate < dateFormat.length; iDate++) {
        datetimeFormats.push(dateFormat[iDate] + ' ' + showtimeFormat[iShow])
      }
    }
  } else {
    datetimeFormats = showtimeFormat
  }

  var result;

  for (var i = 0; i < datetimeFormats.length; i++) {
    if (datetimeFormats[i].match('a') && !timeString.match(/am|pm|a|p/)) {
      timeString += 'pm'
    }
    // console.log("timestring-----------------------------------------",timeString)
    var datetimeString = dateString ? (dateString + ' ' + timeString) : timeString
    var datetimeFormat = datetimeFormats[i]

    var isOver24 = false;
    var datetimeStringTokens = datetimeString.split(' ')
    var datetimeFormatTokens = datetimeFormats[i].split(' ')
    if (datetimeStringTokens.length == datetimeFormatTokens.length) {
      var timeIndex = datetimeFormatTokens.indexOf('HH:mm')
      if (timeIndex > -1) {
        if (datetimeStringTokens[timeIndex].length == 5 && datetimeStringTokens[timeIndex].includes(':')) {
          var hour = Number(datetimeStringTokens[timeIndex].substring(0, 2))
          if (hour >= 24) {
            datetimeStringTokens[timeIndex] = (hour - 24) + datetimeStringTokens[timeIndex].substring(2)
            datetimeString = datetimeStringTokens.join(' ')
            isOver24 = true;
          }
        }
      } 
    }

    var datetime = moment(datetimeString, datetimeFormats[i], !!config.useStrictMode)
    process.env.DEBUG && debug.logSelectionShowtimes('DATETIME:', 'content:', `"${datetimeString}"`, 'format:', `"${datetimeFormats[i]}"`, 'result:', datetime.format())

    if (isOver24) {
      datetime.add(1, 'day')
    }

    if (datetime < moment(config._testBaseDate || undefined).startOf('month').subtract(1, 'month')) {
      datetime.add(1, 'year')
    }

    if (config._testBaseDate) {
      var _testBaseDate = moment(config._testBaseDate)
      if (datetime.year() > _testBaseDate.year()) {
        datetime.year(_testBaseDate.year())
        if (datetime < moment(config._testBaseDate).subtract(1, 'week')) {
          datetime.add(1, 'year')
        }
      }
    }

    result = datetime.format('YYYY-MM-DDTHH:mm:ss')

    if (result !== 'Invalid date' && !result.match('00:00:00')) { 
      break
    }
  }

  return result
}


function parseCinemaValue (value, key, config) {
  var parser = config['cinema' + key.capitalize() + 'Parser']
  if (parser && parser.constructor === Function) {
    return parser(value)
  } else if (parser && parser.constructor === String) {
    return xregexp.exec(value, xregexp(parser), 'x')['cinema' + key.capitalize()]
  } else {
    return value || undefined
  }
}

function parseCinemaFormattedAddress(config, cinemaFormattedAddress) {
  if (!cinemaFormattedAddress) { return }

  if (cinemaFormattedAddress.constructor === String) {
    cinemaFormattedAddress = cinemaFormattedAddress
    // remove already existing leading/trailing commas at line breaks
    .split('|').map(token => token.trim().replace(/(^,)|(,$)/g, "")).join()
    .trim()
    .replace(/[\t\r\n]/g, ',')
    .replace(/,+/g, ',')
    .replace(/\|$/, '')
    .replace(/\|/g, ', ')
    .replace(/ +/g, ' ')
    .replace(/,([^ ])/g, ', $1')
  }

  if (config.cinemaAddressParser && config.cinemaAddressParser.constructor === Function) {
    return config.cinemaAddressParser(cinemaFormattedAddress)
  } else if (config.cinemaAddressParser && config.cinemaAddressParser.constructor === String) {
    return xregexp.exec(cinemaFormattedAddress, xregexp(config.cinemaAddressParser), 'x').formatted_address;
  } else {
    return cinemaFormattedAddress || undefined
  }
}

function parseCinemaLatlon (latlon, config) {
  var parsed = parseCinemaValue(latlon, 'latlon', config)
  if (parsed && parsed.constructor === String) {
    parsed = parsed.split(',').map((n) => Number(n))
  }
  return parsed
}


function parseLanguageText (text, config) {
  var language
  if (!config.languageMap) { throw new ConfigError('missing languageMap in config') }
  Object.keys(config.languageMap).forEach(function (key) {
    var regexp = null

    if (key[0] === '/' && key[key.length - 1] === '/') {
      regexp = new RegExp(key.slice(1, key.length-1))
    }

    if (text.match(regexp || key)) {
      language = config.languageMap[key]
    }
  })

  return language
}

function parseSubtitlesText (text, config) {
  var subtitles = []
  if (!config.subtitlesMap) { throw new ConfigError('missing subtitlesMap in config') }
  Object.keys(config.subtitlesMap).forEach(function (key) {
    var regexp = null

    if (key[0] === '/' && key[key.length - 1] === '/') {
      regexp = new RegExp(key.slice(1, key.length-1))
    }

    if (text.match(regexp || key)) {
      subtitles.push(config.subtitlesMap[key])
    }
  })

  if (subtitles.length > 0) {
    return subtitles.join(',')
  } else {
    return undefined
  }
}

function parseVersionFlags (label) {
  var is3d = label ? !!label.match(/3D/i) : false
  var isImax = label ? !!label.match(/IMAX/i) : false

  return {
    is_3d: is3d,
    is_imax: isImax,
    x_version_label: label
  }
}

module.exports = {
  checkShowtime: checkShowtime,
  cleanMovieTitle: cleanMovieTitle,
  formatStartAt: formatStartAt,
  parseLanguageText: parseLanguageText,
  parseSubtitlesText: parseSubtitlesText,
  parseCinemaValue: parseCinemaValue,
  parseCinemaLatlon: parseCinemaLatlon,
  parseCinemaFormattedAddress: parseCinemaFormattedAddress,
  parseVersionFlags: parseVersionFlags
}
