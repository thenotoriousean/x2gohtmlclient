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

class
X2GoDOMController
{
    constructor()
    {
        this.__sepWnd = 0;
        this.__x2goclient = 0;

        this.__clipElement = 0;
        this.__clipElementText = 0;
        this.__clipElementCloseImg = 0;
        this.__clipFocused = false;
        this.__clipOpened =false;
        this.__clipBlobUrl=0;
        this.__clipBlobUrlOutput=0;
        this.__clipBlobOutput=0;
        this.__inputClip=false;
        this.__clipMime=0;
        this.__clipBuffer=0;
        this.__fpsdisplay=0;

        let app = this;
        window.addEventListener("unload", function (e)
        {
            if (app.__sepWnd)
            {
                app.__sepWnd.close();
            }
        });



        document.getElementById("detach").addEventListener("click", function ()
        {
            app.detachSession(app);
        });

        this.__clipElement=document.getElementById("x2goclip");
        this.__clipElementText=document.getElementById("x2goclip_text");
        this.__clipElementCloseImg=document.getElementById("x2goclip_close_img");

        let clb=document.getElementById("close_clip");

        this.initClipElement(this.__clipElementText, clb);


        window.addEventListener("click", function(e){
            if(app.__clipOpened)
            {
                let widg=e.target;
                while(widg)
                {
                    if(widg==app.__clipElement)
                    {
                        //click inside of clip
                        return;
                    }
                    widg=widg.parentNode;
                }
//                console.log("close of click for target:", e.target);
                app.closeClipElement();
            }
        });


        /* let app = this;
         let btn = document.getElementById("fs");
         btn.addEventListener("click", function ()
         {
         if(document.getElementById("canvas").parentElement.requestFullscreen)
         {
         document.getElementById("canvas").parentElement.requestFullscreen();
         document.getElementById("canvas").style.width==window.innerWidth+"px";
         document.getElementById("canvas").style.height==window.innerHeight+"px";
         document.getElementById("canvas").width=window.innerWidth;
         document.getElementById("canvas").height=window.innerHeight;
         document.getElementById("canvas").addEventListener("keydown",function(e)
         {
         if(e.keyCode==27)
         {
         console.log("not exiting fs");
         e.preventDefault();
         return false;
         }
         else
         {
         console.log("key event", e.keyCode);
         }
         }
         )
         }
         });*/

    }


    attachSession(app)
    {
        if (!app.__sepWnd)
        {
            return;
        }
        console.log("back to main Window");
        app.__sepWnd.close();
        app.__sepWnd = 0;
        let cl = app.__x2goclient;
        let c = cl.__kdriveClient;

        document.getElementById("copy_from").style.display="inline-block";
        document.getElementById("copy_to").style.display="inline-block";

        app.updateStatus("<b>" + cl.__sessionID + "</b>");

        app.getCanvas().style.display = "block";
        c.initCanvas(app.getCanvas());
        c.sendGeometryEvent();
        c.__cursor = document.getElementById("x2go_cursor");
        document.getElementById("detach_img").src = asset_path + "detach.png";
        document.getElementById("detach_span").innerText = "New window";


        this.__clipElement=document.getElementById("x2goclip");
        this.__clipElementText=document.getElementById("x2goclip_text");
        this.__clipElementCloseImg=document.getElementById("x2goclip_close_img");
    }

    initWindow(app, wnd)
    {
        if (wnd.document.readyState != "complete")
        {
            //window is not ready, try later
            setTimeout(function ()
            {
                app.initWindow(app, wnd);
            }, 100);
            return;
        }

        let cl = app.__x2goclient;
        let c = cl.__kdriveClient;

        console.log("Window is loaded");
        wnd.document.getElementById("status_cap").innerHTML = "<b>" + cl.__sessionID + "</b>";
        wnd.document.getElementById("suspend").addEventListener("click", function ()
        {
            cl.suspendSession(cl)
        });
        wnd.document.getElementById("terminate").addEventListener("click", function ()
        {
            if (wnd.confirm("Are you sure you want to terminate this session?\nUnsaved documents will be lost."))
            {
                cl.terminateSession(cl)
            }
        });
        wnd.document.getElementById("attach").addEventListener("click", function ()
        {
            app.attachSession(app, wnd)
        });


        document.getElementById("copy_from").style.display="none";
        document.getElementById("copy_to").style.display="none";

        wnd.document.getElementById("copy_from").addEventListener("click", function ()
        {
            c.copyFromServerToSystem();
        });

        wnd.document.getElementById("copy_to").addEventListener("click", function ()
        {
            //send only notification to server
            c.copyFromSystemToServer(true);
        });



        this.__clipElement=wnd.document.getElementById("x2goclip");
        this.__clipElementText=wnd.document.getElementById("x2goclip_text");
        this.__clipElementCloseImg=wnd.document.getElementById("x2goclip_close_img");
        let clb=wnd.document.getElementById("close_clip");

        this.initClipElement(this.__clipElementText, clb);

        wnd.addEventListener("click", function(e){
            if(app.__clipOpened)
            {
                let widg=e.target;
                while(widg)
                {
                    if(widg==app.__clipElement)
                    {
                        //click inside of clip
                        return;
                    }
                    widg=widg.parentNode;
                }
//                console.log("close of click for target:", e.target);
                app.closeClipElement();
            }
        });



        app.getCanvas().style.display = "none";
        wnd.document.title = "X2Go Client - " + app.getName();
        wnd.addEventListener("unload", function (e)
        {
            app.attachSession(app, wnd);
        });
        let cv = wnd.document.getElementById("canvas");
        console.log("new canvas:", cv);
        c.initCanvas(cv);
        c.createCursor(wnd.document, wnd);
        cl.resizeExtCanvas(c, cv, wnd);
        document.getElementById("detach_img").src = asset_path + "attach.png";
        document.getElementById("detach_span").innerText = "This window";
        wnd.addEventListener("resize", function ()
        {
            cl.resizeExtCanvas(c, cv, wnd);
        })
    }

    detachSession(app)
    {
        if (app.__sepWnd)
        {
            app.attachSession(app, app.__sepWnd);
            return;
        }
        let cl = app.__x2goclient;
        app.updateStatus("X2Go session with ID <b>" + cl.__sessionID + "</b> displayed in other window");
        let wnd = window.open("/x2go/x2gokdriveclient.html", "X2Go Client", "toolbar=no,resizable=yes,location=no,menubar=no,status=no,titlebar=no");
        app.__sepWnd = wnd;
        console.log("deatch session to", wnd);
        setTimeout(function ()
        {
            app.initWindow(app, wnd);
        }, 500);
    }


    setStartCallback(obj, start, suspend, terminate)
    {
        this.__x2goclient = obj;
        let app=this;
        document.getElementById("con-btn").addEventListener("click", function ()
        {
            if (!validateForm())
            {
                return;
            }
            document.getElementById("controls").style.display = "none";
            document.getElementById("canvas").style.display = "block";
            start(obj);
        });

        document.getElementById("suspend").addEventListener("click", function ()
        {
            suspend(obj);
        });
        document.getElementById("terminate").addEventListener("click", function ()
        {
            if (confirm("Are you sure you want to terminate this session?\nUnsaved documents will be lost."))
                terminate(obj);
        });

        document.getElementById("copy_from").addEventListener("click", function ()
        {
            obj.__kdriveClient.copyFromServerToSystem();
        });

        document.getElementById("copy_to").addEventListener("click", function ()
        {
            //send only notification to server
            obj.__kdriveClient.copyFromSystemToServer(true);
        });
    }

    initClipElement(elem, closeBut)
    {
        let app=this;
        elem.addEventListener("paste", function (e)
        {
            for(let i=0; i< e.clipboardData.items.length; ++i)
            {
                if(e.clipboardData.items[i].type=="image/png")
                {
                    console.log("Inserting image");
                    app.__clipElementText.innerText= "";
                    if(app.__clipBlobUrlOutput==0)
                    {
                        window.URL.revokeObjectURL(app.__clipBlobUrlOutput);
                    }
                    app.__clipBlobOutput = e.clipboardData.items[i].getAsFile();
                    app.__clipBlobUrlOutput=window.URL.createObjectURL(app.__clipBlobOutput);
                    app.__clipElementText.innerHTML="<img src='"+app.__clipBlobUrlOutput+"'/>";
                    e.stopPropagation();
                    return;
                }
            }
        });
        elem.addEventListener("focus", function(){
            if(!app.__clipFocused)
            {
                app.__clipFocused=true;
                app.__clipElementText.style.color="black";
                app.__clipElementText.innerText= "";
            }
        });


        elem.addEventListener("keyup", function(e) {
            if(e.key === "Escape") {
                app.closeClipElement();
            }
        });

        closeBut.addEventListener("click", function(){
            app.closeClipElement();
            if(!app.__inputClip || ! app.__clipFocused)
            {
                return;
            }
            if(app.__clipBlobUrlOutput && (app.__clipElementText.innerHTML.indexOf(app.__clipBlobUrlOutput)!=-1))
            {
//                console.log("Image in clipboard:",app.__clipBlobUrlOutput);
                app.getBufferFromOutputImage();
            }
            else
            {
                if(app.__clipElementText.innerText.length)
                {
//                    console.log("Text in clipboard:",app.__clipElementText.innerText);
                    app.__clipMime=UTF_STRING;
                    let encoder = new TextEncoder();
                    app.__clipBuffer=encoder.encode(app.__clipElementText.innerText).buffer;
                    app.__x2goclient.__kdriveClient.sendSelNotify(app.__clipMime);
                }
            }
        });
    }

    async getBufferFromOutputImage()
    {
        let app=this;
        app.__clipMime=PIXMAP;
        app.__clipBuffer=await app.__clipBlobOutput.arrayBuffer();
        app.__x2goclient.__kdriveClient.sendSelNotify(app.__clipMime);
    }

    closeClipElement()
    {
        let app=this;
        app.__clipElement.style.opacity = "0";
        app.__clipOpened=false;
        setTimeout(function ()
        {
            app.__clipElement.style.visibility = "hidden";

        }, 300);

    }

    openClipElement(data)
    {
        let app=this;
        this.__clipElement.style.visibility = "visible";
        this.__clipElement.style.opacity = "1";
        if(!data)
        {
            this.__inputClip=true;
            this.__clipFocused=false;
            this.__clipElementCloseImg.src=asset_path + "clip_copy_close.png"
            this.__clipElementText.style.color="grey";
            this.__clipElementText.innerText= "Paste text or image here";
            this.__clipElementText.contentEditable=true;
        }
        else
        {
//            console.log(data);
            this.__inputClip=false;
            this.__clipElementCloseImg.src=asset_path + "clip_close.png"
            this.__clipFocused=true;
            this.__clipElementText.style.color="black";
            if(data.type && data.type=="image/png")
            {
                //revoke previous URL if already have one
                if(app.__clipBlobUrl)
                {
                    window.URL.revokeObjectURL(app.__clipBlobUrl);
                    app.__clipBlobUrl=0;
                }

                app.__clipBlobUrl=window.URL.createObjectURL(data);
                this.__clipElementText.innerHTML="<img src='"+app.__clipBlobUrl+"'/>";

            }
            else
            {
                this.__clipElementText.innerText=data;
            }
            this.__clipElementText.contentEditable=false;
        }
        app.__clipOpened=true;
    }

    showSessionControls(val)
    {
        let disp = "inline";
        if (!val)
        {
            disp = "none";
        }
        document.getElementById("session_control").style.display = disp;
    }

    serverClipNotify(id, text)
    {
        let elem;

        if (this.__sepWnd)
        {
            elem = this.__sepWnd.document.getElementById(id);
        }
        else
        {
            elem = document.getElementById(id);
        }

        elem.innerText = text;
        elem.style.visibility = "visible";
        elem.style.opacity = "1";
        setTimeout(function ()
        {
            elem.style.opacity = "0";
        }, 1000);
        setTimeout(function ()
        {
            elem.style.visibility = "hidden";
        }, 1300);

    }

    updateStatus(text)
    {
//        if(text)
        {
            document.getElementById("status").style.display = "inline";
            document.getElementById("status_cap").innerHTML = text;
        }
        /*        else
         {
         document.getElementById("status").style.display = "none";
         }*/
    }

    reloadForm()
    {
        document.getElementById("controls").style.display = "block";
        document.getElementById("canvas").style.display = "none";
        document.getElementById("status").style.display = "none";
        document.getElementById("pass").focus();
        this.showSessionControls(false);
    }

    getCanvas()
    {
        return document.getElementById("canvas");
    }

    getBackground()
    {
        return asset_path + "x2gobg.svg";
    }


    getProxy()
    {
        return getProxy();
    }

    getProxyUser()
    {
        return getProxyUser();
    }

    getProxyPass()
    {
        return getProxyPass();
    }

    getServer()
    {   
        let srv = getServer();
        if (srv == "__externalIp__")
        {
            console.log("Running in dev mode on localhost");
            return "localhost";
        }
        return srv;
    }


    getUname()
    {
        return getUname();
    }

    getPass()
    {
        return getPass();
    }

    getCommand()
    {
        return getCommand();
    }

    getCompression()
    {
        return getCompression();
    }

    getName()
    {
        return getName();
    }
}
