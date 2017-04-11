const path = require('path')
const helper = require('./helper')
const expect = require('expect')
const jsondiffpatch = require('jsondiffpatch')
const Mocha = require('mocha')
const async = require('async')
const ora = require('ora')

const minuteInMilliSeconds = 60 * 1000

const ucConfigEnhancer = require(path.join(helper.projectRootDir, 'ultimate-crawler/config-enhancer.js'))

const mochaConfig = {
  timeout: 2 * minuteInMilliSeconds,
  reporter: 'spec'
}

function disableConsoleLog () {
  if (console.__log) {
    return
  }
  console.__log = console.log
  console.log = function () { }
  console.__warn = console.warn
  console.warn = function () { }
}

function enableConsoleLog () {
  if (console.__log) {
    console.log = console.__log
    console.__log = undefined
    console.warn = console.__warn
    console.__warn = undefined
  }
}


function runTest (script, mocha, callback) {
  if (script.slice(0, 8) !== 'scripts/') { script = 'scripts/' + script }
  if (script.slice(-3) !== '.js') { script = script + '.js' }

  var crawlerConfigs = helper.loadConfigs(script)
  var crawlerId = crawlerConfigs[0].crawler.id
  var testConfig = require(helper.testConfigPath(crawlerId).replace('.json', ''))
  crawlerConfigs.map((config) => {
    config._testBaseDate = testConfig.testDate
    if (testConfig.beforeTestConfigEnhancer) {
      config = testConfig.beforeTestConfigEnhancer(config)
    }
    return config
  })

  mocha = mocha || new Mocha(mochaConfig)

  var mochaSuiteForScript = Mocha.Suite.create(mocha.suite, script)

  helper.nock.replay(crawlerId)
  disableConsoleLog()

  async.eachOfSeries(crawlerConfigs, (config, index, cb) => {
    // if the script has only one config there is no need to create a sub mocha context aka suite
    var mochaSuite = crawlerConfigs.length === 1 ? mochaSuiteForScript : Mocha.Suite.create(mochaSuiteForScript, `config ${index}`)
    crawlAndBuildTests(config, mochaSuite, cb)
  }, () => {
    // finished crawling for all configs
    if (callback) {
      callback()
    } else {
      enableConsoleLog()
      mocha.run()
    }
  })
}

function crawlAndBuildTests (config, mochaSuite, callback) {
  var checkOutputFileTests = []

  config.modules = config.modules || {}
  config.modules.saveCinemaFile = function (cinemaId, data, config, cb) {
    var outputFilename = ucConfigEnhancer.getCinemaFilePath(cinemaId, config).split('/').reverse()[0]
    checkOutputFileTests.push(new Mocha.Test(`check ${outputFilename}`, function () {
      var savedOutputFilepath = path.join(helper.testOutputFolderPath(config.crawler.id), outputFilename)
      const savedOutput = require(savedOutputFilepath)

      var delta = jsondiffpatch.diff(savedOutput, data)
      if (delta) {
        console.error('JSON did not match:')
        jsondiffpatch.console.log(delta)
      }
      expect(delta).toNotExist()
    }))
    cb()
  }


  var spinner = ora({text: `Running ultimate crawler for ${mochaSuite.fullTitle()}`, spinner: 'arc'}).start()

  helper.ultimateCrawler.crawl(config, (err) => {
    err ? spinner.fail() : spinner.stopAndPersist('✓')
    mochaSuite.addTest(new Mocha.Test('runs without error', function () {
      expect(err).toBeFalsy()
    }))
    checkOutputFileTests.forEach((test) => mochaSuite.addTest(test))
    callback()
  })
}


function runTests (scripts, cb) {
  var mocha = new Mocha(mochaConfig)
  async.eachSeries(scripts, (script, cb) => {
    runTest(script, mocha, cb)
  }, () => {
    enableConsoleLog()
    mocha.run(cb)
  })
}

module.exports = {
  runTest: runTest,
  runTests: runTests
}

