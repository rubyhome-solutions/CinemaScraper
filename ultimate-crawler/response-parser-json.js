const debug = require('./debug-methods')
const jsonpath = require('jsonpath')
const _ = require('underscore')
const parameterize = require('parameterize')
const templateEvaluator = require('./template-evaluator')
const helpers = require('./response-parser-helpers')
const ConfigError = require('./config-error')



function parseShowtimes (responseText, pageParameters, config) {
  if (responseText.length === 0) {
    return []
  }

  var cinemaId = config.cinemaMappedId
    ? (config.cinemaMappedId[pageParameters.cinemaId] || pageParameters.cinemaId)
    : pageParameters.cinemaId

  if (config.programPageParser) {
    responseText = config.programPageParser(responseText, pageParameters, config)
  }

  var json = JSON.parse(responseText)

  if (config.jsonPreprocess) {
    json = config.jsonPreprocess(json)
  }

  var dateString = pageParameters.date
  var showtimes = []

  if (!config.movieBoxSelector) { throw new ConfigError('missing movieBoxSelector in config') }
  jsonpath.query(json, config.movieBoxSelector).forEach(function (movieBox) {
    var movieTitleAlternatives
    var movieId

    process.env.DEBUG && debug.logSelectionMovies('JSON MATCH OF movieBoxSelector: ', movieBox)
    if (movieBox.constructor === Array) {
      console.error('movieBoxSelector returned an array. \n\n\tTry appending `.*` to the selector')
      throw new ConfigError('movieBoxSelector returned an array')
    }

    if (!config.movieTitleSelector && !(pageParameters.movieId && config._cache.movieTitles[pageParameters.movieId])) {
      throw new ConfigError('missing movieTitleSelector in config')
    }
    var movieTitle = ''
    if (pageParameters.movieId && config._cache.movieTitles[pageParameters.movieId]) {
      movieId = pageParameters.movieId
      movieTitle = config._cache.movieTitles[pageParameters.movieId]
    } else {
      movieTitle = jsonpath.query(movieBox, config.movieTitleSelector)[0]
    }

    process.env.DEBUG && debug.logSelectionMovies('JSON MATCH OF movieTitleSelector: ', movieTitle)
    if (config.movieTitleParser) {
      movieTitle = config.movieTitleParser(movieTitle)
    }
    movieTitle = helpers.cleanMovieTitle(movieTitle)

    if (config.movieIdSelector) {
      movieId = jsonpath.query(movieBox, config.movieIdSelector)[0]
      process.env.DEBUG && debug.logSelectionMovies('JSON MATCH OF movieIdSelector: ', movieId)
    }


    if (config.movieTitleAlternativesSelector) {
      movieTitleAlternatives = jsonpath.query(movieBox, config.movieTitleAlternativesSelector)[0]
      process.env.DEBUG && debug.logSelectionMovies('JSON MATCH OF movieTitleAlternativesSelector: ', movieTitleAlternatives)
    }

    if (movieTitleAlternatives && config.movieTitleAlternativesParser) {
      movieTitleAlternatives = config.movieTitleAlternativesParser(movieTitleAlternatives)
    }

    if (movieTitleAlternatives && movieTitleAlternatives.constructor !== Array) {
      movieTitleAlternatives = [movieTitleAlternatives]
    }

    if (!config.showtimeSelector) { throw new ConfigError('missing showtimeSelector in config') }
    jsonpath.query(movieBox, config.showtimeSelector).forEach(function (showtimeBox) {
      process.env.DEBUG && debug.logSelectionShowtimes('JSON MATCH OF showtimeSelector: ', showtimeBox)
      if (showtimeBox.constructor === Array) {
        console.error('showtimeSelector returned an array. \n\n\tTry appending `.*` to the selector')
        throw new ConfigError('showtimeSelector returned an array')
      }

      if (config.dateAttribute) {
        dateString = jsonpath.query(showtimeBox, config.dateAttribute)[0]
        if (config.dateParser) {
          dateString = config.dateParser(dateString)
        }
      }

      var timeString
      if (config.showtimeAttribute) {
        timeString = jsonpath.query(showtimeBox, config.showtimeAttribute)[0]
      } else {
        timeString = showtimeBox
      }

      if (config.showtimeParser) {
        timeString = config.showtimeParser(timeString)
      }

      var subtitles = config.subtitlesAttribute
        ? helpers.parseSubtitlesText(jsonpath.query(showtimeBox, config.subtitlesAttribute)[0], config)
        : undefined
        
      var language = config.languageAttribute
        ? helpers.parseLanguageText(jsonpath.query(showtimeBox, config.languageAttribute)[0], config)
        : undefined

      var bookingLink = config.bookingDataAttribute ? jsonpath.query(showtimeBox, config.bookingDataAttribute)[0] : undefined
      var bookingId = config.bookingIdAttribute ? jsonpath.query(showtimeBox, config.bookingIdAttribute)[0] : undefined
      if (bookingId && config.bookingIdParser) {
        bookingId = config.bookingIdParser(bookingId)
      }
      var auditorium = config.auditoriumAttribute ? jsonpath.query(showtimeBox, config.auditoriumAttribute)[0] : undefined
      var startAt = helpers.formatStartAt(dateString, timeString, config)

      if (auditorium && config.auditoriumParser) {
        auditorium = config.auditoriumParser(auditorium)
      }

      if (!startAt) {
        return;
      }

      if (config.bookingLinkTemplate) {
        var evaluateParams = {
          bookingId: bookingId,
          cinemaId: cinemaId,
          movieId: movieId,
          date: dateString,
          time: timeString
        }

        if (config.cinemas[cinemaId]) {
          evaluateParams.cinemaSlug = config.cinemas[cinemaId].slug
        }

        if (config.bookingLinkParamsParser) {
          var evaluateParams = config.bookingLinkParamsParser(evaluateParams)
        }

        bookingLink = templateEvaluator.evaluate(evaluateParams, config.bookingLinkTemplate)
      }

      var is3d
      try {
        is3d = jsonpath.query(showtimeBox, config.is3dAttribute)[0]
      } catch (e) {
        is3d = !!movieTitle.match('3D')
      }

      if (auditorium && auditorium.constructor === String) { auditorium = auditorium.trim() }

      var showtime = {
        movie_title: movieTitle,
        movie_title_alternatives: movieTitleAlternatives,
        start_at: startAt,
        booking_link: bookingLink,
        auditorium: auditorium,
        is_3d: is3d,
        subtitles: subtitles,
        language: language
      }

      if (config.showtimeCinemaNameSelector) {
        showtime.cinema_name = jsonpath.query(showtimeBox, config.showtimeCinemaNameSelector)[0]
      }

      helpers.checkShowtime(showtime)

      showtimes.push(showtime)

    })
  })

  process.env.DEBUG && debug.logFirstItemsOfList(showtimes, 5, debug.logResultShowtimes)

  return showtimes
}


function selectCinemaValue (cinemaBox, selectorKey, config) {
  var selectorName = 'cinema' + selectorKey.capitalize() + 'Selector'
  var selector = config[selectorName]
  if (selector) {
    var value = null
    try {
      value = jsonpath.query(cinemaBox, selector)[0]
    } catch (error) {
    }
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF %s:', selectorName, value)
    return value
  }
}

function parseCinemas (responseText, config) {
  if (config.cinemasListPageParser) {
    responseText = config.cinemasListPageParser(responseText, config)
  }

  var json = JSON.parse(responseText)

  var cinemas = {}

  jsonpath.query(json, config.cinemaBoxSelector).forEach(function (cinemaBox) {
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaBoxSelector:', cinemaBox)
    
    if (!config.cinemaNameSelector) { throw new ConfigError('missing cinemaNameSelector in config') }
    var cinemaName = jsonpath.query(cinemaBox, config.cinemaNameSelector)[0]

    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaNameSelector:', cinemaName)
    cinemaName = helpers.parseCinemaValue(cinemaName, 'name', config)

    if (!config.cinemaIdSelector) { throw new ConfigError('missing cinemaIdSelector in config') }
    var cinemaId = jsonpath.query(cinemaBox, config.cinemaIdSelector)[0]
    process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaIdSelector:', cinemaId)

    var cinemaSlug
    if (config.cinemaSlugSelector) {
      cinemaSlug = jsonpath.query(cinemaBox, config.cinemaSlugSelector)[0]
      process.env.DEBUG && debug.logSelectionCinemas('MATCH OF cinemaSlugSelector:', cinemaSlug)
      if (cinemaSlug) {
        cinemaSlug = config.cinemaSlugParser
          ? config.cinemaSlugParser(cinemaSlug)
          : _.uniq(parameterize(cinemaSlug).split('-')).join('-')
      }
    }

    var citySlug
    if (config.cinemaCitySlugSelector) {
      citySlug = jsonpath.query(cinemaBox, config.cinemaCitySlugSelector)[0]
    }


    var isExcluded = config.cinemaIdExcluded 
      ? !!config.cinemaIdExcluded.find(id => cinemaId.match(id))
      : false

    if (cinemaId && !isExcluded) {
      cinemas[cinemaId] = {
        name: cinemaName,
      }
      if (cinemaSlug) {
        cinemas[cinemaId]['slug'] = cinemaSlug
      }
      if (citySlug) {
        cinemas[cinemaId]['citySlug'] = citySlug
      }

      var formatted_address = selectCinemaValue(cinemaBox, 'address', config)
      if (formatted_address) {
        cinemas[cinemaId].formatted_address = helpers.parseCinemaValue(formatted_address, 'address', config)
      }
      var keys = ['website', 'telephone', 'zipcode', 'latlon', 'lat', 'lon']
      keys.forEach(key => {
        var value = selectCinemaValue(cinemaBox, key, config)
        if (value) {
          cinemas[cinemaId][key] = helpers.parseCinemaValue(value, key, config)
        }
      })

      if (!cinemas[cinemaId].latlon && cinemas[cinemaId].lat && cinemas[cinemaId].lon) {
        cinemas[cinemaId].latlon = [cinemas[cinemaId].lat, cinemas[cinemaId].lon].map(l => Number(l))
        delete cinemas[cinemaId].lat
        delete cinemas[cinemaId].lon
      } else if (cinemas[cinemaId].latlon && cinemas[cinemaId].latlon.constructor === String) {
        cinemas[cinemaId].latlon = cinemas[cinemaId].latlon.split(/;|,/).map(l => Number(l))
      }

      cinemas[cinemaId] = Object.assign({id: cinemaId}, cinemas[cinemaId])
    }
  })
  return cinemas
}

function parseMovieIds (res, config) {
  var responseText = res.text

  if (config.moviesListPageParser) {
    responseText = config.moviesListPageParser(responseText, config)
  }

  var json = JSON.parse(responseText)
  var movieIds = []

  jsonpath.query(json, config.moviesListSelector).forEach(function (movieBox) {
    var movieId = jsonpath.query(movieBox, config.moviesListIdSelector)[0]
    if (movieId !== undefined) {
      if (config.moviesListIdParser) {
        movieId = config.moviesListIdParser(movieId)
      }

      movieIds.push(movieId)

      if (config.moviesListTitleSelector) {
        var movieTitle = jsonpath.query(movieBox, config.moviesListTitleSelector)[0].trim()
        if (config.movieTitleParser) {
          movieTitle = config.movieTitleParser(movieTitle)
        }
        config._cache.movieTitles[movieId] = movieTitle
      }
    }
  })

  return movieIds
}

function parseCinemaDetails (responseText, cinemaId, config) {

  if (config.cinemaDetailsPageParser) {
    responseText = config.cinemaDetailsPageParser(responseText, config)
  }

  var json = JSON.parse(responseText)

  var formatted_address = selectCinemaValue(json, 'address', config)
  if (formatted_address && !config.cinemas[cinemaId].formatted_address) {
    config.cinemas[cinemaId].formatted_address = helpers.parseCinemaValue(formatted_address, 'address', config)
  }

  var keys = ['name', 'website', 'telephone', 'zipcode', 'latlon', 'lat', 'lon']
  keys.forEach(key => {
    var value = selectCinemaValue(json, key, config)
    if (value && !config.cinemas[cinemaId][key]) {
      config.cinemas[cinemaId][key] = helpers.parseCinemaValue(value, key, config)
    }
  })
}



module.exports = {
  parseShowtimes: parseShowtimes,
  parseMovieIds: parseMovieIds,
  parseCinemas: parseCinemas,
  parseCinemaDetails: parseCinemaDetails
}
