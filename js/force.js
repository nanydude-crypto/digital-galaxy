(function () {
  try {
    // --- hard fails we want to see loudly ---
    if (!window.d3) throw new Error("D3 not loaded (check CDN or use local d3.v3.min.js)");
    if (!window.spiderJson) throw new Error("spiderJson not loaded (spider.js missing?)");

    var width = 800, height = 600;

    // ---- helpers ----
    function hostOf(u) {
      var a = document.createElement('a'); a.href = u;
      var h = (a.hostname || '').toLowerCase();
      return h.indexOf('www.') === 0 ? h.slice(4) : h;
    }
    function pageKey(u) {
      var a = document.createElement('a'); a.href = u;
      var h = hostOf(u);
      var p = (a.pathname || '/').replace(/\/+$/, '');
      return h + p;
    }
    function canon(u) { return (u || '').replace(/\/+$/, ''); }


























        // Helper: turn a full URL into a "pageKey" like "bearparade.com/foo/bar"
    function urlToPageKey(u) {
      var a = document.createElement('a'); a.href = u || '';
      var host = (a.hostname || '').toLowerCase();
      if (host.indexOf('www.') === 0) host = host.slice(4);
      var path = (a.pathname || '/').replace(/\/+$/, '');
      return host + path;
    }








    // ---- overlay (gallery) ----
    function showGalleryForNode(d) {
      window.__lastNode = d; // handy for console
      var pk = pageKey(d.url);

      var byPage = window.imagesByPageKey || {};
      var pageImgs = byPage[pk] || [];

      var host = hostOf(d.url);
      var byHost = window.imagesByHost || {};
      var hostImgs = byHost[host] || byHost['www.' + host] || [];
      var imgs = pageImgs.length ? pageImgs : hostImgs;

      var ov = document.getElementById('overlay');
      var grid = document.getElementById('ov-grid');
      var heroBox = document.getElementById('ov-hero');
      var title = document.getElementById('ov-title');
      var openBtn = document.getElementById('ov-open');
      var textBox = document.getElementById('ov-text');






            // --- URL bar in the popup header ---
      var urlBar = document.getElementById('ov-url');
      if (!urlBar) {
        urlBar = document.createElement('a');
        urlBar.id = 'ov-url';
        urlBar.className = 'ov-url';
        // place it just before the Open button if possible
        if (openBtn && openBtn.parentNode) {
          openBtn.parentNode.insertBefore(urlBar, openBtn);
        } else if (title && title.parentNode) {
          title.parentNode.appendChild(urlBar);
        } else {
          ov.appendChild(urlBar);
        }

        // optional tiny copy button
        var copyBtn = document.getElementById('ov-copy');
        if (!copyBtn) {
          copyBtn = document.createElement('button');
          copyBtn.id = 'ov-copy';
          copyBtn.className = 'ov-copy';
          copyBtn.textContent = 'Copy';
          copyBtn.title = 'Copy URL';
          copyBtn.onclick = function(e){
            e.stopPropagation();
            if (navigator.clipboard) navigator.clipboard.writeText(urlBar.href);
          };
          urlBar.parentNode.insertBefore(copyBtn, openBtn || null);
        }
      }
      // update on every open
      urlBar.href = d.url;
      urlBar.target = '_blank';
      urlBar.rel = 'noopener';
      urlBar.textContent = d.url;   // full URL shown; hover shows full too
      urlBar.title = d.url;






































      if (!ov || !grid || !title || !openBtn) return;

      title.textContent = (pageImgs.length ? 'Page images' : 'Host images') + ' — ' + imgs.length + (imgs.length === 1 ? ' file' : ' files');
      openBtn.onclick = function () { window.open(d.url, '_blank'); };

      heroBox.innerHTML = '';
      var heroMap = window.heroByPage || {};
      var colorMap = window.heroColorByPage || {};
      var hero = heroMap[d.url] || heroMap[canon(d.url)];
      var color = colorMap[d.url] || colorMap[canon(d.url)];

      if (hero) {
        var hi = new Image();
        hi.loading = 'lazy'; hi.src = hero; hi.title = hero;
        hi.onclick = function (e) { window.open(hero, '_blank'); e.stopPropagation(); };
        heroBox.appendChild(hi);
      }
      if (color) {
        var chip = document.createElement('div');
        chip.className = 'colorchip';
        chip.title = 'Background color: ' + color;
        chip.setAttribute('data-color', color);
        chip.style.background = color;
        chip.onclick = function (e) {
          if (navigator.clipboard) navigator.clipboard.writeText(color).catch(function(){});
          e.stopPropagation();
        };
        heroBox.appendChild(chip);
      }
      heroBox.style.display = (hero || color) ? 'block' : 'none';

      grid.innerHTML = '';
      var seen = new Set(hero ? [hero] : []);
      if (!imgs.length) {
        var p = document.createElement('p');
        p.style.padding = '12px'; p.textContent = 'No local images found for this page or host.';
        grid.appendChild(p);
      } else {
        imgs.forEach(function (pth) {
          if (seen.has(pth)) return;
          var img = new Image();
          img.loading = 'lazy'; img.src = pth; img.title = pth;
          img.onclick = function (e) { window.open(pth, '_blank'); e.stopPropagation(); };
          grid.appendChild(img);
          seen.add(pth);
        });
      }

      textBox.innerHTML = '';
      var txt = (window.textByPageKey || {})[pk];
      if (window.__debugText) {
        console.log('Text lookup for URL:', d.url, 'key:', pk, 'found:', !!txt);
      }
      if (txt && (txt.text || txt.title)) {
        var h3 = document.createElement('h3'); h3.textContent = txt.title || 'Page Content';
        var textContent = document.createElement('div'); textContent.className = 'text-content'; textContent.textContent = txt.text || '';
        textBox.appendChild(h3); textBox.appendChild(textContent); textBox.style.display = 'block';
      } else {
        textBox.style.display = 'none';
      }

      ov.style.display = 'flex';
    }

    // expose for safety/debug
    window.showGalleryForNode = showGalleryForNode;
    window.pageKey = pageKey; window.hostOf = hostOf; window.canon = canon;

    // ensure container + svg
    var root = d3.select("#chart");
    if (root.empty()) throw new Error("#chart element not found in DOM");
    var svg = root.select("svg");
    if (svg.empty()) svg = root.append("svg").attr("width", width).attr("height", height);

    // tiny smoke mark so you know SVG exists even if force fails later
    svg.append("circle").attr("cx", 12).attr("cy", 12).attr("r", 4);

    // --- normalize data ---
    var nodes = (spiderJson.nodes || []).slice();
    var linksRaw = spiderJson.links || [];

    var idToIndex = {};
    nodes.forEach(function (n, i) { idToIndex[n.id] = i; });

    var links = linksRaw.map(function (l) {
      var s = l.source, t = l.target;
      if (typeof s !== "number") s = (s in idToIndex) ? idToIndex[s] : +s;
      if (typeof t !== "number") t = (t in idToIndex) ? idToIndex[t] : +t;
      if (!isFinite(s) || !isFinite(t)) throw new Error("Malformed link: " + JSON.stringify(l));
      return { source: s, target: t, value: l.value || 1 };
    });

    // --- force layout (D3 v3 API) ---
    var force = d3.layout.force()
      .nodes(nodes)
      .links(links)
      .charge(-120)
      .linkDistance((width + height) / 4)
      .size([width, height])
      .start();

    // draw links
    var link = svg.selectAll("line.link")
      .data(links)
      .enter().append("line")
      .attr("class", "link")
      .style("stroke", "#999")
      .style("stroke-opacity", 0.6)
      .style("stroke-width", function (d) { return Math.sqrt(d.value || 1); });

    // ---- ring color lookup ----
    var heroColorByPage = window.heroColorByPage || {};
    function nodeBgColor(d) {
      var map = window.heroColorByPage || {};
      var u  = d.url || '';
      var uC = canon(u);
      var pk = urlToPageKey(u);

      // try: exact → canonical → pageKey → pageKey of canonical
      return map[u] || map[uC] || map[pk] || map[urlToPageKey(uC)] || null;
    }

    // Put near the top of force.js, after heroColorByPage is defined on window
    function normKey(u){
      try {
        var a = document.createElement('a');
        a.href = u;
        var host = (a.hostname || '').toLowerCase().replace(/^www\./,'');
        var path = (a.pathname || '/').replace(/\/+$/,''); // trim trailing slash
        return host + path; // scheme-agnostic
      } catch(e){
        return (u || '').toLowerCase().replace(/^https?:\/\//,'').replace(/\/+$/,'');
      }
    }

    // Rebuild a normalized map once
    var _heroColorNorm = (function(src){
      var out = {};
      src = src || {};
      Object.keys(src).forEach(function(k){ out[normKey(k)] = src[k]; });
      return out;
    })(window.heroColorByPage);

    // Use normalized key for lookups
    function nodeBgColor(d){
      return _heroColorNorm[normKey(d.url)] || null;
    }







    // === SEARCH BLAST UI + EFFECT ===
    (function setupSearchBlast(){
      // Create a tiny search UI if it isn't already there
      if (!document.getElementById('search-ui')) {
        var box = document.createElement('div'); box.id = 'search-ui';
        box.innerHTML = '<input id="search-term" placeholder="find in URL… (enter to blast)" />'
                      + '<button class="go">Blast</button>'
                      + '<button class="clear">Clear</button>';
        document.body.appendChild(box);
        box.querySelector('.go').onclick = function(){ doBlast(box.querySelector('#search-term').value); };
        box.querySelector('.clear').onclick = function(){ doBlast(""); };
        box.querySelector('#search-term').addEventListener('keydown', function(e){
          if (e.key === 'Enter') doBlast(this.value);
        });
      }

      var activeTimer = null;

      // normalize: spaces and underscores are equivalent
      function norm(s){
        return (s || "")
          .toLowerCase()
          .replace(/[\s_\-–—]+/g, " ")  // space, underscore, hyphen, en/em-dash → space
          .trim();
      }
      // compact: remove spaces so "something like_this" → "somethinglikethis"
      function compact(s){
        return norm(s).replace(/\s+/g, "");
      }

      function clearBlast() {
        if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
        node.classed('search-crazy', false)
            .attr('r', function(d){ return d.__r0 || +d3.select(this).attr('r'); });
      }

      function doBlast(rawTerm, durationMs) {
        clearBlast();

        var termSoft = norm(rawTerm);       // spaces == underscores
        var termCompact = compact(rawTerm); // also match smashed form
        if (!termSoft && !termCompact) return;

        var matches = node.filter(function(d){
          if (!d.url) return false;
          var uSoft = norm(d.url);
          if (termSoft && uSoft.indexOf(termSoft) !== -1) return true;
          var uCompact = compact(d.url);
          return termCompact && uCompact.indexOf(termCompact) !== -1;
        });

        if (matches.empty()) {
          try {
            var el = document.getElementById('search-term');
            el.style.borderColor = '#ff004d';
            setTimeout(function(){ el.style.borderColor = 'rgba(255,255,255,.25)'; }, 500);
          } catch(e){}
          return;
        }

        // Remember original radius so we can restore later
        node.each(function(d){
          if (!d.__r0) d.__r0 = +d3.select(this).attr('r') || 5;
        });

        // Bring matches to front and add crazy class
        matches.each(function(){ this.parentNode.appendChild(this); })
               .classed('search-crazy', true);

        // Hype the size with a sine pulse for ~5s
        var endAt = Date.now() + (durationMs || 5000);
        activeTimer = setInterval(function(){
          var now = Date.now();
          var t = now * 0.02;                     // speed
          var scale = 1.0 + 0.75 * Math.abs(Math.sin(t));
          matches.attr('r', function(d){ return d.__r0 * scale; });

          if (now >= endAt) {
            clearBlast();
          }
        }, 60);
      }

      // Expose helpers
      window.searchBlast = doBlast;           // programmatic: searchBlast("wikipedia")
      window.clearSearchBlast = clearBlast;   // programmatic clear
    })();















        // ----- HIGH-CONTRAST NODE FILL (hash-based, no d3-scale needed) -----
    var nodeFill = (function () {
      // Options: 'hash-rainbow' | 'duotone' | 'mono' | 'highcat-no-bw'
      var COLOR_MODE = 'hash-rainbow';

      function clamp(x, a, b){ return x < a ? a : (x > b ? b : x); }
      function rgbToHex(r, g, b) {
        function to(v){ v = clamp(v|0, 0, 255); return ('0' + v.toString(16)).slice(-2); }
        return '#' + to(r) + to(g) + to(b);
      }
      function hsvToHex(h, s, v){ // h in [0,1]
        var i = Math.floor(h*6), f = h*6 - i;
        var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
        var m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
        return rgbToHex(m[0]*255, m[1]*255, m[2]*255);
      }
      function mixHex(a, b, t){
        function hx(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
        var A = hx(a), B = hx(b);
        return rgbToHex(A[0]*(1-t)+B[0]*t, A[1]*(1-t)+B[1]*t, A[2]*(1-t)+B[2]*t);
      }
      function strHash(s){ // fast, stable 32-bit hash
        var h = 2166136261>>>0;
        for (var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
        return h>>>0;
      }
      function keyOf(d){
        // use URL if possible; fall back to id or index-ish
        return (d && (d.url || String(d.id || 'unknown'))) + '';
      }

      // Palette without black/white (if you prefer discrete buckets)
      var HIGHCAT_NO_BW = [
        "#FF004D","#00E5FF","#FFBD00","#24FF00","#7C0BFF",
        "#FF00F5","#00FF85","#FF3D00","#0077FF","#9C27B0",
        "#FF6D00","#00C853"
      ];

      if (COLOR_MODE === 'hash-rainbow') {
        return function(d){
          var k = keyOf(d);
          var h = (strHash(k) % 360) / 360;   // evenly distributed hue
          var s = 0.95, v = 1.0;              // vivid
          return hsvToHex(h, s, v);
        };
      }

      if (COLOR_MODE === 'duotone') {
        // graphic: deep charcoal → punchy yellow
        return function(d){
          var k = keyOf(d), t = (strHash(k) % 1000)/1000;
          return mixHex("#111111", "#FFE500", t);
        };
      }

      if (COLOR_MODE === 'mono') {
        // minimal: deep → light gray
        return function(d){
          var k = keyOf(d), t = (strHash(k) % 1000)/1000;
          return mixHex("#111111", "#EEEEEE", t);
        };
      }

      if (COLOR_MODE === 'highcat-no-bw') {
        // discrete neon-ish buckets, no black/white
        return function(d){
          var k = keyOf(d);
          var idx = strHash(k) % HIGHCAT_NO_BW.length;
          return HIGHCAT_NO_BW[idx];
        };
      }

      // fallback
      return function(d){
        var k = keyOf(d), t = (strHash(k) % 1000)/1000;
        return hsvToHex(t, 1, 1);
      };
    })();


    // ---- draw nodes
    var node = svg.selectAll("circle.node")
      .data(nodes)
      .enter().append("circle")
      .attr("class", "node")
      .attr("r", function (d) { return (d.rank / 2) + 3; })
      .style("fill", nodeFill)
      .each(function (d) {
        var ring = nodeBgColor(d);
        if (ring) {
          d3.select(this)
            .classed("bg-ring", true)
            .classed("bg-pulse", true)   // remove this line if you don’t want pulsing
            .style("stroke", ring);
        } else {
          d3.select(this).style("stroke", "#999").style("stroke-width", 2);
        }
      })
      .on("dblclick", function (d) {
        window.__lastNode = d;
        showGalleryForNode(d);
        d3.event.stopPropagation();
      })
      .call(force.drag);

    node.append("title").text(function (d) { return d.url; });

    // ---- tick
    force.on("tick", function () {
      link.attr("x1", function (d) { return d.source.x; })
          .attr("y1", function (d) { return d.source.y; })
          .attr("x2", function (d) { return d.target.x; })
          .attr("y2", function (d) { return d.target.y; });

      node.attr("cx", function (d) { return d.x; })
          .attr("cy", function (d) { return d.y; });
    });

    console.log("[force.js] OK — nodes:", nodes.length, "links:", links.length);
    console.log("[force.js] Debug helpers: __lastNode, pageKey(), hostOf(), canon()");
    console.log("[force.js] Enable text debug with: window.__debugText = true");
  } catch (e) {
    console.error("[force.js] fatal:", e);
    alert("force.js error: " + e.message);
  }
})();
