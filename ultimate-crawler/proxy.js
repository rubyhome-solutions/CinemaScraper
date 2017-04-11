const debug = require('debug')('proxy')
const moment = require('moment')
const superagent = require('superagent-charset')
const async = require('async')

const apiKey = '10914f9GFd479d1337bcfb2b5b5178bcbeaf00'

const getRequest = (url) => superagent.get(url)
  .set('X-Api-Key', apiKey)
  .set('Content-Type', 'application/json')
  .buffer(true)

const postRequest = (url) => superagent.post(url)
  .set('X-Api-Key', apiKey)
  .set('Content-Type', 'application/json')
  .buffer(true)

const deleteRequest = (url) => superagent.del(url)
  .set('X-Api-Key', apiKey)

const getProxies = (country, cb) => {
  getRequest('https://proxy-service.internal.cinepass.de/proxies')
    .query({ country: country })
    .end((err, res) => cb(err, JSON.parse(res.text)))
}

const createProxy = (country, cb) => {
  postRequest('https://proxy-service.internal.cinepass.de/proxies')
    .send(JSON.stringify({country: country}))
    .end((err, res) => cb(err, JSON.parse(res.text)))
}

const remove = (id, cb) => {
  if (!id) {
    return cb()
  }

  debug('Deleting proxy...', id)

  deleteRequest(`https://proxy-service.internal.cinepass.de/proxies/${id}`)
    .end(cb)
}

const setup = (config, cb) => {
  const country = config.proxyCountry

  if (!country) {
    return cb(null, config)
  }

  debug('Getting proxies list...')

  async.waterfall([
    cb => getProxies(country, cb),
    (proxies, cb) => {
      debug('Proxies response:', proxies)

      const proxy = proxies.find(proxy =>
        moment(proxy.expires_at)
        .diff(moment().add(60, 'minutes')) > 0
      )

      cb(null, proxy)
    },
    (proxy, cb) => {
      if (proxy) {
        cb(null, proxy)
      } else {
        debug('No proxy found. Creating proxy... ')
        createProxy(country, (err, proxy) => {
          if (proxy) { proxy.isNew = true }
          cb(err, proxy)
        })
      }
    },
    (proxy, cb) => {
      debug('Using proxy:', proxy)
      config.proxyUri = `http://${proxy.username}:${proxy.password}@${proxy.ip_v4}:${proxy.port}`
      config.proxyId = proxy._id || proxy.id
      config.proxyRemoveWhenDone = proxy.isNew === true
      cb(null, config)
    }
  ], cb)
}

module.exports = {
  setup: setup,
  remove: remove
}