var cheerio = require('cheerio')
var url = require('url')
var moment = require('moment')
var debug = require('./debug-methods')
var _ = require('underscore')
var xregexp = require('xregexp')
var parameterize = require('parameterize')
var templateEvaluator = require('./template-evaluator')
var helpers = require('./response-parser-helpers')
var ConfigError = require('./config-error')
var configValidator = require('./config-validator')
var helper = require('./helper')
var utils = require('./../utils')

var applySortByDepth = function($) {
  $.fn.sortByDepth = function() {

    var ar = this.map(function() {
            return {length: $(this).parents().length, elt: this}
        }).get(),
        result = [],
        i = ar.length;

    ar.sort(function(a, b) {
        return a.length - b.length;
    });

    while (i--) {
        result.push(ar[i].elt);
    }

    return $(result);
  }
}


function selectValueFromNode (containerNode, selectorKey, config) {
  var selector = config[selectorKey + 'Selector']
  var attribute = config[selectorKey + 'Attribute']
  var parser = config[selectorKey + 'Parser']
  if (!selector && !attribute) {
    return null
  }
  
  var node = selector ? containerNode.find(selector) : containerNode
  var value = attribute && attribute !== 'text()' ? node.attr(attribute) : node.text()
  if (parser) {
    try {
      value = parser(value)
    } catch (error) {
      // ignore error, maybe the parser was defined for the a the details pages
    }
  }

  if (process.env.DEBUG) {
    var debugFunction = null
    if (selectorKey.match(/^city/)) { debugFunction = debug.logSelectionCities }
    else if (selectorKey.match(/^cinema/)) { debugFunction = debug.logSelectionCinemas }
    else if (selectorKey.match(/^movie/)) { debugFunction = debug.logSelectionMovies }
    else if (selectorKey.match(/^showtime/)) { debugFunction = debug.logSelectionShowtimes }
    if (debugFunction) {
      debugFunction('MATCH OF %sSelector [%s]:', selectorKey, selector, node.html())
      debugFunction('MATCH OF %sAttribute [%s]:', selectorKey, attribute, value)
    } 
  }

  return value
}

function searchLatlonFromMapsUrl (containerNode, config) {
  if (!config.cinemaLatlonSelector) { return null }
  var latlon = null
  if (helper.isLinkTagSelector(config.cinemaLatlonSelector)) {
    var mapsUrl = containerNode.find(config.cinemaLatlonSelector).attr('href')
    process.env.DEBUG && debug.logSelectionCinemas('FOUND MAPS URL BY cinemaLatlonSelector', mapsUrl)
    latlon = latlon || utils.parseLatlonFromGoogleMapsUrl(mapsUrl)
    latlon = latlon || utils.parseLatlonFromBingMapsUrl(mapsUrl)
    if (latlon) { latlon = [latlon.lat, latlon.lon] }
  }
  return latlon
}

function parseCities (res, config) {
  var $ = cheerio.load(res.text)
  applySortByDepth($)
  var cities = []

  configValidator.validateKeyIsSet('cityBoxSelector', config)
  var cityBoxes = $(config.cityBoxSelector)
  process.env.DEBUG && debug.logSelectionCities('FOUND %s cityBoxes:', cityBoxes.length)

  cityBoxes.each(function (i, cityBox) {
    process.env.DEBUG && debug.logSelectionCities('MATCH OF cityBoxSelector:', $(cityBox).parent().html())

    cities.push({
      id: selectValueFromNode($(cityBox), 'cityId', config),
      slug: selectValueFromNode($(cityBox), 'citySlug', config),
      name: selectValueFromNode($(cityBox), 'cityName', config)
    })
  })

  process.env.DEBUG && debug.logFirstItemsOfList(cities, 500, debug.logResultCities)

  return cities
}

function getMovieImdbId (config, loopData) {
  var $ = loopData.$
  var movieBox = loopData.movieBox
  var movieImdbId

  if (config.movieImdbSelector) {
    var imdbLink = $(movieBox).find(config.movieImdbSelector).attr('href')
    var imdbLinkMatch = imdbLink && imdbLink.match(/www\.imdb\.com\/title\/([a-z0-9]+)\//)
    if (imdbLinkMatch) {
      movieImdbId = imdbLinkMatch[1]
    }
  }

  return movieImdbId || undefined
}

function getMovieId (config, loopData) {
  var $ = loopData.$
  var movieBox = loopData.movieBox

  if (config.movieIdSelector) {
    var movieId = $(movieBox).find(config.movieIdSelector).attr(config.movieIdAttribute)
    if (config.movieIdParser) {
      movieId = config.movieIdParser(movieId)
    }
    
  } else {
    return undefined
  }
}

function getDateString (config, loopData, element) {
  var $ = loopData.$

  var dateString
  if (config.dateAttribute) {
    dateString = $(element).attr(config.dateAttribute)
  } else {
    dateString = $(element).text().trim()
  }

  // if _tmpDateFormat is set, parser has already been applied
  if (!config._tmpDateFormat && config.dateParser) {
    dateString = config.dateParser(dateString)
  }
  return dateString
}

function getTimeString (config, loopData, element) {
  var $ = loopData.$
  var cinemaId = loopData.cinemaId
  var list

  if (config.showtimeDelimiter && element.tagName !== 'a') {
    // workaround for case where the date contains 'br' itself, as in 'septembre' (CRAW-444)
    var showtimeDelimiter = config.showtimeDelimiter
    try {
      // replace <tag> name with #tag#
      if ($(element).find(showtimeDelimiter)) {
        $(element).find(showtimeDelimiter).replaceWith('#' + showtimeDelimiter + '#')
        showtimeDelimiter = '#' + showtimeDelimiter + '#'
      }
    } catch (error) {
      // just skip if delimiter is not a selector
    }    

    list = _.compact($(element).clone().children().remove().end().text().trim().split(showtimeDelimiter).map(function (timeString) {
      if (timeString.match(/[0-9]/)) {
        return $('<span>'+timeString+'</span>')
      } else {
        return null
      }
    }))
  } else {
    list = [element];
  }
  return list
}

function getLoopValue (attribute, config, loopData, element) {
  switch (attribute) {
    case 'movieTitle':
      return getMovieTitle(config, loopData, element)
    case 'auditorium':
      return getAuditorium(config, loopData, element)
    case 'date':
      return getDateString(config, loopData, element)
    case 'showtime':
      return getTimeString(config, loopData, element)
    case 'dversion':
      return getDversion(config, loopData, element)
  }
  return null
}

function putLoopValue (attribute, loopData, value) {
  switch (attribute) {
    case 'movieTitle':
      return putMovieTitleInLoop(loopData, value)
    case 'showtime':
      loopData.list = value
      break
    case 'date':
      loopData.dateString = value
      break
    case 'dversion':
      loopData.is3d = value
      break
    default:
      loopData[attribute] = value
      break
  }
}

function getShowtime (element, config, loopData) {
  var $ = loopData.$
  var dateString = loopData.dateString
  var timeString = loopData.timeString
  var movieTitle = loopData.movieTitle
  var auditorium = loopData.auditorium
  var language = loopData.language
  var subtitles = loopData.subtitles
  var movieImdbId = loopData.movieImdbId
  var is3d = loopData.is3d
  var cinemaId = loopData.cinemaId
  var movieId = loopData.movieId

  var timeElement = config.showtimeTimeSelector ? $(element).find(config.showtimeTimeSelector) : $(element)
  timeString = config.showtimeAttribute && timeElement.attr(config.showtimeAttribute)
    ? timeElement.attr(config.showtimeAttribute).trim()
    : timeElement.text().trim()

  if (config.showtimeParser) {
    timeString = config.showtimeParser(timeString)
  }

  var startAt = helpers.formatStartAt(dateString, timeString, config)
  var bookingLink

  if (config.bookingIdSelector) {
    var bookingLinkElement = $(element).find(config.bookingIdSelector)

    process.env.DEBUG && debug.logSelectionShowtimes('MATCH OF bookingIdSelector: ', $(bookingLinkElement).html())

    // search in any parent level relative to showtime
    $parent = $(element).parent()
    while (bookingLinkElement.toArray().length === 0 && $parent.toArray().length === 1) {
      var bookingLinks = $parent.find(config.bookingIdSelector).toArray()
      if (bookingLinks.length == 1) {
        bookingLinkElement = $(bookingLinks[0])
      } else if (bookingLinks.length > 1) {
        // if booking links of other showtimes are on same level, we have to find the one which contains the showtime
        var foundMatching = false
        bookingLinks.forEach(function(bookingLink, idx) {
          if ($(bookingLink).find(element).toArray().length === 1) {
            bookingLinkElement = $(bookingLinks[idx])
            foundMatching = true
          }
        })
        if (!foundMatching) bookingLinkElement = $parent.find(config.bookingIdSelector)
      }
      
      $parent = $parent.parent()
    }

    var bookingId = config.bookingIdAttribute
      ? bookingLinkElement.attr(config.bookingIdAttribute)
      : bookingLinkElement.text()

    if (config.bookingIdParser) {
      bookingId = config.bookingIdParser(bookingId)
    }

    bookingLink = bookingId && templateEvaluator.evaluate({
      bookingId: bookingId, 
      cinemaId: cinemaId, 
      date: dateString, 
      time: timeString, 
      movieId: movieId,
    }, config.bookingLinkTemplate)
    // don't encode if we use the booking template to just pass an url
    if (config.bookingLinkTemplate !== ':bookingId' && config.bookingIdAttribute !== 'href') {
      bookingLink = encodeURI(bookingLink)
    }
  } else if (config.bookingDataAttribute) {
    var bookingDataString = $(element).attr(config.bookingDataAttribute)
    var bookingDataRegexp = xregexp(config.bookingDataRegexp)

    if (bookingDataString) {
      bookingLink = xregexp.replace(
        bookingDataString,
        bookingDataRegexp,
        config.bookingLinkTemplate
      )      
      
      bookingLink = templateEvaluator.evaluate({cinemaId: cinemaId}, bookingLink)
    }

  } else {
    bookingLink = $(element).attr('href')

    if (['javascript:void(0)', '#'].indexOf(bookingLink) > -1) {
      bookingLink = undefined;
    }
  }

  if (bookingLink && bookingLink[0] === '/') {
    var urlTemplate = config.urlTemplate || config.cinemas[cinemaId].program
    var urlObject = url.parse(urlTemplate)
    bookingLink = urlObject.protocol + '//' + urlObject.host + bookingLink
  } else if (bookingLink && !bookingLink.match(/^http/)) {
    var hostPart = config.urlTemplate || config.cinemas[cinemaId].program

    if (bookingLink[bookingLink.length - 1] === '/') {
      bookingLink = hostPart + bookingLink
    } else {
      bookingLink = hostPart.slice(0, hostPart.lastIndexOf('/')) + '/' + bookingLink
    }

    bookingLink = templateEvaluator.evaluate({cinemaId: cinemaId}, bookingLink)
  }

  if (!startAt) {
    return undefined
  }

  loopData.versionFlags = loopData.versionFlags || {}

  var showtime = {
    movie_title: movieTitle,
    movie_imdb_id: movieImdbId,
    booking_link: bookingLink || undefined,
    start_at: startAt,
    language: language || loopData.versionFlags.language,
    subtitles: subtitles || loopData.versionFlags.subtitles,
    auditorium: auditorium,
    is_3d: is3d,
    is_imax: loopData.versionFlags.is_imax
  }
  showtime = Object.assign(showtime, loopData.versionFlags)

  helpers.checkShowtime(showtime)

  return showtime
}

function handleTableMode (config, loopData) {
  var $ = loopData.$
  var movieBox = loopData.movieBox

  if (config.showtimeDateTableMode) {
    var dates = $(movieBox).find(config.dateSelector).toArray()

    process.env.DEBUG && debug.logSelectionShowtimes('MATCH OF dates: ', dates)

    var showtimeDateGroups = $(movieBox).find(config.showtimeDateGroupSelector)

    process.env.DEBUG && debug.logSelectionShowtimes('MATCH OF showtimeDateGroupSelector: ', $(showtimeDateGroups).html())

    if (config.showtimeDateTableByRow) {
      var datesCount = dates.length;
      showtimeDateGroups.each(function (i, showtimeDateGroup) {
        var rowNumber = Math.floor(i / datesCount)
        var dateIndex = i - (rowNumber * datesCount)

        $(dates[dateIndex]).insertBefore(showtimeDateGroup)
      })
    } else {    
      showtimeDateGroups.each(function (i, showtimeDateGroup) {
        $(showtimeDateGroup).before(dates[i])
      })
    }
  }
}

function getMovieTitle (config, loopData, element) {
  var $ = loopData.$

  var titleNode = $(element)

  var movieTitle = config.movieTitleAttribute
    ? titleNode.attr(config.movieTitleAttribute)
    : titleNode.text()

  movieTitle = movieTitle.trim()
    .replace('\r\n', '')
    .replace(/\s+/, ' ')

  if (config.movieTitleParser) {
    movieTitle = config.movieTitleParser(movieTitle)
  }

  return movieTitle
}

function getDversion(config, loopData, element) {
   var $ = loopData.$
   var value = config.dversionAttribute ? $(element).attr(config.dversionAttribute) : $(element).text()
   if (config.dversionParser) {
    value = config.dversionParser(dversion)
  } else {
    value = !!value.match('3D')
  }
  return value
}

function getAuditorium(config, loopData, element) {
  var $ = loopData.$
  var auditorium = config.auditoriumAttribute ? $(element).attr(config.auditoriumAttribute) : $(element).text().trim()
  if (config.auditoriumParser) {
    auditorium = config.auditoriumParser(auditorium)
  }
  return auditorium
}

function getSubtitles (config, loopData) {
  if (!config.subtitlesSelector) {
    return undefined
  }

  var $ = loopData.$
  var movieBox = loopData.movieBox

  var text = $(movieBox).find(config.subtitlesSelector).text().trim()

  process.env.DEBUG && debug.logSelectionMovies('MATCH OF subtitlesSelector: ', text)

  return helpers.parseSubtitlesText(text, config)
}

function getLanguage (config, loopData) {
  if (!config.languageSelector) {
    return undefined
  }

  var $ = loopData.$
  var movieBox = loopData.movieBox

  var text = $(movieBox).find(config.languageSelector).text().trim()

  process.env.DEBUG && debug.logSelectionMovies('MATCH OF languageSelector: ', text)

  return helpers.parseLanguageText(text, config)
}

function parseCinemaDetails(responseText, cinemaId, config) {
  if (config.cinemaDetailsPageParser) {
    responseText = config.cinemaDetailsPageParser(responseText, config);
  }

  var $ = cheerio.load(responseText)
  applySortByDepth($)

  // TODO: rename cinemaDetailsPageParser as it is more of a mapper / filter and does not actually parses
  if (config.cinemaDetailsPageResponseParser) {
    var cinemaDetails = config.cinemaDetailsPageResponseParser(responseText, config)
    process.env.DEBUG && debug.logSelectionCinemas('PARSED cinema details: ', cinemaDetails)
    config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], cinemaDetails)
    if (cinemaDetails.id && cinemaDetails.id !== cinemaId) {
      if (!config.cinemaMappedId) {
        config.cinemaMappedId = {}
      }
      config.cinemaMappedId[cinemaId] = cinemaDetails.id
    }
  } else {
    addCinemaDataFromPage($, cinemaId, config, true)
  }


  return config.cinemas[cinemaId]
}

function addCinemaDataFromPage($, cinemaId, config, force) {
  if (force || (!config.cinemas[cinemaId].name && $(config.cinemaNameSelector).length > 0)) {
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaNameSelector:', $(config.cinemaNameSelector).html())

    var text = config.cinemaNameAttribute 
      ? $(config.cinemaNameSelector).attr(config.cinemaNameAttribute)
      : $(config.cinemaNameSelector).text()

    var name = text && helpers.parseCinemaValue(text.trim(), 'name', config)

    if (name) {
      config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
        name: name
      })      
    }
  }

  if (config.cinemaSlugSelector === '$') {
    config.cinemas[cinemaId].slug = parameterize(config.cinemas[cinemaId].name)
  }

  if (force || (!config.cinemas[cinemaId].slug && $(config.cinemaSlugSelector).length > 0)) {
    var slug = config.cinemaSlugSelector
      ? config.cinemaSlugSelector === '$'
        ? name
        : $(config.cinemaSlugSelector).text().trim()
      : undefined

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaSlugSelector: ', slug)

    if (slug) {
      config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
        slug: parameterize(slug)
      })      
    }
  }

  if (config.cinemaMappedIdSelector !== '$' && $(config.cinemaMappedIdSelector).length > 0) {
    if (!config.cinemaMappedId) { 
      config.cinemaMappedId = {} 
    }

    var text = config.cinemaMappedIdAttribute 
      ? $(config.cinemaMappedIdSelector).attr(config.cinemaMappedIdAttribute)
      : $(config.cinemaMappedIdSelector).text()

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaMappedIdSelector', text)

    var cinemaMappedId = helpers.parseCinemaValue(text, 'mappedId', config)

    if (cinemaMappedId) {
      config.cinemaMappedId[cinemaId] = cinemaMappedId
    }
  }

  if (force || (!config.cinemas[cinemaId].formatted_address && $(config.cinemaAddressSelector).length > 0)) {
    $(config.cinemaAddressSelector).find('br').replaceWith('|')

    var addressNode = $(config.cinemaAddressSelector)
    var address = config.cinemaAddressAttribute
      ? addressNode.attr(config.cinemaAddressAttribute)
      : addressNode.text()

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaAddressSelector - %s', config.cinemaAddressSelector, addressNode.parent().html())
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaAddressAttribute', address)

    address = helpers.parseCinemaFormattedAddress(config, address)
   
    if (address) {    
      config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
        formatted_address: address
      })
    }
  }

  if (force || (!config.cinemas[cinemaId].telephone && $(config.cinemaTelephoneSelector).length > 0)) {
    var telephone = helpers.parseCinemaValue($(config.cinemaTelephoneSelector).text().trim(), 'telephone', config)

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaTelephoneSelector', telephone)

    if (telephone) {    
      config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
        telephone: telephone
      })
    }
  }

  if (force || (!config.cinemas[cinemaId].latlon && $(config.cinemaLatlonSelector).length > 0)) {

    var latlon = searchLatlonFromMapsUrl($('html'), config)

    if (!latlon) {
      var latlonString = config.cinemaLatlonAttribute
        ? $(config.cinemaLatlonSelector).attr(config.cinemaLatlonAttribute)
        : $(config.cinemaLatlonSelector).text()

      latlon = helpers.parseCinemaLatlon(latlonString, config)
    }

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaLatlonSelector', latlon)

    if (latlon) {
      config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
        latlon: latlon
      })
    }
  }

  if (config.cinemaWebsiteTemplate && (force || !config.cinemas[cinemaId].website)) {
    var website = templateEvaluator.evaluate({cinemaId: cinemaId}, config.cinemaWebsiteTemplate)

    config.cinemas[cinemaId] = Object.assign({}, config.cinemas[cinemaId], {
      website: website
    })
  }

}

function parseShowtimes (responseText, pageParameters, config) {
  moment.locale(config.dateLocale || 'en')
  
  if (config.programPageParser) {
    responseText = config.programPageParser(responseText, pageParameters, config);
  }

  var $ = cheerio.load(responseText)
  applySortByDepth($)
  var loopData = {'$': $, result: {}}

  addCinemaDataFromPage($, pageParameters.cinemaId, config)

  if (config.groupedByDate) {
    // preprocess dates if format only considers days
    if (config.dateFormat && config.dateFormat.replace(/d/ig, '').trim().length == 0) {
      var daysList
      var dateElements = $(config.dateBoxSelector + ' ' + config.dateSelector).toArray()
      var nDates = dateElements.length
      // determine date of first day by finding date for current day
      for (var iDate = 0; iDate < nDates; iDate++) {
        var dateString = getDateString(config, loopData, dateElements[iDate])
        if (dateString.toLowerCase() === moment().format(config.dateFormat)) {
          var startdate = moment();
          startdate = startdate.subtract(iDate, "days");
          daysList = utils.daysList(nDates, startdate)
          break
        }
      }

      // map days
      if (daysList) {
        config._tmpDateFormat = 'YYYY-MM-DD'
        for (var iDate = 0; iDate < nDates; iDate++) {
          var dateString = daysList[iDate].format(config._tmpDateFormat)
          if (config.dateAttribute) {
            $(dateElements[iDate]).attr(config.dateAttribute, dateString)
          } else {
            $(dateElements[iDate]).text(dateString)
          }
        }
      }
    }

    $(config.dateBoxSelector).each(function (i, dateBox) {
      var dateNode = config.dateSelector ? $(dateBox).find(config.dateSelector) : $(dateBox)
      pageParameters.date = config.dateAttribute ? dateNode.attr(config.dateAttribute) : dateNode.text().trim()
      loopData.movieBoxRoot = $(dateBox)

      process.env.DEBUG && debug.logSelectionShowtimes('MATCH OF dateSelector', $(dateNode).html())

      loopOnMovieBoxes(loopData, pageParameters, config)
    })
  } else {
    loopOnMovieBoxes(loopData, pageParameters, config)
  }

  const showtimes = _.values(loopData.result)
  process.env.DEBUG && debug.logFirstItemsOfList(showtimes, 5, debug.logResultShowtimes)
  return showtimes
}

function loopOnMovieBoxes (loopData, pageParameters, config) {
  if (!config.movieBoxSelector) {
    throw new ConfigError('missing movieBoxSelector in config')
  }

  var $ = loopData.$
  var movieBoxRoot = loopData.movieBoxRoot || $(':root')

  var traversal = config.movieBoxSelector === '$' 
    ? movieBoxRoot
    : movieBoxRoot.find(config.movieBoxSelector)

  if (traversal.length === 0) {
    var warning = 'MATCH OF movieBox EMPTY'
    console.warn(warning)
    config.rollbarWarnings = config.rollbarWarnings || []
    config.rollbarWarnings.push(warning)
  } else {
    process.env.DEBUG && debug.logSelectionMovies(`MATCH OF ${traversal.length} movieBox`)
  }

  traversal.each(function (i, movieBox) {
    process.env.DEBUG && debug.logSelectionMovies('MATCH OF movieBox', $(movieBox).html())

    loopData.movieBox = movieBox

    if (config.versionBoxSelector) {
      loopOnVersionBoxes(loopData, pageParameters, config)
    } else {
      loopData.showtimesContainer = movieBox
      loopOnShowtimeBoxes(loopData, pageParameters, config)
    }
  })
}

function loopOnVersionBoxes (loopData, pageParameters, config) {
  var $ = loopData.$
  var movieBox = loopData.movieBox

  var versionBoxes = $(movieBox).find(config.versionBoxSelector)
  process.env.DEBUG && debug.logSelectionMovies('FOUND %s version boxes', versionBoxes.length)

  var versionLabelMap = config.versionLabelIdAttribute ? {} : null
  if (config.versionLabelIdAttribute) {
    var versionLabelBoxes = $(movieBox).find(config.versionLabelSelector)
    process.env.DEBUG && debug.logSelectionMovies('FOUND %s version label boxes', versionLabelBoxes.length)

    versionLabelBoxes.each(function (i, versionLabelBox) {
      var versionLabel = $(versionLabelBox).text()
      var versionId = $(versionLabelBox).attr(config.versionLabelIdAttribute)

      process.env.DEBUG && debug.logSelectionMovies('MATCH OF versionLabelSelector: ', versionLabel)
      process.env.DEBUG && debug.logSelectionMovies('MATCH OF versionLabelIdAttribute: ', versionId)
      versionLabelMap[versionId] = versionLabel
    })
  }

  versionBoxes.each(function (i, versionBox) {
    var versionLabel = null
    if (versionLabelMap) {
      configValidator.validateKeyIsSet('versionBoxIdParser', config)
      var versionId = config.versionBoxIdParser($(versionBox))
      versionLabel = versionLabelMap[versionId]
    } else {
      configValidator.validateKeyIsSet('versionLabelSelector', config)
      var versionLabelBox = $(versionBox).find(config.versionLabelSelector)
      if (versionLabelBox.length === 0) {
        process.env.DEBUG && debug.logSelectionMovies('NO MATCH OF versionLabelSelector FOUND IN CHILD NODES -> Searching in previous sibling nodes')
        versionLabelBox = $(versionBox).prev(config.versionLabelSelector)
      }
      process.env.DEBUG && debug.logSelectionMovies('MATCH OF versionLabelSelector: ', versionLabelBox.html())

      if (config.versionLabelParser) {
        versionLabel = config.versionLabelParser(versionLabelBox)
      } else {
        versionLabel = versionLabelBox.text()
      }
    }

    var flags = helpers.parseVersionFlags(versionLabel)
    if (config.versionFlagsParser) {
      flags = config.versionFlagsParser($(versionBox), versionLabel, flags)
    }
    process.env.DEBUG && debug.logSelectionMovies('MATCH OF version flags: ', flags)

    loopData.versionFlags = flags
    loopData.showtimesContainer = versionBox
    loopOnShowtimeBoxes(loopData, pageParameters, config)
  })
}

function loopOnShowtimeBoxes (loopData, pageParameters, config) {
  var $ = loopData.$
  var movieBox = loopData.movieBox
  var showtimesContainer = loopData.showtimesContainer

  handleTableMode(config, loopData)

  var cinemaId = pageParameters.cinemaId
  var subtitles = getSubtitles(config, loopData)
  var language = getLanguage(config, loopData)
  var movieImdbId = getMovieImdbId(config, loopData)
  var movieId = getMovieId(config, loopData) || pageParameters.movieId

  if (!config.movieTitleSelector && !(pageParameters.movieId && config._cache.movieTitles[pageParameters.movieId])) {
    throw new ConfigError('missing movieTitleSelector in config')
  }
  var elements = {
    movieTitle: $(movieBox).find(config.movieTitleSelector).toArray(),
    auditorium: $(showtimesContainer).find(config.auditoriumSelector).toArray(),
    dversion: $(showtimesContainer).find(config.dversionSelector).toArray(),
    // add validation if dateSelector is set although url contains date => will not have any effect
    date: pageParameters.date ? [] : $(showtimesContainer).find(config.dateSelector).toArray(),
    showtime: $(showtimesContainer).find(config.showtimeSelector).toArray(),
  }

  // preprocess dates if format only considers days
  if (config.dateFormat && config.dateFormat.replace(/d/ig, '').trim().length == 0) {
    var daysList
    var nDates = elements.date.length
    // determine date of first day by finding date for current day
    for (var iDate = 0; iDate < nDates; iDate++) {
      var dateString = getDateString(config, loopData, elements.date[iDate])
      if (dateString === moment().format(config.dateFormat)) {
        var startdate = moment();
        startdate = startdate.subtract(iDate, "days");
        daysList = utils.daysList(nDates, startdate)
        break
      }
    }
    // map days
    if (daysList) {
      config._tmpDateFormat = 'YYYY-MM-DD'
      for (var iDate = 0; iDate < nDates; iDate++) {
        var dateString = daysList[iDate].format('YYYY-MM-DD')
        if (config.dateAttribute) {
          $(elements.date[iDate]).attr(config.dateAttribute, dateString)
        } else {
          $(elements.date[iDate]).text(dateString)
        }
      }
    }
  }

  var $combined = $(showtimesContainer).find(_.compact([config.movieTitleSelector, config.dversionSelector, config.auditoriumSelector, config.dateSelector, config.showtimeSelector]).join(','))

  var date = pageParameters.date || null

  loopData.movieImdbId = movieImdbId
  loopData.movieId = movieId
  loopData.subtitles = subtitles
  loopData.language = language
  loopData.dateString = date
  loopData.cinemaId = cinemaId

  if (pageParameters.movieId && config._cache.movieTitles[pageParameters.movieId]) {
    putMovieTitleInLoop(loopData, config._cache.movieTitles[pageParameters.movieId])
  }

  if (elements.movieTitle.length === 1) {
    putMovieTitleInLoop(loopData, getMovieTitle(config, loopData, elements.movieTitle[0]))
  }

  // marks the element which should trigger processing of loop data
  var lastAttribute = null
  var processedAttributes = []
  $combined.each(function (i, currentElement) {
    Object.keys(elements).forEach(function(attribute) {
      if (elements[attribute].length > 0 && elements[attribute].find(function (element) { return element === currentElement })) {
        process.env.DEBUG && debug.logSelectionMovies('MATCH OF ' + attribute + 'Selector: ', $(currentElement).html())

        // determine lastAttribute by checking if it has already been processed
        if (!lastAttribute && processedAttributes.indexOf(attribute) != -1) {
          if (!loopData.list) {
            // skip if no showtime has been added yet
            processedAttributes.splice(0, processedAttributes.indexOf(attribute) + 1)
          } else {
            // looks like we have collected all data we need for the showtime, following showtimes will be added when element
            // of lastAttribute type is processed
            lastAttribute = processedAttributes[processedAttributes.length - 1]
            processLoop(config, loopData)
          }
        }
        // add data to loop
        var value = getLoopValue(attribute, config, loopData, currentElement)
        putLoopValue(attribute, loopData, value)
        // add new show if this is our last attribute
        if (lastAttribute == attribute) {
          processLoop(config, loopData)
        }
        processedAttributes.push(attribute)
      }
    })
  })
  // add last showtime if it has not been added yet
  if (processedAttributes.length) {
    if (!lastAttribute || processedAttributes[processedAttributes.length - 1] != lastAttribute) {
      processLoop(config, loopData)
    }
  }
}

function putMovieTitleInLoop(loopData, movieTitleOriginal) {
  var movieTitle = helpers.cleanMovieTitle(movieTitleOriginal)
  var is3d = !!movieTitleOriginal.match('3D')

  if (movieTitle) {
    loopData.movieTitleOriginal = movieTitleOriginal
    loopData.movieTitle = movieTitle
    loopData.is3d = is3d
  }

  if (process.env.DEBUG) {
    debug.logResultMovies({
      id: loopData.movieId,
      imdbId: loopData.movieImdbId,
      title: movieTitle,
      titleOriginal: movieTitleOriginal,
      language: loopData.language,
      subtitles: loopData.subtitles,
      is3d: is3d
    })
  }
}

function processLoop(config, loopData) {
  if (!loopData.list) return

  loopData.list.forEach(function(listElement) {
    showtime = getShowtime(listElement, config, loopData)

    if (!showtime) {
      return
    }

    var filter = config.cinemas 
      && config.cinemas[loopData.cinemaId]
      && config.cinemas[loopData.cinemaId].filterByAuditorium 
      && new RegExp(config.cinemas[loopData.cinemaId].filterByAuditorium)

    if (!filter || (showtime.auditorium && showtime.auditorium.match(filter))) {
      id = showtime.movie_title + showtime.start_at + showtime.is_3d

      var existingShowtime = loopData.result[id]

      if (existingShowtime) {
        existingShowtime.booking_link = showtime.booking_link ? showtime.booking_link : existingShowtime.booking_link
      } else {
        loopData.result[id] = showtime
      }
    }
  })
  loopData.list = []
}



function parseCinemas (responseText, config) {
  if (config.cinemasListPageParser) {
    responseText = config.cinemasListPageParser(responseText, config)
  }

  var $ = cheerio.load(responseText)
  applySortByDepth($)
  var cinemas = {}

  $(config.cinemaBoxSelector).each(function (i, element) {
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaBoxSelector:', $(element).parent().html())
    
    var cinemaSlug
    var cinemaUrl = config.cinemaUrlAttribute && $(element).attr(config.cinemaUrlAttribute)
    
    var cinemaName = selectValueFromNode($(element), 'cinemaName', config)
    // for backwards compability when no cinemaNameSelector has been specified
    if (!cinemaName) {
      cinemaName = $(element).text().trim()
    }
    if (cinemaName) { cinemaName = cinemaName.trim() }

    var cinemaFormattedAddress = selectValueFromNode($(element), 'cinemaAddress', config)
    if (cinemaFormattedAddress) {
      cinemaFormattedAddress = cinemaFormattedAddress.trim()
        .replace(/<br>/g, ',')
        .replace(/[\t\r\n]/g, ',')
        .replace(/,+/g, ',')
        .replace(/\|$/, '')
        .replace(/\|,/g, ',')
        .replace(/\|/g, ', ')
        .replace(/ +/g, ' ')
    }

    var cinemaTelephone = selectValueFromNode($(element), 'cinemaTelephone', config)
    if (cinemaTelephone) {
      cinemaTelephone = helpers.parseCinemaValue(cinemaTelephone, 'telephone', config)
    }

    var cinemaLatlon = searchLatlonFromMapsUrl($(element), config)
    if (!cinemaLatlon) {
      var cinemaLatlonString = selectValueFromNode($(element), 'cinemaLatlon', config)
      if (cinemaLatlonString) {
        cinemaLatlon = helpers.parseCinemaLatlon(cinemaLatlonString, config)
      }
    }

    var cinemaSlugName = config.cinemaSlugSelector
      ? config.cinemaSlugSelector === '$'
        ? cinemaName
        : config.cinemaSlugAttribute
          ? $(element).find(config.cinemaSlugSelector).attr(config.cinemaSlugAttribute)
          : $(element).find(config.cinemaSlugSelector).text()
      : undefined

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaSlugName:', cinemaSlugName)

    var cinemaId
    if (config.cinemaIdSelector) {
      var cinemaIdNode = $(element).find(config.cinemaIdSelector)
      if (config.cinemaIdAttribute) {
        cinemaId = cinemaIdNode.attr(config.cinemaIdAttribute)
      } else {
        cinemaId = cinemaIdNode.text()
      }
    } else {
      if (config.cinemaIdAttribute) {
        cinemaId = $(element).attr(config.cinemaIdAttribute)
      } else {
        cinemaId = parameterize(cinemaName)
      }
    }

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaId:', cinemaId)

    var cinemaMappedId = config.cinemaMappedIdSelector
      ? config.cinemaMappedIdSelector === '$'
        ? $(element).attr(config.cinemaMappedIdAttribute) 
        : $(element).find(config.cinemaMappedIdSelector).attr(config.cinemaMappedIdAttribute) || undefined
      : undefined

    cinemaId = helpers.parseCinemaValue(cinemaId, 'id', config)

    if (config.cinemaMappedIdParser) {
      cinemaMappedId = config.cinemaMappedIdParser(cinemaMappedId)
    }

    if (cinemaMappedId) {
      if (!config.cinemaMappedId) {
        config.cinemaMappedId = {}
      }

      config.cinemaMappedId[cinemaId] = cinemaMappedId
    }

    if (cinemaSlugName) {
      cinemaSlug = config.cinemaSlugParser
        ? config.cinemaSlugParser(cinemaSlugName)
        : _.uniq(parameterize(cinemaSlugName).split('-')).join('-')
    }

    cinemaName = helpers.parseCinemaValue(cinemaName, 'name', config)
    cinemaFormattedAddress = helpers.parseCinemaFormattedAddress(config, cinemaFormattedAddress)

    if (cinemaId) {
      var isExcluded = config.cinemaIdExcluded
      ? !!config.cinemaIdExcluded.find(id => cinemaId.match(id))
      : false

      if (!isExcluded) {
        cinemas[cinemaId] = {
          name: cinemaName,
          slug: cinemaSlug,
          website: cinemaUrl,
          formatted_address: cinemaFormattedAddress,
          latlon: cinemaLatlon,
          telephone: cinemaTelephone
        }
        if (config.includeCinemaIds) {
          cinemas[cinemaId] = Object.assign({id: cinemaId}, cinemas[cinemaId])
        }
      }
    }
  })

  return cinemas
}

function parseMovieIds (res, config) {
  var responseText = res.text

  if (config.moviesListPageParser) {
    responseText = config.moviesListPageParser(responseText, config)
  }

  var $ = cheerio.load(responseText)
  applySortByDepth($)
  var movieIds = []

  $(config.moviesListSelector).each(function (i, element) {
    var movieNode = config.moviesListIdSelector ? $(element).find(config.moviesListIdSelector) : $(element)
    var movieId = movieNode.attr(config.moviesListIdAttribute)
    if (movieId !== undefined) {
      if (config.moviesListIdParser) {
        movieId = config.moviesListIdParser(movieId)
      }

      movieIds.push(movieId)

      var movieTitleNode = config.moviesListTitleSelector ? $(element).find(config.moviesListTitleSelector) : movieNode
      var movieTitle = config.moviesListTitleAttribute ? movieTitleNode.attr(config.moviesListTitleAttribute) : movieTitleNode.text().trim()
      if (config.movieTitleParser) {
        movieTitle = config.movieTitleParser(movieTitle)
      }
      config._cache.movieTitles[movieId] = movieTitle
    }
  })

  return movieIds
}

module.exports = {
  parseCities: parseCities,
  parseShowtimes: parseShowtimes,
  parseMovieIds: parseMovieIds,
  parseCinemas: parseCinemas,
  parseCinemaDetails: parseCinemaDetails
}
