const _ = require('underscore')

function checkForDuplicatedBookingLinks (data) {
  var warnings = []
  var bookingLinksGrouped = _.chain(data.showtimes)
                             .filter((show) => !!show.booking_link)
                             .countBy((show) => show.booking_link)
                             .value()
  var duplicatedBookingLinks = _.filter(_.keys(bookingLinksGrouped), (key) => bookingLinksGrouped[key] > 1)
  if (duplicatedBookingLinks.length > 0) {
    warnings.push({
      code: 1,
      title: 'duplicated booking links',
      details: {
        bookingLinks: duplicatedBookingLinks
      }
    })
  }
  return warnings
}

function checkIsBookingLinkCapableMarker (data) {
  var hasBookingLink = _.find(data.showtimes, (show) => show.booking_link) !== undefined
  if (data.showtimes.length > 0 && ((data.crawler.is_booking_link_capable && !hasBookingLink) || (!data.crawler.is_booking_link_capable && hasBookingLink))) {
    return [{
      code: 2,
      title: 'crawler.is_booking_link_capable value appearing wrong',
      recoveryHint: 'If you finished all configurations and still see this warning please add the follwing to the top of the config object.' +
        '\n\n  crawler: {is_booking_link_capable: true},'
    }]
  }
  return []
}

exports.validate = function (data) {
  var warnings = []
  warnings = warnings.concat(checkForDuplicatedBookingLinks(data))
  warnings = warnings.concat(checkIsBookingLinkCapableMarker(data))
  return warnings
}
