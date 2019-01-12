
var properties = toMap(['async', 'autofocus', 'autoplay', 'checked', 'compact', 'controls', 'declare', 'defer', 'disabled', 'formNoValidate', 'hidden', 'isMap', 'itemScope', 'loop', 'multiple', 'noHref', 'noResize', 'noShade', 'noValidate', 'noWrap', 'open', 'readOnly', 'required', 'reversed', 'scoped', 'seamless', 'selected', 'trueSpeed', 'value'])

;(document.readyState !== 'loading' ? initialize : addEventListener)()

function toMap (array) {
  var map = {}
  array.forEach(function (value) {
    map[value.toLowerCase()] = value
  })
  return map
}

function addEventListener () {
  document.addEventListener('DOMContentLoaded', domContentLoaded)
}

function domContentLoaded () {
  document.removeEventListener('DOMContentLoaded', domContentLoaded)
  initialize()
}

function initialize () {
  document.body.addEventListener('input', function (e) {
    var target = e.target
    if (target.u_) {
      target.u_()
    }
  })
  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j]
        var autofocus
        if (node.nodeType === Node.ELEMENT_NODE &&
            (autofocus = node.matches('[autofocus]')
              ? node
              : node.querySelector('[autofocus]'))) {
          autofocus.focus()
        }
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  })
  var refresh = compileNode(document.body, {})(document.body, {})
  var timeout
  window.refresh = function () {
    if (timeout === undefined) {
      timeout = setTimeout(function () {
        timeout = undefined
        refresh()
      }, 16.67)
    }
  }
  refresh()
}

function compileNode (node, templates) {
  return (
    node.nodeType === window.Node.TEXT_NODE
      ? compileText
      : node.nodeType === window.Node.ELEMENT_NODE
        ? compileElement
        : compileNothing
  )(node, templates)
}

function compileText (node) {
  return (
    isInterpolated(node.textContent)
      ? compileInterpolatedText
      : compileNothing
  )(node)
}

function compileInterpolatedText (node) {
  var bindInterpolated = compileInterpolated(node.textContent)
  return function bind (node, scope) {
    var updateInterpolated = bindInterpolated(node.parentNode, scope)
    return function update () {
      node.textContent = updateInterpolated()
    }
  }
}

function compileElement (node, templates) {
  return (
    node.localName === 'style' || node.localName === 'string'
      ? compileNothing
      : node.hasAttribute('template') && node.getAttribute('template') !== ''
        ? compileTemplate
        : node.hasAttribute('if')
          ? compileIf
          : compileContent
  )(node, templates)
}

function compileTemplate (node, templates) {
  var template = parseTemplate(node.getAttribute('template'))
  node.setAttribute('template', '')
  node.parentNode.replaceChild(document.createTextNode(''), node)
  templates[template.name] = template
  template.node = node
  template.bind = compileNode(node, templates)
  return bindNothing
}

function compileIf (node, templates) {
  var bindExpression = compileExpression(node.getAttribute('if'))
  var bindContent = compileContent(node, templates)
  return function bind (node, scope) {
    var updateExpression = bindExpression(node, scope)
    var updateContent = bindContent(node, scope)
    var placeholder = document.createTextNode('')
    node.p_ = placeholder
    return function update () {
      var content = node.i_ || node
      if (updateExpression()) {
        if (content.parentNode === null) {
          placeholder.parentNode.replaceChild(content, placeholder)
        }
        updateContent()
      } else {
        if (placeholder.parentNode === null) {
          content.parentNode.replaceChild(placeholder, content)
        }
      }
    }
  }
}

function compileApply (node, templates) {
  var apply = parseTemplate(node.getAttribute('apply'))
  var template = templates[apply.name]
  var createSubScope = compileCreateSubScope(template, apply)
  var bindUpdateSubScope = compileUpdateSubScope(template, apply)
  return function bind (node, scope) {
    var updateSubScope = null
    var updateInstance = null
    return function () {
      if (updateInstance !== null) {
        updateSubScope()
        updateInstance()
      } else {
        var instance = template.node.cloneNode(true)
        node.parentNode.replaceChild(instance, node)
        var subScope = createSubScope.call(instance, scope)
        node.i_ = instance
        updateSubScope = bindUpdateSubScope(instance, scope, subScope)
        updateInstance = template.bind(instance, subScope)
        updateInstance()
      }
    }
  }
}

function compileCreateSubScope (template, apply) {
  var map = template.parameters.map(function (key, i) {
    return key + ':' + apply.parameters[i]
  })
  return new Function('s_',
    'with(s_){' +
      'return Object.assign({},s_,{' + map + '})' +
    '}'
  )
}

function compileUpdateSubScope (template, apply) {
  var map = template.parameters.map(function (key, i) {
    return key + ':' + apply.parameters[i]
  })
  return new Function('n_', 's_', 'b_',
    'var u_=function(){' +
      'with(s_){' +
        'Object.assign(b_,s_,{' + map + '})' +
      '}' +
    '};' +
    'return function(){' +
      'u_.call(n_)' +
    '}'
  )
}

function parseTemplate (string) {
  var match = string.match(/^\s*([a-z_$][a-z0-9_$]*)\s*\(\s*([\s\S]*?)\s*\)\s*$/i)
  if (match === null) {
    throw new Error('Invalid template expression "' + string + '"')
  }
  return {
    name: match[1],
    parameters: match[2] === ''
      ? []
      : match[2].split(/\s*,\s*/)
  }
}

function compileContent (node, templates) {
  return (
    node.hasAttribute('apply')
      ? compileApply
      : node.hasAttribute('html')
        ? compileHtml
        : node.hasAttribute('for')
          ? compileFor
          : compileRegular
  )(node, templates)
}

function compileHtml (node) {
  var bindAttributes = compileAttributes(node)
  var bindExpression = compileExpression(node.getAttribute('html'))
  return function bind (node, scope) {
    var updateAttributes = bindAttributes(node, scope)
    var updateExpression = bindExpression(node, scope)
    return function update () {
      updateAttributes()
      node.innerHTML = updateExpression()
    }
  }
}

function compileFor (node, templates) {
  var info = parseFor(node.getAttribute('for'))
  var bindExpression = compileExpression(info.expression)
  var bindCreateEntryScope = compileCreateEntryScope(info)
  var updateEntryScope = compileUpdateEntryScope(info)
  var bindAttributes = compileAttributes(node)
  var childNodes = []
  while (node.firstChild) {
    childNodes.push(node.removeChild(node.firstChild))
  }
  var bindChildNodes = childNodes.map(function (childNode) {
    return compileNode(childNode, templates)
  })
  return function bind (node, scope) {
    var updateAttributes = bindAttributes(node, scope)
    var updateExpression = bindExpression(node, scope)
    var createEntryScope = bindCreateEntryScope(scope)
    var previous = []
    return function update () {
      updateAttributes()
      var previousLength = previous.length
      var next = updateExpression()
      var nextLength = next.length
      if (previousLength < nextLength) {
        var fragment = document.createDocumentFragment()
        next.slice(previousLength)
          .forEach(function (value, i) {
            var scope = createEntryScope(value, previousLength + i)
            var updates = []
            var nodes = childNodes.map(function (childNode, i) {
              var node = childNode.cloneNode(true)
              fragment.appendChild(node)
              updates.push(bindChildNodes[i](node, scope))
              return node
            })
            previous.push({
              scope: scope,
              nodes: nodes,
              updates: updates
            })
          })
        node.appendChild(fragment)
      } else if (previousLength > nextLength) {
        previous.splice(nextLength)
          .forEach(function (entry) {
            entry.nodes.forEach(function (n) {
              node.removeChild(
                n.p_ && n.p_.parentNode !== null
                  ? n.p_
                  : n.i_ || n
              )
            })
          })
      }
      previous.forEach(function (entry, i) {
        updateEntryScope(entry.scope, next[i])
        entry.updates.forEach(execute)
      })
    }
  }
}

function compileCreateEntryScope (info) {
  return new Function('s',
    'return function(v,i){' +
      'return Object.assign({},s,{' +
        info.value + ':v' +
        (info.index !== undefined ? ',' + info.index + ':i' : '') +
      '})' +
    '}'
  )
}

function compileUpdateEntryScope (info) {
  return new Function('s', 'v', 's.' + info.value + '=v')
}

function parseFor (string) {
  var match = string.match(/^\s*(?:([a-z_$][a-z0-9_$]*)(?:\s*,\s*([a-z_$][a-z0-9_$]*))?\s+in\s+)?(.*)\s*$/i)
  if (match === null) {
    throw new Error('Invalid for expression "' + string + '"')
  }
  return {
    value: match[1],
    index: match[2],
    expression: match[3]
  }
}

function compileRegular (node, templates) {
  var bindAttributes = compileAttributes(node)
  var bindChildNodes = compileChildNodes(node, templates)
  return function bind (node, scope) {
    var updateAttributes = bindAttributes(node, scope)
    var updateChildNodes = bindChildNodes(node, scope)
    return function update () {
      updateAttributes()
      updateChildNodes()
    }
  }
}

function compileAttributes (node) {
  var bindAttributes = Array.from(node.attributes).map(compileAttribute)
  return function bind (node, scope) {
    var updateAttributes = bindAttributes.map(function (bindAttribute, i) {
      return bindAttribute(node.attributes[i], scope)
    })
    return function update () {
      updateAttributes.forEach(execute)
    }
  }
}

function compileAttribute (attribute) {
  var name = normalize(attribute.name)
  return (
    name === 'value-source'
      ? compileValueSource
      : name === 'checked-source'
        ? compileCheckedSource
        : /^on/.test(name)
          ? compileEvent
          : isInterpolated(attribute.value)
            ? compileMaybeAttribute
            : compileNothing
  )(attribute)
}

function compileValueSource (attribute) {
  var bindExpression = compileExpression(attribute.value)
  var bindUpdateValueSource = compileUpdateValueSource(attribute.value)
  return function bind (node, scope) {
    var element = node.ownerElement
    element.u_ = bindUpdateValueSource(scope)
    var updateExpression = bindExpression(element, scope)
    return function () {
      element.value = updateExpression()
    }
  }
}

function compileUpdateValueSource (expression) {
  return new Function('s_',
    'return function(){' +
      'with(s_){' +
        expression + '=this.value;' +
        'refresh()' +
      '}' +
    '}'
  )
}

function compileCheckedSource (attribute) {
  var bindExpression = compileExpression(attribute.value)
  var bindUpdateCheckedSource = compileUpdateCheckedSource(attribute.value)
  return function bind (node, scope) {
    var element = node.ownerElement
    element.u_ = bindUpdateCheckedSource(scope)
    var updateExpression = bindExpression(element, scope)
    return function () {
      var next = updateExpression()
      if (typeof next === 'boolean') {
        element.checked = next
      } else if (Array.isArray(next)) {
        element.checked = next.indexOf(element.value) > -1
      } else {
        element.checked = element.value === next
      }
    }
  }
}

function compileUpdateCheckedSource (expression) {
  return new Function('s_',
    'return function(){' +
      'with(s_){' +
        'var n_=' + expression + ';' +
        'if(typeof n_==="boolean"){' +
          expression + '=this.checked' +
        '}else if(Array.isArray(n_)){' +
          'if(this.checked){' +
            expression + '.push(this.value)' +
          '}else{' +
            'var i_=' + expression + '.indexOf(this.value);' +
            expression + '.splice(i_,1)' +
          '}' +
        '}else{' +
          expression + '=this.value' +
        '}' +
        'refresh()' +
      '}' +
    '}'
  )
}

function normalize (name) {
  return name.replace(/^safe-/, '')
}

function compileEvent (attribute) {
  var name = normalize(attribute.name)
  var bindListener = compileListener(attribute.value)
  attribute.value = ''
  return function bind (node, scope) {
    node.ownerElement[name] = bindListener(scope)
    return updateNothing
  }
}

function compileListener (code) {
  return new Function('s_',
    'return function(){' +
      'with(s_){' +
        code + ';' +
        'refresh()' +
      '}' +
    '}'
  )
}

function compileMaybeAttribute (attribute) {
  return (
    properties.hasOwnProperty(normalize(attribute.name))
      ? compileProperty
      : compileInterpolatedAttribute
  )(attribute)
}

function compileProperty (attribute) {
  var property = properties[normalize(attribute.name)]
  var bindInterpolated = compileInterpolated(attribute.value)
  return function bind (node, scope) {
    var element = node.ownerElement
    var updateInterpolated = bindInterpolated(element, scope)
    return function update () {
      element[property] = updateInterpolated()
    }
  }
}

function compileInterpolatedAttribute (attribute) {
  var bindInterpolated = compileInterpolated(attribute.value)
  return function bind (node, scope) {
    var updateInterpolated = bindInterpolated(node.ownerElement, scope)
    return function update () {
      node.value = updateInterpolated()
    }
  }
}

function compileChildNodes (node, templates) {
  var bindChildNodes = Array.from(node.childNodes).map(function (childNode) {
    return compileNode(childNode, templates)
  })
  return function bind (node, scope) {
    var updateChildNodes = bindChildNodes.map(function (bindChildNode, i) {
      return bindChildNode(node.childNodes[i], scope)
    })
    return function update () {
      updateChildNodes.forEach(execute)
    }
  }
}

function compileNothing () {
  return bindNothing
}

function bindNothing () {
  return updateNothing
}

function updateNothing () {
}

function isInterpolated (string) {
  return /{[^}]+}/.test(string)
}

function compileInterpolated (string) {
  return compileExpression(
    /^{[^}]+}$/.test(string)
      ? string.match(/{([^}]+)}/)[1]
      : '"' + replaceTags(string) + '"'
  )
}

function replaceTags (string) {
  return quote(string).replace(/{([^}]+)}/g, tag)
}

function tag (_, expression) {
  return '"+(' + unquote(expression) + ')+"'
}

function quote (string) {
  return string.replace(/[\t\r\n\\"]/g, quoted)
}

function quoted (char) {
  return char === '\t'
    ? '\\t'
    : char === '\r'
      ? '\\r'
      : char === '\n'
        ? '\\n'
        : '\\' + char
}

function unquote (string) {
  return string.replace(/\\[trn\\"]/g, unquoted)
}

function unquoted (_, char) {
  return char === 't'
    ? '\t'
    : char === 'r'
      ? '\r'
      : char === 'n'
        ? '\n'
        : char
}

function compileExpression (expression) {
  return new Function('n_', 's_',
    'var u_=function(){' +
      'with(s_){' +
        'return ' + expression +
      '}' +
    '};' +
    'return function(){' +
      'return u_.call(n_)' +
    '}'
  )
}

function execute (action) {
  action()
}
