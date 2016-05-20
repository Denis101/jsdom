"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");

const mapper = require("../../utils").mapper;
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const createHTMLCollection = require("../../living/html-collection").create;
const notImplemented = require("../../browser/not-implemented");
const resourceLoader = require("../../browser/resource-loader");

// http://www.whatwg.org/specs/web-apps/current-work/#category-listed
const listedElements = /button|fieldset|input|keygen|object|select|textarea/i;

// https://html.spec.whatwg.org/#category-submit
const submittableElements = /button|input|keygen|object|select|textarea/i;

const encTypes = new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain"
]);

const methods = new Set([
  "get",
  "post",
  "dialog"
]);

class HTMLFormElementImpl extends HTMLElementImpl {
  _descendantAdded(parent, child) {
    const form = this;
    for (const el of domSymbolTree.treeIterator(child)) {
      if (typeof el._changedFormOwner === "function") {
        el._changedFormOwner(form);
      }
    }

    super._descendantAdded.apply(this, arguments);
  }

  _descendantRemoved(parent, child) {
    for (const el of domSymbolTree.treeIterator(child)) {
      if (typeof el._changedFormOwner === "function") {
        el._changedFormOwner(null);
      }
    }

    super._descendantRemoved.apply(this, arguments);
  }

  get elements() {
    return createHTMLCollection(this._ownerDocument, mapper(this, e => {
      return listedElements.test(e.nodeName); // TODO exclude <input type="image">
    }));
  }

  get length() {
    return this.elements.length;
  }

  _dispatchSubmitEvent() {
    const ev = this._ownerDocument.createEvent("HTMLEvents");
    ev.initEvent("submit", true, true);
    if (!this.dispatchEvent(ev)) {
      this.submit();
    }
  }

  submit() {
    notImplemented("HTMLFormElement.prototype.submit", this._ownerDocument._defaultView);
  }

  reset() {
    Array.prototype.forEach.call(this.elements, el => {
      el = idlUtils.implForWrapper(el);
      if (typeof el._formReset === "function") {
        el._formReset();
      }
    });
  }

  _staticValidate() {
    let controls = Array.prototype.filter.call(this.elements, el => {
      return submittableElements.test(el.nodeName);
    });

    let invalidControls = [];

    Array.prototype.forEach.call(controls, c => {
      if (c.checkValidity()) {
        return;
      }

      invalidControls.push(c);
    });

    if (invalidControls.length < 1) {
      return {
        valid: true
      };
    }

    let unhandledInvalidControls = [];

    Array.prototype.forEach.call(invalidControls, c => {
      let event = Event.createImpl(["invalid"], { bubbles: false, cancelable: true }], {});
      let outcome = c.dispatchEvent(event);

      // if not cancelled
      unhandledInvalidControls.push(c);
    });

    return {
      valid: false,
      unhandledInvalidControls
    };
  }

  _interactiveValidate() {
    let result = this._staticValidate();

    if (result.valid) {
      return result;
    }


  }

  checkValidity() {
    return this._staticValidate();
  }

  reportValidity() {
    return this._interactiveValidate();
  }

  get method() {
    let method = this.getAttribute("method");
    if (method) {
      method = method.toLowerCase();
    }

    if (methods.has(method)) {
      return method;
    }
    return "get";
  }

  set method(V) {
    this.setAttribute("method", V);
  }

  get enctype() {
    let type = this.getAttribute("enctype");
    if (type) {
      type = type.toLowerCase();
    }

    if (encTypes.has(type)) {
      return type;
    }
    return "application/x-www-form-urlencoded";
  }

  set enctype(V) {
    this.setAttribute("enctype", V);
  }

  get action() {
    const attributeValue = this.getAttribute("action");
    if (attributeValue === null || attributeValue === "") {
      return this._ownerDocument.URL;
    }

    return resourceLoader.resolveResourceUrl(this._ownerDocument, attributeValue);
  }

  set action(V) {
    this.setAttribute("action", V);
  }
}

module.exports = {
  implementation: HTMLFormElementImpl
};
