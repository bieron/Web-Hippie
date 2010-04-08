var Hippie = function(host, arg, on_connect, on_disconnect, on_event) {

    this.arg = arg;
    this.on_disconnect = on_disconnect;
    this.on_connect = on_connect;
    this.on_event = on_event;

    this.detect();

    if (this.mode == 'ws') {
        var that = this;
        this.init = function() {
            ws = new WebSocket("ws://"+host+"/_hippie/ws/"+arg + '?client_id=' + (that.client_id || ''));
            ws.onmessage = function(ev) {
                var d = eval("("+ev.data+")");
                if (d.type == "hippie.pipe.set_client_id") {
                    that.client_id = d.client_id;
                }
                that.on_event(d);
            }
            ws.onclose = ws.onerror = function(ev) {
                that.on_disconnect();
            }
            ws.onopen = function() {
                that.on_connect();
            }
            that.ws = ws;
        };
    }
    else if (this.mode == 'mxhr') {
        var that = this;
        this.init = function() {
            var s = new DUI.Stream();
            // XXX: somehow s.listeners are shared between objects.
            // maybe a DUI class issue?  this workarounds issue where
            // reconnect introduces duplicated listeners.
            s.listeners = {};
            s.listen('application/json', function(payload) {
                var event = eval('(' + payload + ')');
                if (event.type == "hippie.pipe.set_client_id") {
                    that.client_id = event.client_id;
                }
                that.on_event(event);
            });
            s.listen('complete', function() {
                that.on_disconnect();
            });
            s.load("/_hippie/mxhr/" + arg + '?client_id=' + (that.client_id || ''));
            that.on_connect();
            that.mxhr = s;
        };
    }
    else if (this.mode == 'poll') {
        var that = this;
        this.init = function() {
            $.ev.loop('/_hippie/poll/' + arg,
                      { '*': that.on_event,
                        'hippie.pipe.set_client_id': function(e) {
                            that.client_id = e.client_id;
                            $.ev.url = '/_hippie/poll/' + arg + '?client_id=' + e.client_id;
                            that.on_event(e);
                        }
                      }
                     );
            that.on_connect();
        }
    }
    else {
        throw new Error("unknown hippie mode: "+this.mode);
    }

    this.init();
};

Hippie.prototype = {
    detect: function() {
        var match = /hippie\.mode=(\w+)/.exec(document.location.search);
        if (match) {
            this.mode = match[1];
        }
        else {
            if ("WebSocket" in window) {
                this.mode = 'ws';
            }
            else {
                var req;
                try {
                    try { req = new ActiveXObject('MSXML2.XMLHTTP.6.0'); } catch(nope) {
                        try { req = new ActiveXObject('MSXML3.XMLHTTP'); } catch(nuhuh) {
                            try { req = new XMLHttpRequest(); } catch(noway) {
                                throw new Error('Could not find supported version of XMLHttpRequest.');
                            }
                        }
                    }
                }
                catch(e) {
                    this.mode = 'poll';
                    return;
                }

                this.mode = 'mxhr';
            }
        }
    },
    send: function(msg) {
        if (this.ws) {
            this.ws.send(JSON.stringify(msg));
        }
        else {
            var that = this;
            jQuery.ajax({
                url: "/_hippie/pub/"+this.arg,
                beforeSend: function(xhr, s) {
		    xhr.setRequestHeader("X-Hippie-ClientId", that.client_id);
                    return true;
                },
                data: msg,
                type: 'post',
                dataType: 'json',
                success: function(r) { }
            });
        }
    }
};
