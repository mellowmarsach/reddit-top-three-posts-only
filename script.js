// ==UserScript==
// @name         Reddit Top 3
// @namespace    three-only
// @version      1.0
// @description  Links to the top 3 posts on your Best feed
// @match        https://www.reddit.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const COUNT = 3;
    let closeOverlay = null;
    const parser = new DOMParser();
    const decode = s => parser.parseFromString(s, 'text/html').documentElement.textContent;

    function collect() {
        const seen = new Set();
        const out = [];
        const add = (title, subreddit, url) => {
            if (!url || seen.has(url) || out.length >= COUNT) return;
            seen.add(url);
            out.push({title, subreddit, url});
        }

        document.querySelectorAll('shreddit-post').forEach(el => {
            if (el.closest('shreddit-ad-post') || el.hasAttribute('promoted')) return;

            const permalink = el.getAttribute('permalink');
            if (permalink) {
                const title = decode(el.getAttribute('post-title') || '');
                const match = permalink.match(/^\/r\/([^/]+)\//);
                const subreddit = match
                    ? 'r/' + match[1]
                    : (el.getAttribute('subreddit-prefixed-name') || '');
                add(title, subreddit, 'https://www.reddit.com' + permalink);
            }
        });

        // for compact layouts
        document.querySelectorAll('a[slot="full-post-link"]').forEach(a => {
            const match = a.pathname.match(/^\/r\/([^/]+)\//);
            add(
                a.textContent.trim(),
                match ? 'r/' + match[1] : '',
                a.href.split('?')[0]
            );
        });

        return out;
    }

    // reddit.com/best redirects to reddit.com, so the URL alone can't tell us
    // whether we're on the home feed. The shell exposes it as an attribute.
    function isFeedPage() {
        const app = document.querySelector('shreddit-app');
        if (app) return app.getAttribute('pagetype') === 'home';

        // shell hasn't mounted yet
        return location.pathname === '/' || location.pathname === '/best';
    }

    function render() {
        if (document.getElementById('three-only')) return;

        const deadline = Date.now() + 10000;
        const tick = () => {
            if (isFeedPage()) {
                const posts = collect();
                if (posts.length) return paint(posts);
            }
            if (Date.now() < deadline) setTimeout(tick, 400);
        };
        tick();
    }

    function paint(posts) {
        const host = document.createElement('div');
        host.id = 'three-only';
        host.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483647',
            'background:#0b1416', 'display:flex', 'align-items:center',
            'justify-content:center', 'padding:24px'
        ].join(';');
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `
        <style>
            .box{
                font:15px/1.6 system-ui,sans-serif;
                color:#d7dadc;
                width:min(640px,100%);
                max-height:85vh;
                overflow:auto
            }
            .head{
                display:flex;
                justify-content:space-between;
                align-items:center;
                opacity:.6;
                font-size:12px;
                text-transform:uppercase;
                letter-spacing:.05em;
                margin-bottom:20px
            }
            a{
                display:block;
                color:#4fbcff;
                text-decoration:none;
                padding:10px 0;
                border-bottom:1px solid #272729
            }
            .sub{
                opacity:.55;
                white-space:nowrap;
                font-size:90%
            }
        </style>
        <div class="box">
            <div class="head"><span>Top ${posts.length} on Best</span></div>
            <div id="list"></div>
        </div>`;

        const list = root.getElementById('list');
        posts.forEach(p => {
        const a = document.createElement('a');
        a.href = p.url;
        a.textContent = p.title || p.url;
        if (p.subreddit) {
            const sub = document.createElement('span');
            sub.className = 'sub';
            sub.textContent = ' · ' + p.subreddit;
            a.append(sub);
        }
        list.append(a);
        });

        // lock the page behind the overlay
        const html = document.documentElement;
        const prevOverflow = html.style.overflow;
        html.style.overflow = 'hidden';

        closeOverlay = () => {
            html.style.overflow = prevOverflow;
            host.remove();
            closeOverlay = null;
        };

        document.body.append(host);
    }

    render();

    // reddit navigates client-side, so re-check when the page changes
    let lastHref = location.href;
    setInterval(() => {
        const app = document.querySelector('shreddit-app');
        const overlay = document.getElementById('three-only');

        // left the home feed -> take the overlay down
        if (overlay && app && app.getAttribute('pagetype') !== 'home') {
            closeOverlay ? closeOverlay() : overlay.remove();
            return;
        }
        if (location.href !== lastHref) {
            lastHref = location.href;
            if (isFeedPage()) render();
        }
    }, 500);
})();