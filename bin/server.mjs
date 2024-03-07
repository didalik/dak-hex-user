#!/usr/bin/env node

/* Many thanks to: {{{1
 * - https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework
 *
 * This file is based on the link above, which has no license. The updates 
 * are subject to:
 *
/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import * as fs from "node:fs"; // {{{1
import * as http from "node:http";
import * as path from "node:path";

const PORT = process.argv[2] // {{{1

const MIME_TYPES = {
  default: "application/octet-stream",
  html: "text/html; charset=UTF-8",
  js: "application/javascript",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpg",
  gif: "image/gif",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

const STATIC_PATH = process.env.STATIC

const toBool = [() => true, () => false];

const prepareFile = async (url) => {
  const paths = [STATIC_PATH, url];
  if (url.endsWith("/")) paths.push("index.html");
  const filePath = path.join(...paths);
  const pathTraversal = !filePath.startsWith(STATIC_PATH);
  const exists = await fs.promises.access(filePath).then(...toBool);
  const found = !pathTraversal && exists;
  const streamPath = found ? filePath : STATIC_PATH + "/404.html";
  const ext = path.extname(streamPath).substring(1).toLowerCase();
  const stream = fs.createReadStream(streamPath);
  return { found, ext, stream };
};

const remote = /\/test\/|\/public\/|\/dynamic\/|\/qa\/|\/poc\// // FIXME

const sleep = ms => new Promise(r => setTimeout(r, ms))

http // {{{1
  .createServer(async (req, res) => {
    let statusCode = 200, mimeType = MIME_TYPES.html
    if (remote.test(req.url)) {
      res.writeHead(statusCode, { "Content-Type": mimeType })
      console.log(`{"request":{"method":"${req.method}","url":"${req.url}"}}`)
      process.stdin.pipe(res, { end: false })
      process.stdin.on('end', async _ => { // FIXME on macOS
        res.end()
        await sleep(1000)
        process.exit()
      })
    } else { // serve local file from under ./static dir
      const file = await prepareFile(req.url);
      statusCode = file.found ? 200 : 404;
      mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
      req.url == '/favicon.ico' && res.writeHead(statusCode) || res.writeHead(statusCode, { "Content-Type": mimeType });
      file.stream.pipe(res);
    }
    req.url != '/favicon.ico' && console.error(`${req.method} ${req.url} ${statusCode}`);
  })
  .listen(PORT, _ => console.error(`Server running at http://127.0.0.1:${PORT}/`));

/* More thanks: {{{1
 * - https://jonlinnell.co.uk/articles/node-stdin
 *
 * * */
