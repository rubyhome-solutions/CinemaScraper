const expect = require('expect.js')
const parser = require('./../../ultimate-crawler/response-parser-json')

describe('response-parser-json', function () {
  
  describe('#parseCinemas', function () {

    // example based on reelcinemas.co.uk -> https://api.cinemas-online.com/cinema/getchain/?chain=reel
    var data = '{"466":{"cinema":{"object_id":"466","cinema_name":"Reel Cinemas - Borehamwood","town_city":"84 Shenley Road","county":"Borehamwood","region":"UK","address":"84 Shenley Road, Borehamwood, UK, Central","post_code":"WD6 1EH","phone_no":"020 8207 2028","booking_no":"01509 22 11 55","URL":"http:\/\/www.reelcinemas.co.uk\/","site_code":"01","site_name":"Reel Cinemas - Borehamwood","find_showtimes":"http:\/\/www.jack-roe.co.uk\/stdcgi\/taposcgi\/reebor\/start","lat":"51.65549","lng":"-0.27525","latlon1":"51.65549;-0.27525","latlon2":"51.65549,-0.27525","movietickets":"4"}}}'
    
    function checkLatLonResult (cinema) {
      expect(cinema.latlon).to.be.an('array')
      expect(cinema.latlon[0]).to.be(51.65549)
      expect(cinema.latlon[1]).to.be(-0.27525)
      expect(cinema.lat).to.be(undefined)
      expect(cinema.lon).to.be(undefined)
    }

    it('combines single latitude and longitude fields', function () {
      var config = {
        cinemaBoxSelector: '*',
        cinemaIdSelector: 'cinema.object_id',
        cinemaNameSelector: 'cinema.cinema_name',
        cinemaLatSelector: 'cinema.lat',
        cinemaLonSelector: 'cinema.lng'
      }
      var cinemas = parser.parseCinemas(data, config)
      var cinemasId = Object.keys(cinemas)[0]
      checkLatLonResult(cinemas[cinemasId])
    })

    it('transforms a combined latitude and longitude field (separated by ,)', function () {
      var config = {
        cinemaBoxSelector: '*',
        cinemaIdSelector: 'cinema.object_id',
        cinemaNameSelector: 'cinema.cinema_name',
        cinemaLatlonSelector: 'cinema.latlon1'
      }
      var cinemas = parser.parseCinemas(data, config)
      var cinemasId = Object.keys(cinemas)[0]
      checkLatLonResult(cinemas[cinemasId])
    })

    it('transforms a combined latitude and longitude field (separated by ;)', function () {
      var config = {
        cinemaBoxSelector: '*',
        cinemaIdSelector: 'cinema.object_id',
        cinemaNameSelector: 'cinema.cinema_name',
        cinemaLatlonSelector: 'cinema.latlon2'
      }
      var cinemas = parser.parseCinemas(data, config)
      var cinemasId = Object.keys(cinemas)[0]
      checkLatLonResult(cinemas[cinemasId])
    })
  })
})

