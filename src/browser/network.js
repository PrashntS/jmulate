"use strict";

/**
 * An ethernet-through-websocket adapter, to be used with 
 *     https://github.com/benjamincburns/websockproxy
 * 
 * emulated ethernet card <--> this <--> websocket proxy <--> network
 *
 * @constructor
 */
function NetworkAdapter(url)
{
    this.send_data = function(x) {};

    this.socket = undefined;
    this.send_queue = [];
    this.url = url;

    this.reconnect_interval = 10000;
    this.last_connect_attempt = Date.now() - this.reconnect_interval;
    this.send_queue_limit = 64;
}

NetworkAdapter.prototype.handle_message = function(e)
{
    this.send_data(new Uint8Array(e.data));
};

NetworkAdapter.prototype.handle_close = function(e)
{
    //console.log("onclose", e);

    this.connect();
    setTimeout(this.connect.bind(this), this.reconnect_interval);
};

NetworkAdapter.prototype.handle_open = function(e)
{
    //console.log("open", e);

    for(var i = 0; i < this.send_queue.length; i++)
    {
        this.send(this.send_queue[i]);
    }

    this.send_queue = [];
};

NetworkAdapter.prototype.handle_error = function(e)
{
    //console.log("onerror", e);
};

NetworkAdapter.prototype.init = function(send_data)
{
    this.send_data = send_data;
};

NetworkAdapter.prototype.destroy = function() 
{
    if(this.socket)
    {
        this.socket.close();
    }
};

NetworkAdapter.prototype.connect = function()
{
    if(this.socket)
    {
        var state = this.socket.readyState;

        if(state === 0 || state === 1)
        {
            // already or almost there
            return;
        }
    }

    var now = Date.now();

    if(this.last_connect_attempt + this.reconnect_interval > now)
    {
        return;
    }

    this.last_connect_attempt = Date.now();

    this.socket = new WebSocket(this.url);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = this.handle_open.bind(this);;
    this.socket.onmessage = this.handle_message.bind(this);
    this.socket.onclose = this.handle_close.bind(this);
    this.socket.onerror = this.handle_error.bind(this);
};

NetworkAdapter.prototype.send = function(data)
{
    //console.log("send", data);

    if(!this.socket || this.socket.readyState !== 1)
    {
        this.send_queue.push(data);

        if(this.send_queue.length > 2 * this.send_queue_limit)
        {
            this.send_queue = this.send_queue.slice(-this.send_queue_limit);
        }

        this.connect();
    }
    else
    {
        this.socket.send(data);
    }
}
