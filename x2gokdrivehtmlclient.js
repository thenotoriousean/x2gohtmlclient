/*
 * Copyright © 2020-2021 Oleksandr Shneyder <o.shneyder@phoca-gmbh.de>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program; if not, write to the
 * Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.
 */

/*
 * This is the main application class of your custom application "x2gokdrivehtmlclient"
 *
 */

//version 4 supports clipboard
var FEATURE_VERSION = 4;

//Version of client OS for same reason
var OS_VERSION = 3; //web client


//events
const KEYPRESS = 2;
const KEYRELEASE = 3;
const MOUSEPRESS = 4;
const MOUSERELEASE = 5;
const MOUSEMOTION = 6;
const GEOMETRY = 7;
const UPDATE = 8;
const SELECTIONEVENT = 9;
const CLIENTVERSION = 10;
const DEMANDSELECTION = 11;
const KEEPALIVE = 12;

const EVENT_LENGTH = 41;

//mouse events
const Button1Mask = (1 << 8);
const Button2Mask = (1 << 9);
const Button3Mask = (1 << 10);
const Button4Mask = (1 << 11);
const Button5Mask = (1 << 12);


const Button1 = 1;
const Button2 = 2;
const Button3 = 3;
const Button4 = 4;
const Button5 = 5;


//keyboard events
const ShiftMask = (1 << 0);
const LockMask = (1 << 1);
const ControlMask = (1 << 2);
const Mod1Mask = (1 << 3);
const Mod2Mask = (1 << 4);
const Mod3Mask = (1 << 5);
const Mod4Mask = (1 << 6);
const Mod5Mask = (1 << 7);

//header
const HEADER_SIZE = 56;
const REGION_SIZE = 64;

//data types
const HEADER = 0;
const FRAMEREGION = 1;
const REGIONDATA = 2;
const CURSORDATA = 3;
const CURSORLIST = 4;
const FRAMELIST = 5;
const SELECTIONBUFFER = 6;
const H264STREAM = 15;

//header types
const FRAME = 0;
const DELETEDFRAMES = 1;
const CURSOR = 2;
const DELETEDCURSORS = 3;
const SELECTION = 4;
const SERVER_VERSION = 5;
const DEMANDCLIENTSELECTION = 6;
const H264HEADER = 14;

//selection mimes
const STRING = 0;
const UTF_STRING = 1;
const PIXMAP = 2;

//selection types
const PRIMARY = 0;
const CLIPBOARD = 1;

class
X2GoKDriveHTMLClient
{
    constructor(canvas, background, x2goclient)
    {
        this.__background = background;
        this.__websocket = null;
        this.__currentDataType = 0;
        this.__bytesLeftToRead = 0;
        this.__bytesReady = 0;
        this.__messageBuffer = 0;
        this.__currentFrame = 0;
        this.__currentCursor = 0;
        this.__frameCash = new Map();
        this.__cursorCash = new Map();
        this.__drawQueue = [];
        this.__deletedFramesSize = 0;
        this.__deletedCursorSize = 0;
        this.__cookie = 0;
        this.__connected = false;
//        this.__bodySavedCursor = '';
//        this.__bodyResizing = false;
//        this.__bodyOnBorder = false;
        this.__x2goclient = x2goclient;
        this.__serverVersion = 0;
        this.__sendAlive = 0;
        this.__cursor = 0;
        this.__serverExtSelection = false;
//////input selection data
        //size of current chunk
        this.__selectionSize;
        //size of complete selection
        this.__selectionTotalSize;
        //format of chunk, string or pix
        this.__selectionFormat;
        //if true clipboard else primary
        this.__selectionClipboard;
        //if it's the first chunk in multiply sel
        this.__firstChunk;
        //if it's the last chunk in multiply sel
        this.__lastChunk;
        //if the chunk compressed the size is > 0
        this.__compressedSize;
        this.__selData = 0;
        this.__totalCompressed = 0;
//////
        let app = this;

        //new webgl stuff
        this.__display;
        //decoder
        this.__decoder;
        
        this.initCanvasAndDecoder(canvas);

        //this.initDecoder();

        this.createCursor(document, window);

    }

    //init decoder
    initDecoder(){
        this.__decoder = new Worker('./dist/h264_worker.js');
        console.log("Created decoder");

        this.__decoder.addEventListener('message', function(e) {
            var message = e.data;
            if (!message.hasOwnProperty('type')) return;

            switch(message.type) {
            case 'pictureReady':
                console.log("message: width:%d, height:%d, croppingParams:%s, data:%s", message.width,message.height,message.croppingParams,message.data);
                this.__display.drawNextOutputPicture(
                    message.width,
                    message.height,
                    message.croppingParams,
                    new Uint8Array(message.data));
                break;
            case 'decoderReady':
                console.log('Decoder ready');
                break;
            }
        });
    }
    // init canvas and decoder
    initCanvasAndDecoder(canvas)
    {
        let app = this;

        this.__canvas = canvas;
        this.__canvas.oncontextmenu = function (e)
        {
            e.preventDefault();
        };

        console.log("install resize listener");
        this.__canvas.onresize = function (e)
        {
            console.log("canvas resized");
            app.sendGeometryEvent();
        };

        this.__decoder = new Worker('./dist/h264_worker.js');

        this.__decoder.addEventListener('message', function(e) {
            var message = e.data;
            if (!message.hasOwnProperty('type')) return;

            switch(message.type) {
            case 'pictureReady':
                // ++pictureCount;
                app.drawCanvasImg(
                    message.width,
                    message.height,
                    new Uint8Array(message.data));
                break;
            case 'decoderReady':
                console.log('Decoder ready');
                break;
            }

        });



        /*   
        let body = app.__canvas.parentElement;  
        body.addEventListener("pointermove", function (e)
         {
         app.processResize(e)
         });
         body.addEventListener("mousedown", function (e)
         {
         app.processResize(e)
         });
         body.addEventListener("mouseup", function (e)
         {
         app.processResize(e)
         });*/


        app.__canvas.addEventListener("mousedown", function (e)
        {
            app.sendMouseEvent(e);
        });

        app.__canvas.addEventListener("mouseup", function (e)
        {
            app.sendMouseEvent(e);
        });

        app.__canvas.addEventListener("pointermove", function (e)
        {
            if (app.__cursor.src)
            {
                app.__cursor.style.visibility = 'visible';
            }
            app.sendMouseEvent(e);
        });

        app.__canvas.addEventListener("wheel", function (e)
        {

            app.sendMouseEvent(e);
        });

        app.__canvas.addEventListener("keydown", function (e)
        {
            app.sendKeyEvent(e);
        });

        app.__canvas.addEventListener("keyup", function (e)
        {
            app.sendKeyEvent(e);
        });

    }

    drawCanvasImg(width, height, data){
        let ctx = this.__canvas.getContext("2d");
        let imageData = ctx.getImageData(0, 0, width, height);
        imageData.data.set(data);
        ctx.putImageData(imageData, 0, 0);
        ++pictureCount;
    }

    //     create cursor
    createCursor(doc, wnd)
    {
//we will use original cursor untill we get cursor from the server
        this.__cursor = doc.createElement("IMG");
        this.__cursor.id = "x2go_cursor";
        this.__cursor.style.position = 'absolute';
        this.__cursor.style.width = '20';
        this.__cursor.style.height = '20';
        this.__cursor.style.left = '200';
        this.__cursor.style.top = '200';
        this.__cursor.style.cursor = 'none';
        this.__cursor.style.userSelect = 'none';
        this.__cursor.style.pointerEvents = 'none';
        this.__cursor.style.visibility = 'hidden';
        this.__cursor.dataset.hotX = 0;
        this.__cursor.dataset.hotY = 0;


        doc.body.appendChild(this.__cursor);

        let app = this;
        app.__canvas.addEventListener("mouseout", function (e)
        {
            //hide cursor when leaving canvas
            app.__cursor.style.visibility = 'hidden';
        });


        wnd.addEventListener("pointermove", function (e)
        {
            app.__cursor.style.left = e.pageX - app.__cursor.dataset.hotX + 'px';
            app.__cursor.style.top = e.pageY - app.__cursor.dataset.hotY + 'px';
        });


        this.__cursor.onload = function ()
        {
            app.__cursor.style.visibility = 'visible';
            app.__cursor.style.display = 'initial';
        }

        app.__cursor.onerror = function (evt)
        {
            console.log("CURSOR LOAD ERRR", evt, app.__cursor);
            app.__cursor.style.visibility = 'hidden';
            app.__cursor.style.display = 'none';
            app.__canvas.style.cursor = "auto";
        }

    }

    renderBackground()
    {
        if (!this.__background)
        {
            return;
        }

        let canv = this.__canvas;
        let ctx = canv.getContext("2d");


        let img = new Image();
        img.onload = function ()
        {
            ctx.drawImage(img, 0, 0, canv.clientWidth, canv.clientHeight);
        }
        img.src = this.__background;
    }

    restoreResizeCursor(e)
    {
        let app = this;
        let body = app.__canvas.parentElement;
        if (app.__bodyOnBorder)
        {
            app.__bodyOnBorder = false;
            body.style.cursor = app.__bodySavedCursor;
            app.__bodySavedCursor = '';
            e.preventDefault();
            e.stopPropagation();
        }
        if (app.__bodyResizing)
        {
            app.__bodyResizing = false;
        }
    }

    processResize(e)
    {
        let app = this;
        let body = app.__canvas.parentElement;

        if (e.type == "mousedown")
        {
            if ((e.button != 0) || (e.buttons != 1))
            {
                app.restoreResizeCursor(e);
                return;
            }
            if (app.__bodyOnBorder)
            {
                app.__bodyResizing = true;
            }
        }
        if (e.type == "mouseup")
        {
            app.restoreResizeCursor(e);
        }
        if (e.type == "pointermove")
        {
            if (app.__bodyResizing)
            {
                let width;
                let height;
                if (e.target == body)
                {
                    width = e.offsetX - app.__canvas.offsetLeft;
                    height = e.offsetY - app.__canvas.offsetTop;
                }
                else if (e.target == app.__canvas)
                {
                    width = e.offsetX;
                    height = e.offsetY;
                }
                else
                {
                    return;
                }
                //                console.log(width, height);

                if (body.style.cursor == "e-resize")
                {
                    app.__canvas.width = width + "px";
                }

                if (body.style.cursor == "s-resize")
                {
                    app.__canvas.height = height + "px";
                }

                if (body.style.cursor == "nw-resize")
                {
                    app.__canvas.style.width = width + "px";
                    app.__canvas.style.height = height + "px";
                }
                app.__canvas.width = width;
                app.__canvas.height = height;
                app.sendGeometryEvent();
                return;
            }
            if (e.target == app.__canvas)
            {
                let corner = false;
                let right = false;
                let bottom = false;
                let cursor;
                if ((e.offsetX >= app.__canvas.clientWidth - 2))
                {
                    right = true;
                }
                if ((e.offsetY >= app.__canvas.clientHeight - 2))
                {
                    bottom = true;
                }
                if (right && bottom)
                {
                    corner = true;
                }
                if (right)
                {
                    cursor = "e-resize";
                }
                if (bottom)
                {
                    cursor = "s-resize";
                }
                if (corner)
                {
                    cursor = "nw-resize";
                }
                if (right || bottom || corner)
                {
                    if (!app.__bodyOnBorder)
                    {
                        app.__bodySavedCursor = body.style.cursor;
                        app.__bodyOnBorder = true;
                    }
                    body.style.cursor = cursor;
                    e.preventDefault();
                    e.stopPropagation();
                }
                else
                {
                    app.restoreResizeCursor(e);
                }
            }
            else
            {
                app.restoreResizeCursor(e);
            }
        }
    }


    getGeometry()
    {
        return this.__canvas.clientWidth + "x" + this.__canvas.clientHeight;
    }

    startCommunication()
    {
        let app = this;

        initsocket();
    }

    sendClientVersion()
    {
        let buffer = new ArrayBuffer(EVENT_LENGTH);

        //this creates "views" on buffer offset 0, length 5 elements
        let v32 = new Uint32Array(buffer, 0, 5);
        let v16 = new Uint16Array(buffer, 0, 5);

        v32[0] = CLIENTVERSION;
        v16[2] = FEATURE_VERSION;
        v16[3] = OS_VERSION;
        console.log("Sending client Version and OS:", buffer, v32, v16);
        this.__websocket.send(buffer);
    }

    sendKeepAlive()
    {
        let buffer = new ArrayBuffer(EVENT_LENGTH);

        //this creates "views" on buffer offset 0, length 5 elements
        let v32 = new Uint32Array(buffer, 0, 5);

        v32[0] = KEEPALIVE;
        console.log("keep alive event");
        this.__websocket.send(buffer);

    }

    sendGeometryEvent()
    {
        let buffer = new ArrayBuffer(EVENT_LENGTH);

        //this creates "views" on buffer offset 0, length 5 elements
        let v32 = new Uint32Array(buffer, 0, 5);
        let v16 = new Uint16Array(buffer, 0, 5);

        v32[0] = GEOMETRY;
        v16[2] = this.__canvas.clientWidth;
        v16[3] = this.__canvas.clientHeight;
        console.log("Sending geometry event:", buffer, v32, v16);
        if (this.__websocket.readyState == WebSocket.OPEN)
        {
            this.__websocket.send(buffer);
        }
    }


    sendCookie()
    {
        let encoder = new TextEncoder();
        this.__websocket.send(encoder.encode(this.__cookie).buffer);
    }


    web2pc105(nativeCode)
    {
        switch (nativeCode)
        {
            //1st row
            case 192:
                return 49; //` (putting a second accent grave here, so that MCEdit does not get confused with syntax highlighting) `
            case   49:
                return 10; //1
            case 50:
                return 11; //2
            case 51:
                return 12; //3
            case 52:
                return 13; //4
            case 53:
                return 14; //5
            case 54:
                return 15; //6
            case 55:
                return 16; //7
            case 56:
                return 17; //8
            case 57:
                return 18; //9
            case 48:
                return 19; //0
            case 189:
                return 20; //-
            case 187:
                return 21; //=
            case 8:
                return 22; //BSP

            //2 row
            case 9 :
                return 23; //TAB
            case 81:
                return 24; //q
            case 87:
                return 25; //w
            case 69 :
                return 26; //e
            case 82 :
                return 27; //r
            case 84 :
                return 28; //t
            case 89:
                return 29; //y
            case 85:
                return 30; //u
            case 73:
                return 31; //i
            case 79:
                return 32; //o
            case 80:
                return 33; //p
            case 219:
                return 34; //[
            case 221:
                return 35; //]
            case  13:
                return 36; //ENT

            //3 row
            case 20 :
                return  66; //CAPS
            case 65 :
                return  38; //a
            case 83 :
                return  39; //s
            case 68 :
                return  40; //d
            case 70 :
                return  41; //f
            case 71 :
                return  42; //g
            case 72 :
                return  43; //h
            case 74 :
                return  44; //j
            case 75 :
                return  45; //k
            case 76 :
                return  46; //l
            case 186 :
                return  47; //;
            case 222 :
                return  48; //' (putting a second apostrophe here, so that MCEdit does not get confused with syntax highlighting) '
            case 220 :
                return  51; //\

            //4 row
            case 16 :
                return  50; //SHL
            case 220 :
                return  94; //<
            case 90 :
                return  52; //z
            case 88 :
                return  53; //x
            case 67 :
                return  54; //c
            case 86 :
                return  55; //v
            case 66 :
                return  56; //b
            case 78 :
                return  57; //n
            case 77 :
                return  58; //m
            case 188 :
                return  59; //,
            case 190 :
                return  60; //.
            case 191 :
                return  61; ///
            case 16 :
                return  62; //SHR


            //5 row
            case 17 :
                return  37; //LCTRL
            case 91 :
                return  133; //LMETA
            case 18 :
                return  64; //LALT
            case 32 :
                return  65; //SPACE
            case 225 :
                return  108; //RALT
            case 92 :
                return  134; //RMETA
            case 93 :
                return  135; //MENU
            case 17 :
                return  105; //RCTRL


            //specials
            case 27 :
                return  9; //ESC
            case 112 :
                return  67; //F1
            case 113 :
                return  68; //F2
            case 114 :
                return  69; //F3
            case 115 :
                return  70; //F4
            case 116 :
                return  71; //F5
            case 117 :
                return  72; //F6
            case 118 :
                return  73; //F7
            case 119 :
                return  74; //F8
            case 120 :
                return  75; //F9
            case 121 :
                return  76; //F10
            case 122 :
                return  95; //F11
            case 123 :
                return  96; //F12

            case 44 :
                return  107; //print
            case 145 :
                return  78; //scroll
            case 19 :
                return  127; //break

            case 45 :
                return  118; //ins
            case 36 :
                return  110; //home
            case 33 :
                return  112; //pgup
            case 46 :
                return  119; //del
            case 35 :
                return  115; //end
            case 34 :
                return  117; //pgdn

            //arrows
            case 38 :
                return  111;
            case 37 :
                return 113;
            case 40 :
                return 116;
            case 39 :
                return 114;

            //numlock
            case 144 :
                return  77; //NLCK
            case 111 :
                return  106; ///
            case 106 :
                return  63; //*
            case 109 :
                return  82; //-

            case 36 :
                return  79; //home
            case 38 :
                return  80; //up
            case 33 :
                return  81; //pgup
            case 107 :
                return  86; //+

            case 37 :
                return  83; //left
            case 12 :
                return  84; //clear
            case 39 :
                return  85; //right

            case 35 :
                return  87; //end
            case 40 :
                return  88; //dwn
            case 34 :
                return  89; //pgdn
            case 13 :
                return  104; //enter

            case 45 :
                return  90; //ins
            case 46 :
                return  91; //del

            case 96 :
                return  90; //0
            case 97 :
                return  87; //1
            case 98 :
                return  88; //2
            case 99 :
                return  89; //3
            case 100 :
                return  83; //4
            case 101 :
                return  84; //5
            case 102 :
                return  85; //6
            case 103 :
                return  79; //7
            case 104 :
                return  80; //8
            case 105 :
                return  81; //9

            case 108 :
                return  91; //,


        }
        return nativeCode;
    }


    sendMouseEvent(e)
    {
        if (!this.__connected)
        {
            return;
        }
        let buffer = new ArrayBuffer(EVENT_LENGTH);

//        console.log(e);

        //this creates "views" on buffer offset 0, length 3 elements
        let v32 = new Uint32Array(buffer, 0, 3);
        if (e.type == "pointermove")
        {
//            console.log("Mouse move:");
            v32[0] = MOUSEMOTION;
            v32[1] = e.offsetX;
            v32[2] = e.offsetY;
        }
        else
        {
            v32[1] = 0;
            if (e.type == "wheel")
            {
                e.preventDefault();
                e.stopPropagation();
                v32[2] = Button5;
                if (e.deltaY < 0)
                {
                    v32[2] = Button4;
                }
                v32[0] = MOUSEPRESS;
                this.__websocket.send(buffer);
                v32[0] = MOUSERELEASE;
                this.__websocket.send(buffer);
                return;
            }

            if (e.type == "mousedown")
            {
                v32[0] = MOUSEPRESS;
            }
            if (e.type == "mouseup")
            {
                v32[0] = MOUSERELEASE;
            }
            if (e.button == 0)
            {
                v32[2] = Button1;
            }
            if (e.button == 2)
            {
                v32[2] = Button3;
            }
            if (e.button == 1)
            {
                v32[2] = Button2;
            }
        }
        this.__websocket.send(buffer);
    }


    sendKeyEvent(e)
    {
        if (!this.__connected)
        {
            return;
        }

//        console.log(e.key, e.code, e.keyCode);
//                return;

        let buffer = new ArrayBuffer(EVENT_LENGTH);
        let v32 = new Uint32Array(buffer, 0, 3);
        if (e.type == "keyup")
        {
            v32[0] = KEYRELEASE;
        }
        else if (e.type == "keydown")
        {
            v32[0] = KEYPRESS;
        }
        else
        {
            console.log("Unsupported keyboard event: ", e.type);
            return;
        }

        v32[1] = 0;
        if (e.shiftKey)
        {
            v32[1] |= ShiftMask;
        }
        if (e.altKey)
        {
            v32[1] |= Mod1Mask;
        }
        if (e.ctrlKey)
        {
            v32[1] |= ControlMask;
        }
        if (e.metaKey)
        {
            v32[1] |= Mod4Mask;
        }

        v32[2] = this.web2pc105(e.keyCode);

//                console.log(v32[1], v32[2]);

        e.preventDefault();
        e.stopPropagation();
        this.__websocket.send(buffer);
    }


    onOpen(evt)
    {
        console.log("WS Open", evt);
        this.sendCookie();
        this.__connected = true;
        this.sendGeometryEvent();
        this.__x2goclient.wsopen();
        this.sendClientVersion();
        let app = this;
        setInterval(updateFpsCount, 1000);
        setInterval(updateBandwidth, 1000);
        //setInterval(updateDelay, 1000);

        if (!this.__sendAlive)
        {
            //send client version to server every minute to keep alive the connection
            this.__sendAlive = setInterval(function ()
            {
                let serverVersion = parseInt(app.__serverVersion);
                //not supporting any keep alive mechanism
                if (serverVersion < 2)
                {
                    return;
                }
                //doesn't know keepalive event, but we can send version instead
                if (serverVersion < 3)
                {
                    app.sendClientVersion();
                }
                else
                {
                    app.sendKeepAlive();
                }
            }, 60000);
        }
    }

    onClose(evt)
    {
        console.log("WS Close", evt);
        if (this.__sendAlive)
        {
            clearInterval(this.__sendAlive);
            this.__sendAlive = 0;
        }
        this.__connected = false;
        this.__x2goclient.wsclose();
        let app = this;
    }

    onError(evt)
    {
        if (this.__sendAlive)
        {
            clearInterval(this.__sendAlive);
            this.__sendAlive = 0;
        }
        console.log("ws error", evt);
        this.__x2goclient.wserr();
    }

    handleH264Data(data){
        this.__decoder.postMessage({
            'type' : 'input', 
            'data' : data, 
        });
    }

    onNalMessage(evt)
    {
        // if(evt.data.byteLength == 16){
        //     let u32 = new DataView(evt.data);
        //     let longValue = u32.getBigInt64(0,true);
        //     serverTime = longValue.toString();

        //     var now = new Date();
        //     clientTime = now.getTime();
        // }
        // else{
        //     this.handleH264Data(evt.data);
        // }

        dataReceived += parseInt(evt.data.byteLength/1024);
        this.handleH264Data(evt.data);
    }

    onMessage(evt)
    {
//                console.log("WS MSG", evt, evt.data);

        let offset = 0;
        let available = evt.data.byteLength;

        dataReceived += parseInt(available/1024);

        while (available)
        {
            if (!this.__bytesLeftToRead)
            {
                this.__bytesLeftToRead = HEADER_SIZE;
                this.__bytesReady = 0;
                this.__currentDataType = HEADER;
            }
            if (!this.__messageBuffer)
            {
                this.__messageBuffer = new ArrayBuffer(this.__bytesLeftToRead);
            }

            let copyBytes = this.__bytesLeftToRead;
            if (copyBytes > available)
            {
                copyBytes = available;
            }

            //copy to msgbuf+bytesready  copybytes   from data+offset
            let srcArray = new Uint8Array(this.__messageBuffer, this.__bytesReady, copyBytes);
            let dstArray = new Uint8Array(evt.data, offset, copyBytes);
            srcArray.set(dstArray);

            this.__bytesLeftToRead -= copyBytes;
            this.__bytesReady += copyBytes;
            available -= copyBytes;
            offset += copyBytes;
            if (!this.__bytesLeftToRead)
            {
                switch (this.__currentDataType)
                {
                    case HEADER:
                    {
                        this.readDataHeader();
                        break;
                    }
                    case H264STREAM:
                    {
                        this.handleH264Data();
                        break;
                    }
                    case FRAMEREGION:
                    {
                        this.getFrameRegion();
                        break;
                    }
                    case REGIONDATA:
                    {
                        this.getRegionImage();
                        break;
                    }
                    case FRAMELIST:
                    {
                        this.getDeletedFramesList();
                        break;
                    }
                    case CURSORLIST:
                    {
                        this.getDeletedCursorsList();
                        break;
                    }
                    case CURSORDATA:
                    {
                        this.getCursorImage();
                        break;
                    }
                    case SELECTIONBUFFER:
                    {
                        this.getSelectionBuffer();
                        break;
                    }

                    //continue code add another data types!!
                    default:
                    {
                        console.log("Not supported function!!!!");
                    }
                }
            }
        }


        /*
         let reader = new FileReader();
         reader.addEventListener("loadend", function() {
         console.log(reader.result);
         });
         reader.readAsBinaryString(evt.data);
         */
    }

    getRegionImage()
    {
        //here should be our image!!!
//                console.log("GOT IMAGE", this.__messageBuffer);
        let blob = new Blob([this.__messageBuffer], {type:'image/jpeg'});
        this.__currentFrame["regions"][this.__currentFrame["regions"].length - 1]["url"] = window.URL.createObjectURL(blob);

        //console.log("region ready", this.__currentFrame["regions"]);

        if (this.__currentFrame["regions"].length == this.__currentFrame["numOfRegions"])
        {
            //all regions are ready
            /*
             if(this.__currentFrame["regions"].length > 1)
             {
             console.log("all regions ready",this.__currentFrame);
             }
             */
            this.renderFrame();
        }
        else
        {
            //get next region
            this.__bytesReady = 0;
            this.__bytesLeftToRead = REGION_SIZE;
            this.__currentDataType = FRAMEREGION;
        }

    }

    appendFrame(frame)
    {
//                console.log("add to cash: ", frame);
        this.__frameCash.set(frame["crc"], frame);
        //try to get rid of URL in regions
//                console.log("append to frames: ", frame);
    }


    processDrawQueue()
    {
        let ctx = this.__canvas.getContext("2d");

//                let ct1 = this.__tstcanvas.getContext2d();
//                let ct2 = this.__tstcanvas1.getContext2d();

        while (this.__drawQueue.length)
        {
            //check queue first element.
            //append frame if it's last region
            let el = this.__drawQueue[0];
            /*
             if(el["first"])
             {
             ct2.clearRect(0, 0, 600, 768);
             }
             */
            if (el["image"])
            {
                if (!el["image"].complete)
                {
                    //not loaded yet
                    return;
                }
                ctx.drawImage(el["image"], el["source_x"] + el["x"],
                    el["source_y"] + el["y"]/*, el["width"], el["height"]*/);
                /*
                 ct2.drawImage(el["image"], el["source_x"] + el["x"],
                 el["source_y"] + el["y"]*/
                /*, el["width"], el["height"]*/
                /*
                 );

                 ct1.clearRect(0, 0, 600, 768);*/


                URL.revokeObjectURL(el["image"].currentSrc);
                el["image"] = 0;
            }
            else
            {
                let src = el["source_frame"];
//                        console.log("put data from ",src);
                ctx.putImageData(src["imgData"], el["x"] - el["source_x"], el["y"] - el["source_y"],
                    el["source_x"], el["source_y"], el["width"], el["height"]);
                ++pictureCount;

//                        console.log("put src image to:",el["x"],el["y"]);

                /*                        ct1.clearRect(0, 0, 600, 768);
                 ct1.putImageData(src["imgData"], el["x"],el["y"], el["source_x"], el["source_y"], el["width"], el["height"]);
                 if(!el["noreg"])
                 {
                 ct2.putImageData(src["imgData"], el["x"],el["y"], el["source_x"], el["source_y"], el["width"], el["height"]);
                 }
                 */
//                        console.log(src,el);

            }
//                    console.log("drawing:", el);
            if (el["frame"])
            {
                let frame = el["frame"];
                frame["imgData"] = ctx.getImageData(frame["x"], frame["y"],
                    frame["width"], frame["height"]);
                /*
                 console.log("saving data for ",frame);
                 console.log(frame,el);
                 console.log("frame ready");
                 */
                //getFrameData  this.appendFrame(el["frame"]);
            }
            this.__drawQueue.shift();
        }
    }


    renderFrame()
    {
        let fr = this.__currentFrame;
//                console.log("Start process frame:,fr");
        if (!fr["crc"])
        {
            //have copy of display
            //console.log("have initial image", fr);
            fr["x"] = fr["y"] = 0;
        }
        else
        {
//                    console.log("have new frame", fr);
        }
        let processedregions = 0;
        let app = this;

//                console.log("start to render ", fr);
        if (!fr["numOfRegions"])
        {
//                    console.log("Frame without regions: ", fr);
            let actFr = this.__frameCash.get(fr["crc"]);
            if (actFr)
            {
                let obj = {};
                obj["noreg"] = true;
//                        console.log("found frame:", actFr);
                obj["source_x"] = obj["source_y"] = 0;
                obj["source_frame"] = actFr;
                obj["x"] = fr["x"];
                obj["y"] = fr["y"];
                obj["width"] = fr["width"];
                obj["height"] = fr["height"];
                app.__drawQueue.push(obj);
                app.processDrawQueue();
            }
        }

        for (let i = 0; i < fr["numOfRegions"]; i++)
        {
            let reg = fr["regions"][i];
            let obj = {};
//                    if(i==0)
//                    {
//                        obj["first"]=true;
//                    }

            obj["source_x"] = obj["source_y"] = 0;
            obj["x"] = fr["x"] + reg["x"];
            obj["y"] = fr["y"] + reg["y"];
            obj["width"] = reg["width"];
            obj["height"] = reg["height"];

            if (!reg["source_crc"])
            {
                let img = new Image();
                obj["image"] = img;
                img.onload = function ()
                {
//                            console.log("loaded", this.currentSrc);
                    app.processDrawQueue();
                }
                img.onerror = function (evt)
                {
                    console.log("LOAD ERRR", evt, img, reg);
                    app.__websocket.close();
                    return;
                }
                img.src = reg["url"];
//                        console.log("start to load", img, fr, reg);
            }
            else
            {
                let src = this.__frameCash.get(reg["source_crc"]);
                if (!src)
                {
                    console.log("Error!!!, frame not found ", reg["source_crc"]);
                }
                else
                {
//                            console.log("Get region data from source: ", src, fr, reg);
                    obj["source_x"] = reg["source_x"];
                    obj["source_y"] = reg["source_y"];
                    obj["source_frame"] = src;
                }
            }
            if (i == fr["numOfRegions"] - 1 && fr["crc"]) // it's a last one, save it
            {
                obj["frame"] = {};
                Object.assign(obj["frame"], fr);
                this.appendFrame(obj["frame"]);
            }
//                    console.log("add to draw queue ",obj,reg );
            app.__drawQueue.push(obj);
            app.processDrawQueue();
        }
    }

    getH264Data()
    {
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 3);
        serverTime = msgArr[2];
        this.__currentDataType = H264STREAM;
        this.__bytesLeftToRead = msgArr[1];
        this.__messageBuffer = 0;
        this.__bytesReady = 0;

        console.log("server time : %d, data length : %d" , serverTime, msgArr[1]);
    }

    readDataHeader()
    {
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 1);
        switch (msgArr[0])
        {
            case H264HEADER:
                this.getH264Data();
                break;
            case FRAME:
            {
//                        console.log("have a frame header");
                this.getImageFrame();
                break;
            }
            case CURSOR:
            {
                this.getCursor();
                break;
            }
            case DELETEDFRAMES:
            {
                this.getDeletedFrames();
                break;
            }
            case DELETEDCURSORS:
            {
                this.getDeletedCursors();
                break;
            }
            case SELECTION:
            {
                this.getSelection();
                break;
            }
            case SERVER_VERSION:
            {
                this.getServerVersion();
                break;
            }
            case DEMANDCLIENTSELECTION:
            {
                console.log("Server demands selection");
                this.copyFromSystemToServer();
                break;
            }
            default:
            {
                console.log("ERROR!!!!! Unsupported header");
                this.__websocket.close();
            }
        }
        this.__messageBuffer = 0;
    }

    getDeletedCursorsList()
    {
        let msgArr = new Uint32Array(this.__messageBuffer, 0, this.__deletedCursorsSize);
        for (let i = 0; i < this.__deletedCursorsSize; i++)
        {
            let serial = msgArr[i];
//            console.log("delete frame ",crc, this.__frameCash.has(crc));
            if (!this.__cursorCash.delete(serial))
            {
                console.log("ERROR deleting", serial, " from ", this.__cursorCash);
            }
        }
        this.__messageBuffer = 0;
    }


    getDeletedCursors()
    {
        this.__bytesReady = 0;
        this.__currentDataType = CURSORLIST;
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 2);
        this.__deletedCursorsSize = msgArr[1];
        this.__bytesLeftToRead = msgArr[1] * 4;
        this.__messageBuffer = 0;
    }


    getDeletedFramesList()
    {
        let msgArr = new Uint32Array(this.__messageBuffer, 0, this.__deletedFramesSize);
        for (let i = 0; i < this.__deletedFramesSize; i++)
        {
            let crc = msgArr[i];
//            console.log("delete frame ",crc, this.__frameCash.has(crc));
            if (!this.__frameCash.delete(crc))
            {
                console.log("ERROR deleting", crc, " from ", this.__frameCash);
            }
        }
        this.__messageBuffer = 0;
    }

    getDeletedFrames()
    {
        this.__bytesReady = 0;
        this.__currentDataType = FRAMELIST;
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 2);
        this.__deletedFramesSize = msgArr[1];
        this.__bytesLeftToRead = msgArr[1] * 4;
        this.__messageBuffer = 0;
    }

    getServerVersion()
    {
        let msgArr = new Uint16Array(this.__messageBuffer, 0, 4);
        this.__serverVersion = msgArr[2];
        console.log("Server version: ", this.__serverVersion);
        if (parseInt(this.__serverVersion) < 3)
        {
            console.log("Warning!!!! The server is using obsolete version of X2GoKdrive, some features (like mouse cursors) won't work. Please update your X2Go Server");
        }
        if (this.__serverVersion > 1)
        {
            this.__serverExtSelection = true;
        }
    }


    copyFromServerToSystem()
    {
        if (this.__serverExtSelection)
        {
            if(this.__serverVersion >= 4)
            {
                //server already sent notify, request data now
               this.requestServerSelection();
            }
            else
            {
                // server sent us the data, user demands selection
                this.pasteDataToClipboard();
            }
        }
        else
        {
            console.log("server version is too old, disable copying clipboard");
            //copyServerBufferToClipboard
        }
    }

    async copyFromSystemToServer(notify)
    {
        let app=this;
        if (this.__serverExtSelection)
        {
            let nav=navigator;
            if(this.__x2goclient.__domController.__sepWnd)
            {
                nav=this.__x2goclient.__domController.__sepWnd.navigator;
            }

            if (typeof ClipboardItem !== "undefined")
            {
                try
                {
                    const clipboardItems = await nav.clipboard.read();
//                    console.log(clipboardItems);

                    for (const clipboardItem of clipboardItems)
                    {
//                        console.log(clipboardItem);

                        for (const type of clipboardItem.types)
                        {
                            console.log(type);
                            let mime;
                            if(type=="text/plain")
                               mime=UTF_STRING;
                            else if(type=="image/png")
                               mime=PIXMAP;
                            else
                            {
                                console.log("not supported type: ",type);
                            }
                            if(mime!== undefined)
                            {
                                if(notify)
                                {
                                //send notify to server
                                   this.sendSelNotify(mime);
                                }
                                else
                                {
                                    const blob = await clipboardItem.getType(type);
                                    let buff=await blob.arrayBuffer();
                                    this.sendSelChunk(mime, true, true, buff);
                                }
                            }
                        }
                    }

                } catch (err)
                {
                    console.error(err.name, err.message);
                }
            }
            else
            {
                if(notify)
                {
                    console.log("browser doesn't support clipboard API, open clipboard widget");
                    setTimeout(function(){ app.__x2goclient.__domController.openClipElement();},100);
                }
                else
                {
                    this.sendSelChunk(app.__x2goclient.__domController.__clipMime, true, true,
                        app.__x2goclient.__domController.__clipBuffer);
                }

            }
        }
        else
        {
            console.log("server version is too old, disable copying clipboard");
            //copyServerBufferToClipboard
        }

    }

    sendSelNotify(mime)
    {
        this.sendSelChunk(mime,true,true,0);
        if(mime==UTF_STRING)
        {
            this.__x2goclient.selectionNotify("systemclipnotify","Text copied to Server");
        }
        else
        {
            this.__x2goclient.selectionNotify("systemclipnotify","Image copied to Server");
        }
    }

    sendSelChunk(mime, first, last, data)
    {
        let buffer = new ArrayBuffer(EVENT_LENGTH);
        let v32 = new Uint32Array(buffer, 0, 5);
        let v8 = new Uint8Array(buffer);
        let length=0;
        if(data)
        {
            length=data.byteLength;
        }
        v32[0] = SELECTIONEVENT;
        v32[1] = length;
        v8[8] = CLIPBOARD;
        v8[9] = mime;
        v8[10] = first;
        v8[11] = last;
        v32[3] = 0;
        v32[4] =length;
        let headerSize=20;
        let sentData=(length < EVENT_LENGTH-headerSize)?length:EVENT_LENGTH-headerSize;

        let dataset=new Uint8Array(data);
//        console.log("dataset:", dataset);
        v8.set(dataset.slice(0,sentData),headerSize);

        if (this.__websocket.readyState == WebSocket.OPEN)
        {
/*            if(!data)
            {
                console.log("send selection notification");
            }
            else
            {
                console.log("send data", buffer, sentData, length);
            }*/
            this.__websocket.send(buffer);
            while (sentData < length)
            {
                let msg_length=(length-sentData < EVENT_LENGTH)?length-sentData:EVENT_LENGTH;
                v8.set(dataset.slice(sentData, sentData+msg_length),0);
                this.__websocket.send( buffer );
                sentData+=msg_length;
            }
        }
    }

    requestServerSelection()
    {
        let buffer = new ArrayBuffer(EVENT_LENGTH);
        let v32 = new Uint32Array(buffer, 0, 1);
        let v16 = new Uint16Array(buffer, 0, 3);

        v32[0] = DEMANDSELECTION;
        v16[2] = this.__selectionClipboard;
//        console.log("Requesting selection from server");
        if (this.__websocket.readyState == WebSocket.OPEN)
        {
            this.__websocket.send(buffer);
        }
    }



    pasteDataToClipboard()
    {
        let nav=navigator;
        let app=this;
        if(this.__x2goclient.__domController.__sepWnd)
        {
            nav=this.__x2goclient.__domController.__sepWnd.navigator;
        }
        switch (this.__selectionFormat)
        {
            ///////here copy data to clipboard
            case STRING:
            case UTF_STRING:
                if (typeof ClipboardItem !== "undefined")
                {
                    let blob = new Blob([new Uint8Array(this.__selData)], {type:'text/plain'});
                    let data = [new ClipboardItem({ "text/plain":blob })];
                    nav.clipboard.write(data);
                    this.__x2goclient.selectionNotify("serverclipnotify","Text copied to Clipboard");
                }
                else
                {
                    console.log("The browser has no support for clipboardItem, open the Clipboard widget");
                    let decoder = new TextDecoder();
                    let str = decoder.decode(this.__selData);
                    setTimeout(function(){ app.__x2goclient.__domController.openClipElement(str);},100);
                }
                break;
            case PIXMAP:
            {
                let blob = new Blob([new Uint8Array(this.__selData)], {type:'image/png'});
                if (typeof ClipboardItem !== "undefined")
                {
                    let data = [new ClipboardItem({ "image/png":blob })];
                    nav.clipboard.write(data);
                    this.__x2goclient.selectionNotify("serverclipnotify","Image copied to Clipboard");
                }
                else
                {
                    console.log("The browser has no support for clipboardItem, open the Clipboard widget");
                    setTimeout(function(){ app.__x2goclient.__domController.openClipElement(blob);},100);
                }

                break;
            }
        }
    }

    notifyUserSelection()
    {
        if (this.__selectionFormat == PIXMAP)
            this.__x2goclient.selectionNotify("serverclipnotify","New Image available");
        else
            this.__x2goclient.selectionNotify("serverclipnotify","New Text available");

    }

    setInputSelectionData(clipboard, format, firstChunk, lastChunk, compressed, size, data, notify)
    {
//        console.log(clipboard, format, firstChunk, lastChunk, compressed, size, data, notify);
        if (firstChunk)
        {
            this.__selData = new Uint8Array();
            this.__selectionFormat = format;
            this.__totalCompressed = 0;
        }
        if (lastChunk && notify)
        {
            this.notifyUserSelection();
            return;
        }

        if (!compressed)
        {
            let narr = new Uint8Array(this.__selData.length + size);
            narr.set(this.__selData);
            narr.set(new Uint8Array(data), this.__selData.length);
            this.__selData = narr;
//            console.log("read chunk of bytes:", size);
        }
        else
        {
            console.log("not supporting compressed texts");
        }

        if (lastChunk)
        {
            if(this.__serverVersion >=4 )
            {
                //server knows that we are supporting extended selection and already sent us notification
                this.pasteDataToClipboard();
            }
            else
            {
                //server sent us data without notification. Notify user and wait for user demand to paste data
                this.notifyUserSelection();
            }
        }
    }

    getSelectionBuffer()
    {
        this.setInputSelectionData(this.__selectionClipboard, this.__selectionFormat, this.__firstChunk, this.__lastChunk,
            this.__compressedSize, this.__selectionSize, this.__messageBuffer, false)

        this.__bytesReady = 0;
        this.__messageBuffer = 0;

    }

    getSelection()
    {
//        console.log("Selection notify event from server");
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 4);
        this.__selectionClipboard = CLIPBOARD;
        if (msgArr[1] != CLIPBOARD)
        {
            this.__selectionClipboard = PRIMARY;
        }
        this.__selectionFormat = PIXMAP;
        if (msgArr[2] != PIXMAP)
        {
            this.__selectionFormat = UTF_STRING;
        }
        this.__selectionSize = msgArr[3];
//        console.log("selection:", this.__selectionClipboard, this.__selectionFormat, this.__selectionSize);


        if (this.__serverExtSelection)
        {
            msgArr = new Uint32Array(this.__messageBuffer, 0, 8);
            this.__firstChunk = msgArr[4];
            this.__lastChunk = msgArr[5];
            this.__compressedSize = msgArr[6];
            this.__selectionTotalSize = msgArr[7];
            if (this.__firstChunk && this.__lastChunk && (this.__selectionSize == 0) && (this.__selectionTotalSize == 0))
            {
                //received selection notification
                this.setInputSelectionData(this.__selectionClipboard, this.__selectionFormat, this.__firstChunk,
                    this.__lastChunk, this.__compressedSize, this.__selectionSize, this.__messageBuffer, true);
            }
            else if (this.__lastChunk && (this.__selectionSize == 0))
            {
                //last chunk from incr selection with size 0
                this.setInputSelectionData(this.__selectionClipboard, this.__selectionFormat, this.__firstChunk,
                    this.__lastChunk, 0, 0, 0, false);
            }
        }
        else
        {
            console.log("server not supports extended selection");
            this.__firstChunk = this.__lastChunk = true;
            this.__compressedSize = 0;
        }

        this.__currentDataType = SELECTIONBUFFER;
        if (this.__compressedSize)
        {
            this.__bytesLeftToRead = this.__compressedSize;
        }
        else
        {
            this.__bytesLeftToRead = this.__selectionSize;
        }
        this.__bytesReady = 0;
        this.__messageBuffer = 0;
    }

    getCursor()
    {

        let dimArr = new Uint16Array(this.__messageBuffer, 10, 4);
        this.__currentCursor = {};
        this.__currentCursor["width"] = dimArr[0];
        this.__currentCursor["height"] = dimArr[1];
        this.__currentCursor["xhot"] = dimArr[2];
        this.__currentCursor["yhot"] = dimArr[3];
        let dataArr = new Uint32Array(this.__messageBuffer, 20, 2);
        this.__currentCursor["serial"] = dataArr[0];
        this.__currentCursor["size"] = dataArr[1];
        this.__bytesReady = 0;
        this.__messageBuffer = 0;
        if (this.__currentCursor["size"])
        {
            this.__currentDataType = CURSORDATA;
            this.__bytesLeftToRead = this.__currentCursor["size"];
        }
        else
        {
            this.setCursor(this.__currentCursor["serial"]);
        }
    }

    setCursor(serial)
    {
        if (parseInt(this.__serverVersion) < 3)
        {
            //not setting cursor, server sent it in wrong format
            return;
        }
        this.__canvas.style.cursor = "none";
        let cursor_img = this.__cursor;
        let cursor = this.__cursorCash.get(serial);

        if (!cursor)
        {
            console.log("Error, Cursor not found in cash!!!!", serial);
            return;
        }

        cursor_img.src = cursor["url"];
        cursor_img.style.width = cursor["width"];
        cursor_img.style.height = cursor["height"];
        cursor_img.dataset.hotX = cursor["xhot"];
        cursor_img.dataset.hotY = cursor["yhot"];
    }


    getCursorImage()
    {

        let blob = new Blob([this.__messageBuffer], {type:'image/png'});

//         console.log("Cursor image:",blob);
        this.__currentCursor["url"] = window.URL.createObjectURL(blob);
        this.__cursorCash.set(this.__currentCursor["serial"], this.__currentCursor);
        this.setCursor(this.__currentCursor["serial"]);

        this.__bytesReady = 0;
        this.__messageBuffer = 0;
    }

    getImageFrame()
    {
        //int32_t width, uint32_t height, int32_t x, int32_t y,  uint32_t numOfRegions, uint32_t crc
        this.__currentFrame = {};
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 7);
        this.__currentFrame["width"] = msgArr[1];
        this.__currentFrame["height"] = msgArr[2];
        this.__currentFrame["x"] = msgArr[3];
        this.__currentFrame["y"] = msgArr[4];
        this.__currentFrame["numOfRegions"] = msgArr[5];
        this.__currentFrame["crc"] = msgArr[6];
        this.__currentFrame["regions"] = [];

//                console.log("Got Frame:",this.__currentFrame);
        if (!this.__currentFrame["numOfRegions"])
        {
            //we have no regions
//                    console.log("Frame without regions");
            this.renderFrame();
            this.__bytesReady = 0;
        }
        else
        {
            //read region
            this.__bytesReady = 0;
            this.__bytesLeftToRead = REGION_SIZE;
            this.__currentDataType = FRAMEREGION;
        }
    }

    getFrameRegion()
    {
        let region = {};
        let msgArr = new Uint32Array(this.__messageBuffer, 0, 8);
        //uint32_t source_crc, int32_t source_x, int32_t source_y, int32_t x, int32_t y,
        //uint32_t width, uint32_t height, uint32_t dataSize
        region["source_crc"] = msgArr[0];
        region["source_x"] = msgArr[1];
        region["source_y"] = msgArr[2];
        region["x"] = msgArr[3];
        region["y"] = msgArr[4];
        region["width"] = msgArr[5];
        region["height"] = msgArr[6];
        region["dataSize"] = msgArr[7];


//                console.log("Got region",region);
        this.__currentFrame["regions"].push(region);

        if (!region["source_crc"])
        {
            //read the image data for this region
            this.__bytesReady = 0;
            this.__bytesLeftToRead = region["dataSize"];
            this.__currentDataType = REGIONDATA;
            this.__messageBuffer = 0;
        }
        else
        {
            if (this.__currentFrame["numOfRegions"] == this.__currentFrame["regions"].length)
            {
                //we have all regions
                this.__bytesReady = 0;
                this.renderFrame()
            }
            else
            {
                //read next region
                this.__bytesReady = 0;
                this.__bytesLeftToRead = REGION_SIZE;
                this.__currentDataType = FRAMEREGION;
            }
        }
    }


    initSocket(sockPath, cookie)
    {
        this.__cookie = cookie;
        console.log("Init socket on", sockPath);
        this.__websocket = new WebSocket(sockPath, ['binary']);
        let app = this;
        this.__websocket.onopen = function (evt)
        {
            app.onOpen(evt)
        };
        this.__websocket.onclose = function (evt)
        {
            app.onClose(evt)
        };
        this.__websocket.onmessage = function (evt)
        {
            //app.onMessage(evt)
            app.onNalMessage(evt)
        };
        this.__websocket.onerror = function (evt)
        {
            app.onError(evt)
        };
        this.__websocket.binaryType = 'arraybuffer';
        //this.__websocket.binaryType = 'blob';
    }
}

