function ppSpoofFlash()
{
	try {
		if(navigator.plugins["Shockwave Flash"])
			return;
		var p = { description: "Shockwave Flash 33.0 r0" };
		navigator.plugins["Shockwave Flash"] = p;
		var idx = navigator.plugins.length;
		var len = idx + 1;
		var props = { length: {value: len, configurable: false, enumerable: true, writable: false}};
		props[idx] = { value: p, configurable: false, enumerable: true, writable: false };
		Object.defineProperties(PluginArray.prototype, props);
		navigator.mimeTypes["application/x-shockwave-flash"] = { enabledPlugin: p };
	} catch(e) {
		console.log("Flash spoofing failed");
		console.log(e);
	}
}
ppSpoofFlash();
function assert(cond)
{
	if(!cond)
		debugger
}
var ppLocationHref = location.href;
var ppCheerpXAppOpts = {};
var ppJavaScriptCallMode = "verbose";
var ppReadyCallback = null;
var ppObjectsMap = [window];
var ppIeCompat = false;
var ppDisableAudio = false;
function cheerpjGetStackEntry(s)
{
	var frames=s.split("  at ");
	if(frames.length == 1)
	{
		// It was not chrome probably, try again
		frames=s.split("@");
	}
	var firstFrame=frames[1];
	var path=firstFrame.split('.js:')[0]+".js";
	return path;
}
function cheerpxCmgCallback() {
	console.log("cheerpx ready callback function, cheerpxCmgCallback,  invoked");
}
function cjGetCurrentScript()
{
	try
	{
		throw new Error();
	}
	catch(e)
	{
		var stack = e.stack;
	}
	var part=cheerpjGetStackEntry(stack);
	var loaderStart = part.indexOf("http://");
	if(loaderStart == -1)
		loaderStart = part.indexOf("https://");
	if(loaderStart == -1)
		loaderStart = part.indexOf("chrome-extension://");
	var loaderEnd = part.indexOf(".js");
	assert(loaderStart >= 0 && loaderEnd > 0);
	return part.substring(loaderStart, loaderEnd+3);
}

function ppGetObjectOrEmbedParams(elem)
{
	var params = null;
	if(elem.getAttribute("data-cheerpx") != null)
		return null;
	if(elem.tagName == "OBJECT")
	{
		// Old non-flash activex plugins may use the object tag, and are identifiable
		// via the classid attribute. If we see one, and it is not the one for flash, skip
		var classid = elem.getAttribute("classid");
		if(classid && classid != "clsid:d27cdb6e-ae6d-11cf-96b8-444553540000")
			return null;
		// Newer non-flash plugins are identified by the type attribute.
		// If we see it, and it is not the flash one, skip
		var type = elem.getAttribute("type");
		if(type && type != "application/x-shockwave-flash")
			return null;
		var swfFile = elem.getAttribute("data");
		params = {src: swfFile};
		for(var i=0;i<elem.children.length;i++)
		{
			var c = elem.children[i];
			if(c.nodeName.toLowerCase() != "param")
				continue;
			var name = c.getAttribute("name");
			var value = c.getAttribute("value");
			if(name == null || value == null)
				continue;
			params[name] = value;
		}
	}
	else if(elem.tagName == "EMBED")
	{
		// Some non-flash plugins use the embed thag. They are identified by the type attribute.
		// If we see it, and it is not the flash one, skip
		var type = elem.getAttribute("type");
		if(type && type != "application/x-shockwave-flash")
			return null;
		params = {};
		var attrs = elem.attributes;
		for(var i=0;i<attrs.length;i++)
		{
			var a = attrs[i];
			params[a.name] = a.value;
		}
	}
	return params;
}
function ppAllocateObjectId(o)
{
	// Blindly allocate a new id, I don't think uniquess a requirement
	var id = ppObjectsMap.indexOf(null);
	if(id < 0)
	{
		id = ppObjectsMap.length;
		ppObjectsMap.push(o);
	}
	else
	{
		ppObjectsMap[id] = o;
	}
	return {id: id};
}
function ppMapValue(v)
{
	if(typeof(v) == "object" && v != null)
	{
		return ppAllocateObjectId(v);
	}
	return v;
}
function ppMapValues(vs)
{
	for(var i = 0; i < vs.length; i++)
	{
		vs[i] = ppMapValue(vs[i]);
	}
	return vs;
}
function ppUnmapValue(v)
{
	if(typeof(v) == "object" && v != null)
	{
		v = ppObjectsMap[v.id];
	}
	return v;
}
function ppUnmapValues(vs)
{
	for(var i = 0; i < vs.length; i++)
	{
		vs[i] = ppUnmapValue(vs[i]);
	}
	return vs;
}

function ppHandleMessage(e)
{
console.log("cmg cheerpx v31: ppHandleMessage ="+e.data.t);
	if(e.data.t == "init")
	{
		if(this.ppParams.src == null)
			return;
		// The iframe is ready, send over the parameter from the replaced object
		this.postMessage({t:"params", href: ppLocationHref, disableAudio: ppDisableAudio, params:this.ppParams});
		this.ppReadyForCalls = true;
	}
	else if(e.data.t == "openurl")
	{
		let init = {
			method: e.data.method==0 ? "GET" : "POST",
			body: e.data.data,
		};
		let headers = new Headers();
		if(e.data.headers)
		{
			for(let h of e.data.headers.split("\n"))
			{
				var lSplit = h.indexOf(': ');
				if(lSplit < 0)
					continue;
				var k = h.substr(0, lSplit);
				var v = h.substr(lSplit+2);
				headers.append(k, v);
			}
		}
		let handleOpenError = (err) => {
			this.postMessage({
				t:"openurlfailed",
				entryId: e.data.entryId,
				callbackId: e.data.callbackId,
			});
		};
		let handleReceiveError = (err) => {
			this.postMessage({
				t:"openurlreceivefailed",
				entryId: e.data.entryId,
			});
		};
		var url = e.data.url;
		init.headers = headers;
		fetch(url, init).then((resp) =>
		{
			let headers = new Map(resp.headers);
			this.postMessage({
				t:"openurlstarted",
				entryId: e.data.entryId,
				callbackId: e.data.callbackId,
				responseURL: resp.url,
				status: resp.status,
				responseHeaders: headers,
				redirected: resp.redirected,
			});
			let reader = resp.body.getReader();
			let readChunk = ({done, value}) =>
			{
				if(done)
				{
					this.postMessage({
						t:"openurldone",
						entryId: e.data.entryId,
						callbackId: e.data.callbackId,
						progressId: e.data.progressId,
					});
					console.log("cmg cheerpx v31: ppHandleMessage =opeurldone "+new Date());
					var cmgparent = "https://your.domain.here";
					
					setTimeout(function (){ 
					  if(window != top) {
					    window.parent.postMessage("CheerpxGameLoaded", cmgparent); 
					    console.log("cmg cheerpx v31: ppHandleMessage after opeurldone postMessage to parent "+new Date());
					  }
					}, 1000);
					return;
				}
				this.postMessage({
					t:"openurlreceive",
					entryId: e.data.entryId,
					callbackId: e.data.callbackId,
					progressId: e.data.progressId,
					data: value,
				});
				reader.read().then(readChunk).catch(handleReceiveError);
			};
			reader.read().then(readChunk).catch(handleReceiveError);
		})
		.catch(handleOpenError);
	}
	else if(e.data.t == "executesync")
	{
		var r = self.eval(e.data.script);
		this.postMessage({t:"executeret", ret: r});
	}
	else if(e.data.t == "getpropertysync")
	{
		var r = null;
		var o = ppObjectsMap[e.data.obj];
		try
		{
			r = o[e.data.name];
		}
		catch(e)
		{
			r = undefined;
		}
		this.postMessage({t:"executeret", ret: ppMapValue(r)});
	}
	else if(e.data.t == "callsync")
	{
		var o = ppObjectsMap[e.data.obj];
		var r = undefined;
		try
		{
			r = o[e.data.name].apply(o, ppUnmapValues(e.data.args));
		}
		catch(e)
		{
		}
		this.postMessage({t:"executeret", ret: ppMapValue(r)});
	}
	else if(e.data.t == "freeobjid")
	{
		ppObjectsMap[e.data.obj] = null;
	}
	else if(e.data.t == "open")
	{
		window.open(e.data.url, e.data.target);
	}
	else if(e.data.t == "openpost")
	{
		var f = document.createElement("form");
		var params = e.data.params.split("&");
		for(var i = 0; i < params.length; i++)
		{
			var p = params[i].split("=");
			var input = document.createElement("textarea");
			input.name = decodeURIComponent(p[0]);
			input.value = decodeURIComponent(p[1]);
			f.appendChild(input);
		}
		f.action = e.data.url;
		f.target = e.data.target;
		f.method = "POST";
		document.body.appendChild(f);
		f.submit();
		f.remove();
	}
	else if(e.data.t == "scriptingready")
	{
		console.log("cmg cheerpx v31: scriptingready event handling");
		if(typeof cheerpxCmgCallback == "function"){
			console.log("cheerpx: cusatom call cheerpxCmgCallback");
			cheerpxCmgCallback();
		} else { console.log("cheerpx: scriptingready callback not available ");}
		if(typeof ppReadyCallback == "function")
			ppReadyCallback();
	}
	else if(e.data.t == "hasmethoddone")
	{
		var p = this.ppPendingPromises[e.data.id];
		this.ppPendingPromises[e.data.id] = null;
		p(e.data.ret);
	}
	else if(e.data.t == "callmethoddone")
	{
		var p = this.ppPendingPromises[e.data.id];
		this.ppPendingPromises[e.data.id] = null;
		p(e.data.ret);
	}
	else if(e.data.t == "synccallport")
	{
		if(ppJavaScriptCallMode == "sync")
		{
			this.ppSyncHelperPort.postMessage(e.data, [e.data.port]);
			this.ppSyncHelperReady = true;
		}
		else
		{
			e.data.port.onmessage = function()
			{
				debugger;
			}
		}
	}
	else
	{
		debugger;
	}
}

function ppGetPromiseId(pendingPromises, r)
{
	var id = pendingPromises.indexOf(null);
	if(id < 0)
	{
		id = pendingPromises.length;
		pendingPromises.push(r);
	}
	else
	{
		pendingPromises[id] = r;
	}
	return id;
}

function ppHasMethod(port, methodName)
{
	return new Promise(function(r, f)
	{
		var id = ppGetPromiseId(port.ppPendingPromises, r);
		port.postMessage({t:"hasmethod", methodName: methodName, entryId: id});
	});
}

function ppCallMethod(port, methodName, args)
{
	return new Promise(function(r, f)
	{
		var id = ppGetPromiseId(port.ppPendingPromises, r);
		port.postMessage({t:"callmethod", methodName: methodName, args: ppMapValues(args), entryId: id});
	});
}

function rewriteFlashObject(obj, options)
{
	if(obj.parentNode == null)
		return false;
	var objParams = ppGetObjectOrEmbedParams(obj);
	if(objParams == null || objParams.src == null)
		return false;
	if(ppIeCompat && objParams.base === undefined)
		objParams.base = ".";
	var c = new MessageChannel();
	c.port1.onmessage = ppHandleMessage;
	c.port1.ppParams = objParams;
	c.port1.ppReadyForCalls = false;
	c.port1.ppPendingPromises = [];
	c.port1.ppSyncHelperPort = null;
	c.port1.ppSyncHelperSab32 = null;
	c.port1.ppSyncHelperSab8 = null;
	c.port1.ppSyncHelperReady = false;
	var f = document.createElement("iframe");
	f.setAttribute("allow", "clipboard-read; clipboard-write; cross-origin-isolated");
	f.onload = function(e)
	{
		f.contentWindow.postMessage({t:"port",port:c.port2, options: options}, "*", [c.port2]);
	};
	var ppPath = cjGetCurrentScript();
	assert(ppPath.endsWith("/pp.js"));
	ppPath = ppPath.substr(0, ppPath.length - 5);
	if(ppJavaScriptCallMode == "sync")
	{
		var xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";
		xhr.open("GET", ppPath + "synchelper.js");
		// The available space for the json payload
		var sabJsonSize = 0;
		// The index of the json payload length in the SAB
		var sabLenIndex = 3;
		// The starting offset of the json paylod in the SAB
		var sabJsonOffset = 4*4;
		xhr.onload = function(e)
		{
			var b = new Blob([xhr.response]);
			var u = URL.createObjectURL(b);
			var syncHelper = new Worker(u);
			syncHelper.onmessage = function(e)
			{
				sabJsonSize = e.data.s.byteLength - sabJsonOffset;
				c.port1.ppSyncHelperSab8 = new Uint8Array(e.data.s);
				c.port1.ppSyncHelperSab32 = new Int32Array(e.data.s);
				c.port1.ppSyncHelperPort = e.data.p;
			};
		};
		xhr.send();
	}
	f.src = ppPath + "pp.html";
	f.style.border = "0";
	f.style.width = "100%";
	f.style.height = "100%";
	function sendSyncMessage(msg)
	{
		// Encode message
		var json = JSON.stringify(msg);
		var encoder = new TextEncoder();
		var data = encoder.encode(json);
		var dataOffset = 0;
		var sab32 = c.port1.ppSyncHelperSab32;
		var sab8 = c.port1.ppSyncHelperSab8;

		// Notify beginning of transaction
		Atomics.store(sab32, sabLenIndex, data.length);
		Atomics.notify(sab32, 0, 1);
		// Send data
		while(true)
		{
			var writtenSize = Math.min(data.length - dataOffset, sabJsonSize);
			sab8.set(data.subarray(dataOffset, dataOffset+writtenSize), sabJsonOffset);
			dataOffset += writtenSize;
			// Notify that data is written
			Atomics.store(sab32, 2, 1);
			Atomics.notify(sab32, 2, 1);

			if(dataOffset == data.length)
			{
				// We sent all the data
				break;
			}

			// More data to send, wait for synchelper to read
			// this chunk
			while(Atomics.load(sab32, 1) == 0);
			Atomics.store(sab32, 1, 0);
		}

		// Wait for reply
		while(Atomics.load(sab32, 1) == 0);
		Atomics.store(sab32, 1, 0);

		// Get reply
		var len = sab32[sabLenIndex];
		data = new Uint8Array(len);
		dataOffset = 0;
		while(true)
		{
			// Notify that we are ready to read more data
			Atomics.store(sab32, 2, 1);
			Atomics.notify(sab32, 2, 1);
			// Wait for more data
			while(Atomics.load(sab32, 1) == 0);
			Atomics.store(sab32, 1, 0);

			// Read data
			var curLen = Math.min(len-dataOffset, sabJsonSize);
			data.set(sab8.subarray(sabJsonOffset, curLen+sabJsonOffset), dataOffset);
			dataOffset += curLen;

			if(dataOffset == len)
			{
				// We read all the data
				break;
			}
		}

		var decoder = new TextDecoder();
		json = decoder.decode(data);
		var reply = JSON.parse(json);

		return reply;
	}
	var handlers = {
		get:function(t, p, r)
		{
			var ret=Reflect.get(...arguments);
			if(ret !== undefined)
				return ret;
			if(ppJavaScriptCallMode == "sync")
			{
				if(!c.port1.ppSyncHelperReady)
					return undefined;
				var hasmethod = sendSyncMessage({
					t: "hasmethod",
					methodName: p,
				});
				if(!hasmethod)
					return undefined;
				return function()
				{
					var args = [].slice.call(arguments);
					var reply = sendSyncMessage({
						t: "callmethod",
						methodName: p,
						args: ppMapValues(args),
					});
					while(1)
					{
						switch(reply.t)
						{
							case "callmethodret":
							{
								if(reply.exception)
								{
									if(typeof(reply.ret)=="string")
										throw new Error(reply.ret);
									else
										throw new Error("Error: An invalid exception was thrown.");
								}
								return ppUnmapValue(reply.ret);
							}
							case "execute":
							{
								var e = self.eval(reply.ret);
								reply = sendSyncMessage({
									t: "executeret",
									ret: ppMapValue(e),
								});
								break;
							}
							case "callsync":
							{
								var o = ppObjectsMap[reply.obj];
								var r = undefined;
								try
								{
									r = o[reply.name].apply(o, ppUnmapValues(reply.args));
								}
								catch(e)
								{
								}
								reply = sendSyncMessage({
									t: "executeret",
									ret: ppMapValue(r),
								});
								break;
							}
						}
					}
				};
			}
			else if(ppJavaScriptCallMode == "async")
			{
				if(!c.port1.ppReadyForCalls)
					return undefined;
				return async function()
				{
					var hasMethod = await ppHasMethod(c.port1, p);
					if(!hasMethod)
					{
						var errorMsg = "Flash method does not exists: "+p;
						throw new Error(errorMsg);
					}
					return ppCallMethod(c.port1, p, [].slice.call(arguments));
				};
			}
			var errorMsg = "CheerpX: Calling Flash methods from JS is not supported: "+p;
			var stubCode = "var errorMsg='" + errorMsg + "';";
			if(ppJavaScriptCallMode == "verbose")
			{
				f.contentWindow.postMessage({t:"failure",msg:errorMsg}, "*");
				stubCode += "console.warn(errorMsg);";
			}
			stubCode += "throw new Error(errorMsg);";
			return new Function(stubCode);
		}
	};
	if(obj.tagName == "EMBED")
	{
		var newObj = document.createElement("object");
		var attrs = obj.attributes;
		for(var i=0;i<attrs.length;i++)
			newObj.setAttribute(attrs[i].name, attrs[i].value);
		obj.style.display = "none";
		obj.parentNode.insertBefore(newObj, obj);
		var oldProto = obj.__proto__;
		obj.__proto__ = new Proxy(oldProto, handlers);
		obj.setAttribute("data-cheerpx", "")
		obj.removeAttribute("id");
		obj.removeAttribute("name");
		obj = newObj;
	}
	else
	{
		var objChild = null;
		while(objChild = obj.firstChild)
			obj.removeChild(objChild);
	}
	obj.style.display = "inline-block";
	obj.setAttribute("data-cheerpx", "")
	obj.appendChild(f);
	var oldProto = obj.__proto__;
	obj.__proto__ = new Proxy(oldProto, handlers);
	return true;
}
function ppMutationObserver(e)
{
	for(var i=0;i<e.length;i++)
	{
		var addedNodes = [].slice.call(e[i].addedNodes);
		while(addedNodes.length)
		{
			var n = addedNodes.pop();
			var lowerCaseNodeName = n.nodeName.toLowerCase();
			if(lowerCaseNodeName == "object" || lowerCaseNodeName == "embed")
			{
				if(rewriteFlashObject(n, ppCheerpXAppOpts))
					continue;
			}
			if(n.hasChildNodes())
			{
				addedNodes = addedNodes.concat([].slice.call(n.children));
			}
		}
	}
}
function ppInit(args)
{
	if(args)
	{
		if(args.locationHref)
			ppLocationHref = args.locationHref;
		if(args.bridgeURL)
			ppCheerpXAppOpts.bridgeURL = args.bridgeURL;
		if(args.disableHiDPI)
			ppCheerpXAppOpts.disableHiDPI = args.disableHiDPI;
		if(args.javaScriptCallMode)
			ppJavaScriptCallMode = args.javaScriptCallMode;
		if(args.readyCallback){
			console.log("CMG Cheerpx v31: ppInit passed a readyCallback function "+args.readyCallback);
			ppReadyCallback = args.readyCallback;
		} else {
			console.log("CMG Cheerpx v34: ppInit. No ready callback");
		}
		if(args.ieCompat)
			ppIeCompat = args.ieCompat;
		if(args.disableAudio)
			ppDisableAudio = args.disableAudio;
	}
	var elemNames = ["object", "embed"];
	for(var i=0;i<elemNames.length;i++)
	{
		var elems = document.getElementsByTagName(elemNames[i]);
		var a = [];
		for(var j=0;j<elems.length;j++)
			a.push(elems[j]);
		for(var j=0;j<a.length;j++)
			rewriteFlashObject(a[j], ppCheerpXAppOpts);
	}
	var tagObserver = new MutationObserver(ppMutationObserver);
	tagObserver.observe(document, { subtree: true, childList: true });
}
