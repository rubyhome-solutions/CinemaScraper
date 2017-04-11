// params = {foo: 'bar'}, template = 'http://site.com/:foo'
// result 'http://site.com/bar'
function evaluate (params, template) {
  if (!template) {
    console.log('params:' + JSON.stringify(params, null, 2))
    throw new Error('missing template')
  }

  var evaluatedTemplate = template

  Object.keys(params).map(function (key) {
    evaluatedTemplate = evaluatedTemplate.replace(new RegExp(':' + key, 'g'), params[key])
  })

  return evaluatedTemplate
}

module.exports = {
  evaluate: evaluate
}
