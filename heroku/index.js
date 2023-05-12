/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

var request = require("request");
var bodyParser = require('body-parser');
var express = require('express');
var app = express().use(bodyParser.json());
var xhub = require('express-x-hub');
var axios = require("axios").default;


app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN || 'token';
var whatsapp_accesstoken = process.env.WHATSAPP_ACCESSTOKEN || '';

var received_updates = [];

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

app.get(['/facebook', '/instagram', '/webhook'], function(req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

// Accepts POST requests at /webhook endpoint
app.post('/webhook', function(req, res) {
  // Parse the request body from the POST
  let body = req.body;
  
  console.log('Logging Whatsapp request body: ');
  console.log(body);

  // Check the Incoming webhook message
  console.log('Logging request body in json string: ');
  console.log(JSON.stringify(body, null, 2));

  // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      let phone_number_id =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;
      let from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
      let msg_body = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload
      
      let reply = "sending test message";
      
      if(msg_body.includes("Welcome")){
        reply = "Yes";
      } else if(msg_body == "hi" || msg_body == "hello"){
        reply = "hi, how are you agent?";
      } else if (msg_body == "how can I help?") {
        reply = "Ack: " + msg_body;
      } else if (msg_body == "sure. what is the problem?") {
        reply = "Wifi connection is down";
      } else if (msg_body == "bye") {
        reply = "bbye";
      } else if (msg_body.includes("Conversation") || msg_body.includes("opted")) {
        res.sendStatus(200);
        return;
      }
      
      axios({
        method: "POST", // Required, HTTP method, a string, e.g. POST, GET
        url:
          "https://graph.facebook.com/v15.0/" +
          phone_number_id +
          "/messages?access_token=" +
          whatsapp_accesstoken,
        data: {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        headers: { "Content-Type": "application/json" },
      });
    }
    res.sendStatus(200);
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

app.listen();
