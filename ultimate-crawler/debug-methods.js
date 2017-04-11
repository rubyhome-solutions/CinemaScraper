
function logFirstItemsOfList (list, limit, logMethod) {
  list.slice(0, limit).forEach((showtime) => logMethod(showtime))
  if (list.length > limit) {
    logMethod(`${list.length - limit} more…`)
  }
}

module.exports = {
  logSelectionCities: require('debug')('selection:cities'),
  logSelectionCinemas: require('debug')('selection:cinemas'),
  logSelectionMovies: require('debug')('selection:movies'),
  logSelectionShowtimes: require('debug')('selection:showtimes'),
  logResultCities: require('debug')('result:cities'),
  logResultCinemas: require('debug')('result:cinemas'),
  logResultMovies: require('debug')('result:movies'),
  logResultShowtimes: require('debug')('result:showtimes'),
  logFirstItemsOfList: logFirstItemsOfList
}
