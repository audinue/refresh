
var properties = {
    async: 'async',
    autofocus: 'autofocus',
    autoplay: 'autoplay',
    checked: 'checked',
    compact: 'compact',
    controls: 'controls',
    declare: 'declare',
    defer: 'defer',
    disabled: 'disabled',
    formnovalidate: 'formNoValidate',
    hidden: 'hidden',
    ismap: 'isMap',
    itemscope: 'itemScope',
    loop: 'loop',
    multiple: 'multiple',
    nohref: 'noHref',
    noresize: 'noResize',
    noshade: 'noShade',
    novalidate: 'noValidate',
    nowrap: 'noWrap',
    open: 'open',
    readonly: 'readOnly',
    required: 'required',
    reversed: 'reversed',
    scoped: 'scoped',
    seamless: 'seamless',
    selected: 'selected',
    truespeed: 'trueSpeed',
    value: 'value'
}

function assign (target) {
    for (var i = 1; i < arguments.length; i++) {
        for (var j in arguments[i]) {
            if (arguments[i].hasOwnProperty(j)) {
                target[j] = arguments[i][j]
            }
        }
    }
    return target
}

function compileString (string, scope) {
    return new Function('s__',
        'return function(){' +
            'with(s__){' +
                'return "' +
                    string
                        .replace(/[\t\r\n\\"]/g, function (char) {
                            if (char === '\t') {
                                return '\\t'
                            } else if (char === '\r') {
                                return '\\r'
                            } else if (char === '\n') {
                                return '\\n'
                            } else {
                                return '\\' + char
                            }
                        })
                        .replace(/{([^}]+)}/g, function (_, expression) {
                            return '"+(' +
                                expression
                                    .replace(/\\[trn\\"]/g, function (_, char) {
                                        if (char === 't') {
                                            return '\t'
                                        } else if (char === 'r') {
                                            return '\r'
                                        } else if (char === 'n') {
                                            return '\n'
                                        } else {
                                            return char
                                        }
                                    }) +
                                ')+"'
                        }) +
                '"' +
            '}' +
        '}'
    )(scope)
}

function compileExpression (expression, scope) {
    return new Function('s__',
        'return function(){' +
            'with(s__){' +
                'return ' + expression +
            '}' +
        '}'
    )(scope)
}

function compile (node, scope) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (/{[^}]+}/.test(node.textContent)) {
            var evaluate = compileString(node.textContent, scope)
            return function () {
                node.textContent = evaluate.call(node.parentNode)
            }
        } else {
            return function () {}
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === 'STYLE' || node.nodeName === 'SCRIPT') {
            return function () {}
        }
        var predicate = null
        var placeholder
        if (node.hasAttribute('if')) {
            predicate = compileExpression(node.getAttribute('if'), scope)
            placeholder = document.createTextNode('')
            node.p__ = placeholder
            node.removeAttribute('if')
        }
        var iterable = null
        var template
        var current
        var createScope
        var updateScope
        if (node.hasAttribute('for')) {
            var match = node.getAttribute('for')
                .match(/^\s*(?:([a-z_$][a-z0-9_$]*)(?:\s*,\s*([a-z_$][a-z0-9_$]*))?\s+in\s+)?(.*)\s*$/i)
            iterable = compileExpression(match[3], scope)
            template = []
            while (node.firstChild) {
                template.push(node.removeChild(node.firstChild))
            }
            current = []
            createScope = match[2] === undefined
                ? new Function('a', 's',
                    'return function(v,i){' +
                        'return a({},s,{' + match[1] + ':v})' +
                    '}'
                )(assign, scope)
                : new Function('a', 's',
                    'return function(v,i){' +
                        'return a({},s,{' + match[1] + ':v,' + match[2] + ':i})' +
                    '}'
                )(assign, scope)
            updateScope = new Function('s', 'v', 's.' + match[1] + '=v')
            node.removeAttribute('for')
        }
        var valueSource = null
        if (node.hasAttribute('value-source')) {
            node.u__ = new Function('s__',
                'return function(){' +
                    'with(s__){' +
                        node.getAttribute('value-source') + '=this.value' +
                    '}' +
                '}'
            )(scope)
            valueSource = compileExpression(node.getAttribute('value-source'), scope)
            node.removeAttribute('value-source')
        }
        var checkedSource = null
        if (node.hasAttribute('checked-source')) {
            node.c__ = new Function('s__',
                'return function(){' +
                    'with(s__){' +
                        'var r__=' + node.getAttribute('checked-source') + ';' +
                        'if(typeof r__==="boolean"){' +
                            node.getAttribute('checked-source') + '=this.checked' +
                        '}else{' +
                            'if(this.checked){' +
                                'r__.push(this.value)' +
                            '}else{' +
                                'var i__=r__.indexOf(this.value);' +
                                'if(i__>-1){' +
                                    'r__.splice(i__,1)' +
                                '}' +
                            '}' +
                        '}' +
                    '}' +
                '}'
            )(scope)
            checkedSource = compileExpression(node.getAttribute('checked-source'), scope)
            node.removeAttribute('checked-source')
        }
        var refreshAttributes = [].slice.call(node.attributes)
            .map(function (attribute) {
                var name = attribute.name.replace(/^safe-/, '')
                if (/^on/.test(name)) {
                    node.removeAttributeNode(attribute)
                    node[name] = new Function('s__',
                        'return function(){' +
                            'with(s__){' +
                                attribute.value + ';refresh()' +
                            '}' +
                        '}'
                    )(scope)
                    return function () {}
                }
                if (/{[^}]+}/.test(attribute.value)) {
                    var evaluate = compileString(attribute.value, scope)
                    if (properties.hasOwnProperty(name)) {
                        node.removeAttributeNode(attribute)
                        return new Function('n', 'e',
                            'return function(){' +
                                'n.' + properties[name] + '=e.call(n)' +
                            '}'
                        )(node, evaluate)
                    } else {
                        return function () {
                            attribute.value = evaluate.call(node)
                        }
                    }
                } else {
                    return function () {}
                }
            })
        var refreshChildNodes = [].slice.call(node.childNodes)
            .map(function (childNode) {
                return compile(childNode, scope)
            })
        return function () {
            if (predicate !== null) {
                if (predicate()) {
                    if (node.parentNode === null) {
                        placeholder.parentNode.replaceChild(node, placeholder)
                    }
                } else {
                    if (placeholder.parentNode === null) {
                        node.parentNode.replaceChild(placeholder, node)
                    }
                    return
                }
            }
            if (iterable === null) {
                refreshChildNodes.forEach(function (refreshChildNode) {
                    refreshChildNode()
                })
            } else {
                var next = iterable()
                var currentLength = current.length
                var nextLength = next.length
                var i, j
                if (currentLength < nextLength) {
                    var fragment = document.createDocumentFragment()
                    for (i = currentLength; i < nextLength; i++) {
                        var subScope = createScope(next[i], i)
                        current.push({
                            scope: subScope,
                            items: template
                                .map(function (childNode) {
                                    childNode = childNode.cloneNode(true)
                                    fragment.appendChild(childNode)
                                    return {
                                        node: childNode,
                                        refresh: compile(childNode, subScope)
                                    }
                                })
                        })
                    }
                    node.appendChild(fragment)
                } else if (currentLength > nextLength) {
                    for (i = nextLength; i < currentLength; i++) {
                        var items = current.pop().items
                        for (j = 0; j < items.length; j++) {
                            var removing = items[j].node
                            if (removing.p__ && removing.p__.parentNode === node) {
                                node.removeChild(removing.p__)
                            } else {
                                node.removeChild(removing)
                            }
                        }
                    }
                }
                for (i = 0; i < nextLength; i++) {
                    var item = current[i]
                    updateScope(item.scope, next[i])
                    for (j = 0; j < item.items.length; j++) {
                        item.items[j].refresh()
                    }
                }
            }
            refreshAttributes.forEach(function (refreshAttribute) {
                refreshAttribute()
            })
            if (valueSource !== null) {
                node.value = valueSource()
            }
            if (checkedSource !== null) {
                var result = checkedSource()
                if (typeof result === 'boolean') {
                    node.checked = result
                } else {
                    node.checked = result.indexOf(node.value) > -1
                }
            }
        }
    } else {
        return function () {}
    }
}


document.addEventListener('DOMContentLoaded', function () {
    var refresh = compile(document.body, {})
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
    document.body.addEventListener('input', function (e) {
        if (e.target.u__) {
            e.target.u__()
            refresh()
        }
        if (e.target.c__) {
            e.target.c__()
            refresh()
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
})
