var WebiumBridgeLib = {

  // ── IJSRuntime interop ──────────────────────────────────────────────

  WebiumJS_Evaluate: function (scriptPtr) {
    var script = UTF8ToString(scriptPtr);
    try {
      var result = eval(script);
      var str = result !== undefined && result !== null ? String(result) : "";
      var bufferSize = lengthBytesUTF8(str) + 1;
      var buffer = _malloc(bufferSize);
      stringToUTF8(str, buffer, bufferSize);
      return buffer;
    } catch (e) {
      console.error("[Webium] Evaluate error:", e);
      return 0;
    }
  },

  WebiumJS_CallFunction: function (namePtr, argsJsonPtr) {
    var name = UTF8ToString(namePtr);
    var argsJson = UTF8ToString(argsJsonPtr);
    try {
      var fn = window[name];
      if (typeof fn !== "function") {
        console.warn("[Webium] Function not found:", name);
        return 0;
      }
      var args = JSON.parse(argsJson);
      var result = fn.apply(null, args);
      var str = result !== undefined && result !== null ? String(result) : "";
      var bufferSize = lengthBytesUTF8(str) + 1;
      var buffer = _malloc(bufferSize);
      stringToUTF8(str, buffer, bufferSize);
      return buffer;
    } catch (e) {
      console.error("[Webium] CallFunction error:", e);
      return 0;
    }
  },

  WebiumJS_RegisterBinding: function (namePtr) {
    var name = UTF8ToString(namePtr);
    try {
      // Store the binding name so browser JS can call back into C# via SendMessage.
      if (!window.__webium_bindings) {
        window.__webium_bindings = {};
      }
      window.__webium_bindings[name] = true;
    } catch (e) {
      console.error("[Webium] RegisterBinding error:", e);
    }
  },

  // ── IJSBridge interop ───────────────────────────────────────────────

  WebiumBridge_PostToJS: function (messageTypePtr, payloadJsonPtr) {
    var messageType = UTF8ToString(messageTypePtr);
    var payloadJson = UTF8ToString(payloadJsonPtr);
    try {
      if (!window.__webium_outbound) {
        window.__webium_outbound = [];
      }
      window.__webium_outbound.push({
        type: messageType,
        payload: payloadJson
      });
    } catch (e) {
      console.error("[Webium] PostToJS error:", e);
    }
  },

  WebiumBridge_Flush: function () {
    try {
      if (!window.__webium_outbound || window.__webium_outbound.length === 0) {
        return;
      }
      // Process queued messages — consumers register via window.__webium_onFlush
      if (typeof window.__webium_onFlush === "function") {
        window.__webium_onFlush(window.__webium_outbound);
      }
      window.__webium_outbound = [];
    } catch (e) {
      console.error("[Webium] Flush error:", e);
    }
  }
};

autoAddDeps(WebiumBridgeLib, "$WebiumBridgeLib");
mergeInto(LibraryManager.library, WebiumBridgeLib);
