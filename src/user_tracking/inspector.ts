/*
BSD 2-Clause License

Copyright (c) 2016, Benjamin Cordier
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// eslint-disable-next-line no-var
class Interactor {
  interactions: boolean;
  interactionElement: string;
  interactionEvents: string[];
  conversions: boolean;
  conversionElement: string;
  conversionEvents: string[];
  endpoint: string;
  async: boolean;
  debug: boolean;
  records: any[];
  session: { [key: string]: any };
  loadTime: Date;

  constructor(n: any) {
    this.interactions = typeof n.interactions !== "boolean" || n.interactions;
    this.interactionElement =
      typeof n.interactionElement === "string"
        ? n.interactionElement
        : "interaction";
    this.interactionEvents = Array.isArray(n.interactionEvents)
      ? n.interactionEvents
      : ["mouseup", "touchend"];
    this.conversions = typeof n.conversions !== "boolean" || n.conversions;
    this.conversionElement =
      typeof n.conversionElement === "string"
        ? n.conversionElement
        : "conversion";
    this.conversionEvents = Array.isArray(n.conversionEvents)
      ? n.conversionEvents
      : ["mouseup", "touchend"];
    this.endpoint =
      typeof n.endpoint === "string" ? n.endpoint : "/interactions";
    this.async = typeof n.async !== "boolean" || n.async;
    this.debug = typeof n.debug !== "boolean" || n.debug;
    this.records = [];
    this.session = {};
    this.loadTime = new Date();
    this.initializeSession();
    this.bindEvents();
  }

  bindEvents() {
    if (this.interactions) {
      for (let e = 0; e < this.interactionEvents.length; e++) {
        document
          ?.querySelector("body")
          ?.addEventListener(this.interactionEvents[e], (event) => {
            event.stopPropagation();
            // Make sure that we only access vents that have a target with classList
            const eventTarget = event.target as HTMLElement;
            if (eventTarget?.classList.value === this.interactionElement) {
              this.addInteraction(e, "interaction");
            }
          });
      }
    }

    if (this.conversions) {
      for (let e = 0; e < this.conversionEvents.length; e++) {
        document
          ?.querySelector("body")
          ?.addEventListener(this.conversionEvents[e], (event) => {
            event.stopPropagation();
            const eventTarget = event.target as HTMLElement;
            if (eventTarget?.classList.value === this.conversionElement) {
              this.addInteraction(e, "conversion");
            }
          });
      }
    }

    window.onbeforeunload = () => {
      this.sendInteractions();
    };
  }

  addInteraction(n: any, e: string) {
    const i = {
      type: e,
      event: n.type,
      targetTag: n.target.nodeName,
      targetClasses: n.target.className,
      content: n.target.innerText,
      clientPosition: { x: n.clientX, y: n.clientY },
      screenPosition: { x: n.screenX, y: n.screenY },
      createdAt: new Date(),
    };
    this.records.push(i);
    if (this.debug) {
      this.closeSession();
      console.log("Session:\n", this.session);
    }
  }

  initializeSession() {
    this.session = {
      loadTime: this.loadTime,
      unloadTime: new Date(),
      language: window.navigator.language,
      platform: window.navigator.platform,
      port: window.location.port,
      clientStart: {
        name: window.navigator.appVersion,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
      },
      page: {
        location: window.location.pathname,
        href: window.location.href,
        origin: window.location.origin,
        title: document.title,
      },
      endpoint: this.endpoint,
    };
  }

  closeSession() {
    this.session.unloadTime = new Date();
    this.session.interactions = this.records;
    this.session.clientEnd = {
      name: window.navigator.appVersion,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
    };
  }

  sendInteractions() {
    const e = new XMLHttpRequest();
    this.closeSession();
    e.open("POST", this.endpoint, this.async);
    e.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    e.send(JSON.stringify(this.session));
  }
}

export default Interactor;
