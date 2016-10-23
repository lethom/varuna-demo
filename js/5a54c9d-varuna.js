(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":1}],3:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],4:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":8}],5:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":25}],6:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":11}],7:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":16,"is-object":3}],8:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":14,"../vnode/is-vnode.js":17,"../vnode/is-vtext.js":18,"../vnode/is-widget.js":19,"./apply-properties":7,"global/document":2}],9:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],10:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":19,"../vnode/vpatch.js":22,"./apply-properties":7,"./update-widget":12}],11:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":8,"./dom-index":9,"./patch-op":10,"global/document":2,"x-is-array":26}],12:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":19}],13:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],14:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":15,"./is-vnode":17,"./is-vtext":18,"./is-widget":19}],15:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],16:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],17:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":20}],18:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":20}],19:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],20:[function(require,module,exports){
module.exports = "2"

},{}],21:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":15,"./is-vhook":16,"./is-vnode":17,"./is-widget":19,"./version":20}],22:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":20}],23:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":20}],24:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":16,"is-object":3}],25:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":14,"../vnode/is-thunk":15,"../vnode/is-vnode":17,"../vnode/is-vtext":18,"../vnode/is-widget":19,"../vnode/vpatch":22,"./diff-props":24,"x-is-array":26}],26:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],27:[function(require,module,exports){
// Generated by psc-bundle 0.9.3
var PS = {};
(function(exports) {
    "use strict";

  // module Data.Functor

  exports.arrayMap = function (f) {
    return function (arr) {
      var l = arr.length;
      var result = new Array(l);
      for (var i = 0; i < l; i++) {
        result[i] = f(arr[i]);
      }
      return result;
    };
  };
})(PS["Data.Functor"] = PS["Data.Functor"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Semigroupoid = function (compose) {
      this.compose = compose;
  };
  var semigroupoidFn = new Semigroupoid(function (f) {
      return function (g) {
          return function (x) {
              return f(g(x));
          };
      };
  });
  var compose = function (dict) {
      return dict.compose;
  };
  exports["Semigroupoid"] = Semigroupoid;
  exports["compose"] = compose;
  exports["semigroupoidFn"] = semigroupoidFn;
})(PS["Control.Semigroupoid"] = PS["Control.Semigroupoid"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var Category = function (__superclass_Control$dotSemigroupoid$dotSemigroupoid_0, id) {
      this["__superclass_Control.Semigroupoid.Semigroupoid_0"] = __superclass_Control$dotSemigroupoid$dotSemigroupoid_0;
      this.id = id;
  };
  var id = function (dict) {
      return dict.id;
  };
  var categoryFn = new Category(function () {
      return Control_Semigroupoid.semigroupoidFn;
  }, function (x) {
      return x;
  });
  exports["Category"] = Category;
  exports["id"] = id;
  exports["categoryFn"] = categoryFn;
})(PS["Control.Category"] = PS["Control.Category"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];
  var flip = function (f) {
      return function (b) {
          return function (a) {
              return f(a)(b);
          };
      };
  };
  var $$const = function (a) {
      return function (v) {
          return a;
      };
  };
  var apply = function (f) {
      return function (x) {
          return f(x);
      };
  };
  exports["apply"] = apply;
  exports["const"] = $$const;
  exports["flip"] = flip;
})(PS["Data.Function"] = PS["Data.Function"] || {});
(function(exports) {
    "use strict";

  // module Data.Unit

  exports.unit = {};
})(PS["Data.Unit"] = PS["Data.Unit"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Show"];     
  var Show = function (show) {
      this.show = show;
  }; 
  var show = function (dict) {
      return dict.show;
  };
  exports["Show"] = Show;
  exports["show"] = show;
})(PS["Data.Show"] = PS["Data.Show"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Unit"];
  var Data_Show = PS["Data.Show"];
  exports["unit"] = $foreign.unit;
})(PS["Data.Unit"] = PS["Data.Unit"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var Functor = function (map) {
      this.map = map;
  };
  var map = function (dict) {
      return dict.map;
  };
  var $$void = function (dictFunctor) {
      return map(dictFunctor)(Data_Function["const"](Data_Unit.unit));
  };
  var voidLeft = function (dictFunctor) {
      return function (f) {
          return function (x) {
              return map(dictFunctor)(Data_Function["const"](x))(f);
          };
      };
  };
  var voidRight = function (dictFunctor) {
      return function (x) {
          return map(dictFunctor)(Data_Function["const"](x));
      };
  };
  var functorFn = new Functor(Control_Semigroupoid.compose(Control_Semigroupoid.semigroupoidFn));
  var functorArray = new Functor($foreign.arrayMap);
  exports["Functor"] = Functor;
  exports["map"] = map;
  exports["void"] = $$void;
  exports["voidLeft"] = voidLeft;
  exports["voidRight"] = voidRight;
  exports["functorFn"] = functorFn;
  exports["functorArray"] = functorArray;
})(PS["Data.Functor"] = PS["Data.Functor"] || {});
(function(exports) {
    "use strict";

  exports.concatArray = function (xs) {
    return function (ys) {
      return xs.concat(ys);
    };
  };
})(PS["Data.Semigroup"] = PS["Data.Semigroup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];        
  var Semigroup = function (append) {
      this.append = append;
  };                                                         
  var semigroupArray = new Semigroup($foreign.concatArray);
  var append = function (dict) {
      return dict.append;
  };
  exports["Semigroup"] = Semigroup;
  exports["append"] = append;
  exports["semigroupArray"] = semigroupArray;
})(PS["Data.Semigroup"] = PS["Data.Semigroup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Functor = PS["Data.Functor"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var Alt = function (__superclass_Data$dotFunctor$dotFunctor_0, alt) {
      this["__superclass_Data.Functor.Functor_0"] = __superclass_Data$dotFunctor$dotFunctor_0;
      this.alt = alt;
  };                                                       
  var alt = function (dict) {
      return dict.alt;
  };
  exports["Alt"] = Alt;
  exports["alt"] = alt;
})(PS["Control.Alt"] = PS["Control.Alt"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];        
  var Apply = function (__superclass_Data$dotFunctor$dotFunctor_0, apply) {
      this["__superclass_Data.Functor.Functor_0"] = __superclass_Data$dotFunctor$dotFunctor_0;
      this.apply = apply;
  };
  var applyFn = new Apply(function () {
      return Data_Functor.functorFn;
  }, function (f) {
      return function (g) {
          return function (x) {
              return f(x)(g(x));
          };
      };
  });                     
  var apply = function (dict) {
      return dict.apply;
  };
  var applyFirst = function (dictApply) {
      return function (a) {
          return function (b) {
              return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(Data_Function["const"])(a))(b);
          };
      };
  };
  var applySecond = function (dictApply) {
      return function (a) {
          return function (b) {
              return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(Data_Function["const"](Control_Category.id(Control_Category.categoryFn)))(a))(b);
          };
      };
  };
  var lift2 = function (dictApply) {
      return function (f) {
          return function (a) {
              return function (b) {
                  return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(f)(a))(b);
              };
          };
      };
  };
  exports["Apply"] = Apply;
  exports["apply"] = apply;
  exports["applyFirst"] = applyFirst;
  exports["applySecond"] = applySecond;
  exports["lift2"] = lift2;
  exports["applyFn"] = applyFn;
})(PS["Control.Apply"] = PS["Control.Apply"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var Applicative = function (__superclass_Control$dotApply$dotApply_0, pure) {
      this["__superclass_Control.Apply.Apply_0"] = __superclass_Control$dotApply$dotApply_0;
      this.pure = pure;
  };
  var pure = function (dict) {
      return dict.pure;
  };
  var when = function (dictApplicative) {
      return function (v) {
          return function (v1) {
              if (v) {
                  return v1;
              };
              if (!v) {
                  return pure(dictApplicative)(Data_Unit.unit);
              };
              throw new Error("Failed pattern match at Control.Applicative line 58, column 1 - line 58, column 16: " + [ v.constructor.name, v1.constructor.name ]);
          };
      };
  };
  var liftA1 = function (dictApplicative) {
      return function (f) {
          return function (a) {
              return Control_Apply.apply(dictApplicative["__superclass_Control.Apply.Apply_0"]())(pure(dictApplicative)(f))(a);
          };
      };
  };
  var applicativeFn = new Applicative(function () {
      return Control_Apply.applyFn;
  }, function (x) {
      return function (v) {
          return x;
      };
  });
  exports["Applicative"] = Applicative;
  exports["liftA1"] = liftA1;
  exports["pure"] = pure;
  exports["when"] = when;
  exports["applicativeFn"] = applicativeFn;
})(PS["Control.Applicative"] = PS["Control.Applicative"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Data_Functor = PS["Data.Functor"];        
  var Plus = function (__superclass_Control$dotAlt$dotAlt_0, empty) {
      this["__superclass_Control.Alt.Alt_0"] = __superclass_Control$dotAlt$dotAlt_0;
      this.empty = empty;
  };       
  var empty = function (dict) {
      return dict.empty;
  };
  exports["Plus"] = Plus;
  exports["empty"] = empty;
})(PS["Control.Plus"] = PS["Control.Plus"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor = PS["Data.Functor"];        
  var Alternative = function (__superclass_Control$dotApplicative$dotApplicative_0, __superclass_Control$dotPlus$dotPlus_1) {
      this["__superclass_Control.Applicative.Applicative_0"] = __superclass_Control$dotApplicative$dotApplicative_0;
      this["__superclass_Control.Plus.Plus_1"] = __superclass_Control$dotPlus$dotPlus_1;
  };
  exports["Alternative"] = Alternative;
})(PS["Control.Alternative"] = PS["Control.Alternative"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Category = PS["Control.Category"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];        
  var Bind = function (__superclass_Control$dotApply$dotApply_0, bind) {
      this["__superclass_Control.Apply.Apply_0"] = __superclass_Control$dotApply$dotApply_0;
      this.bind = bind;
  };                     
  var bind = function (dict) {
      return dict.bind;
  };
  var bindFlipped = function (dictBind) {
      return Data_Function.flip(bind(dictBind));
  };
  var composeKleisliFlipped = function (dictBind) {
      return function (f) {
          return function (g) {
              return function (a) {
                  return bindFlipped(dictBind)(f)(g(a));
              };
          };
      };
  };
  exports["Bind"] = Bind;
  exports["bind"] = bind;
  exports["bindFlipped"] = bindFlipped;
  exports["composeKleisliFlipped"] = composeKleisliFlipped;
})(PS["Control.Bind"] = PS["Control.Bind"] || {});
(function(exports) {
    "use strict";

  // module Unsafe.Coerce

  exports.unsafeCoerce = function (x) {
    return x;
  };
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Unsafe.Coerce"];
  exports["unsafeCoerce"] = $foreign.unsafeCoerce;
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Unsafe_Coerce = PS["Unsafe.Coerce"];        
  var runExists = Unsafe_Coerce.unsafeCoerce;
  var mkExists = Unsafe_Coerce.unsafeCoerce;
  exports["mkExists"] = mkExists;
  exports["runExists"] = runExists;
})(PS["Data.Exists"] = PS["Data.Exists"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Functor = PS["Data.Functor"];        
  var Monad = function (__superclass_Control$dotApplicative$dotApplicative_0, __superclass_Control$dotBind$dotBind_1) {
      this["__superclass_Control.Applicative.Applicative_0"] = __superclass_Control$dotApplicative$dotApplicative_0;
      this["__superclass_Control.Bind.Bind_1"] = __superclass_Control$dotBind$dotBind_1;
  };
  var ap = function (dictMonad) {
      return function (f) {
          return function (a) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(f)(function (v) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(a)(function (v1) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v(v1));
                  });
              });
          };
      };
  };
  exports["Monad"] = Monad;
  exports["ap"] = ap;
})(PS["Control.Monad"] = PS["Control.Monad"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];        
  var Bifunctor = function (bimap) {
      this.bimap = bimap;
  };
  var bimap = function (dict) {
      return dict.bimap;
  };
  var rmap = function (dictBifunctor) {
      return bimap(dictBifunctor)(Control_Category.id(Control_Category.categoryFn));
  };
  exports["Bifunctor"] = Bifunctor;
  exports["bimap"] = bimap;
  exports["rmap"] = rmap;
})(PS["Data.Bifunctor"] = PS["Data.Bifunctor"] || {});
(function(exports) {
    "use strict";

  // module Data.Bounded

  exports.topInt = 2147483647;
  exports.bottomInt = -2147483648;
})(PS["Data.Bounded"] = PS["Data.Bounded"] || {});
(function(exports) {
    "use strict";

  // module Data.Eq

  exports.refEq = function (r1) {
    return function (r2) {
      return r1 === r2;
    };
  };
})(PS["Data.Eq"] = PS["Data.Eq"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Eq"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];        
  var Eq = function (eq) {
      this.eq = eq;
  };                                    
  var eqInt = new Eq($foreign.refEq);
  var eqChar = new Eq($foreign.refEq);   
  var eq = function (dict) {
      return dict.eq;
  };
  exports["Eq"] = Eq;
  exports["eq"] = eq;
  exports["eqInt"] = eqInt;
  exports["eqChar"] = eqChar;
})(PS["Data.Eq"] = PS["Data.Eq"] || {});
(function(exports) {
    "use strict";

  // module Data.Ord.Unsafe

  exports.unsafeCompareImpl = function (lt) {
    return function (eq) {
      return function (gt) {
        return function (x) {
          return function (y) {
            return x < y ? lt : x > y ? gt : eq;
          };
        };
      };
    };
  };
})(PS["Data.Ord.Unsafe"] = PS["Data.Ord.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Eq = PS["Data.Eq"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];        
  var LT = (function () {
      function LT() {

      };
      LT.value = new LT();
      return LT;
  })();
  var GT = (function () {
      function GT() {

      };
      GT.value = new GT();
      return GT;
  })();
  var EQ = (function () {
      function EQ() {

      };
      EQ.value = new EQ();
      return EQ;
  })();
  exports["LT"] = LT;
  exports["GT"] = GT;
  exports["EQ"] = EQ;
})(PS["Data.Ordering"] = PS["Data.Ordering"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Ord.Unsafe"];
  var Data_Ordering = PS["Data.Ordering"];        
  var unsafeCompare = $foreign.unsafeCompareImpl(Data_Ordering.LT.value)(Data_Ordering.EQ.value)(Data_Ordering.GT.value);
  exports["unsafeCompare"] = unsafeCompare;
})(PS["Data.Ord.Unsafe"] = PS["Data.Ord.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Ord"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Ord_Unsafe = PS["Data.Ord.Unsafe"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];
  var Data_Semiring = PS["Data.Semiring"];        
  var Ord = function (__superclass_Data$dotEq$dotEq_0, compare) {
      this["__superclass_Data.Eq.Eq_0"] = __superclass_Data$dotEq$dotEq_0;
      this.compare = compare;
  };                                
  var ordInt = new Ord(function () {
      return Data_Eq.eqInt;
  }, Data_Ord_Unsafe.unsafeCompare);
  var compare = function (dict) {
      return dict.compare;
  };
  var max = function (dictOrd) {
      return function (x) {
          return function (y) {
              var $27 = compare(dictOrd)(x)(y);
              if ($27 instanceof Data_Ordering.LT) {
                  return y;
              };
              if ($27 instanceof Data_Ordering.EQ) {
                  return x;
              };
              if ($27 instanceof Data_Ordering.GT) {
                  return x;
              };
              throw new Error("Failed pattern match at Data.Ord line 122, column 3 - line 125, column 12: " + [ $27.constructor.name ]);
          };
      };
  };
  exports["Ord"] = Ord;
  exports["compare"] = compare;
  exports["max"] = max;
  exports["ordInt"] = ordInt;
})(PS["Data.Ord"] = PS["Data.Ord"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Bounded"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Ordering = PS["Data.Ordering"];        
  var Bounded = function (__superclass_Data$dotOrd$dotOrd_0, bottom, top) {
      this["__superclass_Data.Ord.Ord_0"] = __superclass_Data$dotOrd$dotOrd_0;
      this.bottom = bottom;
      this.top = top;
  };
  var top = function (dict) {
      return dict.top;
  };                                                 
  var boundedInt = new Bounded(function () {
      return Data_Ord.ordInt;
  }, $foreign.bottomInt, $foreign.topInt);
  var bottom = function (dict) {
      return dict.bottom;
  };
  exports["Bounded"] = Bounded;
  exports["bottom"] = bottom;
  exports["top"] = top;
  exports["boundedInt"] = boundedInt;
})(PS["Data.Bounded"] = PS["Data.Bounded"] || {});
(function(exports) {
    "use strict";

  exports.foldrArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = len - 1; i >= 0; i--) {
          acc = f(xs[i])(acc);
        }
        return acc;
      };
    };
  };

  exports.foldlArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = 0; i < len; i++) {
          acc = f(acc)(xs[i]);
        }
        return acc;
      };
    };
  };
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
    "use strict";

  // module Data.HeytingAlgebra

  exports.boolConj = function (b1) {
    return function (b2) {
      return b1 && b2;
    };
  };

  exports.boolDisj = function (b1) {
    return function (b2) {
      return b1 || b2;
    };
  };

  exports.boolNot = function (b) {
    return !b;
  };
})(PS["Data.HeytingAlgebra"] = PS["Data.HeytingAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];        
  var HeytingAlgebra = function (conj, disj, ff, implies, not, tt) {
      this.conj = conj;
      this.disj = disj;
      this.ff = ff;
      this.implies = implies;
      this.not = not;
      this.tt = tt;
  };
  var tt = function (dict) {
      return dict.tt;
  };
  var not = function (dict) {
      return dict.not;
  };
  var implies = function (dict) {
      return dict.implies;
  };                 
  var ff = function (dict) {
      return dict.ff;
  };
  var disj = function (dict) {
      return dict.disj;
  };
  var heytingAlgebraBoolean = new HeytingAlgebra($foreign.boolConj, $foreign.boolDisj, false, function (a) {
      return function (b) {
          return disj(heytingAlgebraBoolean)(not(heytingAlgebraBoolean)(a))(b);
      };
  }, $foreign.boolNot, true);
  var conj = function (dict) {
      return dict.conj;
  };
  exports["HeytingAlgebra"] = HeytingAlgebra;
  exports["conj"] = conj;
  exports["disj"] = disj;
  exports["ff"] = ff;
  exports["implies"] = implies;
  exports["not"] = not;
  exports["tt"] = tt;
  exports["heytingAlgebraBoolean"] = heytingAlgebraBoolean;
})(PS["Data.HeytingAlgebra"] = PS["Data.HeytingAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];        
  var BooleanAlgebra = function (__superclass_Data$dotHeytingAlgebra$dotHeytingAlgebra_0) {
      this["__superclass_Data.HeytingAlgebra.HeytingAlgebra_0"] = __superclass_Data$dotHeytingAlgebra$dotHeytingAlgebra_0;
  }; 
  var booleanAlgebraBoolean = new BooleanAlgebra(function () {
      return Data_HeytingAlgebra.heytingAlgebraBoolean;
  });
  exports["BooleanAlgebra"] = BooleanAlgebra;
  exports["booleanAlgebraBoolean"] = booleanAlgebraBoolean;
})(PS["Data.BooleanAlgebra"] = PS["Data.BooleanAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];        
  var Monoid = function (__superclass_Data$dotSemigroup$dotSemigroup_0, mempty) {
      this["__superclass_Data.Semigroup.Semigroup_0"] = __superclass_Data$dotSemigroup$dotSemigroup_0;
      this.mempty = mempty;
  };     
  var monoidArray = new Monoid(function () {
      return Data_Semigroup.semigroupArray;
  }, [  ]);
  var mempty = function (dict) {
      return dict.mempty;
  };
  exports["Monoid"] = Monoid;
  exports["mempty"] = mempty;
  exports["monoidArray"] = monoidArray;
})(PS["Data.Monoid"] = PS["Data.Monoid"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Category = PS["Control.Category"];        
  var Just = (function () {
      function Just(value0) {
          this.value0 = value0;
      };
      Just.create = function (value0) {
          return new Just(value0);
      };
      return Just;
  })();
  var Nothing = (function () {
      function Nothing() {

      };
      Nothing.value = new Nothing();
      return Nothing;
  })();
  var maybe = function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Nothing) {
                  return v;
              };
              if (v2 instanceof Just) {
                  return v1(v2.value0);
              };
              throw new Error("Failed pattern match at Data.Maybe line 232, column 1 - line 232, column 22: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  };
  var isNothing = maybe(true)(Data_Function["const"](false));
  var isJust = maybe(false)(Data_Function["const"](true));
  var functorMaybe = new Data_Functor.Functor(function (v) {
      return function (v1) {
          if (v1 instanceof Just) {
              return new Just(v(v1.value0));
          };
          return Nothing.value;
      };
  });
  var fromJust = function (dictPartial) {
      return function (v) {
          var __unused = function (dictPartial1) {
              return function ($dollar29) {
                  return $dollar29;
              };
          };
          return __unused(dictPartial)((function () {
              if (v instanceof Just) {
                  return v.value0;
              };
              throw new Error("Failed pattern match at Data.Maybe line 283, column 1 - line 283, column 21: " + [ v.constructor.name ]);
          })());
      };
  };
  exports["Just"] = Just;
  exports["Nothing"] = Nothing;
  exports["fromJust"] = fromJust;
  exports["isJust"] = isJust;
  exports["isNothing"] = isNothing;
  exports["maybe"] = maybe;
  exports["functorMaybe"] = functorMaybe;
})(PS["Data.Maybe"] = PS["Data.Maybe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];        
  var Disj = function (x) {
      return x;
  };
  var semigroupDisj = function (dictHeytingAlgebra) {
      return new Data_Semigroup.Semigroup(function (v) {
          return function (v1) {
              return Data_HeytingAlgebra.disj(dictHeytingAlgebra)(v)(v1);
          };
      });
  };
  var runDisj = function (v) {
      return v;
  };
  var monoidDisj = function (dictHeytingAlgebra) {
      return new Data_Monoid.Monoid(function () {
          return semigroupDisj(dictHeytingAlgebra);
      }, Data_HeytingAlgebra.ff(dictHeytingAlgebra));
  };
  exports["Disj"] = Disj;
  exports["runDisj"] = runDisj;
  exports["semigroupDisj"] = semigroupDisj;
  exports["monoidDisj"] = monoidDisj;
})(PS["Data.Monoid.Disj"] = PS["Data.Monoid.Disj"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foldable"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Plus = PS["Control.Plus"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Maybe_Last = PS["Data.Maybe.Last"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Monoid_Additive = PS["Data.Monoid.Additive"];
  var Data_Monoid_Conj = PS["Data.Monoid.Conj"];
  var Data_Monoid_Disj = PS["Data.Monoid.Disj"];
  var Data_Monoid_Dual = PS["Data.Monoid.Dual"];
  var Data_Monoid_Endo = PS["Data.Monoid.Endo"];
  var Data_Monoid_Multiplicative = PS["Data.Monoid.Multiplicative"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Category = PS["Control.Category"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];        
  var Foldable = function (foldMap, foldl, foldr) {
      this.foldMap = foldMap;
      this.foldl = foldl;
      this.foldr = foldr;
  };
  var foldr = function (dict) {
      return dict.foldr;
  };
  var traverse_ = function (dictApplicative) {
      return function (dictFoldable) {
          return function (f) {
              return foldr(dictFoldable)(function ($164) {
                  return Control_Apply.applySecond(dictApplicative["__superclass_Control.Apply.Apply_0"]())(f($164));
              })(Control_Applicative.pure(dictApplicative)(Data_Unit.unit));
          };
      };
  };
  var for_ = function (dictApplicative) {
      return function (dictFoldable) {
          return Data_Function.flip(traverse_(dictApplicative)(dictFoldable));
      };
  };
  var foldl = function (dict) {
      return dict.foldl;
  }; 
  var foldMapDefaultR = function (dictFoldable) {
      return function (dictMonoid) {
          return function (f) {
              return function (xs) {
                  return foldr(dictFoldable)(function (x) {
                      return function (acc) {
                          return Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(f(x))(acc);
                      };
                  })(Data_Monoid.mempty(dictMonoid))(xs);
              };
          };
      };
  };
  var foldableArray = new Foldable(function (dictMonoid) {
      return foldMapDefaultR(foldableArray)(dictMonoid);
  }, $foreign.foldlArray, $foreign.foldrArray);
  var foldMap = function (dict) {
      return dict.foldMap;
  };
  var any = function (dictFoldable) {
      return function (dictBooleanAlgebra) {
          return function (p) {
              return function ($167) {
                  return Data_Monoid_Disj.runDisj(foldMap(dictFoldable)(Data_Monoid_Disj.monoidDisj(dictBooleanAlgebra["__superclass_Data.HeytingAlgebra.HeytingAlgebra_0"]()))(function ($168) {
                      return Data_Monoid_Disj.Disj(p($168));
                  })($167));
              };
          };
      };
  };
  var elem = function (dictFoldable) {
      return function (dictEq) {
          return function ($169) {
              return any(dictFoldable)(Data_BooleanAlgebra.booleanAlgebraBoolean)(Data_Eq.eq(dictEq)($169));
          };
      };
  };
  exports["Foldable"] = Foldable;
  exports["any"] = any;
  exports["elem"] = elem;
  exports["foldMap"] = foldMap;
  exports["foldMapDefaultR"] = foldMapDefaultR;
  exports["foldl"] = foldl;
  exports["foldr"] = foldr;
  exports["for_"] = for_;
  exports["traverse_"] = traverse_;
  exports["foldableArray"] = foldableArray;
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];        
  var Left = (function () {
      function Left(value0) {
          this.value0 = value0;
      };
      Left.create = function (value0) {
          return new Left(value0);
      };
      return Left;
  })();
  var Right = (function () {
      function Right(value0) {
          this.value0 = value0;
      };
      Right.create = function (value0) {
          return new Right(value0);
      };
      return Right;
  })();
  var functorEither = new Data_Functor.Functor(function (v) {
      return function (v1) {
          if (v1 instanceof Left) {
              return new Left(v1.value0);
          };
          if (v1 instanceof Right) {
              return new Right(v(v1.value0));
          };
          throw new Error("Failed pattern match at Data.Either line 46, column 3 - line 46, column 26: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var either = function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Left) {
                  return v(v2.value0);
              };
              if (v2 instanceof Right) {
                  return v1(v2.value0);
              };
              throw new Error("Failed pattern match at Data.Either line 243, column 1 - line 243, column 26: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  };
  var isLeft = either(Data_Function["const"](true))(Data_Function["const"](false));
  var bifunctorEither = new Data_Bifunctor.Bifunctor(function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Left) {
                  return new Left(v(v2.value0));
              };
              if (v2 instanceof Right) {
                  return new Right(v1(v2.value0));
              };
              throw new Error("Failed pattern match at Data.Either line 53, column 3 - line 53, column 34: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  });
  var applyEither = new Control_Apply.Apply(function () {
      return functorEither;
  }, function (v) {
      return function (v1) {
          if (v instanceof Left) {
              return new Left(v.value0);
          };
          if (v instanceof Right) {
              return Data_Functor.map(functorEither)(v.value0)(v1);
          };
          throw new Error("Failed pattern match at Data.Either line 89, column 3 - line 89, column 28: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var bindEither = new Control_Bind.Bind(function () {
      return applyEither;
  }, either(function (e) {
      return function (v) {
          return new Left(e);
      };
  })(function (a) {
      return function (f) {
          return f(a);
      };
  }));
  var applicativeEither = new Control_Applicative.Applicative(function () {
      return applyEither;
  }, Right.create);
  exports["Left"] = Left;
  exports["Right"] = Right;
  exports["either"] = either;
  exports["isLeft"] = isLeft;
  exports["functorEither"] = functorEither;
  exports["bifunctorEither"] = bifunctorEither;
  exports["applyEither"] = applyEither;
  exports["applicativeEither"] = applicativeEither;
  exports["bindEither"] = bindEither;
})(PS["Data.Either"] = PS["Data.Either"] || {});
(function(exports) {
    "use strict";

  // module Control.Monad.Eff

  exports.pureE = function (a) {
    return function () {
      return a;
    };
  };

  exports.bindE = function (a) {
    return function (f) {
      return function () {
        return f(a())();
      };
    };
  };
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Eff"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var monadEff = new Control_Monad.Monad(function () {
      return applicativeEff;
  }, function () {
      return bindEff;
  });
  var bindEff = new Control_Bind.Bind(function () {
      return applyEff;
  }, $foreign.bindE);
  var applyEff = new Control_Apply.Apply(function () {
      return functorEff;
  }, Control_Monad.ap(monadEff));
  var applicativeEff = new Control_Applicative.Applicative(function () {
      return applyEff;
  }, $foreign.pureE);
  var functorEff = new Data_Functor.Functor(Control_Applicative.liftA1(applicativeEff));
  exports["functorEff"] = functorEff;
  exports["applyEff"] = applyEff;
  exports["applicativeEff"] = applicativeEff;
  exports["bindEff"] = bindEff;
  exports["monadEff"] = monadEff;
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_Eq = PS["Data.Eq"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Data_Field = PS["Data.Field"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];        
  var Identity = function (x) {
      return x;
  };
  var runIdentity = function (v) {
      return v;
  };
  var functorIdentity = new Data_Functor.Functor(function (f) {
      return function (v) {
          return f(v);
      };
  });
  var applyIdentity = new Control_Apply.Apply(function () {
      return functorIdentity;
  }, function (v) {
      return function (v1) {
          return v(v1);
      };
  });
  var bindIdentity = new Control_Bind.Bind(function () {
      return applyIdentity;
  }, function (v) {
      return function (f) {
          return f(v);
      };
  });
  var applicativeIdentity = new Control_Applicative.Applicative(function () {
      return applyIdentity;
  }, Identity);
  var monadIdentity = new Control_Monad.Monad(function () {
      return applicativeIdentity;
  }, function () {
      return bindIdentity;
  });
  exports["Identity"] = Identity;
  exports["runIdentity"] = runIdentity;
  exports["functorIdentity"] = functorIdentity;
  exports["applyIdentity"] = applyIdentity;
  exports["applicativeIdentity"] = applicativeIdentity;
  exports["bindIdentity"] = bindIdentity;
  exports["monadIdentity"] = monadIdentity;
})(PS["Data.Identity"] = PS["Data.Identity"] || {});
(function(exports) {
    "use strict";

  // module Partial.Unsafe

  exports.unsafePartial = function (f) {
    return f();
  };
})(PS["Partial.Unsafe"] = PS["Partial.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Partial.Unsafe"];
  var Partial = PS["Partial"];
  exports["unsafePartial"] = $foreign.unsafePartial;
})(PS["Partial.Unsafe"] = PS["Partial.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Unsafe = PS["Control.Monad.Eff.Unsafe"];
  var Control_Monad_ST = PS["Control.Monad.ST"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadRec = function (__superclass_Control$dotMonad$dotMonad_0, tailRecM) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.tailRecM = tailRecM;
  };
  var tailRecM = function (dict) {
      return dict.tailRecM;
  };             
  var forever = function (dictMonadRec) {
      return function (ma) {
          return tailRecM(dictMonadRec)(function (u) {
              return Data_Functor.voidRight((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(new Data_Either.Left(u))(ma);
          })(Data_Unit.unit);
      };
  };
  exports["MonadRec"] = MonadRec;
  exports["forever"] = forever;
  exports["tailRecM"] = tailRecM;
})(PS["Control.Monad.Rec.Class"] = PS["Control.Monad.Rec.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];        
  var MonadTrans = function (lift) {
      this.lift = lift;
  };
  var lift = function (dict) {
      return dict.lift;
  };
  exports["MonadTrans"] = MonadTrans;
  exports["lift"] = lift;
})(PS["Control.Monad.Trans"] = PS["Control.Monad.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Exists = PS["Data.Exists"];
  var Data_Either = PS["Data.Either"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Category = PS["Control.Category"];        
  var Bound = (function () {
      function Bound(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bound.create = function (value0) {
          return function (value1) {
              return new Bound(value0, value1);
          };
      };
      return Bound;
  })();
  var FreeT = (function () {
      function FreeT(value0) {
          this.value0 = value0;
      };
      FreeT.create = function (value0) {
          return new FreeT(value0);
      };
      return FreeT;
  })();
  var Bind = (function () {
      function Bind(value0) {
          this.value0 = value0;
      };
      Bind.create = function (value0) {
          return new Bind(value0);
      };
      return Bind;
  })();
  var monadTransFreeT = function (dictFunctor) {
      return new Control_Monad_Trans.MonadTrans(function (dictMonad) {
          return function (ma) {
              return new FreeT(function (v) {
                  return Data_Functor.map(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Left.create)(ma);
              });
          };
      });
  };
  var freeT = FreeT.create;
  var bound = function (m) {
      return function (f) {
          return new Bind(Data_Exists.mkExists(new Bound(m, f)));
      };
  };
  var functorFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return new Data_Functor.Functor(function (f) {
              return function (v) {
                  if (v instanceof FreeT) {
                      return new FreeT(function (v1) {
                          return Data_Functor.map(dictFunctor1)(Data_Bifunctor.bimap(Data_Either.bifunctorEither)(f)(Data_Functor.map(dictFunctor)(Data_Functor.map(functorFreeT(dictFunctor)(dictFunctor1))(f))))(v.value0(Data_Unit.unit));
                      });
                  };
                  if (v instanceof Bind) {
                      return Data_Exists.runExists(function (v1) {
                          return bound(v1.value0)(function ($98) {
                              return Data_Functor.map(functorFreeT(dictFunctor)(dictFunctor1))(f)(v1.value1($98));
                          });
                      })(v.value0);
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free.Trans line 55, column 3 - line 55, column 69: " + [ f.constructor.name, v.constructor.name ]);
              };
          });
      };
  };
  var bimapFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return function (nf) {
              return function (nm) {
                  return function (v) {
                      if (v instanceof Bind) {
                          return Data_Exists.runExists(function (v1) {
                              return bound(function ($99) {
                                  return bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm)(v1.value0($99));
                              })(function ($100) {
                                  return bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm)(v1.value1($100));
                              });
                          })(v.value0);
                      };
                      if (v instanceof FreeT) {
                          return new FreeT(function (v1) {
                              return Data_Functor.map(dictFunctor1)(Data_Functor.map(Data_Either.functorEither)(function ($101) {
                                  return nf(Data_Functor.map(dictFunctor)(bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm))($101));
                              }))(nm(v.value0(Data_Unit.unit)));
                          });
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 96, column 1 - line 96, column 114: " + [ nf.constructor.name, nm.constructor.name, v.constructor.name ]);
                  };
              };
          };
      };
  };
  var hoistFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return bimapFreeT(dictFunctor)(dictFunctor1)(Control_Category.id(Control_Category.categoryFn));
      };
  };
  var interpret = function (dictFunctor) {
      return function (dictFunctor1) {
          return function (nf) {
              return bimapFreeT(dictFunctor)(dictFunctor1)(nf)(Control_Category.id(Control_Category.categoryFn));
          };
      };
  };
  var monadFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Monad.Monad(function () {
              return applicativeFreeT(dictFunctor)(dictMonad);
          }, function () {
              return bindFreeT(dictFunctor)(dictMonad);
          });
      };
  };
  var bindFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Bind.Bind(function () {
              return applyFreeT(dictFunctor)(dictMonad);
          }, function (v) {
              return function (f) {
                  if (v instanceof Bind) {
                      return Data_Exists.runExists(function (v1) {
                          return bound(v1.value0)(function (x) {
                              return bound(function (v2) {
                                  return v1.value1(x);
                              })(f);
                          });
                      })(v.value0);
                  };
                  return bound(function (v1) {
                      return v;
                  })(f);
              };
          });
      };
  };
  var applyFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Apply.Apply(function () {
              return functorFreeT(dictFunctor)(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
          }, Control_Monad.ap(monadFreeT(dictFunctor)(dictMonad)));
      };
  };
  var applicativeFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Applicative.Applicative(function () {
              return applyFreeT(dictFunctor)(dictMonad);
          }, function (a) {
              return new FreeT(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(a));
              });
          });
      };
  };
  var liftFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return function (fa) {
              return new FreeT(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(Data_Functor.map(dictFunctor)(Control_Applicative.pure(applicativeFreeT(dictFunctor)(dictMonad)))(fa)));
              });
          };
      };
  };
  var resume = function (dictFunctor) {
      return function (dictMonadRec) {
          var go = function (v) {
              if (v instanceof FreeT) {
                  return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Right.create)(v.value0(Data_Unit.unit));
              };
              if (v instanceof Bind) {
                  return Data_Exists.runExists(function (v1) {
                      var $77 = v1.value0(Data_Unit.unit);
                      if ($77 instanceof FreeT) {
                          return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())($77.value0(Data_Unit.unit))(function (v2) {
                              if (v2 instanceof Data_Either.Left) {
                                  return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1.value1(v2.value0)));
                              };
                              if (v2 instanceof Data_Either.Right) {
                                  return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(new Data_Either.Right(Data_Functor.map(dictFunctor)(function (h) {
                                      return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(h)(v1.value1);
                                  })(v2.value0))));
                              };
                              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 49, column 9 - line 51, column 68: " + [ v2.constructor.name ]);
                          });
                      };
                      if ($77 instanceof Bind) {
                          return Data_Exists.runExists(function (v2) {
                              return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(v2.value0(Data_Unit.unit))(function (z) {
                                  return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(v2.value1(z))(v1.value1);
                              })));
                          })($77.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 46, column 5 - line 52, column 98: " + [ $77.constructor.name ]);
                  })(v.value0);
              };
              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 44, column 3 - line 44, column 36: " + [ v.constructor.name ]);
          };
          return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(go);
      };
  };
  var runFreeT = function (dictFunctor) {
      return function (dictMonadRec) {
          return function (interp) {
              var go = function (v) {
                  if (v instanceof Data_Either.Left) {
                      return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(v.value0));
                  };
                  if (v instanceof Data_Either.Right) {
                      return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(interp(v.value0))(function (v1) {
                          return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1));
                      });
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free.Trans line 104, column 3 - line 104, column 31: " + [ v.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(Control_Bind.composeKleisliFlipped((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(go)(resume(dictFunctor)(dictMonadRec)));
          };
      };
  };
  var monadRecFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Monad_Rec_Class.MonadRec(function () {
              return monadFreeT(dictFunctor)(dictMonad);
          }, function (f) {
              var go = function (s) {
                  return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonad))(f(s))(function (v) {
                      if (v instanceof Data_Either.Left) {
                          return go(v.value0);
                      };
                      if (v instanceof Data_Either.Right) {
                          return Control_Applicative.pure(applicativeFreeT(dictFunctor)(dictMonad))(v.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 78, column 7 - line 80, column 26: " + [ v.constructor.name ]);
                  });
              };
              return go;
          });
      };
  };
  exports["bimapFreeT"] = bimapFreeT;
  exports["freeT"] = freeT;
  exports["hoistFreeT"] = hoistFreeT;
  exports["interpret"] = interpret;
  exports["liftFreeT"] = liftFreeT;
  exports["resume"] = resume;
  exports["runFreeT"] = runFreeT;
  exports["functorFreeT"] = functorFreeT;
  exports["applyFreeT"] = applyFreeT;
  exports["applicativeFreeT"] = applicativeFreeT;
  exports["bindFreeT"] = bindFreeT;
  exports["monadFreeT"] = monadFreeT;
  exports["monadTransFreeT"] = monadTransFreeT;
  exports["monadRecFreeT"] = monadRecFreeT;
})(PS["Control.Monad.Free.Trans"] = PS["Control.Monad.Free.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];        
  var MonadEff = function (__superclass_Control$dotMonad$dotMonad_0, liftEff) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.liftEff = liftEff;
  };
  var monadEffEff = new MonadEff(function () {
      return Control_Monad_Eff.monadEff;
  }, Control_Category.id(Control_Category.categoryFn));
  var liftEff = function (dict) {
      return dict.liftEff;
  };
  exports["MonadEff"] = MonadEff;
  exports["liftEff"] = liftEff;
  exports["monadEffEff"] = monadEffEff;
})(PS["Control.Monad.Eff.Class"] = PS["Control.Monad.Eff.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadError = function (__superclass_Control$dotMonad$dotMonad_0, catchError, throwError) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.catchError = catchError;
      this.throwError = throwError;
  };
  var throwError = function (dict) {
      return dict.throwError;
  };                          
  var catchError = function (dict) {
      return dict.catchError;
  };
  exports["MonadError"] = MonadError;
  exports["catchError"] = catchError;
  exports["throwError"] = throwError;
})(PS["Control.Monad.Error.Class"] = PS["Control.Monad.Error.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];        
  var MonadReader = function (__superclass_Control$dotMonad$dotMonad_0, ask, local) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.ask = ask;
      this.local = local;
  };                                                                                                                             
  var local = function (dict) {
      return dict.local;
  };
  var ask = function (dict) {
      return dict.ask;
  };
  exports["MonadReader"] = MonadReader;
  exports["ask"] = ask;
  exports["local"] = local;
})(PS["Control.Monad.Reader.Class"] = PS["Control.Monad.Reader.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Unit = PS["Data.Unit"];        
  var Lazy = function (defer) {
      this.defer = defer;
  };
  var defer = function (dict) {
      return dict.defer;
  };
  exports["Lazy"] = Lazy;
  exports["defer"] = defer;
})(PS["Control.Lazy"] = PS["Control.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Biapplicative = PS["Control.Biapplicative"];
  var Control_Biapply = PS["Control.Biapply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Unit = PS["Data.Unit"];        
  var Tuple = (function () {
      function Tuple(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Tuple.create = function (value0) {
          return function (value1) {
              return new Tuple(value0, value1);
          };
      };
      return Tuple;
  })();
  var snd = function (v) {
      return v.value1;
  };                                                                                                    
  var fst = function (v) {
      return v.value0;
  };
  exports["Tuple"] = Tuple;
  exports["fst"] = fst;
  exports["snd"] = snd;
})(PS["Data.Tuple"] = PS["Data.Tuple"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadState = function (__superclass_Control$dotMonad$dotMonad_0, state) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.state = state;
  };
  var state = function (dict) {
      return dict.state;
  };
  var put = function (dictMonadState) {
      return function (s) {
          return state(dictMonadState)(function (v) {
              return new Data_Tuple.Tuple(Data_Unit.unit, s);
          });
      };
  };
  var modify = function (dictMonadState) {
      return function (f) {
          return state(dictMonadState)(function (s) {
              return new Data_Tuple.Tuple(Data_Unit.unit, f(s));
          });
      };
  };
  var get = function (dictMonadState) {
      return state(dictMonadState)(function (s) {
          return new Data_Tuple.Tuple(s, s);
      });
  };
  exports["MonadState"] = MonadState;
  exports["get"] = get;
  exports["modify"] = modify;
  exports["put"] = put;
  exports["state"] = state;
})(PS["Control.Monad.State.Class"] = PS["Control.Monad.State.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Distributive = PS["Data.Distributive"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];        
  var ReaderT = function (x) {
      return x;
  };
  var withReaderT = function (f) {
      return function (v) {
          return function ($48) {
              return v(f($48));
          };
      };
  };
  var runReaderT = function (v) {
      return v;
  };
  var monadTransReaderT = new Control_Monad_Trans.MonadTrans(function (dictMonad) {
      return function ($49) {
          return ReaderT(Data_Function["const"]($49));
      };
  });
  var mapReaderT = function (f) {
      return function (v) {
          return function ($50) {
              return f(v($50));
          };
      };
  };
  var functorReaderT = function (dictFunctor) {
      return new Data_Functor.Functor(function ($51) {
          return mapReaderT(Data_Functor.map(dictFunctor)($51));
      });
  };
  var applyReaderT = function (dictApply) {
      return new Control_Apply.Apply(function () {
          return functorReaderT(dictApply["__superclass_Data.Functor.Functor_0"]());
      }, function (v) {
          return function (v1) {
              return function (r) {
                  return Control_Apply.apply(dictApply)(v(r))(v1(r));
              };
          };
      });
  };
  var bindReaderT = function (dictBind) {
      return new Control_Bind.Bind(function () {
          return applyReaderT(dictBind["__superclass_Control.Apply.Apply_0"]());
      }, function (v) {
          return function (k) {
              return function (r) {
                  return Control_Bind.bind(dictBind)(v(r))(function (a) {
                      var $40 = k(a);
                      return $40(r);
                  });
              };
          };
      });
  };
  var applicativeReaderT = function (dictApplicative) {
      return new Control_Applicative.Applicative(function () {
          return applyReaderT(dictApplicative["__superclass_Control.Apply.Apply_0"]());
      }, function ($53) {
          return ReaderT(Data_Function["const"](Control_Applicative.pure(dictApplicative)($53)));
      });
  };
  var monadReaderT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeReaderT(dictMonad["__superclass_Control.Applicative.Applicative_0"]());
      }, function () {
          return bindReaderT(dictMonad["__superclass_Control.Bind.Bind_1"]());
      });
  };
  var monadEffReader = function (dictMonadEff) {
      return new Control_Monad_Eff_Class.MonadEff(function () {
          return monadReaderT(dictMonadEff["__superclass_Control.Monad.Monad_0"]());
      }, function ($55) {
          return Control_Monad_Trans.lift(monadTransReaderT)(dictMonadEff["__superclass_Control.Monad.Monad_0"]())(Control_Monad_Eff_Class.liftEff(dictMonadEff)($55));
      });
  };
  var monadReaderReaderT = function (dictMonad) {
      return new Control_Monad_Reader_Class.MonadReader(function () {
          return monadReaderT(dictMonad);
      }, Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()), withReaderT);
  };
  exports["ReaderT"] = ReaderT;
  exports["mapReaderT"] = mapReaderT;
  exports["runReaderT"] = runReaderT;
  exports["withReaderT"] = withReaderT;
  exports["functorReaderT"] = functorReaderT;
  exports["applyReaderT"] = applyReaderT;
  exports["applicativeReaderT"] = applicativeReaderT;
  exports["bindReaderT"] = bindReaderT;
  exports["monadReaderT"] = monadReaderT;
  exports["monadTransReaderT"] = monadTransReaderT;
  exports["monadEffReader"] = monadEffReader;
  exports["monadReaderReaderT"] = monadReaderReaderT;
})(PS["Control.Monad.Reader.Trans"] = PS["Control.Monad.Reader.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_RWS_Class = PS["Control.Monad.RWS.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];        
  var MaybeT = function (x) {
      return x;
  };
  var runMaybeT = function (v) {
      return v;
  };
  var monadMaybeT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeMaybeT(dictMonad);
      }, function () {
          return bindMaybeT(dictMonad);
      });
  };
  var functorMaybeT = function (dictMonad) {
      return new Data_Functor.Functor(Control_Applicative.liftA1(applicativeMaybeT(dictMonad)));
  };
  var bindMaybeT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyMaybeT(dictMonad);
      }, function (v) {
          return function (f) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v)(function (v1) {
                  if (v1 instanceof Data_Maybe.Nothing) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Nothing.value);
                  };
                  if (v1 instanceof Data_Maybe.Just) {
                      var $36 = f(v1.value0);
                      return $36;
                  };
                  throw new Error("Failed pattern match at Control.Monad.Maybe.Trans line 55, column 5 - line 58, column 22: " + [ v1.constructor.name ]);
              });
          };
      });
  };
  var applyMaybeT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorMaybeT(dictMonad);
      }, Control_Monad.ap(monadMaybeT(dictMonad)));
  };
  var applicativeMaybeT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyMaybeT(dictMonad);
      }, function ($61) {
          return MaybeT(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Just.create($61)));
      });
  };
  var monadRecMaybeT = function (dictMonadRec) {
      return new Control_Monad_Rec_Class.MonadRec(function () {
          return monadMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]());
      }, function (f) {
          return function ($63) {
              return MaybeT(Control_Monad_Rec_Class.tailRecM(dictMonadRec)(function (a) {
                  var $42 = f(a);
                  return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())($42)(function (m$prime) {
                      return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())((function () {
                          if (m$prime instanceof Data_Maybe.Nothing) {
                              return new Data_Either.Right(Data_Maybe.Nothing.value);
                          };
                          if (m$prime instanceof Data_Maybe.Just && m$prime.value0 instanceof Data_Either.Left) {
                              return new Data_Either.Left(m$prime.value0.value0);
                          };
                          if (m$prime instanceof Data_Maybe.Just && m$prime.value0 instanceof Data_Either.Right) {
                              return new Data_Either.Right(new Data_Maybe.Just(m$prime.value0.value0));
                          };
                          throw new Error("Failed pattern match at Control.Monad.Maybe.Trans line 86, column 11 - line 89, column 45: " + [ m$prime.constructor.name ]);
                      })());
                  });
              })($63));
          };
      });
  };
  var altMaybeT = function (dictMonad) {
      return new Control_Alt.Alt(function () {
          return functorMaybeT(dictMonad);
      }, function (v) {
          return function (v1) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v)(function (v2) {
                  if (v2 instanceof Data_Maybe.Nothing) {
                      return v1;
                  };
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v2);
              });
          };
      });
  };
  var plusMaybeT = function (dictMonad) {
      return new Control_Plus.Plus(function () {
          return altMaybeT(dictMonad);
      }, Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Nothing.value));
  };
  exports["MaybeT"] = MaybeT;
  exports["runMaybeT"] = runMaybeT;
  exports["functorMaybeT"] = functorMaybeT;
  exports["applyMaybeT"] = applyMaybeT;
  exports["applicativeMaybeT"] = applicativeMaybeT;
  exports["bindMaybeT"] = bindMaybeT;
  exports["monadMaybeT"] = monadMaybeT;
  exports["altMaybeT"] = altMaybeT;
  exports["plusMaybeT"] = plusMaybeT;
  exports["monadRecMaybeT"] = monadRecMaybeT;
})(PS["Control.Monad.Maybe.Trans"] = PS["Control.Monad.Maybe.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var WriterT = function (x) {
      return x;
  };
  var runWriterT = function (v) {
      return v;
  };
  var mapWriterT = function (f) {
      return function (v) {
          return f(v);
      };
  };
  var functorWriterT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return Data_Function.apply(mapWriterT)(Data_Functor.map(dictFunctor)(function (v) {
              return new Data_Tuple.Tuple(f(v.value0), v.value1);
          }));
      });
  };
  var applyWriterT = function (dictSemigroup) {
      return function (dictApply) {
          return new Control_Apply.Apply(function () {
              return functorWriterT(dictApply["__superclass_Data.Functor.Functor_0"]());
          }, function (v) {
              return function (v1) {
                  var k = function (v3) {
                      return function (v4) {
                          return new Data_Tuple.Tuple(v3.value0(v4.value0), Data_Semigroup.append(dictSemigroup)(v3.value1)(v4.value1));
                      };
                  };
                  return Control_Apply.apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(k)(v))(v1);
              };
          });
      };
  };
  var applicativeWriterT = function (dictMonoid) {
      return function (dictApplicative) {
          return new Control_Applicative.Applicative(function () {
              return applyWriterT(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(dictApplicative["__superclass_Control.Apply.Apply_0"]());
          }, function (a) {
              return Data_Function.apply(WriterT)(Data_Function.apply(Control_Applicative.pure(dictApplicative))(new Data_Tuple.Tuple(a, Data_Monoid.mempty(dictMonoid))));
          });
      };
  };
  exports["WriterT"] = WriterT;
  exports["mapWriterT"] = mapWriterT;
  exports["runWriterT"] = runWriterT;
  exports["functorWriterT"] = functorWriterT;
  exports["applyWriterT"] = applyWriterT;
  exports["applicativeWriterT"] = applicativeWriterT;
})(PS["Control.Monad.Writer.Trans"] = PS["Control.Monad.Writer.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Cont_Trans = PS["Control.Monad.Cont.Trans"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Ref = PS["Control.Monad.Eff.Ref"];
  var Control_Monad_Eff_Unsafe = PS["Control.Monad.Eff.Unsafe"];
  var Control_Monad_Except_Trans = PS["Control.Monad.Except.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Either = PS["Data.Either"];        
  var Parallel = function (x) {
      return x;
  };
  var MonadPar = function (__superclass_Control$dotMonad$dotMonad_0, par) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.par = par;
  };
  var runParallel = function (v) {
      return v;
  };
  var parallel = Parallel;
  var par = function (dict) {
      return dict.par;
  }; 
  var functorParallel = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function ($90) {
              return parallel(Data_Functor.map(dictFunctor)(f)(runParallel($90)));
          };
      });
  };
  var applyParallel = function (dictMonadPar) {
      return new Control_Apply.Apply(function () {
          return functorParallel((((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, function (f) {
          return function (a) {
              return parallel(par(dictMonadPar)(Data_Function.apply)(runParallel(f))(runParallel(a)));
          };
      });
  };
  exports["MonadPar"] = MonadPar;
  exports["par"] = par;
  exports["parallel"] = parallel;
  exports["runParallel"] = runParallel;
  exports["functorParallel"] = functorParallel;
  exports["applyParallel"] = applyParallel;
})(PS["Control.Parallel.Class"] = PS["Control.Parallel.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Category = PS["Control.Category"];        
  var Profunctor = function (dimap) {
      this.dimap = dimap;
  };
  var profunctorFn = new Profunctor(function (a2b) {
      return function (c2d) {
          return function (b2c) {
              return function ($4) {
                  return c2d(b2c(a2b($4)));
              };
          };
      };
  });
  var dimap = function (dict) {
      return dict.dimap;
  };
  var rmap = function (dictProfunctor) {
      return function (b2c) {
          return dimap(dictProfunctor)(Control_Category.id(Control_Category.categoryFn))(b2c);
      };
  };
  exports["Profunctor"] = Profunctor;
  exports["dimap"] = dimap;
  exports["rmap"] = rmap;
  exports["profunctorFn"] = profunctorFn;
})(PS["Data.Profunctor"] = PS["Data.Profunctor"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Profunctor = PS["Data.Profunctor"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Category = PS["Control.Category"];
  var Emit = (function () {
      function Emit(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Emit.create = function (value0) {
          return function (value1) {
              return new Emit(value0, value1);
          };
      };
      return Emit;
  })();
  var profunctorAwait = new Data_Profunctor.Profunctor(function (f) {
      return function (g) {
          return function (v) {
              return Data_Profunctor.dimap(Data_Profunctor.profunctorFn)(f)(g)(v);
          };
      };
  });
  var loop = function (dictFunctor) {
      return function (dictMonad) {
          return function (me) {
              return Control_Monad_Rec_Class.tailRecM(Control_Monad_Free_Trans.monadRecFreeT(dictFunctor)(dictMonad))(function (v) {
                  return Data_Functor.map(Control_Monad_Free_Trans.functorFreeT(dictFunctor)(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Data_Maybe.maybe(new Data_Either.Left(Data_Unit.unit))(Data_Either.Right.create))(me);
              })(Data_Unit.unit);
          };
      };
  };
  var fuseWith = function (dictFunctor) {
      return function (dictFunctor1) {
          return function (dictFunctor2) {
              return function (dictMonadRec) {
                  return function (dictMonadPar) {
                      return function (zap) {
                          return function (fs) {
                              return function (gs) {
                                  var go = function (v) {
                                      return Control_Bind.bind((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(Control_Parallel_Class.runParallel(Control_Apply.apply(Control_Parallel_Class.applyParallel(dictMonadPar))(Data_Functor.map(Control_Parallel_Class.functorParallel((((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Control_Apply.lift2(Data_Either.applyEither)(zap(Data_Tuple.Tuple.create)))(Control_Parallel_Class.parallel(Control_Monad_Free_Trans.resume(dictFunctor)(dictMonadRec)(v.value0))))(Control_Parallel_Class.parallel(Control_Monad_Free_Trans.resume(dictFunctor1)(dictMonadRec)(v.value1)))))(function (v1) {
                                          if (v1 instanceof Data_Either.Left) {
                                              return Control_Applicative.pure((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1.value0));
                                          };
                                          if (v1 instanceof Data_Either.Right) {
                                              return Control_Applicative.pure((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(Data_Functor.map(dictFunctor2)(function (t) {
                                                  return Control_Monad_Free_Trans.freeT(function (v2) {
                                                      return go(t);
                                                  });
                                              })(v1.value0)));
                                          };
                                          throw new Error("Failed pattern match at Control.Coroutine line 73, column 5 - line 75, column 63: " + [ v1.constructor.name ]);
                                      });
                                  };
                                  return Control_Monad_Free_Trans.freeT(function (v) {
                                      return go(new Data_Tuple.Tuple(fs, gs));
                                  });
                              };
                          };
                      };
                  };
              };
          };
      };
  };
  var functorAwait = new Data_Functor.Functor(Data_Profunctor.rmap(profunctorAwait));
  var bifunctorEmit = new Data_Bifunctor.Bifunctor(function (f) {
      return function (g) {
          return function (v) {
              return new Emit(f(v.value0), g(v.value1));
          };
      };
  });
  var functorEmit = new Data_Functor.Functor(Data_Bifunctor.rmap(bifunctorEmit));
  var emit = function (dictMonad) {
      return function (o) {
          return Control_Monad_Free_Trans.liftFreeT(functorEmit)(dictMonad)(new Emit(o, Data_Unit.unit));
      };
  };
  var producer = function (dictMonad) {
      return function (recv) {
          return loop(functorEmit)(dictMonad)(Control_Bind.bind(Control_Monad_Free_Trans.bindFreeT(functorEmit)(dictMonad))(Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(functorEmit))(dictMonad)(recv))(function (v) {
              if (v instanceof Data_Either.Left) {
                  return Data_Functor.voidLeft(Control_Monad_Free_Trans.functorFreeT(functorEmit)(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(emit(dictMonad)(v.value0))(Data_Maybe.Nothing.value);
              };
              if (v instanceof Data_Either.Right) {
                  return Control_Applicative.pure(Control_Monad_Free_Trans.applicativeFreeT(functorEmit)(dictMonad))(new Data_Maybe.Just(v.value0));
              };
              throw new Error("Failed pattern match at Control.Coroutine line 99, column 3 - line 101, column 29: " + [ v.constructor.name ]);
          }));
      };
  };
  var $$await = function (dictMonad) {
      return Control_Monad_Free_Trans.liftFreeT(functorAwait)(dictMonad)(Control_Category.id(Control_Category.categoryFn));
  };
  exports["Emit"] = Emit;
  exports["await"] = $$await;
  exports["emit"] = emit;
  exports["fuseWith"] = fuseWith;
  exports["loop"] = loop;
  exports["producer"] = producer;
  exports["bifunctorEmit"] = bifunctorEmit;
  exports["functorEmit"] = functorEmit;
  exports["profunctorAwait"] = profunctorAwait;
  exports["functorAwait"] = functorAwait;
})(PS["Control.Coroutine"] = PS["Control.Coroutine"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports._setTimeout = function (nonCanceler, millis, aff) {
    var set = setTimeout, clear = clearTimeout;
    if (millis <= 0 && typeof setImmediate === "function") {
      set = setImmediate;
      clear = clearImmediate;
    }
    return function(success, error) {
      var canceler;

      var timeout = set(function() {
        canceler = aff(success, error);
      }, millis);

      return function(e) {
        return function(s, f) {
          if (canceler !== undefined) {
            return canceler(e)(s, f);
          } else {
            clear(timeout);
            s(true);
            return nonCanceler;
          }
        };
      };
    };
  }

  exports._forkAff = function (nonCanceler, aff) {
    var voidF = function(){};

    return function(success, error) {
      var canceler = aff(voidF, voidF);
      success(canceler);
      return nonCanceler;
    };
  }

  exports._forkAll = function (nonCanceler, foldl, affs) {
    var voidF = function(){};

    return function(success, error) {
      try {
        var cancelers = foldl(function(acc) {
          return function(aff) {
            acc.push(aff(voidF, voidF));
            return acc;
          }
        })([])(affs);
      } catch (err) {
        error(err)
      }

      var canceler = function(e) {
        return function(success, error) {
          var cancellations = 0;
          var result        = false;
          var errored       = false;

          var s = function(bool) {
            cancellations = cancellations + 1;
            result        = result || bool;

            if (cancellations === cancelers.length && !errored) {
              success(result);
            }
          };

          var f = function(err) {
            if (!errored) {
              errored = true;
              error(err);
            }
          };

          for (var i = 0; i < cancelers.length; i++) {
            cancelers[i](e)(s, f);
          }

          return nonCanceler;
        };
      };

      success(canceler);
      return nonCanceler;
    };
  }

  exports._makeAff = function (cb) {
    return function(success, error) {
      try {
        return cb(function(e) {
          return function() {
            error(e);
          };
        })(function(v) {
          return function() {
            success(v);
          };
        })();
      } catch (err) {
        error(err);
      }
    }
  }

  exports._pure = function (nonCanceler, v) {
    return function(success, error) {
      success(v);
      return nonCanceler;
    };
  }

  exports._throwError = function (nonCanceler, e) {
    return function(success, error) {
      error(e);
      return nonCanceler;
    };
  }

  exports._fmap = function (f, aff) {
    return function(success, error) {
      try {
        return aff(function(v) {
          try {
            var v2 = f(v);
          } catch (err) {
            error(err)
          }
          success(v2);
        }, error);
      } catch (err) {
        error(err);
      }
    };
  }

  exports._bind = function (alwaysCanceler, aff, f) {
    return function(success, error) {
      var canceler1, canceler2;

      var isCanceled    = false;
      var requestCancel = false;

      var onCanceler = function(){};

      canceler1 = aff(function(v) {
        if (requestCancel) {
          isCanceled = true;

          return alwaysCanceler;
        } else {
          canceler2 = f(v)(success, error);

          onCanceler(canceler2);

          return canceler2;
        }
      }, error);

      return function(e) {
        return function(s, f) {
          requestCancel = true;

          if (canceler2 !== undefined) {
            return canceler2(e)(s, f);
          } else {
            return canceler1(e)(function(bool) {
              if (bool || isCanceled) {
                s(true);
              } else {
                onCanceler = function(canceler) {
                  canceler(e)(s, f);
                };
              }
            }, f);
          }
        };
      };
    };
  }

  exports._attempt = function (Left, Right, aff) {
    return function(success, error) {
      try {
        return aff(function(v) {
          success(Right(v));
        }, function(e) {
          success(Left(e));
        });
      } catch (err) {
        success(Left(err));
      }
    };
  }

  exports._runAff = function (errorT, successT, aff) {
    return function() {
      return aff(function(v) {
        successT(v)();
      }, function(e) {
        errorT(e)();
      });
    };
  }

  exports._liftEff = function (nonCanceler, e) {
    return function(success, error) {
      var result;
      try {
        result = e();
      } catch (err) {
        error(err);
        return nonCanceler;
      }

      success(result);
      return nonCanceler;
    };
  }

  exports._tailRecM = function (isLeft, f, a) {
    return function(success, error) {
      return function go(acc) {
        var result, status, canceler;

        // Observes synchronous effects using a flag.
        //   status = 0 (unresolved status)
        //   status = 1 (synchronous effect)
        //   status = 2 (asynchronous effect)
        while (true) {
          status = 0;
          canceler = f(acc)(function(v) {
            // If the status is still unresolved, we have observed a
            // synchronous effect. Otherwise, the status will be `2`.
            if (status === 0) {
              // Store the result for further synchronous processing.
              result = v;
              status = 1;
            } else {
              // When we have observed an asynchronous effect, we use normal
              // recursion. This is safe because we will be on a new stack.
              if (isLeft(v)) {
                go(v.value0);
              } else {
                try {
                  success(v.value0);
                } catch (err) {
                  error(err);
                }
              }
            }
          }, error);

          // If the status has already resolved to `1` by our Aff handler, then
          // we have observed a synchronous effect. Otherwise it will still be
          // `0`.
          if (status === 1) {
            // When we have observed a synchronous effect, we merely swap out the
            // accumulator and continue the loop, preserving stack.
            if (isLeft(result)) {
              acc = result.value0;
              continue;
            } else {
              try {
                success(result.value0);
              } catch (err) {
                error(err);
              }
            }
          } else {
            // If the status has not resolved yet, then we have observed an
            // asynchronous effect.
            status = 2;
          }
          return canceler;
        }

      }(a);
    };
  };
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports._makeVar = function (nonCanceler) {
    return function(success, error) {
      try {
        success({
          consumers: [],
          producers: [],
          error: undefined
        });
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  };

  exports._takeVar = function (nonCanceler, avar) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.producers.length > 0) {
        var producer = avar.producers.shift();

        producer(success, error);
      } else {
        avar.consumers.push({success: success, error: error});
      }

      return nonCanceler;
    };
  };

  exports._putVar = function (nonCanceler, avar, a) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.consumers.length === 0) {
        avar.producers.push(function(success, error) {
          try {
            success(a);
          } catch (err) {
            error(err);
          }
        });

        success({});
      } else {
        var consumer = avar.consumers.shift();

        try {
          consumer.success(a);
        } catch (err) {
          error(err);

          return;
        }

        success({});
      }

      return nonCanceler;
    };
  };

  exports._killVar = function (nonCanceler, avar, e) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else {
        var errors = [];

        avar.error = e;

        while (avar.consumers.length > 0) {
          var consumer = avar.consumers.shift();

          try {
            consumer.error(e);
          } catch (err) {
            errors.push(err);
          }
        }

        if (errors.length > 0) error(errors[0]);
        else success({});
      }

      return nonCanceler;
    };
  };
})(PS["Control.Monad.Aff.Internal"] = PS["Control.Monad.Aff.Internal"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Control.Monad.Eff.Exception

  exports.showErrorImpl = function (err) {
    return err.stack || err.toString();
  };

  exports.error = function (msg) {
    return new Error(msg);
  };

  exports.throwException = function (e) {
    return function () {
      throw e;
    };
  };
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Show = PS["Data.Show"];
  var Prelude = PS["Prelude"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Functor = PS["Data.Functor"];                                           
  var showError = new Data_Show.Show($foreign.showErrorImpl);
  exports["showError"] = showError;
  exports["error"] = $foreign.error;
  exports["throwException"] = $foreign.throwException;
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
    "use strict";

  exports.runFn2 = function (fn) {
    return function (a) {
      return function (b) {
        return fn(a, b);
      };
    };
  };
})(PS["Data.Function.Uncurried"] = PS["Data.Function.Uncurried"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Function.Uncurried"];
  var Data_Unit = PS["Data.Unit"];
  exports["runFn2"] = $foreign.runFn2;
})(PS["Data.Function.Uncurried"] = PS["Data.Function.Uncurried"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Aff.Internal"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  exports["_killVar"] = $foreign._killVar;
  exports["_makeVar"] = $foreign._makeVar;
  exports["_putVar"] = $foreign._putVar;
  exports["_takeVar"] = $foreign._takeVar;
})(PS["Control.Monad.Aff.Internal"] = PS["Control.Monad.Aff.Internal"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Aff"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Aff_Internal = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Monoid = PS["Data.Monoid"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Function = PS["Data.Function"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var runAff = function (ex) {
      return function (f) {
          return function (aff) {
              return $foreign._runAff(ex, f, aff);
          };
      };
  };
  var makeAff$prime = function (h) {
      return $foreign._makeAff(h);
  };
  var functorAff = new Data_Functor.Functor(function (f) {
      return function (fa) {
          return $foreign._fmap(f, fa);
      };
  });
  var fromAVBox = Unsafe_Coerce.unsafeCoerce;
  var attempt = function (aff) {
      return $foreign._attempt(Data_Either.Left.create, Data_Either.Right.create, aff);
  };
  var applyAff = new Control_Apply.Apply(function () {
      return functorAff;
  }, function (ff) {
      return function (fa) {
          return $foreign._bind(alwaysCanceler, ff, function (f) {
              return Data_Functor.map(functorAff)(f)(fa);
          });
      };
  });
  var applicativeAff = new Control_Applicative.Applicative(function () {
      return applyAff;
  }, function (v) {
      return $foreign._pure(nonCanceler, v);
  });
  var nonCanceler = Data_Function["const"](Control_Applicative.pure(applicativeAff)(false));
  var alwaysCanceler = Data_Function["const"](Control_Applicative.pure(applicativeAff)(true));
  var forkAff = function (aff) {
      return $foreign._forkAff(nonCanceler, aff);
  };
  var forkAll = function (dictFoldable) {
      return function (affs) {
          return $foreign._forkAll(nonCanceler, Data_Foldable.foldl(dictFoldable), affs);
      };
  };
  var killVar = function (q) {
      return function (e) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._killVar(nonCanceler, q, e));
      };
  };
  var later$prime = function (n) {
      return function (aff) {
          return $foreign._setTimeout(nonCanceler, n, aff);
      };
  };
  var later = later$prime(0);
  var makeAff = function (h) {
      return makeAff$prime(function (e) {
          return function (a) {
              return Data_Functor.map(Control_Monad_Eff.functorEff)(Data_Function["const"](nonCanceler))(h(e)(a));
          };
      });
  };
  var makeVar = Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._makeVar(nonCanceler));
  var putVar = function (q) {
      return function (a) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._putVar(nonCanceler, q, a));
      };
  };
  var takeVar = function (q) {
      return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._takeVar(nonCanceler, q));
  };                                                                         
  var bindAff = new Control_Bind.Bind(function () {
      return applyAff;
  }, function (fa) {
      return function (f) {
          return $foreign._bind(alwaysCanceler, fa, f);
      };
  });
  var monadAff = new Control_Monad.Monad(function () {
      return applicativeAff;
  }, function () {
      return bindAff;
  });
  var monadEffAff = new Control_Monad_Eff_Class.MonadEff(function () {
      return monadAff;
  }, function (eff) {
      return $foreign._liftEff(nonCanceler, eff);
  });
  var monadRecAff = new Control_Monad_Rec_Class.MonadRec(function () {
      return monadAff;
  }, function (f) {
      return function (a) {
          return $foreign._tailRecM(Data_Either.isLeft, f, a);
      };
  });
  var monadErrorAff = new Control_Monad_Error_Class.MonadError(function () {
      return monadAff;
  }, function (aff) {
      return function (ex) {
          return Control_Bind.bind(bindAff)(attempt(aff))(Data_Either.either(ex)(Control_Applicative.pure(applicativeAff)));
      };
  }, function (e) {
      return $foreign._throwError(nonCanceler, e);
  });
  var monadParAff = new Control_Parallel_Class.MonadPar(function () {
      return monadAff;
  }, function (f) {
      return function (ma) {
          return function (mb) {
              var putOrKill = function (v) {
                  return Data_Either.either(killVar(v))(putVar(v));
              };
              return Control_Bind.bind(bindAff)(makeVar)(function (v) {
                  return Control_Bind.bind(bindAff)(makeVar)(function (v1) {
                      return Control_Bind.bind(bindAff)(forkAff(Control_Bind.bindFlipped(bindAff)(putOrKill(v))(attempt(ma))))(function (v2) {
                          return Control_Bind.bind(bindAff)(forkAff(Control_Bind.bindFlipped(bindAff)(putOrKill(v1))(attempt(mb))))(function (v3) {
                              return Control_Apply.apply(applyAff)(Data_Functor.map(functorAff)(f)(takeVar(v)))(takeVar(v1));
                          });
                      });
                  });
              });
          };
      };
  });
  exports["attempt"] = attempt;
  exports["forkAff"] = forkAff;
  exports["forkAll"] = forkAll;
  exports["later"] = later;
  exports["later'"] = later$prime;
  exports["makeAff"] = makeAff;
  exports["nonCanceler"] = nonCanceler;
  exports["runAff"] = runAff;
  exports["functorAff"] = functorAff;
  exports["applyAff"] = applyAff;
  exports["applicativeAff"] = applicativeAff;
  exports["bindAff"] = bindAff;
  exports["monadAff"] = monadAff;
  exports["monadEffAff"] = monadEffAff;
  exports["monadErrorAff"] = monadErrorAff;
  exports["monadRecAff"] = monadRecAff;
  exports["monadParAff"] = monadParAff;
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_Internal_1 = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Aff_Internal_1 = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var fromAVBox = Unsafe_Coerce.unsafeCoerce;
  var makeVar = Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._makeVar(Control_Monad_Aff.nonCanceler));
  var putVar = function (q) {
      return function (a) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._putVar(Control_Monad_Aff.nonCanceler, q, a));
      };
  };
  var makeVar$prime = function (a) {
      return Control_Bind.bind(Control_Monad_Aff.bindAff)(makeVar)(function (v) {
          return Control_Bind.bind(Control_Monad_Aff.bindAff)(putVar(v)(a))(function () {
              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(v);
          });
      });
  };
  var takeVar = function (q) {
      return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._takeVar(Control_Monad_Aff.nonCanceler, q));
  };
  var modifyVar = function (f) {
      return function (v) {
          return Control_Bind.bind(Control_Monad_Aff.bindAff)(takeVar(v))(function ($2) {
              return putVar(v)(f($2));
          });
      };
  };
  exports["makeVar"] = makeVar;
  exports["makeVar'"] = makeVar$prime;
  exports["modifyVar"] = modifyVar;
  exports["putVar"] = putVar;
  exports["takeVar"] = takeVar;
})(PS["Control.Monad.Aff.AVar"] = PS["Control.Monad.Aff.AVar"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var StateT = function (x) {
      return x;
  };
  var runStateT = function (v) {
      return v;
  };
  var monadTransStateT = new Control_Monad_Trans.MonadTrans(function (dictMonad) {
      return function (m) {
          return function (s) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(m)(function (v) {
                  return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))(new Data_Tuple.Tuple(v, s));
              });
          };
      };
  });
  var mapStateT = function (f) {
      return function (v) {
          return function ($93) {
              return f(v($93));
          };
      };
  }; 
  var functorStateT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (v) {
              return function (s) {
                  return Data_Functor.map(dictFunctor)(function (v1) {
                      return new Data_Tuple.Tuple(f(v1.value0), v1.value1);
                  })(v(s));
              };
          };
      });
  };
  var execStateT = function (dictFunctor) {
      return function (v) {
          return function (s) {
              return Data_Functor.map(dictFunctor)(Data_Tuple.snd)(v(s));
          };
      };
  };
  var evalStateT = function (dictFunctor) {
      return function (v) {
          return function (s) {
              return Data_Functor.map(dictFunctor)(Data_Tuple.fst)(v(s));
          };
      };
  };
  var monadStateT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeStateT(dictMonad);
      }, function () {
          return bindStateT(dictMonad);
      });
  };
  var bindStateT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyStateT(dictMonad);
      }, function (v) {
          return function (f) {
              return function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v(s))(function (v1) {
                      var $60 = f(v1.value0);
                      return $60(v1.value1);
                  });
              };
          };
      });
  };
  var applyStateT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, Control_Monad.ap(monadStateT(dictMonad)));
  };
  var applicativeStateT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyStateT(dictMonad);
      }, function (a) {
          return function (s) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))(new Data_Tuple.Tuple(a, s));
          };
      });
  };
  var monadEffState = function (dictMonadEff) {
      return new Control_Monad_Eff_Class.MonadEff(function () {
          return monadStateT(dictMonadEff["__superclass_Control.Monad.Monad_0"]());
      }, function ($94) {
          return Control_Monad_Trans.lift(monadTransStateT)(dictMonadEff["__superclass_Control.Monad.Monad_0"]())(Control_Monad_Eff_Class.liftEff(dictMonadEff)($94));
      });
  };
  var monadReaderStateT = function (dictMonadReader) {
      return new Control_Monad_Reader_Class.MonadReader(function () {
          return monadStateT(dictMonadReader["__superclass_Control.Monad.Monad_0"]());
      }, Control_Monad_Trans.lift(monadTransStateT)(dictMonadReader["__superclass_Control.Monad.Monad_0"]())(Control_Monad_Reader_Class.ask(dictMonadReader)), function (f) {
          return mapStateT(Control_Monad_Reader_Class.local(dictMonadReader)(f));
      });
  };
  var monadStateStateT = function (dictMonad) {
      return new Control_Monad_State_Class.MonadState(function () {
          return monadStateT(dictMonad);
      }, function (f) {
          return Data_Function.apply(StateT)(function ($95) {
              return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(f($95));
          });
      });
  };
  exports["StateT"] = StateT;
  exports["evalStateT"] = evalStateT;
  exports["execStateT"] = execStateT;
  exports["mapStateT"] = mapStateT;
  exports["runStateT"] = runStateT;
  exports["functorStateT"] = functorStateT;
  exports["applyStateT"] = applyStateT;
  exports["applicativeStateT"] = applicativeStateT;
  exports["bindStateT"] = bindStateT;
  exports["monadStateT"] = monadStateT;
  exports["monadTransStateT"] = monadTransStateT;
  exports["monadEffState"] = monadEffState;
  exports["monadReaderStateT"] = monadReaderStateT;
  exports["monadStateStateT"] = monadStateStateT;
})(PS["Control.Monad.State.Trans"] = PS["Control.Monad.State.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Cont_Trans = PS["Control.Monad.Cont.Trans"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Except_Trans = PS["Control.Monad.Except.Trans"];
  var Control_Monad_List_Trans = PS["Control.Monad.List.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_RWS_Trans = PS["Control.Monad.RWS.Trans"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var MonadAff = function (__superclass_Control$dotMonad$dotEff$dotClass$dotMonadEff_0, liftAff) {
      this["__superclass_Control.Monad.Eff.Class.MonadEff_0"] = __superclass_Control$dotMonad$dotEff$dotClass$dotMonadEff_0;
      this.liftAff = liftAff;
  };
  var monadAffAff = new MonadAff(function () {
      return Control_Monad_Aff.monadEffAff;
  }, Control_Category.id(Control_Category.categoryFn));
  var liftAff = function (dict) {
      return dict.liftAff;
  };
  var monadAffReader = function (dictMonadAff) {
      return new MonadAff(function () {
          return Control_Monad_Reader_Trans.monadEffReader(dictMonadAff["__superclass_Control.Monad.Eff.Class.MonadEff_0"]());
      }, function ($15) {
          return Control_Monad_Trans.lift(Control_Monad_Reader_Trans.monadTransReaderT)((dictMonadAff["__superclass_Control.Monad.Eff.Class.MonadEff_0"]())["__superclass_Control.Monad.Monad_0"]())(liftAff(dictMonadAff)($15));
      });
  };
  var monadAffState = function (dictMonadAff) {
      return new MonadAff(function () {
          return Control_Monad_State_Trans.monadEffState(dictMonadAff["__superclass_Control.Monad.Eff.Class.MonadEff_0"]());
      }, function ($16) {
          return Control_Monad_Trans.lift(Control_Monad_State_Trans.monadTransStateT)((dictMonadAff["__superclass_Control.Monad.Eff.Class.MonadEff_0"]())["__superclass_Control.Monad.Monad_0"]())(liftAff(dictMonadAff)($16));
      });
  };
  exports["MonadAff"] = MonadAff;
  exports["liftAff"] = liftAff;
  exports["monadAffAff"] = monadAffAff;
  exports["monadAffReader"] = monadAffReader;
  exports["monadAffState"] = monadAffState;
})(PS["Control.Monad.Aff.Class"] = PS["Control.Monad.Aff.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Aff_Class = PS["Control.Monad.Aff.Class"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];        
  var produceAff = function (recv) {
      return Control_Bind.bind(Control_Monad_Free_Trans.bindFreeT(Control_Coroutine.functorEmit)(Control_Monad_Aff.monadAff))(Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(Control_Coroutine.functorEmit))(Control_Monad_Aff.monadAff)(Control_Monad_Aff_AVar.makeVar))(function (v) {
          return Control_Bind.bind(Control_Monad_Free_Trans.bindFreeT(Control_Coroutine.functorEmit)(Control_Monad_Aff.monadAff))(Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(Control_Coroutine.functorEmit))(Control_Monad_Aff.monadAff)(Control_Monad_Aff.forkAff(recv(Control_Monad_Aff_AVar.putVar(v)))))(function () {
              return Control_Coroutine.producer(Control_Monad_Aff.monadAff)(Control_Monad_Aff_AVar.takeVar(v));
          });
      });
  };
  var produce = function (recv) {
      return produceAff(function (send) {
          return Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(recv(function ($3) {
              return Data_Functor["void"](Control_Monad_Eff.functorEff)(Control_Monad_Aff.runAff(Data_Function["const"](Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))(Control_Applicative.pure(Control_Monad_Eff.applicativeEff))(send($3)));
          }));
      });
  };
  exports["produce"] = produce;
  exports["produceAff"] = produceAff;
})(PS["Control.Coroutine.Aff"] = PS["Control.Coroutine.Aff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];        
  var Emit = (function () {
      function Emit(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Emit.create = function (value0) {
          return function (value1) {
              return new Emit(value0, value1);
          };
      };
      return Emit;
  })();
  var Stall = (function () {
      function Stall(value0) {
          this.value0 = value0;
      };
      Stall.create = function (value0) {
          return new Stall(value0);
      };
      return Stall;
  })();
  var runStallingProcess = function (dictMonadRec) {
      return function ($31) {
          return Control_Monad_Maybe_Trans.runMaybeT(Control_Monad_Free_Trans.runFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.monadRecMaybeT(dictMonadRec))(Data_Maybe.maybe(Control_Plus.empty(Control_Monad_Maybe_Trans.plusMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]())))(Control_Applicative.pure(Control_Monad_Maybe_Trans.applicativeMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))))(Control_Monad_Free_Trans.hoistFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.functorMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(function ($32) {
              return Control_Monad_Maybe_Trans.MaybeT(Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Maybe.Just.create)($32));
          })($31)));
      };
  };
  var producerToStallingProducer = function (dictFunctor) {
      return Control_Monad_Free_Trans.interpret(Control_Coroutine.functorEmit)(dictFunctor)(function (v) {
          return new Emit(v.value0, v.value1);
      });
  };
  var bifunctorStallF = new Data_Bifunctor.Bifunctor(function (f) {
      return function (g) {
          return function (v) {
              if (v instanceof Emit) {
                  return new Emit(f(v.value0), g(v.value1));
              };
              if (v instanceof Stall) {
                  return new Stall(g(v.value0));
              };
              throw new Error("Failed pattern match at Control.Coroutine.Stalling line 51, column 15 - line 53, column 27: " + [ v.constructor.name ]);
          };
      };
  });
  var functorStallF = new Data_Functor.Functor(function (f) {
      return Data_Bifunctor.rmap(bifunctorStallF)(f);
  });
  var fuse = function (dictMonadRec) {
      return function (dictMonadPar) {
          return Control_Coroutine.fuseWith(functorStallF)(Control_Coroutine.functorAwait)(Data_Maybe.functorMaybe)(dictMonadRec)(dictMonadPar)(function (f) {
              return function (q) {
                  return function (v) {
                      if (q instanceof Emit) {
                          return new Data_Maybe.Just(f(q.value1)(v(q.value0)));
                      };
                      if (q instanceof Stall) {
                          return Data_Maybe.Nothing.value;
                      };
                      throw new Error("Failed pattern match at Control.Coroutine.Stalling line 86, column 5 - line 88, column 27: " + [ q.constructor.name ]);
                  };
              };
          });
      };
  };
  exports["Emit"] = Emit;
  exports["Stall"] = Stall;
  exports["fuse"] = fuse;
  exports["producerToStallingProducer"] = producerToStallingProducer;
  exports["runStallingProcess"] = runStallingProcess;
  exports["bifunctorStallF"] = bifunctorStallF;
  exports["functorStallF"] = functorStallF;
})(PS["Control.Coroutine.Stalling"] = PS["Control.Coroutine.Stalling"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var otherwise = true;
  exports["otherwise"] = otherwise;
})(PS["Data.Boolean"] = PS["Data.Boolean"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Generic = PS["Data.Generic"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Control_Category = PS["Control.Category"];        
  var Nil = (function () {
      function Nil() {

      };
      Nil.value = new Nil();
      return Nil;
  })();
  var Cons = (function () {
      function Cons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Cons.create = function (value0) {
          return function (value1) {
              return new Cons(value0, value1);
          };
      };
      return Cons;
  })();
  var semigroupList = new Data_Semigroup.Semigroup(function (v) {
      return function (ys) {
          if (v instanceof Nil) {
              return ys;
          };
          if (v instanceof Cons) {
              return new Cons(v.value0, Data_Semigroup.append(semigroupList)(v.value1)(ys));
          };
          throw new Error("Failed pattern match at Data.List line 719, column 3 - line 719, column 21: " + [ v.constructor.name, ys.constructor.name ]);
      };
  });
  var reverse = (function () {
      var go = function (__copy_acc) {
          return function (__copy_v) {
              var acc = __copy_acc;
              var v = __copy_v;
              tco: while (true) {
                  if (v instanceof Nil) {
                      return acc;
                  };
                  if (v instanceof Cons) {
                      var __tco_acc = new Cons(v.value0, acc);
                      var __tco_v = v.value1;
                      acc = __tco_acc;
                      v = __tco_v;
                      continue tco;
                  };
                  throw new Error("Failed pattern match at Data.List line 346, column 1 - line 349, column 42: " + [ acc.constructor.name, v.constructor.name ]);
              };
          };
      };
      return go(Nil.value);
  })();
  var foldableList = new Data_Foldable.Foldable(function (dictMonoid) {
      return function (f) {
          return Data_Foldable.foldl(foldableList)(function (acc) {
              return function ($387) {
                  return Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(acc)(f($387));
              };
          })(Data_Monoid.mempty(dictMonoid));
      };
  }, (function () {
      var go = function (__copy_v) {
          return function (__copy_b) {
              return function (__copy_v1) {
                  var v = __copy_v;
                  var b = __copy_b;
                  var v1 = __copy_v1;
                  tco: while (true) {
                      if (v1 instanceof Nil) {
                          return b;
                      };
                      if (v1 instanceof Cons) {
                          var __tco_v = v;
                          var __tco_b = v(b)(v1.value0);
                          var __tco_v1 = v1.value1;
                          v = __tco_v;
                          b = __tco_b;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      throw new Error("Failed pattern match at Data.List line 734, column 3 - line 737, column 49: " + [ v.constructor.name, b.constructor.name, v1.constructor.name ]);
                  };
              };
          };
      };
      return go;
  })(), function (v) {
      return function (b) {
          return function (v1) {
              if (v1 instanceof Nil) {
                  return b;
              };
              if (v1 instanceof Cons) {
                  return v(v1.value0)(Data_Foldable.foldr(foldableList)(v)(b)(v1.value1));
              };
              throw new Error("Failed pattern match at Data.List line 732, column 3 - line 732, column 20: " + [ v.constructor.name, b.constructor.name, v1.constructor.name ]);
          };
      };
  });
  exports["Nil"] = Nil;
  exports["Cons"] = Cons;
  exports["reverse"] = reverse;
  exports["semigroupList"] = semigroupList;
  exports["foldableList"] = foldableList;
})(PS["Data.List"] = PS["Data.List"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Tuple = PS["Data.Tuple"];        
  var CatQueue = (function () {
      function CatQueue(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatQueue.create = function (value0) {
          return function (value1) {
              return new CatQueue(value0, value1);
          };
      };
      return CatQueue;
  })();
  var uncons = function (__copy_v) {
      var v = __copy_v;
      tco: while (true) {
          if (v.value0 instanceof Data_List.Nil && v.value1 instanceof Data_List.Nil) {
              return Data_Maybe.Nothing.value;
          };
          if (v.value0 instanceof Data_List.Nil) {
              var __tco_v = new CatQueue(Data_List.reverse(v.value1), Data_List.Nil.value);
              v = __tco_v;
              continue tco;
          };
          if (v.value0 instanceof Data_List.Cons) {
              return new Data_Maybe.Just(new Data_Tuple.Tuple(v.value0.value0, new CatQueue(v.value0.value1, v.value1)));
          };
          throw new Error("Failed pattern match at Data.CatQueue line 51, column 1 - line 51, column 36: " + [ v.constructor.name ]);
      };
  };
  var snoc = function (v) {
      return function (a) {
          return new CatQueue(v.value0, new Data_List.Cons(a, v.value1));
      };
  };
  var $$null = function (v) {
      if (v.value0 instanceof Data_List.Nil && v.value1 instanceof Data_List.Nil) {
          return true;
      };
      return false;
  };
  var empty = new CatQueue(Data_List.Nil.value, Data_List.Nil.value);
  exports["CatQueue"] = CatQueue;
  exports["empty"] = empty;
  exports["null"] = $$null;
  exports["snoc"] = snoc;
  exports["uncons"] = uncons;
})(PS["Data.CatQueue"] = PS["Data.CatQueue"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_CatQueue = PS["Data.CatQueue"];
  var Data_Foldable_1 = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable_1 = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];        
  var CatNil = (function () {
      function CatNil() {

      };
      CatNil.value = new CatNil();
      return CatNil;
  })();
  var CatCons = (function () {
      function CatCons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatCons.create = function (value0) {
          return function (value1) {
              return new CatCons(value0, value1);
          };
      };
      return CatCons;
  })();
  var link = function (v) {
      return function (cat) {
          if (v instanceof CatNil) {
              return cat;
          };
          if (v instanceof CatCons) {
              return new CatCons(v.value0, Data_CatQueue.snoc(v.value1)(cat));
          };
          throw new Error("Failed pattern match at Data.CatList line 111, column 1 - line 111, column 22: " + [ v.constructor.name, cat.constructor.name ]);
      };
  };
  var foldr = function (k) {
      return function (b) {
          return function (q) {
              var foldl = function (__copy_v) {
                  return function (__copy_c) {
                      return function (__copy_v1) {
                          var v = __copy_v;
                          var c = __copy_c;
                          var v1 = __copy_v1;
                          tco: while (true) {
                              if (v1 instanceof Data_List.Nil) {
                                  return c;
                              };
                              if (v1 instanceof Data_List.Cons) {
                                  var __tco_v = v;
                                  var __tco_c = v(c)(v1.value0);
                                  var __tco_v1 = v1.value1;
                                  v = __tco_v;
                                  c = __tco_c;
                                  v1 = __tco_v1;
                                  continue tco;
                              };
                              throw new Error("Failed pattern match at Data.CatList line 126, column 3 - line 126, column 22: " + [ v.constructor.name, c.constructor.name, v1.constructor.name ]);
                          };
                      };
                  };
              };
              var go = function (__copy_xs) {
                  return function (__copy_ys) {
                      var xs = __copy_xs;
                      var ys = __copy_ys;
                      tco: while (true) {
                          var $33 = Data_CatQueue.uncons(xs);
                          if ($33 instanceof Data_Maybe.Nothing) {
                              return foldl(function (x) {
                                  return function (i) {
                                      return i(x);
                                  };
                              })(b)(ys);
                          };
                          if ($33 instanceof Data_Maybe.Just) {
                              var __tco_ys = new Data_List.Cons(k($33.value0.value0), ys);
                              xs = $33.value0.value1;
                              ys = __tco_ys;
                              continue tco;
                          };
                          throw new Error("Failed pattern match at Data.CatList line 121, column 14 - line 123, column 67: " + [ $33.constructor.name ]);
                      };
                  };
              };
              return go(q)(Data_List.Nil.value);
          };
      };
  };
  var uncons = function (v) {
      if (v instanceof CatNil) {
          return Data_Maybe.Nothing.value;
      };
      if (v instanceof CatCons) {
          return new Data_Maybe.Just(new Data_Tuple.Tuple(v.value0, (function () {
              var $38 = Data_CatQueue["null"](v.value1);
              if ($38) {
                  return CatNil.value;
              };
              if (!$38) {
                  return foldr(link)(CatNil.value)(v.value1);
              };
              throw new Error("Failed pattern match at Data.CatList line 103, column 39 - line 103, column 89: " + [ $38.constructor.name ]);
          })()));
      };
      throw new Error("Failed pattern match at Data.CatList line 102, column 1 - line 102, column 24: " + [ v.constructor.name ]);
  }; 
  var empty = CatNil.value;
  var append = function (v) {
      return function (v1) {
          if (v1 instanceof CatNil) {
              return v;
          };
          if (v instanceof CatNil) {
              return v1;
          };
          return link(v)(v1);
      };
  }; 
  var semigroupCatList = new Data_Semigroup.Semigroup(append);
  var snoc = function (cat) {
      return function (a) {
          return append(cat)(new CatCons(a, Data_CatQueue.empty));
      };
  };
  exports["CatNil"] = CatNil;
  exports["CatCons"] = CatCons;
  exports["append"] = append;
  exports["empty"] = empty;
  exports["snoc"] = snoc;
  exports["uncons"] = uncons;
  exports["semigroupCatList"] = semigroupCatList;
})(PS["Data.CatList"] = PS["Data.CatList"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_CatList = PS["Data.CatList"];
  var Data_Either = PS["Data.Either"];
  var Data_Inject = PS["Data.Inject"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Free = (function () {
      function Free(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Free.create = function (value0) {
          return function (value1) {
              return new Free(value0, value1);
          };
      };
      return Free;
  })();
  var Return = (function () {
      function Return(value0) {
          this.value0 = value0;
      };
      Return.create = function (value0) {
          return new Return(value0);
      };
      return Return;
  })();
  var Bind = (function () {
      function Bind(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bind.create = function (value0) {
          return function (value1) {
              return new Bind(value0, value1);
          };
      };
      return Bind;
  })();
  var toView = function (__copy_v) {
      var v = __copy_v;
      tco: while (true) {
          var runExpF = function (v2) {
              return v2;
          };
          var concatF = function (v2) {
              return function (r) {
                  return new Free(v2.value0, Data_Semigroup.append(Data_CatList.semigroupCatList)(v2.value1)(r));
              };
          };
          if (v.value0 instanceof Return) {
              var $20 = Data_CatList.uncons(v.value1);
              if ($20 instanceof Data_Maybe.Nothing) {
                  return new Return(Unsafe_Coerce.unsafeCoerce(v.value0.value0));
              };
              if ($20 instanceof Data_Maybe.Just) {
                  var __tco_v = Unsafe_Coerce.unsafeCoerce(concatF(runExpF($20.value0.value0)(v.value0.value0))($20.value0.value1));
                  v = __tco_v;
                  continue tco;
              };
              throw new Error("Failed pattern match at Control.Monad.Free line 171, column 7 - line 175, column 64: " + [ $20.constructor.name ]);
          };
          if (v.value0 instanceof Bind) {
              return new Bind(v.value0.value0, function (a) {
                  return Unsafe_Coerce.unsafeCoerce(concatF(v.value0.value1(a))(v.value1));
              });
          };
          throw new Error("Failed pattern match at Control.Monad.Free line 169, column 3 - line 177, column 56: " + [ v.value0.constructor.name ]);
      };
  };
  var runFreeM = function (dictFunctor) {
      return function (dictMonadRec) {
          return function (k) {
              var go = function (f) {
                  var $29 = toView(f);
                  if ($29 instanceof Return) {
                      return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Right.create)(Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())($29.value0));
                  };
                  if ($29 instanceof Bind) {
                      return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Left.create)(k(Data_Functor.map(dictFunctor)($29.value1)($29.value0)));
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free line 147, column 10 - line 149, column 37: " + [ $29.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(go);
          };
      };
  };
  var fromView = function (f) {
      return new Free(Unsafe_Coerce.unsafeCoerce(f), Data_CatList.empty);
  };
  var freeMonad = new Control_Monad.Monad(function () {
      return freeApplicative;
  }, function () {
      return freeBind;
  });
  var freeFunctor = new Data_Functor.Functor(function (k) {
      return function (f) {
          return Control_Bind.bindFlipped(freeBind)(function ($53) {
              return Control_Applicative.pure(freeApplicative)(k($53));
          })(f);
      };
  });
  var freeBind = new Control_Bind.Bind(function () {
      return freeApply;
  }, function (v) {
      return function (k) {
          return new Free(v.value0, Data_CatList.snoc(v.value1)(Unsafe_Coerce.unsafeCoerce(k)));
      };
  });
  var freeApply = new Control_Apply.Apply(function () {
      return freeFunctor;
  }, Control_Monad.ap(freeMonad));
  var freeApplicative = new Control_Applicative.Applicative(function () {
      return freeApply;
  }, function ($54) {
      return fromView(Return.create($54));
  });
  var liftF = function (f) {
      return fromView(new Bind(Unsafe_Coerce.unsafeCoerce(f), function ($55) {
          return Control_Applicative.pure(freeApplicative)(Unsafe_Coerce.unsafeCoerce($55));
      }));
  };
  exports["liftF"] = liftF;
  exports["runFreeM"] = runFreeM;
  exports["freeFunctor"] = freeFunctor;
  exports["freeBind"] = freeBind;
  exports["freeApplicative"] = freeApplicative;
  exports["freeApply"] = freeApply;
  exports["freeMonad"] = freeMonad;
})(PS["Control.Monad.Free"] = PS["Control.Monad.Free"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Cont_Trans = PS["Control.Monad.Cont.Trans"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Except_Trans = PS["Control.Monad.Except.Trans"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_List_Trans = PS["Control.Monad.List.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_RWS_Trans = PS["Control.Monad.RWS.Trans"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var Affable = function (fromAff) {
      this.fromAff = fromAff;
  };
  var fromAff = function (dict) {
      return dict.fromAff;
  };
  var fromEff = function (dictAffable) {
      return function (eff) {
          return fromAff(dictAffable)(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(eff));
      };
  };
  var affableFree = function (dictAffable) {
      return new Affable(function ($28) {
          return Control_Monad_Free.liftF(fromAff(dictAffable)($28));
      });
  };
  var affableAff = new Affable(Control_Category.id(Control_Category.categoryFn));
  exports["Affable"] = Affable;
  exports["fromAff"] = fromAff;
  exports["fromEff"] = fromEff;
  exports["affableAff"] = affableAff;
  exports["affableFree"] = affableFree;
})(PS["Control.Monad.Aff.Free"] = PS["Control.Monad.Aff.Free"] || {});
(function(exports) {
    "use strict";

  // module Control.Monad.Eff.Console

  exports.log = function (s) {
    return function () {
      console.log(s);
      return {};
    };
  };
})(PS["Control.Monad.Eff.Console"] = PS["Control.Monad.Eff.Console"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Eff.Console"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Show = PS["Data.Show"];
  var Data_Unit = PS["Data.Unit"];
  exports["log"] = $foreign.log;
})(PS["Control.Monad.Eff.Console"] = PS["Control.Monad.Eff.Console"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var runState = function (v) {
      return function ($14) {
          return Data_Identity.runIdentity(v($14));
      };
  };
  exports["runState"] = runState;
})(PS["Control.Monad.State"] = PS["Control.Monad.State"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var runWriter = function ($0) {
      return Data_Identity.runIdentity(Control_Monad_Writer_Trans.runWriterT($0));
  };
  exports["runWriter"] = runWriter;
})(PS["Control.Monad.Writer"] = PS["Control.Monad.Writer"] || {});
(function(exports) {
    "use strict";

  exports.eventListener = function (fn) {
    return function (event) {
      return fn(event)();
    };
  };

  exports.addEventListener = function (type) {
    return function (listener) {
      return function (useCapture) {
        return function (target) {
          return function () {
            target.addEventListener(type, listener, useCapture);
            return {};
          };
        };
      };
    };
  };
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Event.EventTarget"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var DOM = PS["DOM"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  exports["addEventListener"] = $foreign.addEventListener;
  exports["eventListener"] = $foreign.eventListener;
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  /* global window */
  "use strict";

  exports.window = function () {
    return window;
  };
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
    "use strict";

  exports._readHTMLElement = function (failure) {
    return function (success) {
      return function (value) {
        var tag = Object.prototype.toString.call(value);
        if (tag.indexOf("[object HTML") === 0 && tag.indexOf("Element]") === tag.length - 8) {
          return success(value);
        } else {
          return failure(tag);
        }
      };
    };
  };
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  /* global exports */
  "use strict";
  // jshint maxparams: 1

  exports.toForeign = function (value) {
    return value;
  };

  exports.unsafeFromForeign = function (value) {
    return value;
  };

  exports.typeOf = function (value) {
    return typeof value;
  };

  exports.tagOf = function (value) {
    return Object.prototype.toString.call(value).slice(8, -1);
  };

  exports.isNull = function (value) {
    return value === null;
  };

  exports.isUndefined = function (value) {
    return value === undefined;
  };
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
    "use strict";

  // module Data.Int

  exports.fromNumberImpl = function (just) {
    return function (nothing) {
      return function (n) {
        /* jshint bitwise: false */
        return (n | 0) === n ? just(n) : nothing;
      };
    };
  };

  exports.toNumber = function (n) {
    return n;
  };
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
    "use strict";        

  exports.floor = Math.floor;

  exports.max = function (n1) {
    return function (n2) {
      return Math.max(n1, n2);
    };
  };
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Math"];
  exports["floor"] = $foreign.floor;
  exports["max"] = $foreign.max;
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Int"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Int_Bits = PS["Data.Int.Bits"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Ord = PS["Data.Ord"];
  var $$Math = PS["Math"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var fromNumber = $foreign.fromNumberImpl(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var unsafeClamp = function (x) {
      if (x >= $foreign.toNumber(Data_Bounded.top(Data_Bounded.boundedInt))) {
          return Data_Bounded.top(Data_Bounded.boundedInt);
      };
      if (x <= $foreign.toNumber(Data_Bounded.bottom(Data_Bounded.boundedInt))) {
          return Data_Bounded.bottom(Data_Bounded.boundedInt);
      };
      if (Data_Boolean.otherwise) {
          return Partial_Unsafe.unsafePartial(function (dictPartial) {
              return Data_Maybe.fromJust(dictPartial)(fromNumber(x));
          });
      };
      throw new Error("Failed pattern match at Data.Int line 65, column 1 - line 68, column 56: " + [ x.constructor.name ]);
  };
  var floor = function ($4) {
      return unsafeClamp($$Math.floor($4));
  };
  exports["floor"] = floor;
  exports["fromNumber"] = fromNumber;
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.String

  exports._charAt = function (just) {
    return function (nothing) {
      return function (i) {
        return function (s) {
          return i >= 0 && i < s.length ? just(s.charAt(i)) : nothing;
        };
      };
    };
  };

  exports.singleton = function (c) {
    return c;
  };

  exports.fromCharArray = function (a) {
    return a.join("");
  };

  exports._indexOf = function (just) {
    return function (nothing) {
      return function (x) {
        return function (s) {
          var i = s.indexOf(x);
          return i === -1 ? nothing : just(i);
        };
      };
    };
  };

  exports.length = function (s) {
    return s.length;
  };

  exports.drop = function (n) {
    return function (s) {
      return s.substring(n);
    };
  };

  exports.split = function (sep) {
    return function (s) {
      return s.split(sep);
    };
  };

  exports.toCharArray = function (s) {
    return s.split("");
  };
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.String"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String_Unsafe = PS["Data.String.Unsafe"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Function = PS["Data.Function"];                                                    
  var indexOf = $foreign._indexOf(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);      
  var charAt = $foreign._charAt(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  exports["charAt"] = charAt;
  exports["indexOf"] = indexOf;
  exports["drop"] = $foreign.drop;
  exports["fromCharArray"] = $foreign.fromCharArray;
  exports["length"] = $foreign.length;
  exports["singleton"] = $foreign.singleton;
  exports["split"] = $foreign.split;
  exports["toCharArray"] = $foreign.toCharArray;
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foreign"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Int = PS["Data.Int"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var TypeMismatch = (function () {
      function TypeMismatch(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      TypeMismatch.create = function (value0) {
          return function (value1) {
              return new TypeMismatch(value0, value1);
          };
      };
      return TypeMismatch;
  })();
  var ErrorAtProperty = (function () {
      function ErrorAtProperty(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      ErrorAtProperty.create = function (value0) {
          return function (value1) {
              return new ErrorAtProperty(value0, value1);
          };
      };
      return ErrorAtProperty;
  })();
  var unsafeReadTagged = function (tag) {
      return function (value) {
          if ($foreign.tagOf(value) === tag) {
              return Control_Applicative.pure(Data_Either.applicativeEither)($foreign.unsafeFromForeign(value));
          };
          return new Data_Either.Left(new TypeMismatch(tag, $foreign.tagOf(value)));
      };
  }; 
  var readString = unsafeReadTagged("String");
  exports["TypeMismatch"] = TypeMismatch;
  exports["ErrorAtProperty"] = ErrorAtProperty;
  exports["readString"] = readString;
  exports["unsafeReadTagged"] = unsafeReadTagged;
  exports["isNull"] = $foreign.isNull;
  exports["isUndefined"] = $foreign.isUndefined;
  exports["toForeign"] = $foreign.toForeign;
  exports["typeOf"] = $foreign.typeOf;
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.fromFoldableImpl = (function () {
    // jshint maxparams: 2
    function Cons(head, tail) {
      this.head = head;
      this.tail = tail;
    }
    var emptyList = {};

    function curryCons(head) {
      return function (tail) {
        return new Cons(head, tail);
      };
    }

    function listToArray(list) {
      var result = [];
      var count = 0;
      while (list !== emptyList) {
        result[count++] = list.head;
        list = list.tail;
      }
      return result;
    }

    return function (foldr) {
      return function (xs) {
        return listToArray(foldr(curryCons)(emptyList)(xs));
      };
    };
  })();

  //------------------------------------------------------------------------------
  // Array size ------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.length = function (xs) {
    return xs.length;
  };

  //------------------------------------------------------------------------------
  // Extending arrays ------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.cons = function (e) {
    return function (l) {
      return [e].concat(l);
    };
  };

  exports.concat = function (xss) {
    var result = [];
    for (var i = 0, l = xss.length; i < l; i++) {
      var xs = xss[i];
      for (var j = 0, m = xs.length; j < m; j++) {
        result.push(xs[j]);
      }
    }
    return result;
  };
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Array"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Data_Function = PS["Data.Function"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Category = PS["Control.Category"];
  var singleton = function (a) {
      return [ a ];
  };
  var some = function (dictAlternative) {
      return function (dictLazy) {
          return function (v) {
              return Control_Apply.apply((dictAlternative["__superclass_Control.Applicative.Applicative_0"]())["__superclass_Control.Apply.Apply_0"]())(Data_Functor.map(((dictAlternative["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())["__superclass_Data.Functor.Functor_0"]())($foreign.cons)(v))(Control_Lazy.defer(dictLazy)(function (v1) {
                  return many(dictAlternative)(dictLazy)(v);
              }));
          };
      };
  };
  var many = function (dictAlternative) {
      return function (dictLazy) {
          return function (v) {
              return Control_Alt.alt((dictAlternative["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())(some(dictAlternative)(dictLazy)(v))(Control_Applicative.pure(dictAlternative["__superclass_Control.Applicative.Applicative_0"]())([  ]));
          };
      };
  };
  var fromFoldable = function (dictFoldable) {
      return $foreign.fromFoldableImpl(Data_Foldable.foldr(dictFoldable));
  };
  exports["fromFoldable"] = fromFoldable;
  exports["many"] = many;
  exports["singleton"] = singleton;
  exports["some"] = some;
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // jshint maxparams: 4
  exports.unsafeReadPropImpl = function (f, s, key, value) {
    return value == null ? f : s(value[key]);
  };

  // jshint maxparams: 2
  exports.unsafeHasOwnProperty = function (prop, value) {
    return Object.prototype.hasOwnProperty.call(value, prop);
  };

  exports.unsafeHasProperty = function (prop, value) {
    return prop in value;
  };
})(PS["Data.Foreign.Index"] = PS["Data.Foreign.Index"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foreign.Index"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];        
  var Index = function (errorAt, hasOwnProperty, hasProperty, ix) {
      this.errorAt = errorAt;
      this.hasOwnProperty = hasOwnProperty;
      this.hasProperty = hasProperty;
      this.ix = ix;
  };
  var unsafeReadProp = function (k) {
      return function (value) {
          return $foreign.unsafeReadPropImpl(new Data_Either.Left(new Data_Foreign.TypeMismatch("object", Data_Foreign.typeOf(value))), Control_Applicative.pure(Data_Either.applicativeEither), k, value);
      };
  };
  var prop = unsafeReadProp;
  var ix = function (dict) {
      return dict.ix;
  };                         
  var hasPropertyImpl = function (v) {
      return function (value) {
          if (Data_Foreign.isNull(value)) {
              return false;
          };
          if (Data_Foreign.isUndefined(value)) {
              return false;
          };
          if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
              return $foreign.unsafeHasProperty(v, value);
          };
          return false;
      };
  };
  var hasProperty = function (dict) {
      return dict.hasProperty;
  };
  var hasOwnPropertyImpl = function (v) {
      return function (value) {
          if (Data_Foreign.isNull(value)) {
              return false;
          };
          if (Data_Foreign.isUndefined(value)) {
              return false;
          };
          if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
              return $foreign.unsafeHasOwnProperty(v, value);
          };
          return false;
      };
  };                                                                                                                         
  var indexString = new Index(Data_Foreign.ErrorAtProperty.create, hasOwnPropertyImpl, hasPropertyImpl, Data_Function.flip(prop));
  var hasOwnProperty = function (dict) {
      return dict.hasOwnProperty;
  };
  var errorAt = function (dict) {
      return dict.errorAt;
  };
  exports["Index"] = Index;
  exports["errorAt"] = errorAt;
  exports["hasOwnProperty"] = hasOwnProperty;
  exports["hasProperty"] = hasProperty;
  exports["ix"] = ix;
  exports["prop"] = prop;
  exports["indexString"] = indexString;
})(PS["Data.Foreign.Index"] = PS["Data.Foreign.Index"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Index = PS["Data.Foreign.Index"];
  var Data_Foreign_Null = PS["Data.Foreign.Null"];
  var Data_Foreign_NullOrUndefined = PS["Data.Foreign.NullOrUndefined"];
  var Data_Foreign_Undefined = PS["Data.Foreign.Undefined"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];        
  var IsForeign = function (read) {
      this.read = read;
  };
  var stringIsForeign = new IsForeign(Data_Foreign.readString);
  var read = function (dict) {
      return dict.read;
  };
  var readWith = function (dictIsForeign) {
      return function (f) {
          return function (value) {
              return Data_Either.either(function ($19) {
                  return Data_Either.Left.create(f($19));
              })(Data_Either.Right.create)(read(dictIsForeign)(value));
          };
      };
  };
  var readProp = function (dictIsForeign) {
      return function (dictIndex) {
          return function (prop) {
              return function (value) {
                  return Control_Bind.bind(Data_Either.bindEither)(Data_Foreign_Index.ix(dictIndex)(value)(prop))(readWith(dictIsForeign)(Data_Foreign_Index.errorAt(dictIndex)(prop)));
              };
          };
      };
  };
  exports["IsForeign"] = IsForeign;
  exports["read"] = read;
  exports["readProp"] = readProp;
  exports["readWith"] = readWith;
  exports["stringIsForeign"] = stringIsForeign;
})(PS["Data.Foreign.Class"] = PS["Data.Foreign.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML.Types"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Class = PS["Data.Foreign.Class"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var windowToEventTarget = Unsafe_Coerce.unsafeCoerce;                        
  var readHTMLElement = $foreign._readHTMLElement(function ($0) {
      return Data_Either.Left.create(Data_Foreign.TypeMismatch.create("HTMLElement")($0));
  })(Data_Either.Right.create);                                          
  var htmlElementToNode = Unsafe_Coerce.unsafeCoerce;   
  var htmlDocumentToParentNode = Unsafe_Coerce.unsafeCoerce;
  exports["htmlDocumentToParentNode"] = htmlDocumentToParentNode;
  exports["htmlElementToNode"] = htmlElementToNode;
  exports["readHTMLElement"] = readHTMLElement;
  exports["windowToEventTarget"] = windowToEventTarget;
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["window"] = $foreign.window;
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var load = "load";
  exports["load"] = load;
})(PS["DOM.HTML.Event.EventTypes"] = PS["DOM.HTML.Event.EventTypes"] || {});
(function(exports) {
    "use strict";

  exports.document = function (window) {
    return function () {
      return window.document;
    };
  };
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML.Window"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["document"] = $foreign.document;
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
    "use strict";

  exports.appendChild = function (node) {
    return function (parent) {
      return function () {
        return parent.appendChild(node);
      };
    };
  };
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports["null"] = null;

  exports.nullable = function(a, r, f) {
      return a == null ? r : f(a);
  };

  exports.notNull = function(x) {
      return x;
  };
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Nullable"];
  var Prelude = PS["Prelude"];
  var Data_Function = PS["Data.Function"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Show = PS["Data.Show"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ord = PS["Data.Ord"];        
  var toNullable = Data_Maybe.maybe($foreign["null"])($foreign.notNull);
  var toMaybe = function (n) {
      return $foreign.nullable(n, Data_Maybe.Nothing.value, Data_Maybe.Just.create);
  };
  exports["toMaybe"] = toMaybe;
  exports["toNullable"] = toNullable;
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Node.Node"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Enum = PS["Data.Enum"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Maybe = PS["Data.Maybe"];
  var DOM = PS["DOM"];
  var DOM_Node_NodeType = PS["DOM.Node.NodeType"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  exports["appendChild"] = $foreign.appendChild;
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
    "use strict";                                             

  exports.querySelector = function (selector) {
    return function (node) {
      return function () {
        return node.querySelector(selector);
      };
    };
  };
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Node.ParentNode"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Nullable = PS["Data.Nullable"];
  var DOM = PS["DOM"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  exports["querySelector"] = $foreign.querySelector;
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.fromCharCode = function (c) {
    return String.fromCharCode(c);
  };
})(PS["Data.Char"] = PS["Data.Char"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Char"];
  exports["fromCharCode"] = $foreign.fromCharCode;
})(PS["Data.Char"] = PS["Data.Char"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Unsafe_Coerce = PS["Unsafe.Coerce"];        
  var runExistsR = Unsafe_Coerce.unsafeCoerce;
  var mkExistsR = Unsafe_Coerce.unsafeCoerce;
  exports["mkExistsR"] = mkExistsR;
  exports["runExistsR"] = runExistsR;
})(PS["Data.ExistsR"] = PS["Data.ExistsR"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Lazy

  exports.defer = function () {

    function Defer(thunk) {
      if (this instanceof Defer) {
        this.thunk = thunk;
        return this;
      } else {
        return new Defer(thunk);
      }
    }

    Defer.prototype.force = function () {
      var value = this.thunk();
      this.thunk = null;
      this.force = function () {
        return value;
      };
      return value;
    };

    return Defer;

  }();

  exports.force = function (l) {
    return l.force();
  };
})(PS["Data.Lazy"] = PS["Data.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Lazy"];
  var Prelude = PS["Prelude"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Lazy = PS["Control.Lazy"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Ring = PS["Data.Ring"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Field = PS["Data.Field"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Show = PS["Data.Show"];
  var Data_Unit = PS["Data.Unit"];
  exports["defer"] = $foreign.defer;
  exports["force"] = $foreign.force;
})(PS["Data.Lazy"] = PS["Data.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine_Aff = PS["Control.Coroutine.Aff"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Data_Const = PS["Data.Const"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_Maybe = PS["Data.Maybe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];        
  var EventSource = function (x) {
      return x;
  };                                                   
  var runEventSource = function (v) {
      return v;
  };
  var produce = function (dictFunctor) {
      return function (dictAffable) {
          return function ($11) {
              return Control_Coroutine_Stalling.producerToStallingProducer(dictFunctor)(Control_Monad_Free_Trans.hoistFreeT(Control_Coroutine.functorEmit)(dictFunctor)(Control_Monad_Aff_Free.fromAff(dictAffable))(Control_Coroutine_Aff.produce($11)));
          };
      };
  };
  exports["EventSource"] = EventSource;
  exports["produce"] = produce;
  exports["runEventSource"] = runEventSource;
})(PS["Halogen.Query.EventSource"] = PS["Halogen.Query.EventSource"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Applicative = PS["Control.Applicative"];        
  var Get = (function () {
      function Get(value0) {
          this.value0 = value0;
      };
      Get.create = function (value0) {
          return new Get(value0);
      };
      return Get;
  })();
  var Modify = (function () {
      function Modify(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Modify.create = function (value0) {
          return function (value1) {
              return new Modify(value0, value1);
          };
      };
      return Modify;
  })();
  var stateN = function (dictMonad) {
      return function (dictMonadState) {
          return function (v) {
              if (v instanceof Get) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(Control_Monad_State_Class.get(dictMonadState))(function ($22) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v.value0($22));
                  });
              };
              if (v instanceof Modify) {
                  return Data_Functor.voidLeft(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Control_Monad_State_Class.modify(dictMonadState)(v.value0))(v.value1);
              };
              throw new Error("Failed pattern match at Halogen.Query.StateF line 33, column 1 - line 33, column 40: " + [ v.constructor.name ]);
          };
      };
  };
  var functorStateF = new Data_Functor.Functor(function (f) {
      return function (v) {
          if (v instanceof Get) {
              return new Get(function ($24) {
                  return f(v.value0($24));
              });
          };
          if (v instanceof Modify) {
              return new Modify(v.value0, f(v.value1));
          };
          throw new Error("Failed pattern match at Halogen.Query.StateF line 21, column 3 - line 21, column 32: " + [ f.constructor.name, v.constructor.name ]);
      };
  });
  exports["Get"] = Get;
  exports["Modify"] = Modify;
  exports["stateN"] = stateN;
  exports["functorStateF"] = functorStateF;
})(PS["Halogen.Query.StateF"] = PS["Halogen.Query.StateF"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];        
  var Pending = (function () {
      function Pending() {

      };
      Pending.value = new Pending();
      return Pending;
  })();
  var StateHF = (function () {
      function StateHF(value0) {
          this.value0 = value0;
      };
      StateHF.create = function (value0) {
          return new StateHF(value0);
      };
      return StateHF;
  })();
  var SubscribeHF = (function () {
      function SubscribeHF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SubscribeHF.create = function (value0) {
          return function (value1) {
              return new SubscribeHF(value0, value1);
          };
      };
      return SubscribeHF;
  })();
  var QueryHF = (function () {
      function QueryHF(value0) {
          this.value0 = value0;
      };
      QueryHF.create = function (value0) {
          return new QueryHF(value0);
      };
      return QueryHF;
  })();
  var RenderHF = (function () {
      function RenderHF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      RenderHF.create = function (value0) {
          return function (value1) {
              return new RenderHF(value0, value1);
          };
      };
      return RenderHF;
  })();
  var RenderPendingHF = (function () {
      function RenderPendingHF(value0) {
          this.value0 = value0;
      };
      RenderPendingHF.create = function (value0) {
          return new RenderPendingHF(value0);
      };
      return RenderPendingHF;
  })();
  var HaltHF = (function () {
      function HaltHF(value0) {
          this.value0 = value0;
      };
      HaltHF.create = function (value0) {
          return new HaltHF(value0);
      };
      return HaltHF;
  })();
  var functorHalogenF = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (h) {
              if (h instanceof StateHF) {
                  return new StateHF(Data_Functor.map(Halogen_Query_StateF.functorStateF)(f)(h.value0));
              };
              if (h instanceof SubscribeHF) {
                  return new SubscribeHF(h.value0, f(h.value1));
              };
              if (h instanceof QueryHF) {
                  return new QueryHF(Data_Functor.map(dictFunctor)(f)(h.value0));
              };
              if (h instanceof RenderHF) {
                  return new RenderHF(h.value0, f(h.value1));
              };
              if (h instanceof RenderPendingHF) {
                  return new RenderPendingHF(Data_Functor.map(Data_Functor.functorFn)(f)(h.value0));
              };
              if (h instanceof HaltHF) {
                  return new HaltHF(h.value0);
              };
              throw new Error("Failed pattern match at Halogen.Query.HalogenF line 37, column 5 - line 43, column 31: " + [ h.constructor.name ]);
          };
      });
  };
  var affableHalogenF = function (dictAffable) {
      return new Control_Monad_Aff_Free.Affable(function ($38) {
          return QueryHF.create(Control_Monad_Aff_Free.fromAff(dictAffable)($38));
      });
  };
  exports["StateHF"] = StateHF;
  exports["SubscribeHF"] = SubscribeHF;
  exports["QueryHF"] = QueryHF;
  exports["RenderHF"] = RenderHF;
  exports["RenderPendingHF"] = RenderPendingHF;
  exports["HaltHF"] = HaltHF;
  exports["Pending"] = Pending;
  exports["functorHalogenF"] = functorHalogenF;
  exports["affableHalogenF"] = affableHalogenF;
})(PS["Halogen.Query.HalogenF"] = PS["Halogen.Query.HalogenF"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var PostRender = (function () {
      function PostRender(value0) {
          this.value0 = value0;
      };
      PostRender.create = function (value0) {
          return new PostRender(value0);
      };
      return PostRender;
  })();
  var Finalized = (function () {
      function Finalized(value0) {
          this.value0 = value0;
      };
      Finalized.create = function (value0) {
          return new Finalized(value0);
      };
      return Finalized;
  })();
  var FinalizedF = (function () {
      function FinalizedF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      FinalizedF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new FinalizedF(value0, value1, value2);
              };
          };
      };
      return FinalizedF;
  })();
  var runFinalized = function (k) {
      return function (f) {
          var $6 = Unsafe_Coerce.unsafeCoerce(f);
          return k($6.value0)($6.value1)($6.value2);
      };
  };
  var finalized = function (e) {
      return function (s) {
          return function (i) {
              return Unsafe_Coerce.unsafeCoerce(new FinalizedF(e, s, i));
          };
      };
  };
  exports["PostRender"] = PostRender;
  exports["Finalized"] = Finalized;
  exports["finalized"] = finalized;
  exports["runFinalized"] = runFinalized;
})(PS["Halogen.Component.Hook"] = PS["Halogen.Component.Hook"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Halogen.HTML.Events.Handler

  exports.preventDefaultImpl = function (e) {
    return function () {
      e.preventDefault();
    };
  };

  exports.stopPropagationImpl = function (e) {
    return function () {
      e.stopPropagation();
    };
  };

  exports.stopImmediatePropagationImpl = function (e) {
    return function () {
      e.stopImmediatePropagation();
    };
  };
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Halogen.HTML.Events.Handler"];
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Writer = PS["Control.Monad.Writer"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM = PS["DOM"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var PreventDefault = (function () {
      function PreventDefault() {

      };
      PreventDefault.value = new PreventDefault();
      return PreventDefault;
  })();
  var StopPropagation = (function () {
      function StopPropagation() {

      };
      StopPropagation.value = new StopPropagation();
      return StopPropagation;
  })();
  var StopImmediatePropagation = (function () {
      function StopImmediatePropagation() {

      };
      StopImmediatePropagation.value = new StopImmediatePropagation();
      return StopImmediatePropagation;
  })();
  var EventHandler = function (x) {
      return x;
  };                                                                                                                                                                                                      
  var runEventHandler = function (dictMonad) {
      return function (dictMonadEff) {
          return function (e) {
              return function (v) {
                  var applyUpdate = function (v1) {
                      if (v1 instanceof PreventDefault) {
                          return $foreign.preventDefaultImpl(e);
                      };
                      if (v1 instanceof StopPropagation) {
                          return $foreign.stopPropagationImpl(e);
                      };
                      if (v1 instanceof StopImmediatePropagation) {
                          return $foreign.stopImmediatePropagationImpl(e);
                      };
                      throw new Error("Failed pattern match at Halogen.HTML.Events.Handler line 89, column 3 - line 89, column 63: " + [ v1.constructor.name ]);
                  };
                  var $13 = Control_Monad_Writer.runWriter(v);
                  return Data_Function.apply(Control_Monad_Eff_Class.liftEff(dictMonadEff))(Control_Apply.applySecond(Control_Monad_Eff.applyEff)(Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)($13.value1)(applyUpdate))(Control_Applicative.pure(Control_Monad_Eff.applicativeEff)($13.value0)));
              };
          };
      };
  };                                                                                                                                                                                  
  var functorEventHandler = new Data_Functor.Functor(function (f) {
      return function (v) {
          return Data_Functor.map(Control_Monad_Writer_Trans.functorWriterT(Data_Identity.functorIdentity))(f)(v);
      };
  });
  var applyEventHandler = new Control_Apply.Apply(function () {
      return functorEventHandler;
  }, function (v) {
      return function (v1) {
          return Control_Apply.apply(Control_Monad_Writer_Trans.applyWriterT(Data_Semigroup.semigroupArray)(Data_Identity.applyIdentity))(v)(v1);
      };
  });
  var applicativeEventHandler = new Control_Applicative.Applicative(function () {
      return applyEventHandler;
  }, function ($23) {
      return EventHandler(Control_Applicative.pure(Control_Monad_Writer_Trans.applicativeWriterT(Data_Monoid.monoidArray)(Data_Identity.applicativeIdentity))($23));
  });
  exports["runEventHandler"] = runEventHandler;
  exports["functorEventHandler"] = functorEventHandler;
  exports["applyEventHandler"] = applyEventHandler;
  exports["applicativeEventHandler"] = applicativeEventHandler;
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Show = PS["Data.Show"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];        
  var TagName = function (x) {
      return x;
  };
  var PropName = function (x) {
      return x;
  };
  var EventName = function (x) {
      return x;
  };
  var HandlerF = (function () {
      function HandlerF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      HandlerF.create = function (value0) {
          return function (value1) {
              return new HandlerF(value0, value1);
          };
      };
      return HandlerF;
  })();
  var AttrName = function (x) {
      return x;
  };
  var PropF = (function () {
      function PropF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      PropF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new PropF(value0, value1, value2);
              };
          };
      };
      return PropF;
  })();
  var Prop = (function () {
      function Prop(value0) {
          this.value0 = value0;
      };
      Prop.create = function (value0) {
          return new Prop(value0);
      };
      return Prop;
  })();
  var Attr = (function () {
      function Attr(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      Attr.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new Attr(value0, value1, value2);
              };
          };
      };
      return Attr;
  })();
  var Key = (function () {
      function Key(value0) {
          this.value0 = value0;
      };
      Key.create = function (value0) {
          return new Key(value0);
      };
      return Key;
  })();
  var Handler = (function () {
      function Handler(value0) {
          this.value0 = value0;
      };
      Handler.create = function (value0) {
          return new Handler(value0);
      };
      return Handler;
  })();
  var Ref = (function () {
      function Ref(value0) {
          this.value0 = value0;
      };
      Ref.create = function (value0) {
          return new Ref(value0);
      };
      return Ref;
  })();
  var Text = (function () {
      function Text(value0) {
          this.value0 = value0;
      };
      Text.create = function (value0) {
          return new Text(value0);
      };
      return Text;
  })();
  var Element = (function () {
      function Element(value0, value1, value2, value3) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
      };
      Element.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return new Element(value0, value1, value2, value3);
                  };
              };
          };
      };
      return Element;
  })();
  var Slot = (function () {
      function Slot(value0) {
          this.value0 = value0;
      };
      Slot.create = function (value0) {
          return new Slot(value0);
      };
      return Slot;
  })();
  var IsProp = function (toPropString) {
      this.toPropString = toPropString;
  };
  var toPropString = function (dict) {
      return dict.toPropString;
  };
  var tagName = TagName;
  var stringIsProp = new IsProp(function (v) {
      return function (v1) {
          return function (s) {
              return s;
          };
      };
  });
  var runTagName = function (v) {
      return v;
  };
  var runPropName = function (v) {
      return v;
  };
  var runNamespace = function (v) {
      return v;
  };
  var runEventName = function (v) {
      return v;
  };
  var runAttrName = function (v) {
      return v;
  };
  var propName = PropName;
  var prop = function (dictIsProp) {
      return function (name) {
          return function (attr) {
              return function (v) {
                  return new Prop(Data_Exists.mkExists(new PropF(name, v, Data_Functor.map(Data_Maybe.functorMaybe)(Data_Function.flip(Data_Tuple.Tuple.create)(toPropString(dictIsProp)))(attr))));
              };
          };
      };
  }; 
  var handler = function (name) {
      return function (k) {
          return new Handler(Data_ExistsR.mkExistsR(new HandlerF(name, k)));
      };
  };
  var eventName = EventName;
  var element = Element.create(Data_Maybe.Nothing.value);
  var booleanIsProp = new IsProp(function (v) {
      return function (v1) {
          return function (v2) {
              if (v2) {
                  return runAttrName(v);
              };
              if (!v2) {
                  return "";
              };
              throw new Error("Failed pattern match at Halogen.HTML.Core line 138, column 3 - line 138, column 46: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  });                                                                            
  var attrName = AttrName;
  exports["Text"] = Text;
  exports["Element"] = Element;
  exports["Slot"] = Slot;
  exports["HandlerF"] = HandlerF;
  exports["Prop"] = Prop;
  exports["Attr"] = Attr;
  exports["Key"] = Key;
  exports["Handler"] = Handler;
  exports["Ref"] = Ref;
  exports["PropF"] = PropF;
  exports["IsProp"] = IsProp;
  exports["attrName"] = attrName;
  exports["element"] = element;
  exports["eventName"] = eventName;
  exports["handler"] = handler;
  exports["prop"] = prop;
  exports["propName"] = propName;
  exports["runAttrName"] = runAttrName;
  exports["runEventName"] = runEventName;
  exports["runNamespace"] = runNamespace;
  exports["runPropName"] = runPropName;
  exports["runTagName"] = runTagName;
  exports["tagName"] = tagName;
  exports["toPropString"] = toPropString;
  exports["stringIsProp"] = stringIsProp;
  exports["booleanIsProp"] = booleanIsProp;
})(PS["Halogen.HTML.Core"] = PS["Halogen.HTML.Core"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Lazy = PS["Data.Lazy"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Category = PS["Control.Category"];        
  var runTree = function (k) {
      return function (t) {
          var $5 = Unsafe_Coerce.unsafeCoerce(t);
          return k($5);
      };
  };
  var mkTree$prime = Unsafe_Coerce.unsafeCoerce;
  exports["mkTree'"] = mkTree$prime;
  exports["runTree"] = runTree;
})(PS["Halogen.Component.Tree"] = PS["Halogen.Component.Tree"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var subscribe = function (es) {
      return Control_Monad_Free.liftF(new Halogen_Query_HalogenF.SubscribeHF(es, Data_Unit.unit));
  };
  var modify = function (f) {
      return Control_Monad_Free.liftF(new Halogen_Query_HalogenF.StateHF(new Halogen_Query_StateF.Modify(f, Data_Unit.unit)));
  };
  var set = function ($0) {
      return modify(Data_Function["const"]($0));
  };
  var gets = function ($2) {
      return Control_Monad_Free.liftF(Halogen_Query_HalogenF.StateHF.create(Halogen_Query_StateF.Get.create($2)));
  };
  var get = gets(Control_Category.id(Control_Category.categoryFn));
  var action = function (act) {
      return act(Data_Unit.unit);
  };
  exports["action"] = action;
  exports["get"] = get;
  exports["gets"] = gets;
  exports["modify"] = modify;
  exports["set"] = set;
  exports["subscribe"] = subscribe;
})(PS["Halogen.Query"] = PS["Halogen.Query"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_ST = PS["Control.Monad.ST"];
  var Data_Array = PS["Data.Array"];
  var Data_Array_ST = PS["Data.Array.ST"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_Lazy = PS["Data.Lazy"];
  var Data_List = PS["Data.List"];
  var Data_Map = PS["Data.Map"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var renderComponent = function (v) {
      return v.render;
  };
  var queryComponent = function (v) {
      return v["eval"];
  };
  var lifecycleComponent = function (spec) {
      var renderTree = function (html) {
          return Halogen_Component_Tree["mkTree'"]({
              slot: Data_Unit.unit, 
              html: Data_Lazy.defer(function (v) {
                  return Unsafe_Coerce.unsafeCoerce(html);
              }), 
              eq: function (v) {
                  return function (v1) {
                      return false;
                  };
              }, 
              thunk: false
          });
      };
      return {
          render: function (s) {
              return {
                  state: s, 
                  hooks: [  ], 
                  tree: renderTree(spec.render(s))
              };
          }, 
          "eval": spec["eval"], 
          initializer: spec.initializer, 
          finalizers: function (s) {
              return Data_Maybe.maybe([  ])(function (i) {
                  return [ Halogen_Component_Hook.finalized(spec["eval"])(s)(i) ];
              })(spec.finalizer);
          }
      };
  };
  var initializeComponent = function (v) {
      return v.initializer;
  };
  exports["initializeComponent"] = initializeComponent;
  exports["lifecycleComponent"] = lifecycleComponent;
  exports["queryComponent"] = queryComponent;
  exports["renderComponent"] = renderComponent;
})(PS["Halogen.Component"] = PS["Halogen.Component"] || {});
(function(exports) {
  /* global exports, require */
  "use strict";
  var vcreateElement =require("virtual-dom/create-element");
  var vdiff =require("virtual-dom/diff");
  var vpatch =require("virtual-dom/patch");
  var VText =require("virtual-dom/vnode/vtext");
  var VirtualNode =require("virtual-dom/vnode/vnode");
  var SoftSetHook =require("virtual-dom/virtual-hyperscript/hooks/soft-set-hook"); 

  // jshint maxparams: 2
  exports.prop = function (key, value) {
    var props = {};
    props[key] = value;
    return props;
  };

  // jshint maxparams: 2
  exports.attr = function (key, value) {
    var props = { attributes: {} };
    props.attributes[key] = value;
    return props;
  };

  function HandlerHook (key, f) {
    this.key = key;
    this.callback = function (e) {
      f(e)();
    };
  }

  HandlerHook.prototype = {
    hook: function (node) {
      node.addEventListener(this.key, this.callback);
    },
    unhook: function (node) {
      node.removeEventListener(this.key, this.callback);
    }
  };

  // jshint maxparams: 2
  exports.handlerProp = function (key, f) {
    var props = {};
    props["halogen-hook-" + key] = new HandlerHook(key, f);
    return props;
  };

  exports.refPropImpl = function (nothing) {
    return function (just) {

      var ifHookFn = function (init) {
        // jshint maxparams: 3
        return function (node, prop, diff) {
          // jshint validthis: true
          if (typeof diff === "undefined") {
            this.f(init ? just(node) : nothing)();
          }
        };
      };

      // jshint maxparams: 1
      function RefHook (f) {
        this.f = f;
      }

      RefHook.prototype = {
        hook: ifHookFn(true),
        unhook: ifHookFn(false)
      };

      return function (f) {
        return { "halogen-ref": new RefHook(f) };
      };
    };
  };

  // jshint maxparams: 3
  function HalogenWidget (tree, eq, render) {
    this.tree = tree;
    this.eq = eq;
    this.render = render;
    this.vdom = null;
    this.el = null;
  }

  HalogenWidget.prototype = {
    type: "Widget",
    init: function () {
      this.vdom = this.render(this.tree);
      this.el = vcreateElement(this.vdom);
      return this.el;
    },
    update: function (prev, node) {
      if (!prev.tree || !this.eq(prev.tree.slot)(this.tree.slot)) {
        return this.init();
      }
      if (this.tree.thunk) {
        this.vdom = prev.vdom;
        this.el = prev.el;
      } else {
        this.vdom = this.render(this.tree);
        this.el = vpatch(node, vdiff(prev.vdom, this.vdom));
      }
    }
  };

  exports.widget = function (tree) {
    return function (eq) {
      return function (render) {
        return new HalogenWidget(tree, eq, render);
      };
    };
  };

  exports.concatProps = function () {
    // jshint maxparams: 2
    var hOP = Object.prototype.hasOwnProperty;
    var copy = function (props, result) {
      for (var key in props) {
        if (hOP.call(props, key)) {
          if (key === "attributes") {
            var attrs = props[key];
            var resultAttrs = result[key] || (result[key] = {});
            for (var attr in attrs) {
              if (hOP.call(attrs, attr)) {
                resultAttrs[attr] = attrs[attr];
              }
            }
          } else {
            result[key] = props[key];
          }
        }
      }
      return result;
    };
    return function (p1, p2) {
      return copy(p2, copy(p1, {}));
    };
  }();

  exports.emptyProps = {};

  exports.createElement = function (vtree) {
    return vcreateElement(vtree);
  };

  exports.diff = function (vtree1) {
    return function (vtree2) {
      return vdiff(vtree1, vtree2);
    };
  };

  exports.patch = function (p) {
    return function (node) {
      return function () {
        return vpatch(node, p);
      };
    };
  };

  exports.vtext = function (s) {
    return new VText(s);
  };

  exports.vnode = function (namespace) {
    return function (name) {
      return function (key) {
        return function (props) {
          return function (children) {
            if (name === "input" && props.value !== undefined) {
              props.value = new SoftSetHook(props.value);
            }
            return new VirtualNode(name, props, children, key, namespace);
          };
        };
      };
    };
  };
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Halogen.Internal.VirtualDOM"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var semigroupProps = new Data_Semigroup.Semigroup(Data_Function_Uncurried.runFn2($foreign.concatProps));
  var refProp = $foreign.refPropImpl(Data_Maybe.Nothing.value)(Data_Maybe.Just.create);
  var monoidProps = new Data_Monoid.Monoid(function () {
      return semigroupProps;
  }, $foreign.emptyProps);
  exports["refProp"] = refProp;
  exports["semigroupProps"] = semigroupProps;
  exports["monoidProps"] = monoidProps;
  exports["attr"] = $foreign.attr;
  exports["createElement"] = $foreign.createElement;
  exports["diff"] = $foreign.diff;
  exports["handlerProp"] = $foreign.handlerProp;
  exports["patch"] = $foreign.patch;
  exports["prop"] = $foreign.prop;
  exports["vnode"] = $foreign.vnode;
  exports["vtext"] = $foreign.vtext;
  exports["widget"] = $foreign.widget;
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Lazy = PS["Data.Lazy"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Nullable = PS["Data.Nullable"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Bind = PS["Control.Bind"];        
  var handleAff = function ($40) {
      return Data_Functor["void"](Control_Monad_Eff.functorEff)(Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Data_Function["const"](Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))($40));
  };
  var renderProp = function (v) {
      return function (v1) {
          if (v1 instanceof Halogen_HTML_Core.Prop) {
              return Data_Exists.runExists(function (v2) {
                  return Halogen_Internal_VirtualDOM.prop(Halogen_HTML_Core.runPropName(v2.value0), v2.value1);
              })(v1.value0);
          };
          if (v1 instanceof Halogen_HTML_Core.Attr) {
              var attrName = Data_Maybe.maybe("")(function (ns$prime) {
                  return Halogen_HTML_Core.runNamespace(ns$prime) + ":";
              })(v1.value0) + Halogen_HTML_Core.runAttrName(v1.value1);
              return Halogen_Internal_VirtualDOM.attr(attrName, v1.value2);
          };
          if (v1 instanceof Halogen_HTML_Core.Handler) {
              return Data_ExistsR.runExistsR(function (v2) {
                  return Halogen_Internal_VirtualDOM.handlerProp(Halogen_HTML_Core.runEventName(v2.value0), function (ev) {
                      return Data_Function.apply(handleAff)(Control_Bind.bind(Control_Monad_Aff.bindAff)(Halogen_HTML_Events_Handler.runEventHandler(Control_Monad_Aff.monadAff)(Control_Monad_Aff.monadEffAff)(ev)(v2.value1(ev)))(Data_Maybe.maybe(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(Data_Unit.unit))(v)));
                  });
              })(v1.value0);
          };
          if (v1 instanceof Halogen_HTML_Core.Ref) {
              return Halogen_Internal_VirtualDOM.refProp(function ($41) {
                  return handleAff(v(v1.value0($41)));
              });
          };
          return Data_Monoid.mempty(Halogen_Internal_VirtualDOM.monoidProps);
      };
  };
  var findKey = function (v) {
      return function (v1) {
          if (v1 instanceof Halogen_HTML_Core.Key) {
              return new Data_Maybe.Just(v1.value0);
          };
          return v;
      };
  };
  var renderTree = function (f) {
      return Halogen_Component_Tree.runTree(function (tree) {
          var go = function (v) {
              if (v instanceof Halogen_HTML_Core.Text) {
                  return Halogen_Internal_VirtualDOM.vtext(v.value0);
              };
              if (v instanceof Halogen_HTML_Core.Slot) {
                  return Halogen_Internal_VirtualDOM.widget(v.value0)(tree.eq)(renderTree(f));
              };
              if (v instanceof Halogen_HTML_Core.Element) {
                  var tag = Halogen_HTML_Core.runTagName(v.value1);
                  var ns$prime = Data_Function.apply(Data_Nullable.toNullable)(Data_Functor.map(Data_Maybe.functorMaybe)(Halogen_HTML_Core.runNamespace)(v.value0));
                  var key = Data_Function.apply(Data_Nullable.toNullable)(Data_Foldable.foldl(Data_Foldable.foldableArray)(findKey)(Data_Maybe.Nothing.value)(v.value2));
                  return Halogen_Internal_VirtualDOM.vnode(ns$prime)(tag)(key)(Data_Foldable.foldMap(Data_Foldable.foldableArray)(Halogen_Internal_VirtualDOM.monoidProps)(renderProp(f))(v.value2))(Data_Functor.map(Data_Functor.functorArray)(go)(v.value3));
              };
              throw new Error("Failed pattern match at Halogen.HTML.Renderer.VirtualDOM line 49, column 5 - line 56, column 28: " + [ v.constructor.name ]);
          };
          return go(Data_Lazy.force(tree.html));
      });
  };
  exports["renderTree"] = renderTree;
})(PS["Halogen.HTML.Renderer.VirtualDOM"] = PS["Halogen.HTML.Renderer.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Coroutine_Stalling_1 = PS["Control.Coroutine.Stalling"];
  var Control_Coroutine_Stalling_1 = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_Node_Node = PS["DOM.Node.Node"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_HTML_Renderer_VirtualDOM = PS["Halogen.HTML.Renderer.VirtualDOM"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];        
  var onInitializers = function (dictFoldable) {
      return function (f) {
          var go = function (v) {
              return function (as) {
                  if (v instanceof Halogen_Component_Hook.PostRender) {
                      return new Data_List.Cons(f(v.value0), as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(dictFoldable)(go)(Data_List.Nil.value);
      };
  };
  var onFinalizers = function (dictFoldable) {
      return function (f) {
          var go = function (v) {
              return function (as) {
                  if (v instanceof Halogen_Component_Hook.Finalized) {
                      return new Data_List.Cons(f(v.value0), as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(dictFoldable)(go)(Data_List.Nil.value);
      };
  };
  var runUI = function (c) {
      return function (s) {
          return function (element) {
              var driver$prime = function (e) {
                  return function (s1) {
                      return function (i) {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar["makeVar'"](s1))(function (v) {
                              return Data_Function.flip(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff))(e(i))(function (h) {
                                  if (h instanceof Halogen_Query_HalogenF.StateHF) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(v))(function (v1) {
                                          var $29 = Control_Monad_State.runState(Halogen_Query_StateF.stateN(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity))(Control_Monad_State_Trans.monadStateStateT(Data_Identity.monadIdentity))(h.value0))(v1);
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(v)($29.value1))(function () {
                                              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)($29.value0);
                                          });
                                      });
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.RenderHF) {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.RenderPendingHF) {
                                      return Data_Function.apply(Control_Applicative.pure(Control_Monad_Aff.applicativeAff))(h.value0(Data_Maybe.Nothing.value));
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                                      return h.value0;
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                                      return Data_Function.apply(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff))(Control_Monad_Eff_Exception.error(h.value0));
                                  };
                                  throw new Error("Failed pattern match at Halogen.Driver line 145, column 7 - line 156, column 45: " + [ h.constructor.name ]);
                              });
                          });
                      };
                  };
              };
              var render = function (ref) {
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                      if (v.renderPaused) {
                          return Data_Function.apply(Control_Monad_Aff_AVar.putVar(ref))((function () {
                              var $42 = {};
                              for (var $43 in v) {
                                  if (v.hasOwnProperty($43)) {
                                      $42[$43] = v[$43];
                                  };
                              };
                              $42.renderPending = true;
                              return $42;
                          })());
                      };
                      if (!v.renderPaused) {
                          var rc = Halogen_Component.renderComponent(c)(v.state);
                          var vtree$prime = Halogen_HTML_Renderer_VirtualDOM.renderTree(driver(ref))(rc.tree);
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(Halogen_Internal_VirtualDOM.patch(Halogen_Internal_VirtualDOM.diff(v.vtree)(vtree$prime))(v.node)))(function (v1) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)({
                                  node: v1, 
                                  vtree: vtree$prime, 
                                  state: rc.state, 
                                  renderPending: false, 
                                  renderPaused: true
                              }))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onFinalizers(Data_Foldable.foldableArray)(Halogen_Component_Hook.runFinalized(driver$prime))(rc.hooks)))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onInitializers(Data_Foldable.foldableArray)(driver(ref))(rc.hooks)))(function () {
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (v2) {
                                              var $46 = {};
                                              for (var $47 in v2) {
                                                  if (v2.hasOwnProperty($47)) {
                                                      $46[$47] = v2[$47];
                                                  };
                                              };
                                              $46.renderPaused = false;
                                              return $46;
                                          })(ref))(function () {
                                              return flushRender(ref);
                                          });
                                      });
                                  });
                              });
                          });
                      };
                      throw new Error("Failed pattern match at Halogen.Driver line 161, column 5 - line 177, column 24: " + [ v.renderPaused.constructor.name ]);
                  });
              };
              var flushRender = Control_Monad_Rec_Class.tailRecM(Control_Monad_Aff.monadRecAff)(function (ref) {
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(v))(function () {
                          var $50 = !v.renderPending;
                          if ($50) {
                              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Right(Data_Unit.unit));
                          };
                          if (!$50) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(render(ref))(function () {
                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Left(ref));
                              });
                          };
                          throw new Error("Failed pattern match at Halogen.Driver line 183, column 5 - line 187, column 24: " + [ $50.constructor.name ]);
                      });
                  });
              });
              var $$eval = function (ref) {
                  return function (rpRef) {
                      return function (h) {
                          if (h instanceof Halogen_Query_HalogenF.StateHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                                  if (h.value0 instanceof Halogen_Query_StateF.Get) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(v))(function () {
                                          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value0.value0(v.state));
                                      });
                                  };
                                  if (h.value0 instanceof Halogen_Query_StateF.Modify) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v1) {
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff_AVar.putVar(ref))((function () {
                                              var $56 = {};
                                              for (var $57 in v) {
                                                  if (v.hasOwnProperty($57)) {
                                                      $56[$57] = v[$57];
                                                  };
                                              };
                                              $56.state = h.value0.value0(v.state);
                                              return $56;
                                          })()))(function () {
                                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff_AVar.putVar(rpRef))(new Data_Maybe.Just(Halogen_Query_HalogenF.Pending.value)))(function () {
                                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value0.value1);
                                              });
                                          });
                                      });
                                  };
                                  throw new Error("Failed pattern match at Halogen.Driver line 107, column 9 - line 115, column 22: " + [ h.value0.constructor.name ]);
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                              var producer = Halogen_Query_EventSource.runEventSource(h.value0);
                              var consumer = Control_Monad_Rec_Class.forever(Control_Monad_Free_Trans.monadRecFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(Control_Bind.bindFlipped(Control_Monad_Free_Trans.bindFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(function ($78) {
                                  return Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(Control_Coroutine.functorAwait))(Control_Monad_Aff.monadAff)(driver(ref)($78));
                              })(Control_Coroutine["await"](Control_Monad_Aff.monadAff)));
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAff)(Control_Coroutine_Stalling_1.runStallingProcess(Control_Monad_Aff.monadRecAff)(Control_Coroutine_Stalling_1.fuse(Control_Monad_Aff.monadRecAff)(Control_Monad_Aff.monadParAff)(producer)(consumer))))(function () {
                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.RenderHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(Data_Function["const"](h.value0))(rpRef))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isNothing(h.value0)))(render(ref)))(function () {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.RenderPendingHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(rpRef)(v))(function () {
                                      return Data_Function.apply(Control_Applicative.pure(Control_Monad_Aff.applicativeAff))(h.value0(v));
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isJust(v)))(render(ref)))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(rpRef)(Data_Maybe.Nothing.value))(function () {
                                          return h.value0;
                                      });
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                              return Data_Function.apply(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff))(Control_Monad_Eff_Exception.error(h.value0));
                          };
                          throw new Error("Failed pattern match at Halogen.Driver line 104, column 5 - line 134, column 43: " + [ h.constructor.name ]);
                      };
                  };
              };
              var driver = function (ref) {
                  return function (q) {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar["makeVar'"](Data_Maybe.Nothing.value))(function (v) {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff)($$eval(ref)(v))(Halogen_Component.queryComponent(c)(q)))(function (v1) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(v))(function (v2) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isJust(v2)))(render(ref)))(function () {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(v1);
                                  });
                              });
                          });
                      });
                  };
              };
              return Data_Functor.map(Control_Monad_Aff.functorAff)(function (v) {
                  return v.driver;
              })(Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.makeVar)(function (v) {
                  var rc = Halogen_Component.renderComponent(c)(s);
                  var dr = driver(v);
                  var vtree = Halogen_HTML_Renderer_VirtualDOM.renderTree(dr)(rc.tree);
                  var node = Halogen_Internal_VirtualDOM.createElement(vtree);
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(v)({
                      node: node, 
                      vtree: vtree, 
                      state: rc.state, 
                      renderPending: false, 
                      renderPaused: true
                  }))(function () {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(DOM_Node_Node.appendChild(DOM_HTML_Types.htmlElementToNode(node))(DOM_HTML_Types.htmlElementToNode(element))))(function () {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onInitializers(Data_Foldable.foldableArray)(dr)(rc.hooks)))(function () {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAff)(Data_Maybe.maybe(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(Data_Unit.unit))(dr)(Halogen_Component.initializeComponent(c))))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (v1) {
                                      var $75 = {};
                                      for (var $76 in v1) {
                                          if (v1.hasOwnProperty($76)) {
                                              $75[$76] = v1[$76];
                                          };
                                      };
                                      $75.renderPaused = false;
                                      return $75;
                                  })(v))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(flushRender(v))(function () {
                                          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)({
                                              driver: dr
                                          });
                                      });
                                  });
                              });
                          });
                      });
                  });
              }));
          };
      };
  };
  exports["runUI"] = runUI;
})(PS["Halogen.Driver"] = PS["Halogen.Driver"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var textarea = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("textarea"))(xs)([  ]);
  };                       
  var strong = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("strong"))(xs);
  };                         
  var span = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("span"))(xs);
  };
  var p = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("p"))(xs);
  };                   
  var input = function (props) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("input"))(props)([  ]);
  };                       
  var form = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("form"))(xs);
  };                       
  var em = Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("em"));
  var div = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("div"))(xs);
  };
  var div_ = div([  ]);      
  var br = function (props) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("br"))(props)([  ]);
  };                     
  var blockquote = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("blockquote"))(xs);
  };                       
  var article = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("article"))(xs);
  };
  exports["article"] = article;
  exports["blockquote"] = blockquote;
  exports["br"] = br;
  exports["div"] = div;
  exports["div_"] = div_;
  exports["em"] = em;
  exports["form"] = form;
  exports["input"] = input;
  exports["p"] = p;
  exports["span"] = span;
  exports["strong"] = strong;
  exports["textarea"] = textarea;
})(PS["Halogen.HTML.Elements"] = PS["Halogen.HTML.Elements"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Data_Functor = PS["Data.Functor"];        
  var text = Halogen_HTML_Core.Text.create;
  exports["text"] = text;
})(PS["Halogen.HTML"] = PS["Halogen.HTML"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Data_Function = PS["Data.Function"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Functor = PS["Data.Functor"];
  var value = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("value"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("value")));
  var type_ = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("type"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("type")));                    
  var name = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("name"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("name")));
  var checked = Halogen_HTML_Core.prop(Halogen_HTML_Core.booleanIsProp)(Halogen_HTML_Core.propName("checked"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("checked")));
  exports["checked"] = checked;
  exports["name"] = name;
  exports["type_"] = type_;
  exports["value"] = value;
})(PS["Halogen.HTML.Properties"] = PS["Halogen.HTML.Properties"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties_1 = PS["Halogen.HTML.Properties"];
  var Halogen_HTML_Properties_1 = PS["Halogen.HTML.Properties"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var InputButton = (function () {
      function InputButton() {

      };
      InputButton.value = new InputButton();
      return InputButton;
  })();
  var InputCheckbox = (function () {
      function InputCheckbox() {

      };
      InputCheckbox.value = new InputCheckbox();
      return InputCheckbox;
  })();
  var InputColor = (function () {
      function InputColor() {

      };
      InputColor.value = new InputColor();
      return InputColor;
  })();
  var InputDate = (function () {
      function InputDate() {

      };
      InputDate.value = new InputDate();
      return InputDate;
  })();
  var InputDatetime = (function () {
      function InputDatetime() {

      };
      InputDatetime.value = new InputDatetime();
      return InputDatetime;
  })();
  var InputDatetimeLocal = (function () {
      function InputDatetimeLocal() {

      };
      InputDatetimeLocal.value = new InputDatetimeLocal();
      return InputDatetimeLocal;
  })();
  var InputEmail = (function () {
      function InputEmail() {

      };
      InputEmail.value = new InputEmail();
      return InputEmail;
  })();
  var InputFile = (function () {
      function InputFile() {

      };
      InputFile.value = new InputFile();
      return InputFile;
  })();
  var InputHidden = (function () {
      function InputHidden() {

      };
      InputHidden.value = new InputHidden();
      return InputHidden;
  })();
  var InputImage = (function () {
      function InputImage() {

      };
      InputImage.value = new InputImage();
      return InputImage;
  })();
  var InputMonth = (function () {
      function InputMonth() {

      };
      InputMonth.value = new InputMonth();
      return InputMonth;
  })();
  var InputNumber = (function () {
      function InputNumber() {

      };
      InputNumber.value = new InputNumber();
      return InputNumber;
  })();
  var InputPassword = (function () {
      function InputPassword() {

      };
      InputPassword.value = new InputPassword();
      return InputPassword;
  })();
  var InputRadio = (function () {
      function InputRadio() {

      };
      InputRadio.value = new InputRadio();
      return InputRadio;
  })();
  var InputRange = (function () {
      function InputRange() {

      };
      InputRange.value = new InputRange();
      return InputRange;
  })();
  var InputReset = (function () {
      function InputReset() {

      };
      InputReset.value = new InputReset();
      return InputReset;
  })();
  var InputSearch = (function () {
      function InputSearch() {

      };
      InputSearch.value = new InputSearch();
      return InputSearch;
  })();
  var InputSubmit = (function () {
      function InputSubmit() {

      };
      InputSubmit.value = new InputSubmit();
      return InputSubmit;
  })();
  var InputTel = (function () {
      function InputTel() {

      };
      InputTel.value = new InputTel();
      return InputTel;
  })();
  var InputText = (function () {
      function InputText() {

      };
      InputText.value = new InputText();
      return InputText;
  })();
  var InputTime = (function () {
      function InputTime() {

      };
      InputTime.value = new InputTime();
      return InputTime;
  })();
  var InputUrl = (function () {
      function InputUrl() {

      };
      InputUrl.value = new InputUrl();
      return InputUrl;
  })();
  var InputWeek = (function () {
      function InputWeek() {

      };
      InputWeek.value = new InputWeek();
      return InputWeek;
  })();
  var renderInputType = function (ty) {
      if (ty instanceof InputButton) {
          return "button";
      };
      if (ty instanceof InputCheckbox) {
          return "checkbox";
      };
      if (ty instanceof InputColor) {
          return "color";
      };
      if (ty instanceof InputDate) {
          return "date";
      };
      if (ty instanceof InputDatetime) {
          return "datetime";
      };
      if (ty instanceof InputDatetimeLocal) {
          return "datetime-local";
      };
      if (ty instanceof InputEmail) {
          return "email";
      };
      if (ty instanceof InputFile) {
          return "file";
      };
      if (ty instanceof InputHidden) {
          return "hidden";
      };
      if (ty instanceof InputImage) {
          return "image";
      };
      if (ty instanceof InputMonth) {
          return "month";
      };
      if (ty instanceof InputNumber) {
          return "number";
      };
      if (ty instanceof InputPassword) {
          return "password";
      };
      if (ty instanceof InputRadio) {
          return "radio";
      };
      if (ty instanceof InputRange) {
          return "range";
      };
      if (ty instanceof InputReset) {
          return "reset";
      };
      if (ty instanceof InputSearch) {
          return "search";
      };
      if (ty instanceof InputSubmit) {
          return "submit";
      };
      if (ty instanceof InputTel) {
          return "tel";
      };
      if (ty instanceof InputText) {
          return "text";
      };
      if (ty instanceof InputTime) {
          return "time";
      };
      if (ty instanceof InputUrl) {
          return "url";
      };
      if (ty instanceof InputWeek) {
          return "week";
      };
      throw new Error("Failed pattern match at Halogen.HTML.Properties.Indexed line 184, column 3 - line 209, column 1: " + [ ty.constructor.name ]);
  };
  var refine = Unsafe_Coerce.unsafeCoerce;            
  var value = refine(Halogen_HTML_Properties_1.value);
  var name = refine(Halogen_HTML_Properties_1.name);
  var inputType = function ($20) {
      return refine(Halogen_HTML_Properties_1.type_)(renderInputType($20));
  };                                                    
  var checked = refine(Halogen_HTML_Properties_1.checked);
  exports["InputButton"] = InputButton;
  exports["InputCheckbox"] = InputCheckbox;
  exports["InputColor"] = InputColor;
  exports["InputDate"] = InputDate;
  exports["InputDatetime"] = InputDatetime;
  exports["InputDatetimeLocal"] = InputDatetimeLocal;
  exports["InputEmail"] = InputEmail;
  exports["InputFile"] = InputFile;
  exports["InputHidden"] = InputHidden;
  exports["InputImage"] = InputImage;
  exports["InputMonth"] = InputMonth;
  exports["InputNumber"] = InputNumber;
  exports["InputPassword"] = InputPassword;
  exports["InputRadio"] = InputRadio;
  exports["InputRange"] = InputRange;
  exports["InputReset"] = InputReset;
  exports["InputSearch"] = InputSearch;
  exports["InputSubmit"] = InputSubmit;
  exports["InputTel"] = InputTel;
  exports["InputText"] = InputText;
  exports["InputTime"] = InputTime;
  exports["InputUrl"] = InputUrl;
  exports["InputWeek"] = InputWeek;
  exports["checked"] = checked;
  exports["inputType"] = inputType;
  exports["name"] = name;
  exports["value"] = value;
})(PS["Halogen.HTML.Properties.Indexed"] = PS["Halogen.HTML.Properties.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Halogen_HTML_Elements_1 = PS["Halogen.HTML.Elements"];
  var Halogen_HTML_Elements_1 = PS["Halogen.HTML.Elements"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];                              
  var textarea = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.textarea);
  var strong = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.strong);
  var span = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.span);  
  var p = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.p);    
  var input = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.input);
  var form = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.form);  
  var em = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.em);
  var div = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.div);      
  var br = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.br);    
  var blockquote = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.blockquote);
  var article = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.article);
  exports["article"] = article;
  exports["blockquote"] = blockquote;
  exports["br"] = br;
  exports["div"] = div;
  exports["em"] = em;
  exports["form"] = form;
  exports["input"] = input;
  exports["p"] = p;
  exports["span"] = span;
  exports["strong"] = strong;
  exports["textarea"] = textarea;
})(PS["Halogen.HTML.Elements.Indexed"] = PS["Halogen.HTML.Elements.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];                                      
  var onClick = Halogen_HTML_Core.handler(Halogen_HTML_Core.eventName("click"));
  var input_ = function (f) {
      return function (v) {
          return Data_Function.apply(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_Query.action(f)));
      };
  };
  var input = function (f) {
      return function (x) {
          return Data_Function.apply(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_Query.action(f(x))));
      };
  };
  exports["input"] = input;
  exports["input_"] = input_;
  exports["onClick"] = onClick;
})(PS["Halogen.HTML.Events"] = PS["Halogen.HTML.Events"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Class = PS["Data.Foreign.Class"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Foreign_Index = PS["Data.Foreign.Index"];        
  var addForeignPropHandler = function (dictIsForeign) {
      return function (key) {
          return function (prop) {
              return function (f) {
                  return Halogen_HTML_Core.handler(Halogen_HTML_Core.eventName(key))(function ($2) {
                      return Data_Either.either(Data_Function.apply(Data_Function["const"])(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Data_Maybe.Nothing.value)))(f)(Data_Foreign_Class.readProp(dictIsForeign)(Data_Foreign_Index.indexString)(prop)(Data_Foreign.toForeign((function (v) {
                          return v.target;
                      })($2))));
                  });
              };
          };
      };
  };                                                                                               
  var onValueInput = addForeignPropHandler(Data_Foreign_Class.stringIsForeign)("input")("value");
  exports["onValueInput"] = onValueInput;
})(PS["Halogen.HTML.Events.Forms"] = PS["Halogen.HTML.Events.Forms"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Maybe = PS["Data.Maybe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_1 = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Events_1 = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Events_Forms = PS["Halogen.HTML.Events.Forms"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];        
  var refine$prime = Unsafe_Coerce.unsafeCoerce;
  var refine = Unsafe_Coerce.unsafeCoerce;
  var onValueInput = refine$prime(Halogen_HTML_Events_Forms.onValueInput);
  var onClick = refine(Halogen_HTML_Events_1.onClick);
  exports["onClick"] = onClick;
  exports["onValueInput"] = onValueInput;
})(PS["Halogen.HTML.Events.Indexed"] = PS["Halogen.HTML.Events.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Foreign = PS["Data.Foreign"];
  var DOM = PS["DOM"];
  var DOM_Event_EventTarget = PS["DOM.Event.EventTarget"];
  var DOM_HTML_Event_EventTypes = PS["DOM.HTML.Event.EventTypes"];
  var DOM_HTML = PS["DOM.HTML"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_HTML_Window = PS["DOM.HTML.Window"];
  var DOM_Node_ParentNode = PS["DOM.Node.ParentNode"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];        
  var selectElement = function (query) {
      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(Data_Functor.map(Control_Monad_Eff.functorEff)(Data_Nullable.toMaybe)(Control_Bind.bindFlipped(Control_Monad_Eff.bindEff)(Control_Bind.composeKleisliFlipped(Control_Monad_Eff.bindEff)(function ($8) {
          return DOM_Node_ParentNode.querySelector(query)(DOM_HTML_Types.htmlDocumentToParentNode($8));
      })(DOM_HTML_Window.document))(DOM_HTML.window))))(function (v) {
          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)((function () {
              if (v instanceof Data_Maybe.Nothing) {
                  return Data_Maybe.Nothing.value;
              };
              if (v instanceof Data_Maybe.Just) {
                  return Data_Function.apply(Data_Either.either(Data_Function["const"](Data_Maybe.Nothing.value))(Data_Maybe.Just.create))(DOM_HTML_Types.readHTMLElement(Data_Foreign.toForeign(v.value0)));
              };
              throw new Error("Failed pattern match at Halogen.Util line 54, column 3 - line 56, column 76: " + [ v.constructor.name ]);
          })());
      });
  };
  var runHalogenAff = function ($9) {
      return Data_Functor["void"](Control_Monad_Eff.functorEff)(Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Data_Function["const"](Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))($9));
  };
  var awaitLoad = Control_Monad_Aff.makeAff(function (v) {
      return function (callback) {
          return Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Eff_Class.monadEffEff))(function __do() {
              var $10 = DOM_HTML.window();
              return DOM_Event_EventTarget.addEventListener(DOM_HTML_Event_EventTypes.load)(DOM_Event_EventTarget.eventListener(function (v1) {
                  return callback(Data_Unit.unit);
              }))(false)(DOM_HTML_Types.windowToEventTarget($10))();
          });
      };
  });
  var awaitBody = Control_Bind.bind(Control_Monad_Aff.bindAff)(awaitLoad)(function () {
      return Control_Bind.bindFlipped(Control_Monad_Aff.bindAff)(Data_Maybe.maybe(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff)(Control_Monad_Eff_Exception.error("Could not find body")))(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)))(selectElement("body"));
  });
  exports["awaitBody"] = awaitBody;
  exports["awaitLoad"] = awaitLoad;
  exports["runHalogenAff"] = runHalogenAff;
  exports["selectElement"] = selectElement;
})(PS["Halogen.Util"] = PS["Halogen.Util"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Generic = PS["Data.Generic"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Show = PS["Data.Show"];        
  var Semicolon = (function () {
      function Semicolon() {

      };
      Semicolon.value = new Semicolon();
      return Semicolon;
  })();
  var Colon = (function () {
      function Colon() {

      };
      Colon.value = new Colon();
      return Colon;
  })();
  var Question = (function () {
      function Question() {

      };
      Question.value = new Question();
      return Question;
  })();
  var Exclamation = (function () {
      function Exclamation() {

      };
      Exclamation.value = new Exclamation();
      return Exclamation;
  })();
  var OpenQuote = (function () {
      function OpenQuote() {

      };
      OpenQuote.value = new OpenQuote();
      return OpenQuote;
  })();
  var CloseQuote = (function () {
      function CloseQuote() {

      };
      CloseQuote.value = new CloseQuote();
      return CloseQuote;
  })();
  var Dash = (function () {
      function Dash() {

      };
      Dash.value = new Dash();
      return Dash;
  })();
  var LongDash = (function () {
      function LongDash() {

      };
      LongDash.value = new LongDash();
      return LongDash;
  })();
  var Comma = (function () {
      function Comma() {

      };
      Comma.value = new Comma();
      return Comma;
  })();
  var Point = (function () {
      function Point() {

      };
      Point.value = new Point();
      return Point;
  })();
  var Hyphen = (function () {
      function Hyphen() {

      };
      Hyphen.value = new Hyphen();
      return Hyphen;
  })();
  var SuspensionPoints = (function () {
      function SuspensionPoints() {

      };
      SuspensionPoints.value = new SuspensionPoints();
      return SuspensionPoints;
  })();
  var Apostrophe = (function () {
      function Apostrophe() {

      };
      Apostrophe.value = new Apostrophe();
      return Apostrophe;
  })();
  var Word = (function () {
      function Word(value0) {
          this.value0 = value0;
      };
      Word.create = function (value0) {
          return new Word(value0);
      };
      return Word;
  })();
  var Punctuation = (function () {
      function Punctuation(value0) {
          this.value0 = value0;
      };
      Punctuation.create = function (value0) {
          return new Punctuation(value0);
      };
      return Punctuation;
  })();
  var Raw = (function () {
      function Raw(value0) {
          this.value0 = value0;
      };
      Raw.create = function (value0) {
          return new Raw(value0);
      };
      return Raw;
  })();
  var Emph = (function () {
      function Emph(value0) {
          this.value0 = value0;
      };
      Emph.create = function (value0) {
          return new Emph(value0);
      };
      return Emph;
  })();
  var StrongEmph = (function () {
      function StrongEmph(value0) {
          this.value0 = value0;
      };
      StrongEmph.create = function (value0) {
          return new StrongEmph(value0);
      };
      return StrongEmph;
  })();
  var Quote = (function () {
      function Quote(value0) {
          this.value0 = value0;
      };
      Quote.create = function (value0) {
          return new Quote(value0);
      };
      return Quote;
  })();
  var Simple = (function () {
      function Simple(value0) {
          this.value0 = value0;
      };
      Simple.create = function (value0) {
          return new Simple(value0);
      };
      return Simple;
  })();
  var WithSay = (function () {
      function WithSay(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      WithSay.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new WithSay(value0, value1, value2);
              };
          };
      };
      return WithSay;
  })();
  var Teller = (function () {
      function Teller(value0) {
          this.value0 = value0;
      };
      Teller.create = function (value0) {
          return new Teller(value0);
      };
      return Teller;
  })();
  var Dialogue = (function () {
      function Dialogue(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Dialogue.create = function (value0) {
          return function (value1) {
              return new Dialogue(value0, value1);
          };
      };
      return Dialogue;
  })();
  var Thought = (function () {
      function Thought(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Thought.create = function (value0) {
          return function (value1) {
              return new Thought(value0, value1);
          };
      };
      return Thought;
  })();
  var IllFormed = (function () {
      function IllFormed(value0) {
          this.value0 = value0;
      };
      IllFormed.create = function (value0) {
          return new IllFormed(value0);
      };
      return IllFormed;
  })();
  var Story = (function () {
      function Story(value0) {
          this.value0 = value0;
      };
      Story.create = function (value0) {
          return new Story(value0);
      };
      return Story;
  })();
  var Aside = (function () {
      function Aside(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Aside.create = function (value0) {
          return function (value1) {
              return new Aside(value0, value1);
          };
      };
      return Aside;
  })();
  var Failing = (function () {
      function Failing(value0) {
          this.value0 = value0;
      };
      Failing.create = function (value0) {
          return new Failing(value0);
      };
      return Failing;
  })();
  exports["Word"] = Word;
  exports["Punctuation"] = Punctuation;
  exports["Teller"] = Teller;
  exports["Dialogue"] = Dialogue;
  exports["Thought"] = Thought;
  exports["IllFormed"] = IllFormed;
  exports["Raw"] = Raw;
  exports["Emph"] = Emph;
  exports["StrongEmph"] = StrongEmph;
  exports["Quote"] = Quote;
  exports["Semicolon"] = Semicolon;
  exports["Colon"] = Colon;
  exports["Question"] = Question;
  exports["Exclamation"] = Exclamation;
  exports["OpenQuote"] = OpenQuote;
  exports["CloseQuote"] = CloseQuote;
  exports["Dash"] = Dash;
  exports["LongDash"] = LongDash;
  exports["Comma"] = Comma;
  exports["Point"] = Point;
  exports["Hyphen"] = Hyphen;
  exports["SuspensionPoints"] = SuspensionPoints;
  exports["Apostrophe"] = Apostrophe;
  exports["Simple"] = Simple;
  exports["WithSay"] = WithSay;
  exports["Story"] = Story;
  exports["Aside"] = Aside;
  exports["Failing"] = Failing;
})(PS["Text.Ogmarkup.Private.Ast"] = PS["Text.Ogmarkup.Private.Ast"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Ord = PS["Data.Ord"];
  var Data_Eq = PS["Data.Eq"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Text_Ogmarkup_Private_Ast = PS["Text.Ogmarkup.Private.Ast"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];        
  var Normal = (function () {
      function Normal() {

      };
      Normal.value = new Normal();
      return Normal;
  })();
  var Nbsp = (function () {
      function Nbsp() {

      };
      Nbsp.value = new Nbsp();
      return Nbsp;
  })();
  var None = (function () {
      function None() {

      };
      None.value = new None();
      return None;
  })();
  var spaceEq = new Data_Eq.Eq(function (v) {
      return function (v1) {
          if (v instanceof Normal && v1 instanceof Normal) {
              return true;
          };
          if (v instanceof Nbsp && v1 instanceof Nbsp) {
              return true;
          };
          if (v instanceof None && v1 instanceof None) {
              return true;
          };
          return false;
      };
  });
  var spaceOrd = new Data_Ord.Ord(function () {
      return spaceEq;
  }, function (v) {
      return function (v1) {
          if (v instanceof Normal && v1 instanceof Normal) {
              return Data_Ordering.EQ.value;
          };
          if (v instanceof Normal) {
              return Data_Ordering.LT.value;
          };
          if (v1 instanceof Normal) {
              return Data_Ordering.GT.value;
          };
          if (v instanceof Nbsp && v1 instanceof Nbsp) {
              return Data_Ordering.EQ.value;
          };
          if (v instanceof Nbsp) {
              return Data_Ordering.LT.value;
          };
          if (v1 instanceof Nbsp) {
              return Data_Ordering.GT.value;
          };
          if (v instanceof None && v1 instanceof None) {
              return Data_Ordering.EQ.value;
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 38, column 3 - line 38, column 29: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var normalizeAtom = function (t) {
      return function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Punctuation) {
              return (t.decide(v.value0)).string;
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Word) {
              return t.wrapWord(v.value0);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 91, column 1 - line 91, column 58: " + [ t.constructor.name, v.constructor.name ]);
      };
  };
  var frenchTypo = function (w) {
      var t = function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Semicolon) {
              return {
                  before: Nbsp.value, 
                  after: Nbsp.value, 
                  string: w(";")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Colon) {
              return {
                  before: Nbsp.value, 
                  after: Normal.value, 
                  string: w(":")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.OpenQuote) {
              return {
                  before: Normal.value, 
                  after: Nbsp.value, 
                  string: w("\xab")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.CloseQuote) {
              return {
                  before: Nbsp.value, 
                  after: Normal.value, 
                  string: w("\xbb")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Question) {
              return {
                  before: Nbsp.value, 
                  after: Normal.value, 
                  string: w("?")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Exclamation) {
              return {
                  before: Nbsp.value, 
                  after: Normal.value, 
                  string: w("!")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.LongDash) {
              return {
                  before: Normal.value, 
                  after: Normal.value, 
                  string: w("\u2014")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Dash) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("\u2013")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Hyphen) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("-")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Comma) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(",")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Point) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(".")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Apostrophe) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("\u2019")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.SuspensionPoints) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w("\u2026")
              };
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 108, column 5 - line 111, column 24: " + [ v.constructor.name ]);
      };
      var prevT = function (v) {
          if (v) {
              return new Data_Maybe.Just(Text_Ogmarkup_Private_Ast.LongDash.value);
          };
          if (!v) {
              return new Data_Maybe.Just(Text_Ogmarkup_Private_Ast.OpenQuote.value);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 101, column 1 - line 165, column 38: " + [ v.constructor.name ]);
      };
      var nextT = function (v) {
          if (v) {
              return Data_Maybe.Nothing.value;
          };
          if (!v) {
              return new Data_Maybe.Just(Text_Ogmarkup_Private_Ast.CloseQuote.value);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 101, column 1 - line 165, column 38: " + [ v.constructor.name ]);
      };
      return {
          decide: t, 
          openDialogue: prevT, 
          closeDialogue: nextT, 
          wrapWord: w
      };
  };
  var englishTypo = function (w) {
      var t = function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Semicolon) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(";")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Colon) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(":")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.OpenQuote) {
              return {
                  before: Normal.value, 
                  after: None.value, 
                  string: w("\u201c")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.CloseQuote) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w("\u201d")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Question) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w("?")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Exclamation) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w("!")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.LongDash) {
              return {
                  before: Normal.value, 
                  after: None.value, 
                  string: w("\u2014")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Dash) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("\u2013")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Hyphen) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("-")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Comma) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(",")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Point) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w(".")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Apostrophe) {
              return {
                  before: None.value, 
                  after: None.value, 
                  string: w("'")
              };
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.SuspensionPoints) {
              return {
                  before: None.value, 
                  after: Normal.value, 
                  string: w("\u2026")
              };
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Typography line 179, column 5 - line 182, column 24: " + [ v.constructor.name ]);
      };
      return {
          decide: t, 
          openDialogue: Data_Function.apply(Control_Applicative.pure(Control_Applicative.applicativeFn))(new Data_Maybe.Just(Text_Ogmarkup_Private_Ast.OpenQuote.value)), 
          closeDialogue: Data_Function.apply(Control_Applicative.pure(Control_Applicative.applicativeFn))(new Data_Maybe.Just(Text_Ogmarkup_Private_Ast.CloseQuote.value)), 
          wrapWord: w
      };
  };
  var beforeAtom = function (t) {
      return function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Punctuation) {
              return (t.decide(v.value0)).before;
          };
          return Normal.value;
      };
  };
  var afterAtom = function (t) {
      return function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Punctuation) {
              return (t.decide(v.value0)).after;
          };
          return Normal.value;
      };
  };
  exports["Normal"] = Normal;
  exports["Nbsp"] = Nbsp;
  exports["None"] = None;
  exports["afterAtom"] = afterAtom;
  exports["beforeAtom"] = beforeAtom;
  exports["englishTypo"] = englishTypo;
  exports["frenchTypo"] = frenchTypo;
  exports["normalizeAtom"] = normalizeAtom;
  exports["spaceEq"] = spaceEq;
  exports["spaceOrd"] = spaceOrd;
})(PS["Text.Ogmarkup.Private.Typography"] = PS["Text.Ogmarkup.Private.Typography"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Text_Ogmarkup_Private_Typography = PS["Text.Ogmarkup.Private.Typography"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Category = PS["Control.Category"];        
  var GC = (function () {
      function GC(value0) {
          this.value0 = value0;
      };
      GC.create = function (value0) {
          return new GC(value0);
      };
      return GC;
  })();
  exports["GC"] = GC;
})(PS["Text.Ogmarkup.Private.Config"] = PS["Text.Ogmarkup.Private.Config"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_Class = PS["Control.Monad.Aff.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Control_Monad_Reader = PS["Control.Monad.Reader"];
  var Data_List = PS["Data.List"];
  var Data_Tuple = PS["Data.Tuple"];
  var Text_Ogmarkup_Private_Ast = PS["Text.Ogmarkup.Private.Ast"];
  var Text_Ogmarkup_Private_Config = PS["Text.Ogmarkup.Private.Config"];
  var Text_Ogmarkup_Private_Typography = PS["Text.Ogmarkup.Private.Typography"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Functor = PS["Data.Functor"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];        
  var GS = (function () {
      function GS(value0) {
          this.value0 = value0;
      };
      GS.create = function (value0) {
          return new GS(value0);
      };
      return GS;
  })();
  var reset = Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v) {
      return Data_Function.apply(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(Data_Function.apply(GS.create)((function () {
          var $55 = {};
          for (var $56 in v.value0) {
              if (v.value0.hasOwnProperty($56)) {
                  $55[$56] = v.value0[$56];
              };
          };
          $55.prev = Data_Maybe.Nothing.value;
          return $55;
      })()));
  });
  var raw = function (dictMonoid) {
      return function (str$prime) {
          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v) {
              var st$prime = Data_Function.apply(GS.create)((function () {
                  var $60 = {};
                  for (var $61 in v.value0) {
                      if (v.value0.hasOwnProperty($61)) {
                          $60[$61] = v.value0[$61];
                      };
                  };
                  $60.string = Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(v.value0.string)(str$prime);
                  return $60;
              })());
              return Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(st$prime);
          });
      };
  };
  var later$prime = function (gen) {
      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v) {
          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Function.apply(function ($184) {
                  return Control_Monad_Aff_Class.liftAff(Control_Monad_Aff_Class.monadAffState(Control_Monad_Aff_Class.monadAffReader(Control_Monad_Aff_Class.monadAffAff)))(Control_Monad_Aff.later($184));
              })(Control_Monad_Reader_Trans.runReaderT(Control_Monad_State_Trans.runStateT(gen)(v))(v1)))(function (v2) {
                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(v2.value1))(function () {
                      return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(v2.value0);
                  });
              });
          });
      });
  };
  var initState = function (dictMonoid) {
      return new GS({
          string: Data_Monoid.mempty(dictMonoid), 
          prev: Data_Maybe.Nothing.value
      });
  };
  var runGenerator = function (dictMonoid) {
      return function (gen) {
          return function (conf) {
              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Reader_Trans.runReaderT(Control_Monad_State_Trans.execStateT(Control_Monad_Reader_Trans.functorReaderT(Control_Monad_Aff.functorAff))(gen)(initState(dictMonoid)))(conf))(function (v) {
                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(v.value0.string);
              });
          };
      };
  };
  var atom = function (dictMonoid) {
      return function (text) {
          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  if (v.value0.prev instanceof Data_Maybe.Just) {
                      var spc = Data_Function.apply(v1.value0.printSpace)(Data_Ord.max(Text_Ogmarkup_Private_Typography.spaceOrd)(Text_Ogmarkup_Private_Typography.afterAtom(v1.value0.typography)(v.value0.prev.value0))(Text_Ogmarkup_Private_Typography.beforeAtom(v1.value0.typography)(text)));
                      var str$prime = Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(spc)(Text_Ogmarkup_Private_Typography.normalizeAtom(v1.value0.typography)(text));
                      return Data_Function.apply(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(Data_Function.apply(GS.create)((function () {
                          var $79 = (function () {
                              var $74 = {};
                              for (var $75 in v.value0) {
                                  if (v.value0.hasOwnProperty($75)) {
                                      $74[$75] = v.value0[$75];
                                  };
                              };
                              $74.string = Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(v.value0.string)(str$prime);
                              return $74;
                          })();
                          var $77 = {};
                          for (var $78 in $79) {
                              if ($79.hasOwnProperty($78)) {
                                  $77[$78] = $79[$78];
                              };
                          };
                          $77.prev = new Data_Maybe.Just(text);
                          return $77;
                      })()));
                  };
                  if (v.value0.prev instanceof Data_Maybe.Nothing) {
                      return Data_Function.apply(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(Data_Function.apply(GS.create)((function () {
                          var $86 = (function () {
                              var $81 = {};
                              for (var $82 in v.value0) {
                                  if (v.value0.hasOwnProperty($82)) {
                                      $81[$82] = v.value0[$82];
                                  };
                              };
                              $81.string = Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(v.value0.string)(Text_Ogmarkup_Private_Typography.normalizeAtom(v1.value0.typography)(text));
                              return $81;
                          })();
                          var $84 = {};
                          for (var $85 in $86) {
                              if ($86.hasOwnProperty($85)) {
                                  $84[$85] = $86[$85];
                              };
                          };
                          $84.prev = new Data_Maybe.Just(text);
                          return $84;
                      })()));
                  };
                  throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 119, column 3 - line 125, column 50: " + [ v.value0.prev.constructor.name ]);
              });
          });
      };
  };
  var atoms = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_List.Cons) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(atom(dictMonoid)(v.value0))(function () {
                  return atoms(dictMonoid)(v.value1);
              });
          };
          if (v instanceof Data_List.Nil) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 140, column 1 - line 142, column 12: " + [ v.constructor.name ]);
      };
  };
  var maybeAtom = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_Maybe.Just) {
              return atom(dictMonoid)(v.value0);
          };
          if (v instanceof Data_Maybe.Nothing) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 132, column 1 - line 132, column 34: " + [ v.constructor.name ]);
      };
  };
  var apply = function (dictMonoid) {
      return function (temp) {
          return function (gen) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v) {
                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Function.apply(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(Data_Function.apply(GS.create)((function () {
                      var $95 = {};
                      for (var $96 in v.value0) {
                          if (v.value0.hasOwnProperty($96)) {
                              $95[$96] = v.value0[$96];
                          };
                      };
                      $95.string = Data_Monoid.mempty(dictMonoid);
                      return $95;
                  })())))(function () {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(gen)(function () {
                          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                              return Data_Function.apply(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff))))(Data_Function.apply(GS.create)((function () {
                                  var $104 = (function () {
                                      var $99 = {};
                                      for (var $100 in v1.value0) {
                                          if (v1.value0.hasOwnProperty($100)) {
                                              $99[$100] = v1.value0[$100];
                                          };
                                      };
                                      $99.string = Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(v.value0.string)(temp(v1.value0.string));
                                      return $99;
                                  })();
                                  var $102 = {};
                                  for (var $103 in $104) {
                                      if ($104.hasOwnProperty($103)) {
                                          $102[$103] = $104[$103];
                                      };
                                  };
                                  $102.prev = v1.value0.prev;
                                  return $102;
                              })()));
                          });
                      });
                  });
              });
          };
      };
  };
  var formats = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_List.Cons) {
              return Data_Function.apply(later$prime)(Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(format(dictMonoid)(v.value0))(function () {
                  return formats(dictMonoid)(v.value1);
              }));
          };
          if (v instanceof Data_List.Nil) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 175, column 1 - line 177, column 14: " + [ v.constructor.name ]);
      };
  };
  var format = function (dictMonoid) {
      return function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Raw) {
              return atoms(dictMonoid)(v.value0);
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Emph) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(v1.value0.emphTemplate)(formats(dictMonoid)(v.value0));
              });
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.StrongEmph) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(v1.value0.strongEmphTemplate)(formats(dictMonoid)(v.value0));
              });
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Quote) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Function.apply(atom(dictMonoid))(new Text_Ogmarkup_Private_Ast.Punctuation(Text_Ogmarkup_Private_Ast.OpenQuote.value)))(function () {
                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(formats(dictMonoid)(v.value0))(function () {
                      return Data_Function.apply(atom(dictMonoid))(new Text_Ogmarkup_Private_Ast.Punctuation(Text_Ogmarkup_Private_Ast.CloseQuote.value));
                  });
              });
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 151, column 1 - line 151, column 31: " + [ v.constructor.name ]);
      };
  };
  var reply = function (dictMonoid) {
      return function (begin) {
          return function (end) {
              return function (v) {
                  if (v instanceof Text_Ogmarkup_Private_Ast.Simple) {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(maybeAtom(dictMonoid)(begin))(function () {
                              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(apply(dictMonoid)(v1.value0.replyTemplate)(formats(dictMonoid)(v.value0)))(function () {
                                  return maybeAtom(dictMonoid)(end);
                              });
                          });
                      });
                  };
                  if (v instanceof Text_Ogmarkup_Private_Ast.WithSay) {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(maybeAtom(dictMonoid)(begin))(function () {
                              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(apply(dictMonoid)(v1.value0.replyTemplate)(formats(dictMonoid)(v.value0)))(function () {
                                  if (v.value2 instanceof Data_List.Nil) {
                                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(maybeAtom(dictMonoid)(end))(function () {
                                          return formats(dictMonoid)(v.value1);
                                      });
                                  };
                                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(formats(dictMonoid)(v.value1))(function () {
                                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(apply(dictMonoid)(v1.value0.replyTemplate)(formats(dictMonoid)(v.value2)))(function () {
                                          return maybeAtom(dictMonoid)(end);
                                      });
                                  });
                              });
                          });
                      });
                  };
                  throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 187, column 1 - line 193, column 16: " + [ begin.constructor.name, end.constructor.name, v.constructor.name ]);
              };
          };
      };
  };
  var component = function (dictMonoid) {
      return function (p) {
          return function (n) {
              return function (v) {
                  if (v instanceof Text_Ogmarkup_Private_Ast.Dialogue) {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                          return apply(dictMonoid)(Data_Function.apply(v1.value0.dialogueTemplate)(v1.value0.authorNormalize(v.value1)))(reply(dictMonoid)(Data_Functor.map(Data_Maybe.functorMaybe)(Text_Ogmarkup_Private_Ast.Punctuation.create)(v1.value0.typography.openDialogue(p)))(Data_Functor.map(Data_Maybe.functorMaybe)(Text_Ogmarkup_Private_Ast.Punctuation.create)(v1.value0.typography.closeDialogue(n)))(v.value0));
                      });
                  };
                  if (v instanceof Text_Ogmarkup_Private_Ast.Thought) {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                          return apply(dictMonoid)(Data_Function.apply(v1.value0.thoughtTemplate)(v1.value0.authorNormalize(v.value1)))(reply(dictMonoid)(Data_Maybe.Nothing.value)(Data_Maybe.Nothing.value)(v.value0));
                      });
                  };
                  if (v instanceof Text_Ogmarkup_Private_Ast.Teller) {
                      return formats(dictMonoid)(v.value0);
                  };
                  if (v instanceof Text_Ogmarkup_Private_Ast.IllFormed) {
                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                          return apply(dictMonoid)(v1.value0.errorTemplate)(Data_Function.apply(raw(dictMonoid))(v1.value0.typography.wrapWord(v.value0)));
                      });
                  };
                  throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 216, column 1 - line 226, column 93: " + [ p.constructor.name, n.constructor.name, v.constructor.name ]);
              };
          };
      };
  };
  var paragraph = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_List.Cons) {
              var isDialogue = function (v1) {
                  if (v1 instanceof Text_Ogmarkup_Private_Ast.Dialogue) {
                      return true;
                  };
                  return false;
              };
              var willBeDialogue = function (v1) {
                  if (v1 instanceof Data_List.Cons && v1.value1 instanceof Data_List.Cons) {
                      return isDialogue(v1.value1.value0);
                  };
                  return false;
              };
              var recGen = function (v1) {
                  return function (v2) {
                      return function (v3) {
                          return function (v4) {
                              if (v4 instanceof Data_List.Cons) {
                                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Function.apply(Control_Applicative.when(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(v2 && isDialogue(v4.value0)))(Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(raw(dictMonoid)(v1))(function () {
                                      return reset;
                                  })))(function () {
                                      return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(component(dictMonoid)(v2)(v3)(v4.value0))(function () {
                                          return recGen(v1)(isDialogue(v4.value0))(willBeDialogue(v4.value1))(v4.value1);
                                      });
                                  });
                              };
                              if (v4 instanceof Data_List.Nil) {
                                  return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
                              };
                              throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 265, column 5 - line 269, column 61: " + [ v1.constructor.name, v2.constructor.name, v3.constructor.name, v4.constructor.name ]);
                          };
                      };
                  };
              };
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(v1.value0.paragraphTemplate)(recGen(v1.value0.betweenDialogue)(false)(willBeDialogue(v))(v));
              });
          };
          if (v instanceof Data_List.Nil) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 246, column 1 - line 270, column 33: " + [ v.constructor.name ]);
      };
  };
  var paragraphs = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_List.Cons) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(paragraph(dictMonoid)(v.value0))(function () {
                  return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(reset)(function () {
                      return paragraphs(dictMonoid)(v.value1);
                  });
              });
          };
          if (v instanceof Data_List.Nil) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 279, column 1 - line 281, column 40: " + [ v.constructor.name ]);
      };
  };
  var section = function (dictMonoid) {
      return function (v) {
          if (v instanceof Text_Ogmarkup_Private_Ast.Story) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(v1.value0.storyTemplate)(paragraphs(dictMonoid)(v.value0));
              });
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Aside) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(v1.value0.asideTemplate(v.value0))(paragraphs(dictMonoid)(v.value1));
              });
          };
          if (v instanceof Text_Ogmarkup_Private_Ast.Failing) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v1) {
                  return apply(dictMonoid)(function ($185) {
                      return v1.value0.storyTemplate(v1.value0.errorTemplate($185));
                  })(Data_Function.apply(raw(dictMonoid))(v1.value0.typography.wrapWord(v.value0)));
              });
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 289, column 1 - line 292, column 55: " + [ v.constructor.name ]);
      };
  };
  var sections = function (dictMonoid) {
      return function (v) {
          if (v instanceof Data_List.Cons) {
              return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(section(dictMonoid)(v.value0))(function () {
                  return sections(dictMonoid)(v.value1);
              });
          };
          if (v instanceof Data_List.Nil) {
              return Control_Applicative.pure(Control_Monad_State_Trans.applicativeStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Data_Unit.unit);
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Generator line 309, column 1 - line 310, column 36: " + [ v.constructor.name ]);
      };
  };
  var document = function (dictMonoid) {
      return function (d) {
          return Control_Bind.bind(Control_Monad_State_Trans.bindStateT(Control_Monad_Reader_Trans.monadReaderT(Control_Monad_Aff.monadAff)))(Control_Monad_Reader_Class.ask(Control_Monad_State_Trans.monadReaderStateT(Control_Monad_Reader_Trans.monadReaderReaderT(Control_Monad_Aff.monadAff))))(function (v) {
              return apply(dictMonoid)(v.value0.documentTemplate)(sections(dictMonoid)(d));
          });
      };
  };
  exports["GS"] = GS;
  exports["apply"] = apply;
  exports["atom"] = atom;
  exports["atoms"] = atoms;
  exports["component"] = component;
  exports["document"] = document;
  exports["format"] = format;
  exports["formats"] = formats;
  exports["initState"] = initState;
  exports["maybeAtom"] = maybeAtom;
  exports["paragraph"] = paragraph;
  exports["paragraphs"] = paragraphs;
  exports["raw"] = raw;
  exports["reply"] = reply;
  exports["reset"] = reset;
  exports["runGenerator"] = runGenerator;
  exports["section"] = section;
  exports["sections"] = sections;
})(PS["Text.Ogmarkup.Private.Generator"] = PS["Text.Ogmarkup.Private.Generator"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_String = PS["Data.String"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Ring = PS["Data.Ring"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];        
  var Position = (function () {
      function Position(value0) {
          this.value0 = value0;
      };
      Position.create = function (value0) {
          return new Position(value0);
      };
      return Position;
  })();
  var updatePosString = function (pos) {
      return function (str) {
          var updatePosChar = function (v) {
              return function (c) {
                  if (c === "\n") {
                      return new Position({
                          line: v.value0.line + 1 | 0, 
                          column: 1
                      });
                  };
                  if (c === "\r") {
                      return new Position({
                          line: v.value0.line + 1 | 0, 
                          column: 1
                      });
                  };
                  if (c === "\t") {
                      return new Position({
                          line: v.value0.line, 
                          column: (v.value0.column + 8 | 0) - (v.value0.column - 1) % 8
                      });
                  };
                  return new Position({
                      line: v.value0.line, 
                      column: v.value0.column + 1 | 0
                  });
              };
          };
          return Data_Foldable.foldl(Data_Foldable.foldableArray)(updatePosChar)(pos)(Data_String.split("")(str));
      };
  }; 
  var initialPos = new Position({
      line: 1, 
      column: 1
  });
  exports["Position"] = Position;
  exports["initialPos"] = initialPos;
  exports["updatePosString"] = updatePosString;
})(PS["Text.Parsing.Parser.Pos"] = PS["Text.Parsing.Parser.Pos"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var ParseError = (function () {
      function ParseError(value0) {
          this.value0 = value0;
      };
      ParseError.create = function (value0) {
          return new ParseError(value0);
      };
      return ParseError;
  })();
  var PState = (function () {
      function PState(value0) {
          this.value0 = value0;
      };
      PState.create = function (value0) {
          return new PState(value0);
      };
      return PState;
  })();
  var ParserT = function (x) {
      return x;
  };
  var unParserT = function (v) {
      return v;
  }; 
  var runParserT = function (dictMonad) {
      return function (s) {
          return function (p) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p)(s))(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v.result);
              });
          };
      };
  };
  var parseFailed = function (s) {
      return function (pos) {
          return function (message) {
              return {
                  input: s, 
                  consumed: false, 
                  result: new Data_Either.Left(new ParseError({
                      message: message, 
                      position: pos
                  })), 
                  position: pos
              };
          };
      };
  };
  var monadTransParserT = new Control_Monad_Trans.MonadTrans(function (dictMonad) {
      return function (m) {
          return Data_Function.apply(ParserT)(function (v) {
              return Data_Functor.map(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(function (a) {
                  return {
                      input: v.value0.input, 
                      consumed: false, 
                      result: new Data_Either.Right(a), 
                      position: v.value0.position
                  };
              })(m);
          });
      };
  });
  var lazyParserT = new Control_Lazy.Lazy(function (f) {
      return Data_Function.apply(ParserT)(function (s) {
          return unParserT(f(Data_Unit.unit))(s);
      });
  });
  var functorParserT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (p) {
              var f$prime = function (o) {
                  return {
                      input: o.input, 
                      result: Data_Functor.map(Data_Either.functorEither)(f)(o.result), 
                      consumed: o.consumed, 
                      position: o.position
                  };
              };
              return Data_Function.apply(ParserT)(function (s) {
                  return Data_Functor.map(dictFunctor)(f$prime)(unParserT(p)(s));
              });
          };
      });
  };
  var fail = function (dictMonad) {
      return function (message) {
          return Data_Function.apply(ParserT)(function (v) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))(parseFailed(v.value0.input)(v.value0.position)(message));
          });
      };
  };
  var monadParserT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeParserT(dictMonad);
      }, function () {
          return bindParserT(dictMonad);
      });
  };
  var bindParserT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyParserT(dictMonad);
      }, function (p) {
          return function (f) {
              var updateConsumedFlag = function (c) {
                  return function (o) {
                      return {
                          input: o.input, 
                          consumed: c || o.consumed, 
                          result: o.result, 
                          position: o.position
                      };
                  };
              };
              return Data_Function.apply(ParserT)(function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p)(s))(function (o) {
                      if (o.result instanceof Data_Either.Left) {
                          return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())({
                              input: o.input, 
                              result: new Data_Either.Left(o.result.value0), 
                              consumed: o.consumed, 
                              position: o.position
                          });
                      };
                      if (o.result instanceof Data_Either.Right) {
                          return Data_Functor.map(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(updateConsumedFlag(o.consumed))(unParserT(f(o.result.value0))(new PState({
                              input: o.input, 
                              position: o.position
                          })));
                      };
                      throw new Error("Failed pattern match at Text.Parsing.Parser line 79, column 5 - line 81, column 117: " + [ o.result.constructor.name ]);
                  });
              });
          };
      });
  };
  var applyParserT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, Control_Monad.ap(monadParserT(dictMonad)));
  };
  var applicativeParserT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyParserT(dictMonad);
      }, function (a) {
          return Data_Function.apply(ParserT)(function (v) {
              return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())({
                  input: v.value0.input, 
                  result: new Data_Either.Right(a), 
                  consumed: false, 
                  position: v.value0.position
              });
          });
      });
  };
  var altParserT = function (dictMonad) {
      return new Control_Alt.Alt(function () {
          return functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, function (p1) {
          return function (p2) {
              return Data_Function.apply(ParserT)(function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p1)(s))(function (o) {
                      if (o.result instanceof Data_Either.Left && !o.consumed) {
                          return unParserT(p2)(s);
                      };
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(o);
                  });
              });
          };
      });
  };
  var plusParserT = function (dictMonad) {
      return new Control_Plus.Plus(function () {
          return altParserT(dictMonad);
      }, fail(dictMonad)("No alternative"));
  };
  var alternativeParserT = function (dictMonad) {
      return new Control_Alternative.Alternative(function () {
          return applicativeParserT(dictMonad);
      }, function () {
          return plusParserT(dictMonad);
      });
  };
  exports["PState"] = PState;
  exports["ParseError"] = ParseError;
  exports["ParserT"] = ParserT;
  exports["fail"] = fail;
  exports["parseFailed"] = parseFailed;
  exports["runParserT"] = runParserT;
  exports["unParserT"] = unParserT;
  exports["functorParserT"] = functorParserT;
  exports["applyParserT"] = applyParserT;
  exports["applicativeParserT"] = applicativeParserT;
  exports["altParserT"] = altParserT;
  exports["plusParserT"] = plusParserT;
  exports["alternativeParserT"] = alternativeParserT;
  exports["bindParserT"] = bindParserT;
  exports["monadParserT"] = monadParserT;
  exports["monadTransParserT"] = monadTransParserT;
  exports["lazyParserT"] = lazyParserT;
})(PS["Text.Parsing.Parser"] = PS["Text.Parsing.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Control_Alt = PS["Control.Alt"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Apply = PS["Control.Apply"];
  var $$try = function (dictFunctor) {
      return function (p) {
          var try$prime = function (v) {
              return function (v1) {
                  return function (v2) {
                      if (v2.result instanceof Data_Either.Left) {
                          return {
                              input: v, 
                              result: v2.result, 
                              consumed: false, 
                              position: v1
                          };
                      };
                      return v2;
                  };
              };
          };
          return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
              return Data_Functor.map(dictFunctor)(try$prime(v.value0.input)(v.value0.position))(Text_Parsing_Parser.unParserT(p)(new Text_Parsing_Parser.PState({
                  input: v.value0.input, 
                  position: v.value0.position
              })));
          });
      };
  };
  var optional = function (dictMonad) {
      return function (p) {
          return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(p)(function () {
              return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit);
          }))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit));
      };
  };
  var option = function (dictMonad) {
      return function (a) {
          return function (p) {
              return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(p)(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(a));
          };
      };
  };
  var optionMaybe = function (dictMonad) {
      return function (p) {
          return option(dictMonad)(Data_Maybe.Nothing.value)(Data_Functor.map(Text_Parsing_Parser.functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Data_Maybe.Just.create)(p));
      };
  };
  var notFollowedBy = function (dictMonad) {
      return function (p) {
          return Data_Function.apply($$try(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(dictMonad))($$try(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(p))(Text_Parsing_Parser.fail(dictMonad)("Negated parser succeeded")))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit)));
      };
  };
  var manyTill = function (dictMonad) {
      return function (p) {
          return function (end) {
              var scan = Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(end)(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_List.Nil.value);
              }))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(p)(function (v) {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(scan)(function (v1) {
                      return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(new Data_List.Cons(v, v1));
                  });
              }));
              return scan;
          };
      };
  };
  var many1Till = function (dictMonad) {
      return function (p) {
          return function (end) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(p)(function (v) {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(manyTill(dictMonad)(p)(end))(function (v1) {
                      return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(new Data_List.Cons(v, v1));
                  });
              });
          };
      };
  };
  var lookAhead = function (dictMonad) {
      return function (v) {
          return function (v1) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v(new Text_Parsing_Parser.PState({
                  input: v1.value0.input, 
                  position: v1.value0.position
              })))(function (v2) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())((function () {
                      var $75 = {};
                      for (var $76 in v2) {
                          if (v2.hasOwnProperty($76)) {
                              $75[$76] = v2[$76];
                          };
                      };
                      $75.input = v1.value0.input;
                      $75.consumed = false;
                      $75.position = v1.value0.position;
                      return $75;
                  })());
              });
          };
      };
  };
  exports["lookAhead"] = lookAhead;
  exports["many1Till"] = many1Till;
  exports["manyTill"] = manyTill;
  exports["notFollowedBy"] = notFollowedBy;
  exports["option"] = option;
  exports["optionMaybe"] = optionMaybe;
  exports["optional"] = optional;
  exports["try"] = $$try;
})(PS["Text.Parsing.Parser.Combinators"] = PS["Text.Parsing.Parser.Combinators"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];        
  var string = function (dictMonad) {
      return function (str) {
          return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
                  var $16 = Data_String.indexOf(str)(v.value0.input);
                  if ($16 instanceof Data_Maybe.Just && $16.value0 === 0) {
                      return {
                          consumed: true, 
                          input: Data_String.drop(Data_String.length(str))(v.value0.input), 
                          result: new Data_Either.Right(str), 
                          position: Text_Parsing_Parser_Pos.updatePosString(v.value0.position)(str)
                      };
                  };
                  return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Expected " + str);
              })());
          });
      };
  };
  var eof = function (dictMonad) {
      return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
          return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
              if (v.value0.input === "") {
                  return {
                      consumed: false, 
                      input: v.value0.input, 
                      result: new Data_Either.Right(Data_Unit.unit), 
                      position: v.value0.position
                  };
              };
              return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Expected EOF");
          })());
      });
  };
  var anyChar = function (dictMonad) {
      return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
          return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
              var $27 = Data_String.charAt(0)(v.value0.input);
              if ($27 instanceof Data_Maybe.Nothing) {
                  return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Unexpected EOF");
              };
              if ($27 instanceof Data_Maybe.Just) {
                  return {
                      consumed: true, 
                      input: Data_String.drop(1)(v.value0.input), 
                      result: new Data_Either.Right($27.value0), 
                      position: Text_Parsing_Parser_Pos.updatePosString(v.value0.position)(Data_String.singleton($27.value0))
                  };
              };
              throw new Error("Failed pattern match at Text.Parsing.Parser.String line 33, column 3 - line 35, column 113: " + [ $27.constructor.name ]);
          })());
      });
  };
  var satisfy = function (dictMonad) {
      return function (f) {
          return Text_Parsing_Parser_Combinators["try"](((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(anyChar(dictMonad))(function (v) {
              var $33 = f(v);
              if ($33) {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(v);
              };
              if (!$33) {
                  return Data_Function.apply(Text_Parsing_Parser.fail(dictMonad))("Character '" + (Data_String.singleton(v) + "' did not satisfy predicate"));
              };
              throw new Error("Failed pattern match at Text.Parsing.Parser.String line 41, column 3 - line 44, column 1: " + [ $33.constructor.name ]);
          }));
      };
  };
  var $$char = function (dictMonad) {
      return function (c) {
          return satisfy(dictMonad)(function (v) {
              return v === c;
          });
      };
  };
  var oneOf = function (dictMonad) {
      return function (ss) {
          return satisfy(dictMonad)(Data_Function.flip(Data_Foldable.elem(Data_Foldable.foldableArray)(Data_Eq.eqChar))(ss));
      };
  };
  var whiteSpace = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(Data_Function.apply(Data_Array.many(Text_Parsing_Parser.alternativeParserT(dictMonad))(Text_Parsing_Parser.lazyParserT))(satisfy(dictMonad)(function (c) {
          return c === "\n" || (c === "\r" || (c === " " || c === "\t"));
      })))(function (v) {
          return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad)))(Data_String.fromCharArray(v));
      });
  };
  var skipSpaces = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(whiteSpace(dictMonad))(function () {
          return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit);
      });
  };
  exports["anyChar"] = anyChar;
  exports["char"] = $$char;
  exports["eof"] = eof;
  exports["oneOf"] = oneOf;
  exports["satisfy"] = satisfy;
  exports["skipSpaces"] = skipSpaces;
  exports["string"] = string;
  exports["whiteSpace"] = whiteSpace;
})(PS["Text.Parsing.Parser.String"] = PS["Text.Parsing.Parser.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_List_1 = PS["Data.List"];
  var Data_Array = PS["Data.Array"];
  var Data_Identity = PS["Data.Identity"];
  var Data_List_1 = PS["Data.List"];
  var Data_String = PS["Data.String"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_String = PS["Text.Parsing.Parser.String"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Text_Ogmarkup_Private_Ast = PS["Text.Ogmarkup.Private.Ast"];
  var Data_Function = PS["Data.Function"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var sput = function (dictMonad) {
      return function (t) {
          return Data_Function.apply(Control_Monad_Trans.lift(Text_Parsing_Parser.monadTransParserT)(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Monad_State_Class.put(Control_Monad_State_Trans.monadStateStateT(dictMonad))(t));
      };
  };
  var some$prime = function (dictMonad) {
      return function (p) {
          return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_String.fromCharArray)(Data_Array.some(Text_Parsing_Parser.alternativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser.lazyParserT)(p));
      };
  };
  var skip = function (dictMonad) {
      return function (p) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(p)(function () {
              return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
          });
      };
  };
  var whiteSpace = function (dictMonad) {
      return Data_Function.apply(skip(dictMonad))(Text_Parsing_Parser_String.satisfy(Control_Monad_State_Trans.monadStateT(dictMonad))(function (c) {
          return c === "\n" || (c === " " || (c === "\t" || c === "\r"));
      }));
  };
  var word = function (dictMonad) {
      var specChar = Data_String.toCharArray("\"\xab\xbb`+*[]<>|_'\u2019.,;-\u2013\u2014!?:");
      var endOfWord = Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.eof(Control_Monad_State_Trans.monadStateT(dictMonad)))(whiteSpace(dictMonad)))(Data_Function.apply(skip(dictMonad))(Text_Parsing_Parser_String.oneOf(Control_Monad_State_Trans.monadStateT(dictMonad))(specChar)));
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.notFollowedBy(Control_Monad_State_Trans.monadStateT(dictMonad))(endOfWord))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_Array.fromFoldable(Data_List_1.foldableList))(Text_Parsing_Parser_Combinators.many1Till(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.lookAhead(Control_Monad_State_Trans.monadStateT(dictMonad))(endOfWord))))(function (v) {
              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.Word(Data_String.fromCharArray(v)));
          });
      });
  };
  var sget = function (dictMonad) {
      return Control_Monad_Trans.lift(Text_Parsing_Parser.monadTransParserT)(Control_Monad_State_Trans.monadStateT(dictMonad))(Control_Monad_State_Class.get(Control_Monad_State_Trans.monadStateStateT(dictMonad)));
  };
  var many$prime = function (dictMonad) {
      return function (p) {
          return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_String.fromCharArray)(Data_Array.many(Text_Parsing_Parser.alternativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser.lazyParserT)(p));
      };
  };
  var mark = function (dictMonad) {
      var parseMark = function (p) {
          return function (m) {
              return Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(p)(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(m));
          };
      };
      var point = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("."))(Text_Ogmarkup_Private_Ast.Point.value);
      var question = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("?"))(Text_Ogmarkup_Private_Ast.Question.value);
      var semicolon = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(";"))(Text_Ogmarkup_Private_Ast.Semicolon.value);
      var suspensionPoints = parseMark(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))(".."))(many$prime(dictMonad)(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("."))))(Text_Ogmarkup_Private_Ast.SuspensionPoints.value);
      var longDash = parseMark(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))("\u2014"))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))("---")))(Text_Ogmarkup_Private_Ast.LongDash.value);
      var hyphen = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("-"))(Text_Ogmarkup_Private_Ast.Hyphen.value);
      var exclamation = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("!"))(Text_Ogmarkup_Private_Ast.Exclamation.value);
      var dash = parseMark(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))("\u2013"))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))("--")))(Text_Ogmarkup_Private_Ast.Dash.value);
      var comma = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(","))(Text_Ogmarkup_Private_Ast.Comma.value);
      var colon = parseMark(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(":"))(Text_Ogmarkup_Private_Ast.Colon.value);
      var apostrophe = parseMark(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("'"))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\u2019")))(Text_Ogmarkup_Private_Ast.Apostrophe.value);
      return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Text_Ogmarkup_Private_Ast.Punctuation.create)(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(semicolon)(colon))(question))(exclamation))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(longDash)))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(dash)))(hyphen))(comma))(apostrophe))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(suspensionPoints)))(point));
  };
  var many = function (dictMonad) {
      return function (p) {
          return Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(p)(function (v) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(many(dictMonad)(p))(function (v1) {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(new Data_List_1.Cons(v, v1));
              });
          }))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_List_1.Nil.value));
      };
  };
  var some = function (dictMonad) {
      return function (p) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(p)(function (v) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(many(dictMonad)(p))(function (v1) {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(new Data_List_1.Cons(v, v1));
              });
          });
      };
  };
  var longword = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("`"))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.notFollowedBy(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("`")))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_Array.fromFoldable(Data_List_1.foldableList))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("`"))))(function (v) {
                  return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.Word(Data_String.fromCharArray(v)));
              });
          });
      });
  };
  var liftParser = function (dictMonad) {
      return function (v) {
          return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (ps) {
              return Data_Function.apply(Control_Monad_State_Trans.StateT)(function (st) {
                  var $79 = Control_Monad_State_Trans.runStateT(v(ps))(st);
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())($79);
              });
          });
      };
  };
  var leaveStrongEmph = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithStrongEmph) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sput(dictMonad)((function () {
                  var $82 = {};
                  for (var $83 in v) {
                      if (v.hasOwnProperty($83)) {
                          $82[$83] = v[$83];
                      };
                  };
                  $82.parseWithStrongEmph = false;
                  return $82;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          if (!v.parseWithStrongEmph) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("cannot leave strong emphasis when you did not enter");
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 114, column 22 - line 119, column 1: " + [ v.parseWithStrongEmph.constructor.name ]);
      });
  };
  var leaveQuote = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithinQuote) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sput(dictMonad)((function () {
                  var $87 = {};
                  for (var $88 in v) {
                      if (v.hasOwnProperty($88)) {
                          $87[$88] = v[$88];
                      };
                  };
                  $87.parseWithinQuote = false;
                  return $87;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          if (!v.parseWithinQuote) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("cannot leave quote when you did not enter");
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 135, column 17 - line 140, column 1: " + [ v.parseWithinQuote.constructor.name ]);
      });
  };
  var leaveEmph = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithEmph) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sput(dictMonad)((function () {
                  var $92 = {};
                  for (var $93 in v) {
                      if (v.hasOwnProperty($93)) {
                          $92[$93] = v[$93];
                      };
                  };
                  $92.parseWithEmph = false;
                  return $92;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          if (!v.parseWithEmph) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("cannot leave emphasis when you did not enter");
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 93, column 16 - line 98, column 1: " + [ v.parseWithEmph.constructor.name ]);
      });
  };
  var later$prime = function (v) {
      return function (ps) {
          return function (st) {
              return Data_Function.apply(Control_Monad_Aff.later)(Control_Monad_State_Trans.runStateT(v(ps))(st));
          };
      };
  };
  var initParserState = {
      parseWithEmph: false, 
      parseWithStrongEmph: false, 
      parseWithinQuote: false
  };
  var parse = function (dictMonad) {
      return function (ogma) {
          return function (content) {
              return Control_Monad_State_Trans.evalStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Text_Parsing_Parser.runParserT(Control_Monad_State_Trans.monadStateT(dictMonad))(new Text_Parsing_Parser.PState({
                  input: content, 
                  position: Text_Parsing_Parser_Pos.initialPos
              }))(ogma))(initParserState);
          };
      };
  };
  var enterStrongEmph = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithStrongEmph) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("guard against nested strong emphasis");
          };
          if (!v.parseWithStrongEmph) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sput(dictMonad)((function () {
                  var $98 = {};
                  for (var $99 in v) {
                      if (v.hasOwnProperty($99)) {
                          $98[$99] = v[$99];
                      };
                  };
                  $98.parseWithStrongEmph = true;
                  return $98;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 103, column 22 - line 106, column 41: " + [ v.parseWithStrongEmph.constructor.name ]);
      });
  };
  var enterQuote = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithinQuote) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("guard against nested quotes");
          };
          if (!v.parseWithinQuote) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sput(dictMonad)((function () {
                  var $103 = {};
                  for (var $104 in v) {
                      if (v.hasOwnProperty($104)) {
                          $103[$104] = v[$104];
                      };
                  };
                  $103.parseWithinQuote = true;
                  return $103;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 124, column 17 - line 127, column 36: " + [ v.parseWithinQuote.constructor.name ]);
      });
  };
  var enterEmph = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(sget(dictMonad))(function (v) {
          if (v.parseWithEmph) {
              return Text_Parsing_Parser.fail(Control_Monad_State_Trans.monadStateT(dictMonad))("guard against nested emphasis");
          };
          if (!v.parseWithEmph) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Function.apply(sput(dictMonad))((function () {
                  var $108 = {};
                  for (var $109 in v) {
                      if (v.hasOwnProperty($109)) {
                          $108[$109] = v[$109];
                      };
                  };
                  $108.parseWithEmph = true;
                  return $108;
              })()))(function () {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
              });
          };
          throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 82, column 16 - line 85, column 35: " + [ v.parseWithEmph.constructor.name ]);
      });
  };
  var count = function (dictMonad) {
      return function (n) {
          return function (p) {
              var count$prime = function (v) {
                  return function (v1) {
                      return function (r) {
                          if (v === 0) {
                              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(Data_List_1.reverse(r));
                          };
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(v1)(function (v2) {
                              return count$prime(v - 1)(v1)(new Data_List_1.Cons(v2, r));
                          });
                      };
                  };
              };
              var $115 = n > 0;
              if ($115) {
                  return count$prime(n)(p)(Data_List_1.Nil.value);
              };
              if (!$115) {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_List_1.Nil.value);
              };
              throw new Error("Failed pattern match at Text.Ogmarkup.Private.Parser line 501, column 13 - line 503, column 26: " + [ $115.constructor.name ]);
          };
      };
  };
  var characterName = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("("))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.notFollowedBy(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(")")))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_Array.fromFoldable(Data_List_1.foldableList))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(")"))))(function (v) {
                  return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(Data_String.fromCharArray(v));
              });
          });
      });
  };
  var asideSeparator = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.string(Control_Monad_State_Trans.monadStateT(dictMonad))("__"))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(some(dictMonad)(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("_")))(function () {
              return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Unit.unit);
          });
      });
  };
  var endOfParagraph = function (dictMonad) {
      var betweenTwoSections = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Function.apply(count(dictMonad)(2))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(whiteSpace(dictMonad))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.eof(Control_Monad_State_Trans.monadStateT(dictMonad)))(skip(dictMonad)(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\n"))))))(function () {
          return Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(dictMonad));
      });
      return Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(betweenTwoSections))(asideSeparator(dictMonad)))(Text_Parsing_Parser_String.eof(Control_Monad_State_Trans.monadStateT(dictMonad)));
  };
  var blank = function (dictMonad) {
      return Data_Function.apply(skip(dictMonad))(Text_Parsing_Parser_Combinators.optional(Control_Monad_State_Trans.monadStateT(dictMonad))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.notFollowedBy(Control_Monad_State_Trans.monadStateT(dictMonad))(endOfParagraph(dictMonad)))(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(dictMonad)))));
  };
  var atom = function (dictMonad) {
      return Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(word(dictMonad))(mark(dictMonad)))(longword(dictMonad)))(blank(dictMonad));
  };
  var raw = function (dictMonad) {
      return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Text_Ogmarkup_Private_Ast.Raw.create)(some(dictMonad)(atom(dictMonad)));
  };
  var closeQuote = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\xbb"))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\"")))(function () {
          return blank(dictMonad);
      });
  };
  var openQuote = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\xab"))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("\"")))(function () {
          return blank(dictMonad);
      });
  };
  var format = function (dictMonad) {
      var strongEmph = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("+"))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(enterStrongEmph(dictMonad))(function () {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(format(dictMonad))(function (v) {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(format(dictMonad))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("+"))(blank(dictMonad))))(function (v1) {
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(leaveStrongEmph(dictMonad))(function () {
                              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.StrongEmph(new Data_List_1.Cons(v, v1)));
                          });
                      });
                  });
              });
          });
      });
      var quote = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(openQuote(dictMonad))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(enterQuote(dictMonad))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(format(dictMonad))(function (v) {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(format(dictMonad))(closeQuote(dictMonad)))(function (v1) {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(leaveQuote(dictMonad))(function () {
                          return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.Quote(new Data_List_1.Cons(v, v1)));
                      });
                  });
              });
          });
      });
      var emph = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("*"))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(enterEmph(dictMonad))(function () {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(format(dictMonad))(function (v) {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(format(dictMonad))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("*"))(blank(dictMonad))))(function (v1) {
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(leaveEmph(dictMonad))(function () {
                              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.Emph(new Data_List_1.Cons(v, v1)));
                          });
                      });
                  });
              });
          });
      });
      return Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(raw(dictMonad))(emph))(strongEmph))(quote);
  };
  var teller = function (dictMonad) {
      return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Text_Ogmarkup_Private_Ast.Teller.create)(some(dictMonad)(format(dictMonad)));
  };
  var reply = function (dictMonad) {
      return function (c) {
          return function (c$prime) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(c))(function () {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(some(dictMonad)(format(dictMonad)))(function (v) {
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String.oneOf(Control_Monad_State_Trans.monadStateT(dictMonad))([ "|", c$prime ]))(function (v1) {
                              if (v1 === "|") {
                                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
                                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(some(dictMonad)(format(dictMonad)))(function (v2) {
                                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))("|"))(function () {
                                              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
                                                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(many(dictMonad)(format(dictMonad)))(function (v3) {
                                                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(dictMonad))(c$prime))(function () {
                                                          return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.WithSay(v, v2, v3));
                                                      });
                                                  });
                                              });
                                          });
                                      });
                                  });
                              };
                              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(new Text_Ogmarkup_Private_Ast.Simple(v));
                          });
                      });
                  });
              });
          };
      };
  };
  var talk = function (dictMonad) {
      return function (c) {
          return function (c$prime) {
              return function (constructor) {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(reply(dictMonad)(c)(c$prime))(function (v) {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.optionMaybe(Control_Monad_State_Trans.monadStateT(dictMonad))(characterName(dictMonad)))(function (v1) {
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(blank(dictMonad))(function () {
                              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(constructor(v)(v1));
                          });
                      });
                  });
              };
          };
      };
  };
  var dialogue = function (dictMonad) {
      return talk(dictMonad)("[")("]")(Text_Ogmarkup_Private_Ast.Dialogue.create);
  };
  var thought = function (dictMonad) {
      return talk(dictMonad)("<")(">")(Text_Ogmarkup_Private_Ast.Thought.create);
  };
  var restOfParagraph = function (dictMonad) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.lookAhead(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(dictMonad))))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators.notFollowedBy(Control_Monad_State_Trans.monadStateT(dictMonad))(endOfParagraph(dictMonad)))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Data_Array.fromFoldable(Data_List_1.foldableList))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(dictMonad))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(dictMonad)))(Data_Function.apply(Text_Parsing_Parser_Combinators.lookAhead(Control_Monad_State_Trans.monadStateT(dictMonad)))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(endOfParagraph(dictMonad))))))(function (v) {
                  return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(dictMonad))))(Data_String.fromCharArray(v));
              });
          });
      });
  };
  var illformed = function (dictMonad) {
      return Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())))(Text_Ogmarkup_Private_Ast.IllFormed.create)(restOfParagraph(dictMonad));
  };
  var component = Data_Function.apply(later$prime)(Data_Function.apply(liftParser(Control_Monad_Aff.monadAff))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity)))(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(Data_Identity.functorIdentity))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity)))(dialogue(Data_Identity.monadIdentity))(thought(Data_Identity.monadIdentity)))(teller(Data_Identity.monadIdentity))))(illformed(Data_Identity.monadIdentity))));
  var paragraph = Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(some(Control_Monad_Aff.monadAff)(component))(blank(Control_Monad_Aff.monadAff));
  var story = Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(Control_Monad_Aff.functorAff)))(Text_Ogmarkup_Private_Ast.Story.create)(some(Control_Monad_Aff.monadAff)(Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(paragraph)(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))));
  var aside = (function () {
      var letterChar = Text_Parsing_Parser_String.satisfy(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))(function (c) {
          return c >= "a" && c <= "z" || c >= "A" && c <= "Z";
      });
      var asideClass = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(some$prime(Control_Monad_Aff.monadAff)(letterChar))(function (v) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(asideSeparator(Control_Monad_Aff.monadAff))(function () {
              return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(v);
          });
      });
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(asideSeparator(Control_Monad_Aff.monadAff))(function () {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_Combinators.optionMaybe(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))(asideClass))(function (v) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(function () {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(some(Control_Monad_Aff.monadAff)(Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(paragraph)(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))))(function (v1) {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(asideSeparator(Control_Monad_Aff.monadAff))(function () {
                          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_Combinators.manyTill(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(skip(Control_Monad_Aff.monadAff)(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))("\n")))(Text_Parsing_Parser_String.eof(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))))(function () {
                              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(function () {
                                  return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))))(new Text_Ogmarkup_Private_Ast.Aside(v, v1));
                              });
                          });
                      });
                  });
              });
          });
      });
  })();
  var section = Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(aside)(story);
  var document = (function () {
      var recover = function (ast) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Control_Monad_State_Trans.functorStateT(Control_Monad_Aff.functorAff)))(Data_Array.fromFoldable(Data_List_1.foldableList))(Text_Parsing_Parser_Combinators.many1Till(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))(Text_Parsing_Parser_String.anyChar(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_String["char"](Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))("\n"))))(function (v) {
              return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff))))(Data_Semigroup.append(Data_List_1.semigroupList)(ast)(new Data_List_1.Cons(Data_Function.apply(Text_Ogmarkup_Private_Ast.Failing.create)(Data_String.fromCharArray(v)), Data_List_1.Nil.value)));
          });
      };
      var doc = function (ast) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_String.skipSpaces(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(function () {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(many(Control_Monad_Aff.monadAff)(Text_Parsing_Parser_Combinators["try"](Control_Monad_State_Trans.functorStateT(Control_Monad_Aff.functorAff))(section)))(function (v) {
                  var ast$prime = Data_Semigroup.append(Data_List_1.semigroupList)(ast)(v);
                  return Control_Alt.alt(Text_Parsing_Parser.altParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Text_Parsing_Parser_String.eof(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(ast$prime)))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Control_Monad_State_Trans.monadStateT(Control_Monad_Aff.monadAff)))(recover(ast$prime))(doc));
              });
          });
      };
      return doc(Data_List_1.Nil.value);
  })();
  exports["aside"] = aside;
  exports["asideSeparator"] = asideSeparator;
  exports["atom"] = atom;
  exports["blank"] = blank;
  exports["characterName"] = characterName;
  exports["closeQuote"] = closeQuote;
  exports["component"] = component;
  exports["count"] = count;
  exports["dialogue"] = dialogue;
  exports["document"] = document;
  exports["endOfParagraph"] = endOfParagraph;
  exports["enterEmph"] = enterEmph;
  exports["enterQuote"] = enterQuote;
  exports["enterStrongEmph"] = enterStrongEmph;
  exports["format"] = format;
  exports["illformed"] = illformed;
  exports["initParserState"] = initParserState;
  exports["leaveEmph"] = leaveEmph;
  exports["leaveQuote"] = leaveQuote;
  exports["leaveStrongEmph"] = leaveStrongEmph;
  exports["liftParser"] = liftParser;
  exports["longword"] = longword;
  exports["many"] = many;
  exports["mark"] = mark;
  exports["openQuote"] = openQuote;
  exports["paragraph"] = paragraph;
  exports["parse"] = parse;
  exports["raw"] = raw;
  exports["reply"] = reply;
  exports["restOfParagraph"] = restOfParagraph;
  exports["section"] = section;
  exports["sget"] = sget;
  exports["skip"] = skip;
  exports["some"] = some;
  exports["sput"] = sput;
  exports["story"] = story;
  exports["talk"] = talk;
  exports["teller"] = teller;
  exports["thought"] = thought;
  exports["whiteSpace"] = whiteSpace;
  exports["word"] = word;
})(PS["Text.Ogmarkup.Private.Parser"] = PS["Text.Ogmarkup.Private.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Text_Ogmarkup_Private_Config = PS["Text.Ogmarkup.Private.Config"];
  var Text_Ogmarkup_Private_Ast = PS["Text.Ogmarkup.Private.Ast"];
  var Text_Ogmarkup_Private_Generator = PS["Text.Ogmarkup.Private.Generator"];
  var Text_Ogmarkup_Private_Parser = PS["Text.Ogmarkup.Private.Parser"];
  var Text_Ogmarkup_Private_Typography = PS["Text.Ogmarkup.Private.Typography"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];        
  var ogmarkup = function (dictMonoid) {
      return function (input) {
          return function (conf) {
              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Text_Ogmarkup_Private_Parser.parse(Control_Monad_Aff.monadAff)(Text_Ogmarkup_Private_Parser.document)(input))(function (v) {
                  if (v instanceof Data_Either.Right) {
                      return Text_Ogmarkup_Private_Generator.runGenerator(dictMonoid)(Text_Ogmarkup_Private_Generator.document(dictMonoid)(v.value0))(conf);
                  };
                  if (v instanceof Data_Either.Left) {
                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(Data_Monoid.mempty(dictMonoid));
                  };
                  throw new Error("Failed pattern match at Text.Ogmarkup line 48, column 3 - line 49, column 34: " + [ v.constructor.name ]);
              });
          };
      };
  };
  exports["ogmarkup"] = ogmarkup;
})(PS["Text.Ogmarkup"] = PS["Text.Ogmarkup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Data_Either = PS["Data.Either"];
  var Data_Int = PS["Data.Int"];
  var Data_Time_Duration = PS["Data.Time.Duration"];
  var Halogen = PS["Halogen"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var $$Math = PS["Math"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Bind = PS["Control.Bind"];
  var Halogen_Query = PS["Halogen.Query"];        
  var oneTimeEventSource = function (dictAffable) {
      return function (dictFunctor) {
          return function (v) {
              return function (action) {
                  return Data_Function.apply(Halogen_Query_EventSource.EventSource)(Halogen_Query_EventSource.produce(dictFunctor)(dictAffable)(function (emit) {
                      return Data_Function.apply(Data_Functor["void"](Control_Monad_Eff.functorEff))(Data_Function.apply(Control_Monad_Aff.runAff(Data_Function.apply(Data_Function["const"])(Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))(Data_Function.apply(Data_Function["const"])(Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit))))(Data_Function.apply(Control_Monad_Aff["later'"](Data_Function.apply(Data_Int.floor)($$Math.max(v)(0))))(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(function __do() {
                          Data_Function.apply(emit)(new Data_Either.Left(action))();
                          return Data_Function.apply(emit)(new Data_Either.Right(Data_Unit.unit))();
                      }))));
                  }));
              };
          };
      };
  };
  var sendAfter = function (dictAffable) {
      return function (dictFunctor) {
          return function (ms) {
              return function (action) {
                  return Data_Function.apply(Halogen_Query.subscribe)(oneTimeEventSource(dictAffable)(dictFunctor)(ms)(action));
              };
          };
      };
  };
  var raise = function (dictAffable) {
      return function (dictFunctor) {
          return sendAfter(dictAffable)(dictFunctor)(0.0);
      };
  };
  exports["oneTimeEventSource"] = oneTimeEventSource;
  exports["raise"] = raise;
  exports["sendAfter"] = sendAfter;
})(PS["Varuna.Component.Utils"] = PS["Varuna.Component.Utils"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Char = PS["Data.Char"];
  var Data_String = PS["Data.String"];
  var Data_Array = PS["Data.Array"];
  var Text_Ogmarkup = PS["Text.Ogmarkup"];
  var Text_Ogmarkup_Private_Config = PS["Text.Ogmarkup.Private.Config"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Indexed = PS["Halogen.HTML.Indexed"];
  var Halogen_HTML_Elements_Indexed = PS["Halogen.HTML.Elements.Indexed"];
  var Data_Eq = PS["Data.Eq"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Halogen_HTML = PS["Halogen.HTML"];
  var Text_Ogmarkup_Private_Typography = PS["Text.Ogmarkup.Private.Typography"];
  var Data_Function = PS["Data.Function"];        
  var Fr = (function () {
      function Fr() {

      };
      Fr.value = new Fr();
      return Fr;
  })();
  var En = (function () {
      function En() {

      };
      En.value = new En();
      return En;
  })();
  var thoughtT = function (v) {
      return function ($12) {
          return Data_Array.singleton(Halogen_HTML_Elements_Indexed.span([  ])($12));
      };
  };
  var tellT = function ($13) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.span([  ])($13));
  };
  var strongT = function ($14) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.strong([  ])($14));
  };
  var storyT = function ($15) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.div([  ])($15));
  };
  var replyT = function ($16) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.span([  ])($16));
  };
  var paraT = function ($17) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.p([  ])($17));
  };
  var nbsp = Data_Char.fromCharCode(160);
  var mkO = function ($18) {
      return Data_Array.singleton(Halogen_HTML.text($18));
  };
  var printHtmlSpace = function (v) {
      if (v instanceof Text_Ogmarkup_Private_Typography.None) {
          return mkO("");
      };
      if (v instanceof Text_Ogmarkup_Private_Typography.Nbsp) {
          return Data_Function.apply(mkO)(Data_String.singleton(nbsp));
      };
      if (v instanceof Text_Ogmarkup_Private_Typography.Normal) {
          return mkO(" ");
      };
      throw new Error("Failed pattern match at Varuna.Ogmarkup line 62, column 1 - line 63, column 1: " + [ v.constructor.name ]);
  };
  var fr = Text_Ogmarkup_Private_Typography.frenchTypo(mkO);
  var errorT = function ($19) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.span([  ])($19));
  };
  var eqLang = new Data_Eq.Eq(function (x) {
      return function (y) {
          if (x instanceof Fr && y instanceof Fr) {
              return true;
          };
          if (x instanceof En && y instanceof En) {
              return true;
          };
          return false;
      };
  });
  var en = Text_Ogmarkup_Private_Typography.englishTypo(mkO);
  var lang2typo = function (v) {
      if (v instanceof Fr) {
          return fr;
      };
      if (v instanceof En) {
          return en;
      };
      throw new Error("Failed pattern match at Varuna.Ogmarkup line 36, column 1 - line 36, column 18: " + [ v.constructor.name ]);
  };
  var emphT = function ($20) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.em([  ])($20));
  };
  var docT = function ($21) {
      return Data_Array.singleton(Halogen_HTML_Elements_Indexed.article([  ])($21));
  };
  var dialogueT = function (v) {
      return function ($22) {
          return Data_Array.singleton(Halogen_HTML_Elements_Indexed.span([  ])($22));
      };
  };
  var between = Data_Function.apply(Data_Array.singleton)(Halogen_HTML_Elements_Indexed.br([  ]));
  var author = function (v) {
      return "notMe";
  };
  var asideT = function (v) {
      return function ($23) {
          return Data_Array.singleton(Halogen_HTML_Elements_Indexed.blockquote([  ])($23));
      };
  };
  var conf = function (l) {
      var gc = {
          typography: lang2typo(l), 
          documentTemplate: docT, 
          errorTemplate: errorT, 
          storyTemplate: storyT, 
          asideTemplate: asideT, 
          paragraphTemplate: paraT, 
          tellerTemplate: tellT, 
          dialogueTemplate: dialogueT, 
          thoughtTemplate: thoughtT, 
          replyTemplate: replyT, 
          betweenDialogue: between, 
          emphTemplate: emphT, 
          strongEmphTemplate: strongT, 
          authorNormalize: author, 
          printSpace: printHtmlSpace
      };
      return new Text_Ogmarkup_Private_Config.GC(gc);
  };
  exports["Fr"] = Fr;
  exports["En"] = En;
  exports["asideT"] = asideT;
  exports["author"] = author;
  exports["between"] = between;
  exports["conf"] = conf;
  exports["dialogueT"] = dialogueT;
  exports["docT"] = docT;
  exports["emphT"] = emphT;
  exports["en"] = en;
  exports["errorT"] = errorT;
  exports["fr"] = fr;
  exports["lang2typo"] = lang2typo;
  exports["mkO"] = mkO;
  exports["nbsp"] = nbsp;
  exports["paraT"] = paraT;
  exports["printHtmlSpace"] = printHtmlSpace;
  exports["replyT"] = replyT;
  exports["storyT"] = storyT;
  exports["strongT"] = strongT;
  exports["tellT"] = tellT;
  exports["thoughtT"] = thoughtT;
  exports["eqLang"] = eqLang;
})(PS["Varuna.Ogmarkup"] = PS["Varuna.Ogmarkup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff_Console = PS["Control.Monad.Eff.Console"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Halogen = PS["Halogen"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Indexed = PS["Halogen.HTML.Events.Indexed"];
  var Halogen_HTML_Indexed = PS["Halogen.HTML.Indexed"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Halogen_Query = PS["Halogen.Query"];
  var Text_Ogmarkup = PS["Text.Ogmarkup"];
  var Varuna_Component_Utils = PS["Varuna.Component.Utils"];
  var Varuna_Ogmarkup = PS["Varuna.Ogmarkup"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Function = PS["Data.Function"];
  var Data_Monoid = PS["Data.Monoid"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Halogen_HTML_Elements_Indexed = PS["Halogen.HTML.Elements.Indexed"];
  var Data_Eq = PS["Data.Eq"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Halogen_HTML_Events = PS["Halogen.HTML.Events"];
  var Halogen_HTML = PS["Halogen.HTML"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Applicative = PS["Control.Applicative"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Data_Show = PS["Data.Show"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];        
  var Free = (function () {
      function Free() {

      };
      Free.value = new Free();
      return Free;
  })();
  var Busy = (function () {
      function Busy() {

      };
      Busy.value = new Busy();
      return Busy;
  })();
  var Pending = (function () {
      function Pending(value0) {
          this.value0 = value0;
      };
      Pending.create = function (value0) {
          return new Pending(value0);
      };
      return Pending;
  })();
  var AskPreview = (function () {
      function AskPreview(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      AskPreview.create = function (value0) {
          return function (value1) {
              return new AskPreview(value0, value1);
          };
      };
      return AskPreview;
  })();
  var CheckPreview = (function () {
      function CheckPreview(value0) {
          this.value0 = value0;
      };
      CheckPreview.create = function (value0) {
          return new CheckPreview(value0);
      };
      return CheckPreview;
  })();
  var RenderPreview = (function () {
      function RenderPreview(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      RenderPreview.create = function (value0) {
          return function (value1) {
              return new RenderPreview(value0, value1);
          };
      };
      return RenderPreview;
  })();
  var UpdatePreview = (function () {
      function UpdatePreview(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      UpdatePreview.create = function (value0) {
          return function (value1) {
              return new UpdatePreview(value0, value1);
          };
      };
      return UpdatePreview;
  })();
  var GetOgmarkup = (function () {
      function GetOgmarkup(value0) {
          this.value0 = value0;
      };
      GetOgmarkup.create = function (value0) {
          return new GetOgmarkup(value0);
      };
      return GetOgmarkup;
  })();
  var SetLang = (function () {
      function SetLang(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SetLang.create = function (value0) {
          return function (value1) {
              return new SetLang(value0, value1);
          };
      };
      return SetLang;
  })();
  var State = (function () {
      function State(value0) {
          this.value0 = value0;
      };
      State.create = function (value0) {
          return new State(value0);
      };
      return State;
  })();
  var showPS = function (v) {
      if (v instanceof Free) {
          return "Done.";
      };
      if (v instanceof Busy) {
          return "Rendering";
      };
      if (v instanceof Pending) {
          return "Rendering. Queue: " + v.value0;
      };
      throw new Error("Failed pattern match at Varuna.Component.Editor line 38, column 1 - line 39, column 1: " + [ v.constructor.name ]);
  };
  var setPreview = function (vdom) {
      return function (v) {
          return Data_Function.apply(State.create)((function () {
              var $16 = {};
              for (var $17 in v.value0) {
                  if (v.value0.hasOwnProperty($17)) {
                      $16[$17] = v.value0[$17];
                  };
              };
              $16.preview = vdom;
              return $16;
          })());
      };
  };
  var setOgmarkup = function (txt) {
      return function (v) {
          return Data_Function.apply(State.create)((function () {
              var $22 = {};
              for (var $23 in v.value0) {
                  if (v.value0.hasOwnProperty($23)) {
                      $22[$23] = v.value0[$23];
                  };
              };
              $22.ogmarkup = txt;
              return $22;
          })());
      };
  };
  var setLanguage = function (l) {
      return function (v) {
          return Data_Function.apply(State.create)((function () {
              var $28 = {};
              for (var $29 in v.value0) {
                  if (v.value0.hasOwnProperty($29)) {
                      $28[$29] = v.value0[$29];
                  };
              };
              $28.language = l;
              return $28;
          })());
      };
  };
  var renderOgmarkup = function (txt) {
      return function (l) {
          return Text_Ogmarkup.ogmarkup(Data_Monoid.monoidArray)(txt)(Varuna_Ogmarkup.conf(l));
      };
  };
  var render = function (v) {
      var renderFrench = function (l) {
          return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements_Indexed.input([ Data_Function.apply(Halogen_HTML_Properties_Indexed.checked)(Data_Eq.eq(Varuna_Ogmarkup.eqLang)(l)(Varuna_Ogmarkup.Fr.value)), Halogen_HTML_Properties_Indexed.inputType(Halogen_HTML_Properties_Indexed.InputRadio.value), Data_Function.apply(function ($78) {
              return Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_($78));
          })(SetLang.create(Varuna_Ogmarkup.Fr.value)) ]), Halogen_HTML.text("French") ]);
      };
      var renderEnglish = function (l) {
          return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements_Indexed.input([ Data_Function.apply(Halogen_HTML_Properties_Indexed.checked)(Data_Eq.eq(Varuna_Ogmarkup.eqLang)(l)(Varuna_Ogmarkup.En.value)), Halogen_HTML_Properties_Indexed.inputType(Halogen_HTML_Properties_Indexed.InputRadio.value), Data_Function.apply(function ($79) {
              return Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_($79));
          })(SetLang.create(Varuna_Ogmarkup.En.value)) ]), Halogen_HTML.text("English") ]);
      };
      return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements_Indexed.textarea([ Halogen_HTML_Events_Indexed.onValueInput(Halogen_HTML_Events.input(AskPreview.create)) ]), Data_Function.apply(Halogen_HTML.text)(showPS(v.value0.queue)), Halogen_HTML_Elements_Indexed.form([  ])([ renderFrench(v.value0.language), renderEnglish(v.value0.language) ]), Data_Function.apply(Halogen_HTML_Elements.div_)(v.value0.preview) ]);
  };
  var initState = new State({
      ogmarkup: "", 
      language: Varuna_Ogmarkup.En.value, 
      preview: [  ], 
      queue: Free.value
  });
  var $$eval = function (v) {
      if (v instanceof SetLang) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Halogen_Query.modify)(setLanguage(v.value0)))(function () {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.get)(function (v1) {
                  return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(function ($80) {
                      return Varuna_Component_Utils.raise(Control_Monad_Aff_Free.affableAff)(Control_Monad_Aff.functorAff)(Halogen_Query.action($80));
                  })(RenderPreview.create(v1.value0.ogmarkup)))(function () {
                      return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
                  });
              });
          });
      };
      if (v instanceof GetOgmarkup) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.get)(function (v1) {
              return Data_Function.apply(Control_Applicative.pure(Control_Monad_Free.freeApplicative))(v.value0(v1.value0.ogmarkup));
          });
      };
      if (v instanceof AskPreview) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Halogen_Query.modify)(setOgmarkup(v.value0)))(function () {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.get)(function (v1) {
                  return Control_Bind.bind(Control_Monad_Free.freeBind)((function () {
                      if (v1.value0.queue instanceof Free) {
                          return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Halogen_Query.set)(new State((function () {
                              var $44 = {};
                              for (var $45 in v1.value0) {
                                  if (v1.value0.hasOwnProperty($45)) {
                                      $44[$45] = v1.value0[$45];
                                  };
                              };
                              $44.queue = Busy.value;
                              return $44;
                          })())))(function () {
                              return Data_Function.apply(function ($81) {
                                  return Varuna_Component_Utils.raise(Control_Monad_Aff_Free.affableAff)(Control_Monad_Aff.functorAff)(Halogen_Query.action($81));
                              })(RenderPreview.create(v.value0));
                          });
                      };
                      if (v1.value0.queue instanceof Busy) {
                          return Data_Function.apply(Halogen_Query.set)(new State((function () {
                              var $47 = {};
                              for (var $48 in v1.value0) {
                                  if (v1.value0.hasOwnProperty($48)) {
                                      $47[$48] = v1.value0[$48];
                                  };
                              };
                              $47.queue = new Pending(v.value0);
                              return $47;
                          })()));
                      };
                      if (v1.value0.queue instanceof Pending) {
                          return Data_Function.apply(Halogen_Query.set)(new State((function () {
                              var $50 = {};
                              for (var $51 in v1.value0) {
                                  if (v1.value0.hasOwnProperty($51)) {
                                      $50[$51] = v1.value0[$51];
                                  };
                              };
                              $50.queue = new Pending(v.value0);
                              return $50;
                          })()));
                      };
                      throw new Error("Failed pattern match at Varuna.Component.Editor line 119, column 3 - line 122, column 71: " + [ v1.value0.queue.constructor.name ]);
                  })())(function () {
                      return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
                  });
              });
          });
      };
      if (v instanceof CheckPreview) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.get)(function (v1) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)((function () {
                  if (v1.value0.queue instanceof Pending) {
                      return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Halogen_Query.set)(new State((function () {
                          var $59 = {};
                          for (var $60 in v1.value0) {
                              if (v1.value0.hasOwnProperty($60)) {
                                  $59[$60] = v1.value0[$60];
                              };
                          };
                          $59.queue = Busy.value;
                          return $59;
                      })())))(function () {
                          return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff))))(Control_Monad_Eff_Console.log("pending preview has been found")))(function () {
                              return Data_Function.apply(function ($82) {
                                  return Varuna_Component_Utils.raise(Control_Monad_Aff_Free.affableAff)(Control_Monad_Aff.functorAff)(Halogen_Query.action($82));
                              })(RenderPreview.create(v1.value0.queue.value0));
                          });
                      });
                  };
                  return Data_Function.apply(Halogen_Query.set)(new State((function () {
                      var $63 = {};
                      for (var $64 in v1.value0) {
                          if (v1.value0.hasOwnProperty($64)) {
                              $63[$64] = v1.value0[$64];
                          };
                      };
                      $63.queue = Free.value;
                      return $63;
                  })()));
              })())(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value0);
              });
          });
      };
      if (v instanceof RenderPreview) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.get)(function (v1) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff))))(Control_Monad_Eff_Console.log("star render preview")))(function () {
                  return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(function ($83) {
                      return Control_Monad_Aff_Free.fromAff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff)))(Control_Monad_Aff.attempt($83));
                  })(renderOgmarkup(v1.value0.ogmarkup)(v1.value0.language)))(function (v2) {
                      return Control_Bind.bind(Control_Monad_Free.freeBind)((function () {
                          if (v2 instanceof Data_Either.Right) {
                              return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff))))(Control_Monad_Eff_Console.log("end render preview")))(function () {
                                  return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Varuna_Component_Utils.raise(Control_Monad_Aff_Free.affableAff)(Control_Monad_Aff.functorAff))(Halogen_Query.action(UpdatePreview.create(v2.value0))))(function () {
                                      return Data_Function.apply(Halogen_Query.modify)(setPreview(v2.value0));
                                  });
                              });
                          };
                          if (v2 instanceof Data_Either.Left) {
                              return Data_Function.apply(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff))))(Control_Monad_Eff_Console.log(Data_Show.show(Control_Monad_Eff_Exception.showError)(v2.value0)));
                          };
                          throw new Error("Failed pattern match at Varuna.Component.Editor line 135, column 3 - line 138, column 50: " + [ v2.constructor.name ]);
                      })())(function () {
                          return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
                      });
                  });
              });
          });
      };
      if (v instanceof UpdatePreview) {
          return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Halogen_Query.modify)(setPreview(v.value0)))(function () {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Data_Function.apply(Varuna_Component_Utils.raise(Control_Monad_Aff_Free.affableAff)(Control_Monad_Aff.functorAff))(Halogen_Query.action(CheckPreview.create)))(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
              });
          });
      };
      throw new Error("Failed pattern match at Varuna.Component.Editor line 108, column 1 - line 112, column 12: " + [ v.constructor.name ]);
  };
  var editor = Halogen_Component.lifecycleComponent({
      render: render, 
      "eval": $$eval, 
      initializer: Data_Maybe.Nothing.value, 
      finalizer: Data_Maybe.Nothing.value
  });
  exports["Free"] = Free;
  exports["Busy"] = Busy;
  exports["Pending"] = Pending;
  exports["AskPreview"] = AskPreview;
  exports["CheckPreview"] = CheckPreview;
  exports["RenderPreview"] = RenderPreview;
  exports["UpdatePreview"] = UpdatePreview;
  exports["GetOgmarkup"] = GetOgmarkup;
  exports["SetLang"] = SetLang;
  exports["State"] = State;
  exports["editor"] = editor;
  exports["initState"] = initState;
  exports["render"] = render;
  exports["renderOgmarkup"] = renderOgmarkup;
  exports["setLanguage"] = setLanguage;
  exports["setOgmarkup"] = setOgmarkup;
  exports["setPreview"] = setPreview;
  exports["showPS"] = showPS;
})(PS["Varuna.Component.Editor"] = PS["Varuna.Component.Editor"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Halogen = PS["Halogen"];
  var Halogen_Util = PS["Halogen.Util"];
  var Varuna_Component_Editor = PS["Varuna.Component.Editor"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Data_Functor = PS["Data.Functor"];
  var Halogen_Driver = PS["Halogen.Driver"];        
  var main = Data_Function.apply(Halogen_Util.runHalogenAff)(Control_Bind.bind(Control_Monad_Aff.bindAff)(Halogen_Util.awaitBody)(function (v) {
      return Data_Function.apply(Data_Functor["void"](Control_Monad_Aff.functorAff))(Halogen_Driver.runUI(Varuna_Component_Editor.editor)(Varuna_Component_Editor.initState)(v));
  }));
  exports["main"] = main;
})(PS["Main"] = PS["Main"] || {});
PS["Main"].main();

},{"virtual-dom/create-element":4,"virtual-dom/diff":5,"virtual-dom/patch":6,"virtual-dom/virtual-hyperscript/hooks/soft-set-hook":13,"virtual-dom/vnode/vnode":21,"virtual-dom/vnode/vtext":23}]},{},[27]);
