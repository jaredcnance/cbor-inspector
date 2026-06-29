const api = typeof browser !== "undefined" ? browser : chrome;
api.devtools.panels.create("CBOR", "icon.svg", "panel.html");
