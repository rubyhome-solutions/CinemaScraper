const expect = require('chai').expect
const validate = require('./../../ultimate-crawler/output-validator').validate

describe('output validtor', () => {

  describe('#validate', () => {

    it('finds nothing if all is fine (1)', () => {
      var data = {
        crawler: {
          is_booking_link_capable: true
        },
        showtimes: [
          {
            'movie_title': 'Phantastische Tierwesen und wo sie zu finden sind',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/37029000023RKBWGMB/mode/sale/',
            'start_at': '2016-12-04T12:30:00'
          },
          {
            'movie_title': 'Fifty Shades of Grey - Gefährliche Liebe',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/',
            'start_at': '2017-02-15T19:15:00'
          }
        ]
      }

      expect(validate(data)).to.be.empty
    })

    it('finds nothing if all is fine (2)', () => {
      var data = {
        crawler: {
          is_booking_link_capable: false
        },
        showtimes: [
          {
            'movie_title': 'Pettersson und Findus - Das schönste Weihnachten überhaupt',
            'start_at': '2016-12-07T15:00:00',
            'is_3d': false
          },
          {
            'movie_title': "Bridget Jones' Baby",
            'start_at': '2016-12-06T17:00:00',
            'is_3d': false
          }
        ]
      }

      expect(validate(data)).to.be.empty
    })

    it('finds duplicated booking links', () => {
      var data = {
        crawler: {
          is_booking_link_capable: true
        },
        showtimes: [
          {
            'movie_title': 'Phantastische Tierwesen und wo sie zu finden sind',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/37029000023RKBWGMB/mode/sale/',
            'start_at': '2016-12-04T12:30:00'
          },
          {
            'movie_title': 'Fifty Shades of Grey - Gefährliche Liebe',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/',
            'start_at': '2017-02-15T19:15:00'
          },
          {
            'movie_title': 'Fifty Shades of Grey - Gefährliche Liebe',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/',
            'start_at': '2017-02-16T19:15:00'

          },
          {
            'movie_title': 'Fifty Shades of Grey - Gefährliche Liebe',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/',
            'start_at': '2017-02-17T19:15:00'
          }
        ]
      }

      var warnings = validate(data)
      expect(warnings.length).to.equal(1)
      expect(warnings[0].code).to.equal(1)
      expect(warnings[0].details.bookingLinks.length).to.equal(1)
      expect(warnings[0].details.bookingLinks[0]).to.equal('https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/')
    })

    it('finds wrong `is_booking_link_capable`', () => {
      var data = {
        crawler: {
          is_booking_link_capable: false
        },
        showtimes: [
          {
            'movie_title': 'Phantastische Tierwesen und wo sie zu finden sind',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/37029000023RKBWGMB/mode/sale/',
            'start_at': '2016-12-04T12:30:00'
          },
          {
            'movie_title': 'Fifty Shades of Grey - Gefährliche Liebe',
            'booking_link': 'https://booking.cineplex.de/#/site/11/performance/13029000023RKBWGMB/mode/sale/',
            'start_at': '2017-02-15T19:15:00'
          }
        ]
      }
      var warnings = validate(data)
      expect(warnings.length).to.equal(1)
      expect(warnings[0].code).to.equal(2)
    })
  })
})
