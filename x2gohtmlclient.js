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

var X2GOClientVersion = "1.0";

class
X2GoHTMLClient
{

    constructor()
    {
        this.__sessionID = "";
        console.log("X2Go HTML Client v. ", X2GOClientVersion);
        this.__domController = new X2GoDOMController();
        this.__kdriveClient = new X2GoKDriveHTMLClient(this.__domController.getCanvas(),
            this.__domController.getBackground(), this);

        this.__domController.setStartCallback(this, this.startX2GoConnection, this.suspendSession,
            this.terminateSession);

    }

    startXHRRequest(app, request, callback)
    {
        let controller = app.__domController;
        let xhr = new XMLHttpRequest();
        xhr.open("POST", RPC_path, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onreadystatechange = function ()
        {
            if (this.readyState === XMLHttpRequest.DONE && this.status != 200)
            {
                console.log("Error", this);
                alert("Error executing RPC, please contact your administrator for support");
                controller.reloadForm();
            }
            if (this.readyState === XMLHttpRequest.DONE && this.status === 200)
            {
                console.log(this);
                console.log(this.response);

                let jsonSep='__STARTJSON__{';
                let resp = JSON.parse(this.response.substr(this.response.indexOf(jsonSep)+jsonSep.length-1));
                console.log(resp);
                if (resp.status != 0)
                {
                    console.log("SSH exited with error:", resp.stderr);
                    alert("Failed to connect to server, please check your login data\n" + "Error message: " + resp.err);
                    controller.reloadForm();
                }
                else
                {
                    callback(resp);
                }
            }
        }
        xhr.send(request);
    }


    wserr()
    {
        let controller = this.__domController;
        alert("Error openning web socket, please try again");
        controller.reloadForm();
    }

    wsopen()
    {
        let controller = this.__domController;
        controller.updateStatus("<b>" + this.__sessionID + "</b>");
        controller.showSessionControls(true);
    }

    wsclose()
    {
        let controller = this.__domController;
        let app = this;
        controller.attachSession(controller);
        alert("Connection is closed");
        controller.reloadForm();
    }

    startX2GoConnection(app)
    {
        let d = app.__domController;
        let c = app.__kdriveClient;

        d.updateStatus("Connecting as <b>" + d.getUname() + "</b> to <b>" + d.getServer() + "</b>...");
        app.startXHRRequest(app,
            "action=start&user=" + d.getUname() + "&pass=" + d.getPass() + "&proxy=" + d.getProxy() +
                "&server=" + d.getServer() + "&cmd=" +
                d.getCommand() + "&geometry=" + c.getGeometry() + "&compression=" + d.getCompression() +
                "&proxyuser=" + d.getProxyUser() + "&proxypass=" + d.getProxyPass(), function (resp)
            {

                if (resp.stdout.indexOf("X2GORUNCOMMAND ERR NOEXEC") != -1)
                {
                    let cmd = resp.stdout;
                    cmd = cmd.replace("X2GORUNCOMMAND ERR NOEXEC", "");
                    cmd = cmd.replace("\n", "");
                    cmd = cmd.replace(":", "");
                    console.log(resp.stdout);
                    console.log("Err not found:", cmd);
                    alert("It looks like " + d.getCommand() + "(" + cmd + ") is not installed on the " + d.getServer() +
                        "\nplease install it or try different kind of session");
                }

                app.__sessionID = resp.session.id;
                if (!app.__sessionID)
                {
                    alert("It looks like X2Go Server is not installed or broken on the " + d.getServer() +
                        "\nplease install it if you want to open X2Go connection");

                }
                d.updateStatus("resuming X2Go session with ID <b>" + resp.session.id + "</b>");
                c.initSocket("wss://" + window.location.hostname + "/x2gows/" + resp.session.wsport,
                    resp.session.cookie);
            });
        c.renderBackground();
    }

    suspendSession(app)
    {
        let d = app.__domController;
        d.attachSession(d);
        console.log("Suspending session ", app.__sessionID, " on ", d.getServer());
        d.updateStatus("suspending X2Go session with ID <b>" + app.__sessionID + "</b>");
        app.startXHRRequest(app, "action=suspend&sid=" + app.__sessionID + "&user=" + d.getUname() + "&pass=" + d.getPass() +
            "&proxy=" + d.getProxy() + "&server=" + d.getServer() + "&proxyuser=" + d.getProxyUser() +
            "&proxypass=" + d.getProxyPass(), function ()
        {
        });

    }

    selectionNotify(id,text)
    {
        this.__domController.serverClipNotify(id,text);
    }

    terminateSession(app)
    {
        let d = app.__domController;
        d.attachSession(d);
        console.log("Terminating session ", app.__sessionID, " on ", d.getServer());
        d.updateStatus("terminating X2Go session with ID <b>" + app.__sessionID + "</b>");
        app.startXHRRequest(app, "action=terminate&sid=" + app.__sessionID + "&user=" + d.getUname() + "&pass=" + d.getPass() +
            "&proxy=" + d.getProxy() + "&server=" + d.getServer() + "&proxyuser=" + d.getProxyUser() +
            "&proxypass=" + d.getProxyPass(), function ()
        {
        });
    }

    resizeExtCanvas(c, cv, wnd)
    {
        let width = wnd.document.body.clientWidth - 20;
        let height = wnd.document.body.clientHeight - cv.offsetTop - 20;

        cv.width = width;
        cv.style.width = width + "px";

        cv.style.height = height + "px";
        cv.height = height;
        c.sendGeometryEvent();
    }

    updateDOMFPS(count){
        this.__domController.updateFPS(count);
    }


}

function main()
{
//    console.log(window.location.href);
//    console.log("starting main function");
    let client = new X2GoHTMLClient();
}

main();
