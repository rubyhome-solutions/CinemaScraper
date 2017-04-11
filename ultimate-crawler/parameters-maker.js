var async = require('async')
var moment = require('moment')
var _ = require('underscore')
var utils = require('../utils')
var requestsMaker = require('./requests-maker')

function cartProd (arrays) {
  return _.reduce(arrays, function (a, b) {
    return _.flatten(_.map(a, function (x) {
      return _.map(b, function (y) {
        return x.concat([y])
      })
    }), true)
  }, [ [] ])
}

function getDates (cinemaId, config, cb) {
  var startDate = config._testBaseDate || undefined
  var startDateBeginningOfDay = moment(startDate).startOf('day')

  var dates = utils.daysList(config.requestDaysCount || 7, startDate).map(function (day) {
    if (config.urlDateFormat === 'c') {
      return day.startOf('day').diff(startDateBeginningOfDay, 'days')
    } else {
      return day.format(config.urlDateFormat || 'YYYY-MM-DD')
    }
  })

  cb(null, dates)
}

function getCinemaParams(cinemaId, config) {
  var params = {
    cinemaId: cinemaId
  }
  if (config.cinemas) {
    if (config.cinemas[cinemaId].website) params['cinemaUrl'] = config.cinemas[cinemaId].website
    if (config.cinemas[cinemaId].cinemaMappedId) params['cinemaMappedId'] = config.cinemas[cinemaId].cinemaMappedId
    if (config.cinemas[cinemaId].slug) params['cinemaSlug'] = config.cinemas[cinemaId].slug
    if (config.cinemas[cinemaId].citySlug) params['citySlug'] = config.cinemas[cinemaId].citySlug
  }
  return params
}

function pages (cinemaOrPageId, config, cb) {
  var urlTemplate = config.urlTemplate || config.cinemas[cinemaOrPageId].program

  var isDateParameter = !!(urlTemplate && urlTemplate.match(':date')) || !!(config.postParamsTemplate && config.postParamsTemplate.match(':date'))
  var isMovieIdParameter = !!(urlTemplate && urlTemplate.match(':movieId')) || !!(config.postParamsTemplate && config.postParamsTemplate.match(':movieId'))
  var isWeekIdParameter = !!(urlTemplate && urlTemplate.match(':weekId')) || !!(config.postParamsTemplate && config.postParamsTemplate.match(':weekId'))
  var cinemaUrl = config.cinemas ? config.cinemas[cinemaOrPageId].website : undefined
  var cinemaMappedId = config.cinemaMappedId ? (config.cinemaMappedId[cinemaOrPageId] || cinemaOrPageId) : undefined
  var citySlug = config.cinemas ? config.cinemas[cinemaOrPageId].citySlug : undefined

  if (!cinemaMappedId) {
    cinemaMappedId = config.cinemas ? config.cinemas[cinemaOrPageId].cinemaMappedId : undefined
  }

  async.waterfall([
    function (cb) {
      isMovieIdParameter
        ? requestsMaker.getMovieIds(getCinemaParams(cinemaOrPageId, config), config, function (err, movieIds) { cb(err, {movieIds: movieIds}) })
        : cb(null, {movieIds: []})
    },
    function (data, cb) {
      isDateParameter
        ? getDates(cinemaOrPageId, config, function (err, dates) { cb(err, Object.assign({}, data, {dates: dates})) })
        : cb(null, Object.assign({}, data, {dates: []}))
    },
    function (data, cb) {
      cb(null, Object.assign({}, data, {
        weekIds: isWeekIdParameter ? config.weekIds : []
      }))
      
    }
  ],
    function (err, data) {
      var paramsList = cartProd(_.compact([
        [(config.hasMultiCinemaPages ? undefined : cinemaOrPageId)],
        [(config.hasMultiCinemaPages ? cinemaOrPageId : undefined)],
        [cinemaUrl],
        [cinemaMappedId],
        [citySlug],
        data.movieIds.length > 0 && data.movieIds,
        data.dates.length > 0 && data.dates,
        data.weekIds.length > 0 && data.weekIds
      ])
      )

      var pagesParameters = paramsList.map(function (params) {
        return _.object(_.compact([
          'cinemaId',
          'cinemaPageId',
          'cinemaUrl',
          'cinemaMappedId',
          'citySlug',
          data.movieIds.length > 0 && 'movieId',
          data.dates.length > 0 && 'date',
          data.weekIds.length > 0 && 'weekId'
        ]), params)
      })

      cb(err, pagesParameters)
    })
}

module.exports = {
  getCinemaParams: getCinemaParams,
  pages: pages
}
