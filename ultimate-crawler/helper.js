/*
 * Checks if the given selector is addressing an html `a` tag.
 */
function isLinkTagSelector (selector) {
  if (!selector) {
    return false
  }
  return selector.split(' ').reverse()[0].split('.')[0].split(':')[0] === 'a'
}

module.exports = {
  isLinkTagSelector: isLinkTagSelector
}




