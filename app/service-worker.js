/**
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

// DO NOT EDIT THIS GENERATED OUTPUT DIRECTLY!
// This file should be overwritten as part of your build process.
// If you need to extend the behavior of the generated service worker, the best approach is to write
// additional code and include it using the importScripts option:
//   https://github.com/GoogleChrome/sw-precache#importscripts-arraystring
//
// Alternatively, it's possible to make changes to the underlying template file and then use that as the
// new base for generating output, via the templateFilePath option:
//   https://github.com/GoogleChrome/sw-precache#templatefilepath-string
//
// If you go that route, make sure that whenever you update your sw-precache dependency, you reconcile any
// changes made to this original template file with your modified copy.

// This generated service worker JavaScript will precache your site's resources.
// The code needs to be saved in a .js file at the top-level of your site, and registered
// from your pages in order to be used. See
// https://github.com/googlechrome/sw-precache/blob/master/demo/app/js/service-worker-registration.js
// for an example of how you can register this script and handle various service worker events.

/* eslint-env worker, serviceworker */
/* eslint-disable indent, no-unused-vars, no-multiple-empty-lines, max-nested-callbacks, space-before-function-paren, quotes, comma-spacing */
'use strict';

var precacheConfig = [["FiraCode.ttf","fa1f8c8961adca519738d9518139579c"],["FixedSys.ttf","43cc87e8f9adba81b9d63b6e2d15db57"],["Inconsolata.ttf","b0639eb725c0df94f68b779889679457"],["Monoid.ttf","9b27db986ad2a74c522e9d3b6f7e2a63"],["animation/10s.gif","36ad6e1df99af289c2f23963e44c11bd"],["animation/open-up-stage.gif","a299382c43208809e1cd05de5b217ccb"],["assets/advanced-icon.png","784c0014f70f2dee7989848b29aa1f9c"],["assets/basic-icon.png","184ca7e5a4be8df84fd5699f776975be"],["assets/html5-logo.svg","1f4630ca7f4e95a6cb2c95d3ac3e7947"],["assets/js13kgames-square-logo.png","7c1400c0a7fd6b771b8cb0c6d9602f03"],["assets/js13kgames.png","cf8232690591545e25afe952ada8fdeb"],["assets/patreon.png","8b4321f782e84764e556af3dee32a131"],["assets/preact-logo.svg","a5caf9d0b043afe6c9becc28a7b5d2fc"],["assets/react-logo.svg","7aad7eb173190c5fc9dcf1882c92fa07"],["assets/star-icon.png","c768d6788e2fcd10c74d2575c5ae7fbb"],["assets/vue-logo.svg","61dba046a20cb30b344c4c0ec9777dbb"],["bundle.6afa2.js","0923ae93d4f4389285d9b3af5c6ceb2e"],["detached-window.js","e94ff3192986df74b878246a3268566a"],["icon-48.png","d8b84ed54fff85c852cf1f54259a572c"],["icons/icon-128x128.png","bfdc132184384bf5bf6cf34835cbce20"],["icons/icon-144x144.png","252be3837441f79208237747f9174af2"],["icons/icon-152x152.png","d1767dc31f2185979739273633468373"],["icons/icon-192x192.png","e6150ca4a84d684e02ee60cc2708131f"],["icons/icon-384x384.png","056a746d18fa943ea1a773325559d671"],["icons/icon-512x512.png","13e470b61e539649e0567687c597c792"],["icons/icon-72x72.png","f336e8ae87d17759eb3235a9186e6e7b"],["icons/icon-96x96.png","259cc1f173cf5e8bdbff4b84e1193b89"],["index.html","cf1b4a296c58392a5bf88161c627ab8f"],["lib/codemirror/mode/coffeescript/coffeescript.js","2fd62fcddfe25dcbd6350b939816afb4"],["lib/codemirror/mode/css/css.js","7436a26e66a157922d25e11d3ddb0c87"],["lib/codemirror/mode/css/gss.html","f984d854a1b531d10f33ba77417222bb"],["lib/codemirror/mode/css/gss_test.js","28e904088454a38b89cda0b3f9712172"],["lib/codemirror/mode/css/less.html","ab02b2ae472dcd4db340cef9789c865d"],["lib/codemirror/mode/css/scss.html","06ef3102d764fcb015aa5eaa6727d210"],["lib/codemirror/mode/haml/haml.js","e3de0ff5f3c1cb02e24f605d43680b9f"],["lib/codemirror/mode/htmlembedded/htmlembedded.js","2f092a16c37ca1527ea69c71c6d4aa22"],["lib/codemirror/mode/htmlmixed/htmlmixed.js","dff574f49ec0a6153d2415fcd64d0f64"],["lib/codemirror/mode/javascript/javascript.js","1cefabc638a206c43a978f303ddbfc34"],["lib/codemirror/mode/javascript/json-ld.html","a1d49489ee5f2c9d4a602a0d4f8ef479"],["lib/codemirror/mode/javascript/typescript.html","92e3fd696a6f697c2c7a549473f548e6"],["lib/codemirror/mode/jsx/jsx.js","a21721da020edcc8078c1d1d57bfeaa8"],["lib/codemirror/mode/markdown/markdown.js","eecead8a6aca738337998e8da39337ba"],["lib/codemirror/mode/meta.js","6e761b0f96985d02ee4cf28d00a084da"],["lib/codemirror/mode/pug/pug.js","c415c8d9faa5314c5ca77d7b52353731"],["lib/codemirror/mode/sass/sass.js","263c20da6731aa5afc5038026f500797"],["lib/codemirror/mode/stylus/stylus.js","42d7c80c998c5dc45e6edd7d5b434ee5"],["lib/codemirror/mode/xml/xml.js","e31cbb0ce98a21593c39706b9beee639"],["lib/codemirror/theme/3024-day.css","30db765285b89203ab8906dd85d9e513"],["lib/codemirror/theme/3024-night.css","d75e8c39aedd3de2c57e8014824fc9b4"],["lib/codemirror/theme/abcdef.css","d9669dcd203b3d23672b09f20f613b0f"],["lib/codemirror/theme/ambiance-mobile.css","a96afed4fb30aaa2827be1e687a806bb"],["lib/codemirror/theme/ambiance.css","7f12b039abfb4781286de79d04c8d351"],["lib/codemirror/theme/base16-dark.css","446d2349da4f656a6a0a4768b43c4788"],["lib/codemirror/theme/base16-light.css","9f59a3bc4b00b1aba7a66e1ab72aac7a"],["lib/codemirror/theme/base2tone-meadow-dark.css","1b12d556992a22b4ec2fbafb27a0da4b"],["lib/codemirror/theme/bespin.css","d482df8a8cbf551e21cb400816bb63b2"],["lib/codemirror/theme/blackboard.css","2151ba7aa367605ab258cc470405ecc8"],["lib/codemirror/theme/cobalt.css","9ff81e7c2b7c00e60b55c58a9704ebd1"],["lib/codemirror/theme/colorforth.css","8ee531dbb10cc004ab5bcb7e7503a1e6"],["lib/codemirror/theme/dracula.css","05bb9b5ff594c36400c764ef623d91e1"],["lib/codemirror/theme/duotone-dark.css","7fe9f15d5c33c151fe08265e38dc9de0"],["lib/codemirror/theme/duotone-light.css","1b0c49e3b6c236a23c8a01c14bdbbf62"],["lib/codemirror/theme/eclipse.css","7107af240007207ce6719d6cbc5aa39c"],["lib/codemirror/theme/elegant.css","c377166cd76e7bbfe2eacad2704212ab"],["lib/codemirror/theme/erlang-dark.css","b81ea4fc3e9f486b4230efd04a73a390"],["lib/codemirror/theme/hopscotch.css","605e52168e993f05335aad564649ce8c"],["lib/codemirror/theme/icecoder.css","7bc0467092f7d80087c663d8f591aef7"],["lib/codemirror/theme/isotope.css","225942c4693a19cf745d490d6f0115c1"],["lib/codemirror/theme/lesser-dark.css","f268af786cb3e75f7566c1cc490e5f37"],["lib/codemirror/theme/liquibyte.css","eea6cde1d3603c844952d3494f09d975"],["lib/codemirror/theme/material.css","ad9635dc695bcc9517b228332d352565"],["lib/codemirror/theme/mbo.css","b4ba836e7dc6e7ae3268e2c79696ac5a"],["lib/codemirror/theme/mdn-like.css","24753c2d5638f9ffd574a7d1b324ba29"],["lib/codemirror/theme/midnight.css","fcc190eb7635ce2f5f04cbd603e032d0"],["lib/codemirror/theme/monokai.css","5e805fd493cce35ade2b0c707d5ea5af"],["lib/codemirror/theme/neat.css","f8f8e2d696b44ff431220ba79a1c87fd"],["lib/codemirror/theme/neo.css","b5e345f9d35d0cf0c05486da39bdfec7"],["lib/codemirror/theme/night.css","64bb9835a6a3abc1e20ac09123665bb1"],["lib/codemirror/theme/panda-syntax.css","88dc8e98d3532f1db32e005d7b2fece6"],["lib/codemirror/theme/paraiso-dark.css","9acfcc04e671bc9a47dd918cdfc30c95"],["lib/codemirror/theme/paraiso-light.css","3b01cde07347ad7919528dc6e27fc9fa"],["lib/codemirror/theme/pastel-on-dark.css","7a64f857dde7c3d393d08779fd16289f"],["lib/codemirror/theme/railscasts.css","aa6698470a18b85731f4aadab930284b"],["lib/codemirror/theme/rubyblue.css","ae6dd65492dd7945bda9c7f14064e94a"],["lib/codemirror/theme/seti.css","25a35901267d8535f15077acd49e420c"],["lib/codemirror/theme/solarized dark.css","9b2282b2f1b73268e8331baf94845c68"],["lib/codemirror/theme/solarized light.css","9b2282b2f1b73268e8331baf94845c68"],["lib/codemirror/theme/the-matrix.css","15ef7417c9c4e96d982967a22f938201"],["lib/codemirror/theme/tomorrow-night-bright.css","7ec90bd60d58fa4965aba00351b091e2"],["lib/codemirror/theme/tomorrow-night-eighties.css","b22266876fadf81f73fb81ea320b5c10"],["lib/codemirror/theme/ttcn.css","6abd7bbd173c1f5449c0ae133e68da79"],["lib/codemirror/theme/twilight.css","2c314a8cfde74700ae8199bc93089989"],["lib/codemirror/theme/vibrant-ink.css","8e916906d6da1791bb1023f3629ecc37"],["lib/codemirror/theme/xq-dark.css","504839642e276c3357be8deffd56a72c"],["lib/codemirror/theme/xq-light.css","4f89e5076db298e2fa752a1626bee622"],["lib/codemirror/theme/yeti.css","b0c2f1f65f23fc981149ede5bbeea1a9"],["lib/codemirror/theme/zenburn.css","c1d673b4567944839400ecb8cf2e1cc6"],["lib/gtm.js","abbd3989a842e608f9777776654f0c1e"],["lib/paddle.js","efa1f57da925d5833beeb46ed22f2c37"],["lib/prettier-worker.js","74fb55d8c84d20af814bcfd71d0f844b"],["lib/prettier/parser-babylon.js","c29a62ec0700a2d3c28b1291c277fade"],["lib/prettier/parser-html.js","f57d01a39cd36a3bfb71169475277e61"],["lib/prettier/parser-postcss.js","7198a258311de8ab6dfe4ad5f45ea538"],["lib/prettier/standalone.js","7aed2660b4fdeb5dfdd486d238719d01"],["lib/screenlog.js","974cb1ec0473b11ae4834028c1820816"],["lib/transpilers/atomizer.browser.js","3dfba9fa54353d3fdaa9ec3720724266"],["lib/transpilers/babel-polyfill.min.js","d875a5e2d3e6a5c0178cf7553edbea27"],["lib/transpilers/babel.min.js","0d337f556e9037bb1b619d7c78af13be"],["lib/transpilers/coffee-script.js","bc8c6dbc4863f369323e35691b6b8b0f"],["lib/transpilers/jade.js","d6ee4657480d88dc5f32458e3e46f506"],["lib/transpilers/less.min.js","36841241b98a435709a1e629e81c0393"],["lib/transpilers/marked.js","1ef6a449919c3c6b1277920c779ea9ed"],["lib/transpilers/sass.js","11b8ec8e3694e67c2112634be1bc3c82"],["lib/transpilers/sass.worker.js","f989d3795c59e686d10fdb4bb2fbb6bd"],["lib/transpilers/stylus.min.js","715f9571f2984604c262e2ff8f11ac74"],["lib/transpilers/typescript.js","542c31971659ea8c8e7cbe9153e1f145"],["lib/vue-sequence-bundle.0e8cea35150ecb935947.js","d6aa046309385a5265ec8aa904295250"],["lib/vue-sequence-bundle.1a696d822fffe3552b25.js","566451098f4252a0a350cf8f7022b91e"],["lib/vue-sequence-bundle.a7936022fadd796b54d2.js","c8dbc197ec846a53df1bbfd72360ada5"],["lib/vue-sequence-bundle.f0877a50a5fb0dd7b839.js","74033c0efe5cf6e9b1f5f31febf0ba4c"],["lib/vue-sequence-ext.css","bcec62214855ae9c0aea01708b11c012"],["polyfills.716bb.js","64365e7a4dd822a60edcd613b10a0b6b"],["preview.html","17d3e9f03f1c7af74ef666fd53767d40"],["privacy-policy/index.html","fd8f83e6511179eeef6253bcae835124"],["style-170f742dbe5b4f17d2fff6deeeadc656.css","170f742dbe5b4f17d2fff6deeeadc656"],["style-2fc5f9b0e96536f80bdd884e8a9e0315.css","6e942d6a129a23b21680867c1a7d8e0e"],["vendor.css","a9718df6aa24003c61661679bcbefb55"]];
var cacheName = 'sw-precache-v3--' + (self.registration ? self.registration.scope : '');


var ignoreUrlParametersMatching = [/^utm_/];



var addDirectoryIndex = function(originalUrl, index) {
    var url = new URL(originalUrl);
    if (url.pathname.slice(-1) === '/') {
      url.pathname += index;
    }
    return url.toString();
  };

var cleanResponse = function(originalResponse) {
    // If this is not a redirected response, then we don't have to do anything.
    if (!originalResponse.redirected) {
      return Promise.resolve(originalResponse);
    }

    // Firefox 50 and below doesn't support the Response.body stream, so we may
    // need to read the entire body to memory as a Blob.
    var bodyPromise = 'body' in originalResponse ?
      Promise.resolve(originalResponse.body) :
      originalResponse.blob();

    return bodyPromise.then(function(body) {
      // new Response() is happy when passed either a stream or a Blob.
      return new Response(body, {
        headers: originalResponse.headers,
        status: originalResponse.status,
        statusText: originalResponse.statusText
      });
    });
  };

var createCacheKey = function(originalUrl, paramName, paramValue,
                           dontCacheBustUrlsMatching) {
    // Create a new URL object to avoid modifying originalUrl.
    var url = new URL(originalUrl);

    // If dontCacheBustUrlsMatching is not set, or if we don't have a match,
    // then add in the extra cache-busting URL parameter.
    if (!dontCacheBustUrlsMatching ||
        !(url.pathname.match(dontCacheBustUrlsMatching))) {
      url.search += (url.search ? '&' : '') +
        encodeURIComponent(paramName) + '=' + encodeURIComponent(paramValue);
    }

    return url.toString();
  };

var isPathWhitelisted = function(whitelist, absoluteUrlString) {
    // If the whitelist is empty, then consider all URLs to be whitelisted.
    if (whitelist.length === 0) {
      return true;
    }

    // Otherwise compare each path regex to the path of the URL passed in.
    var path = (new URL(absoluteUrlString)).pathname;
    return whitelist.some(function(whitelistedPathRegex) {
      return path.match(whitelistedPathRegex);
    });
  };

var stripIgnoredUrlParameters = function(originalUrl,
    ignoreUrlParametersMatching) {
    var url = new URL(originalUrl);
    // Remove the hash; see https://github.com/GoogleChrome/sw-precache/issues/290
    url.hash = '';

    url.search = url.search.slice(1) // Exclude initial '?'
      .split('&') // Split into an array of 'key=value' strings
      .map(function(kv) {
        return kv.split('='); // Split each 'key=value' string into a [key, value] array
      })
      .filter(function(kv) {
        return ignoreUrlParametersMatching.every(function(ignoredRegex) {
          return !ignoredRegex.test(kv[0]); // Return true iff the key doesn't match any of the regexes.
        });
      })
      .map(function(kv) {
        return kv.join('='); // Join each [key, value] array into a 'key=value' string
      })
      .join('&'); // Join the array of 'key=value' strings into a string with '&' in between each

    return url.toString();
  };


var hashParamName = '_sw-precache';
var urlsToCacheKeys = new Map(
  precacheConfig.map(function(item) {
    var relativeUrl = item[0];
    var hash = item[1];
    var absoluteUrl = new URL(relativeUrl, self.location);
    var cacheKey = createCacheKey(absoluteUrl, hashParamName, hash, false);
    return [absoluteUrl.toString(), cacheKey];
  })
);

function setOfCachedUrls(cache) {
  return cache.keys().then(function(requests) {
    return requests.map(function(request) {
      return request.url;
    });
  }).then(function(urls) {
    return new Set(urls);
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return setOfCachedUrls(cache).then(function(cachedUrls) {
        return Promise.all(
          Array.from(urlsToCacheKeys.values()).map(function(cacheKey) {
            // If we don't have a key matching url in the cache already, add it.
            if (!cachedUrls.has(cacheKey)) {
              var request = new Request(cacheKey, {credentials: 'same-origin'});
              return fetch(request).then(function(response) {
                // Bail out of installation unless we get back a 200 OK for
                // every request.
                if (!response.ok) {
                  throw new Error('Request for ' + cacheKey + ' returned a ' +
                    'response with status ' + response.status);
                }

                return cleanResponse(response).then(function(responseToCache) {
                  return cache.put(cacheKey, responseToCache);
                });
              });
            }
          })
        );
      });
    }).then(function() {
      
      // Force the SW to transition from installing -> active state
      return self.skipWaiting();
      
    })
  );
});

self.addEventListener('activate', function(event) {
  var setOfExpectedUrls = new Set(urlsToCacheKeys.values());

  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return cache.keys().then(function(existingRequests) {
        return Promise.all(
          existingRequests.map(function(existingRequest) {
            if (!setOfExpectedUrls.has(existingRequest.url)) {
              return cache.delete(existingRequest);
            }
          })
        );
      });
    }).then(function() {
      
      return self.clients.claim();
      
    })
  );
});


self.addEventListener('fetch', function(event) {
  if (event.request.method === 'GET') {
    // Should we call event.respondWith() inside this fetch event handler?
    // This needs to be determined synchronously, which will give other fetch
    // handlers a chance to handle the request if need be.
    var shouldRespond;

    // First, remove all the ignored parameters and hash fragment, and see if we
    // have that URL in our cache. If so, great! shouldRespond will be true.
    var url = stripIgnoredUrlParameters(event.request.url, ignoreUrlParametersMatching);
    shouldRespond = urlsToCacheKeys.has(url);

    // If shouldRespond is false, check again, this time with 'index.html'
    // (or whatever the directoryIndex option is set to) at the end.
    var directoryIndex = 'index.html';
    if (!shouldRespond && directoryIndex) {
      url = addDirectoryIndex(url, directoryIndex);
      shouldRespond = urlsToCacheKeys.has(url);
    }

    // If shouldRespond is still false, check to see if this is a navigation
    // request, and if so, whether the URL matches navigateFallbackWhitelist.
    var navigateFallback = '';
    if (!shouldRespond &&
        navigateFallback &&
        (event.request.mode === 'navigate') &&
        isPathWhitelisted([], event.request.url)) {
      url = new URL(navigateFallback, self.location).toString();
      shouldRespond = urlsToCacheKeys.has(url);
    }

    // If shouldRespond was set to true at any point, then call
    // event.respondWith(), using the appropriate cache key.
    if (shouldRespond) {
      event.respondWith(
        caches.open(cacheName).then(function(cache) {
          return cache.match(urlsToCacheKeys.get(url)).then(function(response) {
            if (response) {
              return response;
            }
            throw Error('The cached response that was expected is missing.');
          });
        }).catch(function(e) {
          // Fall back to just fetch()ing the request if some unexpected error
          // prevented the cached response from being valid.
          console.warn('Couldn\'t serve response for "%s" from cache: %O', event.request.url, e);
          return fetch(event.request);
        })
      );
    }
  }
});







