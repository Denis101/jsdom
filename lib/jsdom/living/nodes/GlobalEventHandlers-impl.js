"use strict";

const vm = require("vm");

const idlUtils = require("../generated/utils");

const ErrorEvent = require("../generated/ErrorEvent");

const events = new Set(["abort", "autocomplete",
"autocompleteerror", "blur",
"cancel", "canplay", "canplaythrough",
"change", "click",
"close", "contextmenu",
"cuechange", "dblclick",
"drag", "dragend",
"dragenter", "dragexit",
"dragleave", "dragover",
"dragstart", "drop",
"durationchange", "emptied",
"ended", "focus",
"input", "invalid",
"keydown", "keypress",
"keyup", "load", "loadeddata",
"loadedmetadata", "loadstart",
"mousedown", "mouseenter",
"mouseleave", "mousemove",
"mouseout", "mouseover",
"mouseup", "wheel",
"pause", "play",
"playing", "progress",
"ratechange", "reset",
"resize", "scroll",
"seeked", "seeking",
"select", "show",
"sort", "stalled",
"submit", "suspend",
"timeupdate", "toggle",
"volumechange", "waiting"]);

function appendHandler(el, eventName) {
  el.addEventListener(eventName, event => {
    event = idlUtils.implForWrapper(event);

    const callback = el["on" + eventName];
    if (!callback) {
      return;
    }

    let returnValue = null;
    if (ErrorEvent.isImpl(event)/* && callback is OnErrorEventHandler*/) {

    } else {
      returnValue = callback.call(event.currentTarget, event);
    }

    if (eventName === "mouseover" || (eventName === "error" && ErrorEvent.isImpl(event))) {
      if (returnValue) {
        event._canceledFlag = true;
      }
    // TODO: before unload
    } else if (!returnValue) {
      event._canceledFlag = true;
    }
  }, false);
}

function createEventMethod(obj, event) {
  Object.defineProperty(obj, "on" + event, {
    get() {
      const value = this._eventHandlers[event];
      if (value.body !== undefined) {
        let element;
        let formOwner = null;
        let document;
        let window;
        if (this.constructor.name === "Window") { // still not great at detecting this
          element = null;
          window = this;
          document = this.document;
        } else {
          element = this;
          document = element.ownerDocument;
          window = document.defaultView;
        }
        const body = value.body;
        // TODO: location
        if (element !== null) {
          formOwner = element.form || null;
        }

        try {
          // eslint-disable-next-line no-new-func
          Function(body); // properly error out on syntax errors
        } catch (e) {
          // TODO: Report the error
          return null;
        }

        let fn;
        const Constructor = vm.isContext(window) ? window.Function : Function;
        if (event === "error" && element === null) {
          // eslint-disable-next-line no-new-func
          fn = new Constructor(`return function onerror(event, source, lineno, colno, error) {
  ${body}
};`)(document);
        } else {
          const argNames = [];
          const args = [];
          if (element !== null) {
            argNames.push("document");
            args.push(document);
          }
          if (formOwner !== null) {
            argNames.push("formOwner");
            args.push(formOwner);
          }
          if (element !== null) {
            argNames.push("element");
            args.push(element);
          }
          let wrapperBody = `
return function on${event}(event) {
  ${body}
};`;
          for (let i = argNames.length - 1; i >= 0; --i) {
            wrapperBody = `with (${argNames[i]}) { ${wrapperBody} }`;
          }
          argNames.push(wrapperBody);
          fn = Constructor.apply(null, argNames).apply(null, args);
        }
        this._eventHandlers[event] = fn;
      }
      return this._eventHandlers[event];
    },
    set(val) {
      if (!(val instanceof Function)) {
        return;
      }

      if (!this._eventHandlers[event]) {
        appendHandler(this, event);
      }
      this._eventHandlers[event] = val;
    }
  });
}


class GlobalEventHandlersImpl {
  _initGlobalEvents() {
    this._eventHandlers = Object.create(null);
  }

  _eventChanged(event) {
    const propName = "on" + event;
    const val = this.getAttribute(propName);

    if (!this._eventHandlers[event]) {
      appendHandler(this, event);
    }

    this._eventHandlers[event] = {
      body: val
    };
  }
}

for (const event of events) {
  createEventMethod(GlobalEventHandlersImpl.prototype, event);
}

module.exports = {
  implementation: GlobalEventHandlersImpl
};
