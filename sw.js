self.addEventListener(
    "push",
    event => {

        if (!event.data) {
            return;
        }


        let data;


        try {

            data =
                event.data.json();

        } catch {

            data = {
                title:
                    "Incoming Video Call",

                body:
                    "Someone is calling you.",

                url:
                    "/"
            };
        }


        const title =
            data.title ||
            "Incoming Video Call";


        const options = {

            body:
                data.body ||
                "Someone is calling you.",

            icon:
                "/icon-192.png",

            badge:
                "/icon-192.png",

            vibrate: [
                300,
                100,
                300,
                100,
                500
            ],

            requireInteraction:
                true,

            tag:
                "video-call",

            renotify:
                true,

            data: {
                url:
                    data.url ||
                    "/?incoming=1",

                callerRoom:
                    data.callerRoom ||
                    "",

                targetRoom:
                    data.targetRoom ||
                    "",

                callerId:
                    data.callerId ||
                    ""
            },

            actions: [
                {
                    action:
                        "accept",

                    title:
                        "Accept"
                },
                {
                    action:
                        "reject",

                    title:
                        "Reject"
                }
            ]
        };


        event.waitUntil(
            self.registration.showNotification(
                title,
                options
            )
        );
    }
);


// =====================================
// NOTIFICATION CLICK
// =====================================

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        const action =
            event.action;


        const data =
            event.notification.data ||
            {};


        const url =
            data.url ||
            "/?incoming=1";


        event.waitUntil(

            clients.matchAll({
                type:
                    "window",

                includeUncontrolled:
                    true
            }).then(
                windowClients => {

                    for (
                        const client of windowClients
                    ) {

                        if (
                            "focus" in client
                        ) {

                            client.focus();


                            client.postMessage({
                                type:
                                    "call-action",

                                action:
                                    action ||
                                    "open",

                                callerId:
                                    data.callerId ||
                                    "",

                                callerRoom:
                                    data.callerRoom ||
                                    "",

                                targetRoom:
                                    data.targetRoom ||
                                    ""
                            });


                            return;
                        }
                    }


                    if (
                        clients.openWindow
                    ) {

                        return clients.openWindow(
                            url
                        );
                    }
                }
            )
        );
    }
);
